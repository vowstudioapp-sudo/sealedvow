// ============================================================================
// /api/drafts/save.js — Create or update a draft (PR-48 Phase 2 / D4+D5)
//
// Auth required. All state validation occurs INSIDE a single RTDB
// .transaction() on the per-user drafts subtree (users/{uid}/drafts). This
// closes the pre-Phase-2 race where two concurrent saves could both pass a
// sequential .once() check and both commit. See doctrine §6.5 atomic
// transition rule, contract §5 ATR-3 / ATR-4, and diagnostic drift item D4.
//
// Body:
//   { draftId?, data, step?, draftState?, persistenceStatus?, expectedRevision? }
//   * draftId absent  → CREATE. Server generates id via .push().key. No
//                       expectedRevision required (revision starts at 1).
//   * draftId present → UPDATE. expectedRevision REQUIRED. Mismatch returns
//                       STALE_REVISION (stale) or INVALID_REVISION (ahead).
//
// Defaults:
//   * draftState         → 'IN_PROGRESS'
//   * persistenceStatus  → 'ACTIVE'
//
// Response (200):
//   { ok: true, draftId, revision, updatedAt }
//
// Atomic-transaction rejections (409):
//   { error: 'ACTIVE_DRAFT_EXISTS', existingDraftId }
//   { error: 'CAP_EXCEEDED', current, limit }
//   { error: 'STALE_REVISION', currentRevision, yourRevision }
//   { error: 'INVALID_REVISION', currentRevision, yourRevision }
//
// Other rejections:
//   401 Unauthorized
//   429 TOO_MANY_REQUESTS
//   400 (validation reasons from validateDraftWrite or expectedRevision check)
//   404 DRAFT_NOT_FOUND (UPDATE path with unknown draftId)
//   500 TRANSACTION_FAILED / WRITE_FAILED
//
// Cap rule: Count(ACTIVE) + Count(PAUSED) ≤ MAX_DRAFTS. ABANDONED unbounded.
// Single-ACTIVE rule: at most one draft per user with status === 'ACTIVE'.
// Both enforced inside the transaction (re-queried at commit time).
// ============================================================================

import admin from 'firebase-admin';
import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';
import {
  validateDraftWrite,
  validateExpectedRevision,
  MAX_DRAFTS,
} from '../lib/draftValidation.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const user = await getSessionUser(req);
  if (!user?.uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { limited } = await rateLimit(req, {
    keyPrefix: 'drafts:save',
    windowSeconds: 60,
    max: 30,
  });
  if (limited) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  }

  const {
    draftId: incomingDraftId,
    data,
    step,
    draftState,
    persistenceStatus,
    expectedRevision,
  } = req.body || {};

  const validation = validateDraftWrite({ data, step, draftState, persistenceStatus });
  if (!validation.ok) {
    return res.status(400).json({ error: validation.reason });
  }

  const isUpdate = typeof incomingDraftId === 'string' && incomingDraftId.length > 0;
  const revisionCheck = validateExpectedRevision(expectedRevision, { required: isUpdate });
  if (!revisionCheck.ok) {
    return res.status(400).json({ error: revisionCheck.reason });
  }

  const finalDraftState = draftState || 'IN_PROGRESS';
  const finalPersistenceStatus = persistenceStatus || 'ACTIVE';

  // Pre-generate the new draftId outside the transaction so the same key is
  // used regardless of how many retries the transaction callback performs.
  // .push().key is a pure pseudo-random ID generator; it does not write.
  const userDraftsRef = adminDb.ref(`users/${user.uid}/drafts`);
  const newDraftId = isUpdate ? incomingDraftId : userDraftsRef.push().key;

  // The transaction callback may be invoked multiple times under contention.
  // We capture the abort reason via a closure that the callback re-sets on
  // every entry; only the final committed/aborted state is read after.
  let abortReason = null;

  let txResult;
  try {
    txResult = await userDraftsRef.transaction((currentDrafts) => {
      abortReason = null;
      const drafts = currentDrafts || {};

      if (isUpdate) {
        // ATR-4: Save Draft (overwriting existing). Verify expectedRevision
        // inside the transaction; reject if mismatched.
        const existing = drafts[incomingDraftId];
        if (!existing) {
          abortReason = { http: 404, body: { error: 'DRAFT_NOT_FOUND' } };
          return; // abort
        }
        // Graceful retro-migration: pre-Phase-2 drafts without a revision
        // field are treated as revision = 1. First update increments to 2.
        const storedRevision =
          typeof existing.revision === 'number' ? existing.revision : 1;
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
        if (expectedRevision > storedRevision) {
          // Client claimed a revision the server has never issued. Hard bug
          // signal — surfaces to client per contract §6 client-policy note.
          abortReason = {
            http: 409,
            body: {
              error: 'INVALID_REVISION',
              currentRevision: storedRevision,
              yourRevision: expectedRevision,
            },
          };
          return;
        }
        // expectedRevision === storedRevision: apply update, increment.
        const updated = {
          draftId: incomingDraftId,
          userId: user.uid,
          data,
          draftState: finalDraftState,
          persistenceStatus: finalPersistenceStatus,
          revision: storedRevision + 1,
          createdAt: existing.createdAt ?? admin.database.ServerValue.TIMESTAMP,
          updatedAt: admin.database.ServerValue.TIMESTAMP,
        };
        if (step === 1 || step === 2 || step === 3) {
          updated.step = step;
        } else if (existing.step === 1 || existing.step === 2 || existing.step === 3) {
          updated.step = existing.step;
        }
        return { ...drafts, [incomingDraftId]: updated };
      }

      // ATR-3: Save Draft (creating new). Re-query authoritative count
      // INSIDE the transaction. Validation here is the canonical gate;
      // any pre-transaction check is advisory only.
      const allDrafts = Object.values(drafts).filter(Boolean);
      const nonAbandonedCount = allDrafts.filter(
        (d) => d.persistenceStatus !== 'ABANDONED',
      ).length;
      if (nonAbandonedCount >= MAX_DRAFTS) {
        abortReason = {
          http: 409,
          body: {
            error: 'CAP_EXCEEDED',
            current: nonAbandonedCount,
            limit: MAX_DRAFTS,
          },
        };
        return;
      }
      if (finalPersistenceStatus === 'ACTIVE') {
        const existingActive = allDrafts.find((d) => d.persistenceStatus === 'ACTIVE');
        if (existingActive) {
          abortReason = {
            http: 409,
            body: {
              error: 'ACTIVE_DRAFT_EXISTS',
              existingDraftId: existingActive.draftId,
            },
          };
          return;
        }
      }
      const created = {
        draftId: newDraftId,
        userId: user.uid,
        data,
        draftState: finalDraftState,
        persistenceStatus: finalPersistenceStatus,
        revision: 1,
        createdAt: admin.database.ServerValue.TIMESTAMP,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      };
      if (step === 1 || step === 2 || step === 3) {
        created.step = step;
      }
      return { ...drafts, [newDraftId]: created };
    });
  } catch (err) {
    console.error('[drafts/save] Transaction threw:', err?.message ?? err);
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  if (!txResult.committed) {
    if (abortReason) {
      return res.status(abortReason.http).json(abortReason.body);
    }
    // RTDB aborted the transaction without our intervention — typically
    // because the callback returned undefined too many times under
    // contention, or because of network. Treat as a write failure.
    return res.status(500).json({ error: 'TRANSACTION_FAILED' });
  }

  // Re-read the committed draft to surface server-resolved timestamps and
  // the new revision back to the client.
  const writtenSnap = await userDraftsRef.child(newDraftId).once('value');
  const written = writtenSnap.val();

  return res.status(200).json({
    ok: true,
    draftId: newDraftId,
    revision: written?.revision ?? null,
    updatedAt: written?.updatedAt ?? null,
  });
}
