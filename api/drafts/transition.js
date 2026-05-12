// ============================================================================
// /api/drafts/transition.js — Move a draft's draftState forward (PR #18a;
// PR-48 Phase 3 refactor for revision-CAS protection).
//
// Body:    { draftId, draftState, expectedRevision }
// Success: 200 { ok: true, draftState, revision }
// No-op:   200 { ok: true, draftState, revision }  (same draftState; no
//          revision/updatedAt bump — preserves observer dwell-time semantics)
//
// Errors:
//   400 MISSING_FIELDS                — missing draftId, draftState, or expectedRevision
//   400 MISSING_EXPECTED_REVISION     — expectedRevision absent
//   400 INVALID_EXPECTED_REVISION_FORMAT
//   400 INVALID_DRAFT_STATE           — draftState not in enum
//   401 Unauthorized
//   404 DRAFT_NOT_FOUND
//   409 NON_MONOTONIC { current, requested }
//   409 STALE_REVISION { currentRevision, yourRevision }
//   429 TOO_MANY_REQUESTS
//   500 TRANSACTION_FAILED
//
// PR-48 Phase 3 refactor (D6):
//   * Switched from .update() to .transaction() on the specific draft path
//     so revision-CAS protection holds against concurrent observer fires
//     from multiple tabs/devices.
//   * Added expectedRevision to required request body. The client observer
//     tracks revision via Commit 3's hook changes.
//   * Preserved the existing monotonic guard (NON_MONOTONIC 409) and
//     same-state no-op behavior (no revision/updatedAt bump on dwell-time
//     re-fires).
//   * Per Stage 2 decision 2: expectedRevision > stored is NOT rejected;
//     the write proceeds and the client self-corrects from response.revision.
//     Only expectedRevision < stored triggers STALE_REVISION.
//
// The monotonic guard is enforced server-side here AND client-side in the
// observer hook. Both are required: the observer guard prevents spurious
// network calls; the server guard is the canonical invariant.
// ============================================================================

import admin from 'firebase-admin';
import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';
import {
  DRAFT_STATE_ORDER,
  isDraftState,
  validateExpectedRevision,
} from '../lib/draftValidation.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const user = await getSessionUser(req);
  if (!user?.uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Observer may legitimately fire often during cinematic flow; cap is higher
  // than save/list to accommodate dwell-time re-fires that the server then
  // resolves as no-ops (per same-state branch below).
  const { limited } = await rateLimit(req, {
    keyPrefix: 'drafts:transition',
    windowSeconds: 60,
    max: 60,
  });
  if (limited) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  }

  const { draftId, draftState: nextDraftState, expectedRevision } = req.body || {};

  if (!draftId || !nextDraftState) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }
  if (!isDraftState(nextDraftState)) {
    return res.status(400).json({ error: 'INVALID_DRAFT_STATE' });
  }

  const revisionCheck = validateExpectedRevision(expectedRevision, { required: true });
  if (!revisionCheck.ok) {
    return res.status(400).json({ error: revisionCheck.reason });
  }

  const draftRef = adminDb.ref(`users/${user.uid}/drafts/${draftId}`);
  const preSnap = await draftRef.once('value');

  if (!preSnap.exists()) {
    return res.status(404).json({ error: 'DRAFT_NOT_FOUND' });
  }
  const existing = preSnap.val();

  const currentIndex = DRAFT_STATE_ORDER[existing.draftState] ?? -1;
  const nextIndex = DRAFT_STATE_ORDER[nextDraftState];

  // Pre-fetch advisory monotonic check (fast 4xx). The transaction below
  // re-confirms inside the atomic boundary.
  if (nextIndex < currentIndex) {
    return res.status(409).json({
      error: 'NON_MONOTONIC',
      current: existing.draftState,
      requested: nextDraftState,
    });
  }

  // No-op on same state — preserves observer dwell-time semantics: same
  // UIStage milestone re-fires (e.g., PERSONAL_INTRO → QUESTION both map
  // to REFINED) should not bump revision or updatedAt.
  if (nextIndex === currentIndex) {
    return res.status(200).json({
      ok: true,
      draftState: existing.draftState,
      revision: typeof existing.revision === 'number' ? existing.revision : 1,
    });
  }

  let abortReason = null;
  let txResult;
  try {
    txResult = await draftRef.transaction((current) => {
      abortReason = null;

      if (current === null) {
        // Firebase Admin SDK null-first-call: returning preSnap.val() triggers
        // compare-and-set retry so the callback re-runs with authoritative
        // server state. Never return undefined here — that aborts without retry.
        return preSnap.val();
      }

      // Re-confirm monotonic guard inside the atomic boundary (defense vs
      // concurrent regression).
      const txCurrentIndex = DRAFT_STATE_ORDER[current.draftState] ?? -1;
      if (nextIndex < txCurrentIndex) {
        abortReason = {
          http: 409,
          body: {
            error: 'NON_MONOTONIC',
            current: current.draftState,
            requested: nextDraftState,
          },
        };
        return;
      }
      if (nextIndex === txCurrentIndex) {
        // Concurrent same-state write between pre-fetch and tx. Commit
        // unchanged; response below echoes current values.
        return current;
      }

      // Revision check. Per Stage 2 decision 2: only reject if client BEHIND
      // server (STALE_REVISION). Client AHEAD is allowed and self-corrects
      // from response.revision.
      const storedRevision =
        typeof current.revision === 'number' ? current.revision : 1;
      if (expectedRevision < storedRevision) {
        abortReason = {
          http: 409,
          body: {
            error: 'STALE_REVISION',
            currentRevision: storedRevision,
            yourRevision: expectedRevision,
          },
        };
        return;
      }

      // Apply transition: forward to nextDraftState, increment revision.
      return {
        ...current,
        draftState: nextDraftState,
        revision: storedRevision + 1,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      };
    });
  } catch (err) {
    console.error('[drafts/transition] Transaction threw:', err?.message ?? err);
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  if (!txResult.committed) {
    if (abortReason) {
      return res.status(abortReason.http).json(abortReason.body);
    }
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  // Read back to surface server-resolved revision (which may differ from
  // a same-state commit-unchanged case where revision wasn't bumped).
  const writtenSnap = await draftRef.once('value');
  const written = writtenSnap.val();

  return res.status(200).json({
    ok: true,
    draftState: written?.draftState ?? nextDraftState,
    revision: written?.revision ?? null,
  });
}
