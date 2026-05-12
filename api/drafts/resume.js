// ============================================================================
// /api/drafts/resume.js — Promote a PAUSED draft to ACTIVE with atomic demote
// of the prior ACTIVE (PR-48 Phase 3, ATR-1 per contract §5.1).
//
// Auth required. Two-draft atomic swap requires the transaction scope to be
// the PARENT users/{uid}/drafts subtree. Inside the transaction we promote
// the selected draft and demote the currently-ACTIVE one (if any) — both
// writes commit together or fail together.
//
// Per contract §5.1: revision check applies to the SELECTED draft only.
// The donor (currently-ACTIVE) is demoted without a client-supplied revision
// check; the user's intent is "make this PAUSED active", and whichever draft
// happens to be ACTIVE at commit time becomes the donor.
//
// Body:   { draftId, expectedRevision }   // selected draft only
// Success 200: {
//   ok: true,
//   promoted: { draftId, persistenceStatus: 'ACTIVE',  revision, updatedAt },
//   demoted:  { draftId, persistenceStatus: 'PAUSED',  revision, updatedAt } | null
// }
// No-op 200 (selected already ACTIVE): promoted echoes current, demoted: null.
// Errors:
//   400 MISSING_FIELDS / MISSING_EXPECTED_REVISION / INVALID_EXPECTED_REVISION_FORMAT
//   401 Unauthorized
//   404 DRAFT_NOT_FOUND
//   409 STALE_REVISION { currentRevision, yourRevision }   // on selected
//   409 ILLEGAL_STATUS_TRANSITION { from: 'ABANDONED', to: 'ACTIVE' }
//   429 TOO_MANY_REQUESTS
//   500 TRANSACTION_FAILED
//
// Per Stage 2 decision 2: expectedRevision > stored is NOT rejected.
// ============================================================================

import admin from 'firebase-admin';
import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';
import { validateExpectedRevision } from '../lib/draftValidation.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const user = await getSessionUser(req);
  if (!user?.uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { limited } = await rateLimit(req, {
    keyPrefix: 'drafts:resume',
    windowSeconds: 60,
    max: 30,
  });
  if (limited) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  }

  const { draftId, expectedRevision } = req.body || {};

  if (!draftId || typeof draftId !== 'string') {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  const revisionCheck = validateExpectedRevision(expectedRevision, { required: true });
  if (!revisionCheck.ok) {
    return res.status(400).json({ error: revisionCheck.reason });
  }

  // Pre-fetch the parent subtree (not just the selected draft) because the
  // atomic transaction needs to read both the selected draft (revision check)
  // and discover the donor (currently-ACTIVE) in a single boundary.
  const userDraftsRef = adminDb.ref(`users/${user.uid}/drafts`);
  const preSnap = await userDraftsRef.once('value');
  const preAll = preSnap.val() || {};
  const preSelected = preAll[draftId];

  if (!preSelected) {
    return res.status(404).json({ error: 'DRAFT_NOT_FOUND' });
  }

  // Pre-fetch advisory checks.
  if (preSelected.persistenceStatus === 'ABANDONED') {
    return res.status(409).json({
      error: 'ILLEGAL_STATUS_TRANSITION',
      from: 'ABANDONED',
      to: 'ACTIVE',
    });
  }
  if (preSelected.persistenceStatus === 'ACTIVE') {
    // Same-state no-op — selected is already ACTIVE; nothing to swap.
    return res.status(200).json({
      ok: true,
      promoted: {
        draftId,
        persistenceStatus: 'ACTIVE',
        revision: typeof preSelected.revision === 'number' ? preSelected.revision : 1,
        updatedAt: preSelected.updatedAt ?? null,
      },
      demoted: null,
    });
  }
  // Otherwise: preSelected.persistenceStatus === 'PAUSED'. Proceed to tx.

  let abortReason = null;
  // Capture the draftId of the donor that the committed transaction demoted
  // (if any), so the post-transaction read can build the response.
  let demotedDraftId = null;
  let txResult;

  try {
    txResult = await userDraftsRef.transaction((currentDrafts) => {
      abortReason = null;
      demotedDraftId = null;

      if (currentDrafts === null) {
        // Firebase Admin SDK null-first-call on the parent subtree: returning
        // preSnap.val() triggers compare-and-set retry so the callback
        // re-runs with authoritative server state for ALL drafts under this
        // user. Never return undefined here — that aborts without retry.
        return preSnap.val();
      }

      const drafts = currentDrafts;
      const selected = drafts[draftId];

      if (!selected) {
        abortReason = { http: 404, body: { error: 'DRAFT_NOT_FOUND' } };
        return;
      }

      if (selected.persistenceStatus === 'ABANDONED') {
        abortReason = {
          http: 409,
          body: { error: 'ILLEGAL_STATUS_TRANSITION', from: 'ABANDONED', to: 'ACTIVE' },
        };
        return;
      }
      if (selected.persistenceStatus === 'ACTIVE') {
        // Concurrent ACTIVE-promotion. Treat as success; the response below
        // will report no demote and the selected as ACTIVE.
        return currentDrafts;
      }
      // selected.persistenceStatus === 'PAUSED' from here.

      // Revision check on the SELECTED draft (per contract §5.1 step 1).
      const selectedStoredRevision =
        typeof selected.revision === 'number' ? selected.revision : 1;
      if (expectedRevision < selectedStoredRevision) {
        abortReason = {
          http: 409,
          body: {
            error: 'STALE_REVISION',
            currentRevision: selectedStoredRevision,
            yourRevision: expectedRevision,
          },
        };
        return;
      }

      // Discover donor (currently-ACTIVE, if any). No client-supplied
      // revision check on the donor — per contract §5.1 step 2 the donor
      // demotion is a side-effect of the resume operation.
      const donorEntry = Object.entries(drafts).find(
        ([key, d]) =>
          key !== draftId && d && d.persistenceStatus === 'ACTIVE',
      );

      const newDrafts = { ...drafts };

      if (donorEntry) {
        const [donorKey, donorDraft] = donorEntry;
        const donorStoredRevision =
          typeof donorDraft.revision === 'number' ? donorDraft.revision : 1;
        newDrafts[donorKey] = {
          ...donorDraft,
          persistenceStatus: 'PAUSED',
          revision: donorStoredRevision + 1,
          updatedAt: admin.database.ServerValue.TIMESTAMP,
        };
        demotedDraftId = donorKey;
      }

      newDrafts[draftId] = {
        ...selected,
        persistenceStatus: 'ACTIVE',
        revision: selectedStoredRevision + 1,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      };

      return newDrafts;
    });
  } catch (err) {
    console.error('[drafts/resume] Transaction threw:', err?.message ?? err);
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  if (!txResult.committed) {
    if (abortReason) {
      return res.status(abortReason.http).json(abortReason.body);
    }
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  // Read back to surface server-resolved updatedAt for both affected drafts.
  const promotedSnap = await userDraftsRef.child(draftId).once('value');
  const promoted = promotedSnap.val();

  let demoted = null;
  if (demotedDraftId) {
    const demotedSnap = await userDraftsRef.child(demotedDraftId).once('value');
    const demotedVal = demotedSnap.val();
    if (demotedVal) {
      demoted = {
        draftId: demotedDraftId,
        persistenceStatus: demotedVal.persistenceStatus ?? 'PAUSED',
        revision: demotedVal.revision ?? null,
        updatedAt: demotedVal.updatedAt ?? null,
      };
    }
  }

  return res.status(200).json({
    ok: true,
    promoted: {
      draftId,
      persistenceStatus: promoted?.persistenceStatus ?? 'ACTIVE',
      revision: promoted?.revision ?? null,
      updatedAt: promoted?.updatedAt ?? null,
    },
    demoted,
  });
}
