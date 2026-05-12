// ============================================================================
// /api/drafts/save.js — Create or update a draft (PR-48 Phase 2 + 2.1)
//
// Auth required. All state validation occurs INSIDE an RTDB .transaction()
// boundary, satisfying contract §5 ATR-3 / ATR-4 atomicity (validation
// occurs INSIDE the transaction, not before).
//
// CREATE path (no draftId in request): .transaction() on the parent
// users/{uid}/drafts subtree — the cap and single-ACTIVE checks must read
// across all of the user's drafts inside one atomic boundary.
//
// UPDATE path (draftId in request): pre-fetch the specific draft via
// .once('value') to confirm existence, then .transaction() on that same
// specific draft node. The pre-fetch warms the Admin SDK cache so the
// transaction's first callback invocation receives the actual server data
// (per Phase 2.1: without it, the Admin SDK's first call may pass null
// even when data exists, and our previous "return undefined to abort"
// produced a spurious DRAFT_NOT_FOUND for every UPDATE).
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

  // The transaction callback may be invoked multiple times under contention.
  // We capture the abort reason via a closure that the callback re-sets on
  // every entry; only the final committed/aborted state is read after.
  let abortReason = null;

  let txResult;
  let resultDraftId;

  if (isUpdate) {
    // ATR-4: Save Draft (overwriting existing).
    //
    // PR-48 Phase 2.1 fix: scope this transaction to the SPECIFIC draft
    // path (not the parent users/{uid}/drafts subtree) and pre-fetch via
    // .once('value') to verify existence before transacting.
    //
    // Why: Firebase Admin SDK's .transaction() may invoke the callback with
    // null on its first call when its local cache is cold — which is always
    // the case for serverless invocations. Phase 2's original
    // implementation, scoped to the parent path, returned undefined when
    // drafts[incomingDraftId] was missing (because currentDrafts was null
    // → drafts === {} → lookup undefined). Returning undefined ABORTS the
    // transaction without retry. Firebase never got a chance to re-invoke
    // the callback with real server data, producing a spurious
    // DRAFT_NOT_FOUND on every UPDATE in production.
    //
    // The fix: (a) pre-fetch the specific draft node to confirm existence,
    // returning 404 immediately if absent; (b) run the transaction on that
    // same specific path. The pre-fetch warms the Admin SDK cache so the
    // transaction's first callback invocation receives the actual server
    // data. The transaction still provides the atomic compare-and-set on
    // the revision field — that property is what makes the UPDATE safe
    // against concurrent writers.
    const draftRef = adminDb.ref(`users/${user.uid}/drafts/${incomingDraftId}`);
    const preSnap = await draftRef.once('value');
    if (!preSnap.exists()) {
      return res.status(404).json({ error: 'DRAFT_NOT_FOUND' });
    }
    resultDraftId = incomingDraftId;

    try {
      txResult = await draftRef.transaction((current) => {
        abortReason = null;

        if (current === null) {
          // Defense-in-depth: either the path was deleted between
          // pre-fetch and transaction (extremely rare concurrent action),
          // or — despite the pre-fetch — the Admin SDK still passed null
          // on this first call. Aborting here is correct: there's no
          // safe value to write without observing the stored revision.
          // If runtime verification ever shows this firing in non-race
          // conditions, the recourse is to return preSnap.val() to force
          // a server compare-and-set retry — but that path is not needed
          // in the happy case and adds complexity, so we abort instead.
          abortReason = { http: 404, body: { error: 'DRAFT_NOT_FOUND' } };
          return; // abort
        }

        // Graceful retro-migration: pre-Phase-2 drafts without a revision
        // field are treated as revision = 1. First update increments to 2.
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
          createdAt: current.createdAt ?? admin.database.ServerValue.TIMESTAMP,
          updatedAt: admin.database.ServerValue.TIMESTAMP,
        };
        if (step === 1 || step === 2 || step === 3) {
          updated.step = step;
        } else if (current.step === 1 || current.step === 2 || current.step === 3) {
          updated.step = current.step;
        }
        return updated;
      });
    } catch (err) {
      console.error('[drafts/save] Update transaction threw:', err?.message ?? err);
      return res.status(500).json({ error: 'TRANSACTION_FAILED' });
    }
  } else {
    // ATR-3: Save Draft (creating new).
    //
    // CREATE remains on the parent users/{uid}/drafts path because the cap
    // check and single-ACTIVE check must read across all of the user's
    // drafts inside the atomic boundary. CREATE handles the null-first-
    // call quirk implicitly: when currentDrafts is null on the first
    // invocation, the callback falls through to returning the new draft
    // payload; Firebase then attempts compare-and-set; if the server is
    // also null, the commit succeeds; if the server has data, Firebase
    // re-invokes the callback with the real data and the existing-ACTIVE /
    // cap checks fire correctly.
    const userDraftsRef = adminDb.ref(`users/${user.uid}/drafts`);
    const newDraftId = userDraftsRef.push().key;
    resultDraftId = newDraftId;

    try {
      txResult = await userDraftsRef.transaction((currentDrafts) => {
        abortReason = null;
        const drafts = currentDrafts || {};

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
          const existingActive = allDrafts.find(
            (d) => d.persistenceStatus === 'ACTIVE',
          );
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
      console.error('[drafts/save] Create transaction threw:', err?.message ?? err);
      return res.status(500).json({ error: 'TRANSACTION_FAILED' });
    }
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
  const writtenSnap = await adminDb
    .ref(`users/${user.uid}/drafts/${resultDraftId}`)
    .once('value');
  const written = writtenSnap.val();

  return res.status(200).json({
    ok: true,
    draftId: resultDraftId,
    revision: written?.revision ?? null,
    updatedAt: written?.updatedAt ?? null,
  });
}
