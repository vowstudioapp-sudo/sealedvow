// ============================================================================
// /api/drafts/save.js — Create or update a draft (authenticated mode).
//
// PR-49 C2 hotfix (LOCK-2): CAS plumbing retired. expectedRevision is no
// longer required or checked. STALE_REVISION / INVALID_REVISION response
// branches removed. Under dual-mode's single-writer-per-mode invariant (I7),
// concurrent-edit conflicts cannot occur — last-write-wins is the locked
// behavior. The `revision` field on the persisted record stays as an audit
// counter (LOCK-4): the server still increments it on each write.
//
// CREATE path (no draftId in request): .transaction() on the parent
// users/{uid}/drafts subtree — the single-ACTIVE check must read across all
// of the user's drafts inside one atomic boundary.
//
// UPDATE path (draftId in request): pre-fetch the specific draft via
// .once('value') to confirm existence, then .transaction() on that specific
// draft node. The pre-fetch warms the Admin SDK cache so the transaction's
// first callback invocation receives the actual server data (Phase 2.1 fix
// for the null-first-call quirk; preserved).
//
// Body:
//   { draftId?, data, step?, draftState?, persistenceStatus? }
//   * draftId absent  → CREATE. Server generates id via .push().key.
//   * draftId present → UPDATE. Server overwrites the existing record.
//
// Defaults:
//   * draftState         → 'IN_PROGRESS'
//   * persistenceStatus  → 'ACTIVE'
//
// Response (200):
//   { ok: true, draftId, revision, updatedAt }
//
// 409 rejections:
//   { error: 'ACTIVE_DRAFT_EXISTS', existingDraftId } — CREATE attempted
//     while user already has an ACTIVE draft. Defensive guard (LOCK-5).
//     After PR-49 C2 hotfix, client always passes draftId on subsequent
//     saves, so this should not trigger in normal flow.
//
// Other rejections:
//   401 Unauthorized
//   429 TOO_MANY_REQUESTS
//   400 (validation reasons from validateDraftWrite)
//   404 DRAFT_NOT_FOUND (UPDATE path with unknown draftId)
//   500 TRANSACTION_FAILED / WRITE_FAILED
//
// Single-ACTIVE rule: at most one draft per user with status === 'ACTIVE'.
// Enforced inside the transaction (re-queried at commit time).
// ============================================================================

import admin from 'firebase-admin';
import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';
import { validateDraftWrite } from '../lib/draftValidation.js';

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
    phase,
    draftState,
    persistenceStatus,
  } = req.body || {};

  const validation = validateDraftWrite({ data, step, phase, draftState, persistenceStatus });
  if (!validation.ok) {
    return res.status(400).json({ error: validation.reason });
  }

  const isUpdate = typeof incomingDraftId === 'string' && incomingDraftId.length > 0;

  const finalDraftState = draftState || 'IN_PROGRESS';
  const finalPersistenceStatus = persistenceStatus || 'ACTIVE';

  let abortReason = null;
  let txResult;
  let resultDraftId;

  if (isUpdate) {
    // UPDATE: scoped to the specific draft path. Pre-fetch warms the Admin
    // SDK cache so the transaction's first callback invocation receives the
    // actual server data (Phase 2.1 fix preserved).
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
          // Firebase Admin SDK null-first-call quirk: return preSnap.val()
          // to trigger compare-and-set retry so the callback re-runs with
          // authoritative server state.
          return preSnap.val();
        }

        // PR-49 C2 hotfix: no revision check. Last-write-wins. The server
        // increments the audit counter on every write.
        const storedRevision =
          typeof current.revision === 'number' ? current.revision : 1;
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
        // PR-49 Phase 1 QA: Step-2 inner phase. Same persistence shape as
        // step — preserve current value when request omits it so the field
        // doesn't get wiped on saves that don't include it.
        if (phase === 1 || phase === 2 || phase === 3) {
          updated.phase = phase;
        } else if (current.phase === 1 || current.phase === 2 || current.phase === 3) {
          updated.phase = current.phase;
        }
        return updated;
      });
    } catch (err) {
      console.error('[drafts/save] Update transaction threw:', err?.message ?? err);
      return res.status(500).json({ error: 'TRANSACTION_FAILED' });
    }
  } else {
    // CREATE: scoped to the parent users/{uid}/drafts path so the
    // single-ACTIVE check reads across all of the user's drafts inside the
    // atomic boundary.
    const userDraftsRef = adminDb.ref(`users/${user.uid}/drafts`);
    const newDraftId = userDraftsRef.push().key;
    resultDraftId = newDraftId;

    try {
      txResult = await userDraftsRef.transaction((currentDrafts) => {
        abortReason = null;
        const drafts = currentDrafts || {};

        const allDrafts = Object.values(drafts).filter(Boolean);
        if (finalPersistenceStatus === 'ACTIVE') {
          const existingActive = allDrafts.find(
            (d) => d.persistenceStatus === 'ACTIVE',
          );
          if (existingActive) {
            // LOCK-5: defensive guard. After PR-49 C2 hotfix, the client
            // always passes draftId on subsequent saves; this fires only if
            // a CREATE comes in while the user already has an ACTIVE draft
            // (programmer error or stale client). Client receives the
            // existingDraftId and can retry as UPDATE.
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
        // PR-49 Phase 1 QA: Step-2 inner phase. Same persistence shape as step.
        if (phase === 1 || phase === 2 || phase === 3) {
          created.phase = phase;
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
