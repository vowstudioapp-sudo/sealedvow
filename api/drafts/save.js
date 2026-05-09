// ============================================================================
// /api/drafts/save.js — Create or update a draft (PR #18a)
//
// Auth required. Single-ACTIVE-per-uid enforced server-side BEFORE the write.
//
// Body: { draftId?, data, step?, draftState?, persistenceStatus? }
//   - If draftId is present → update existing.
//   - If absent → create new (server generates draftId via push().key).
//   - draftState defaults to 'IN_PROGRESS'.
//   - persistenceStatus defaults to 'ACTIVE'.
//
// Response: { ok: true, draftId, updatedAt } or { error: 'CODE' }.
//
// Single-ACTIVE-per-uid is a hard invariant. Multiple non-ACTIVE drafts
// (PAUSED, ABANDONED) per uid are allowed and expected over time — they
// support 18c's conflict picker and 18d's reminder enumeration.
// ============================================================================

import admin from 'firebase-admin';
import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';
import { validateDraftWrite } from '../lib/draftValidation.js';

async function findActiveDraftForUser(uid) {
  const snap = await adminDb
    .ref(`users/${uid}/drafts`)
    .orderByChild('persistenceStatus')
    .equalTo('ACTIVE')
    .once('value');
  const drafts = snap.val() || {};
  const keys = Object.keys(drafts);
  if (keys.length === 0) return null;
  // Invariant guarantees ≤1; if a race produces more, the first wins.
  return drafts[keys[0]];
}

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

  const { draftId: incomingDraftId, data, step, draftState, persistenceStatus } = req.body || {};

  const validation = validateDraftWrite({ data, step, draftState, persistenceStatus });
  if (!validation.ok) {
    return res.status(400).json({ error: validation.reason });
  }

  const finalDraftState = draftState || 'IN_PROGRESS';
  const finalPersistenceStatus = persistenceStatus || 'ACTIVE';

  // Single-ACTIVE invariant — runs BEFORE write so the conflict response
  // can include existingDraftId for 18b/c routing.
  if (finalPersistenceStatus === 'ACTIVE') {
    const existingActive = await findActiveDraftForUser(user.uid);
    if (existingActive && existingActive.draftId !== incomingDraftId) {
      return res.status(409).json({
        error: 'ACTIVE_DRAFT_EXISTS',
        existingDraftId: existingActive.draftId,
      });
    }
  }

  const draftRef = incomingDraftId
    ? adminDb.ref(`users/${user.uid}/drafts/${incomingDraftId}`)
    : adminDb.ref(`users/${user.uid}/drafts`).push();
  const draftId = draftRef.key;

  // Preserve createdAt on update; set on create.
  const existingSnap = await draftRef.once('value');
  const existing = existingSnap.val();

  const doc = {
    draftId,
    userId: user.uid,
    data,
    draftState: finalDraftState,
    persistenceStatus: finalPersistenceStatus,
    createdAt: existing?.createdAt || admin.database.ServerValue.TIMESTAMP,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
  };
  if (step === 1 || step === 2 || step === 3) {
    doc.step = step;
  }

  try {
    await draftRef.set(doc);
  } catch (err) {
    console.error('[drafts/save] Write failed:', err.message);
    return res.status(500).json({ error: 'WRITE_FAILED' });
  }

  // Re-read to get resolved server timestamps for the response.
  const writtenSnap = await draftRef.once('value');
  const written = writtenSnap.val();

  return res.status(200).json({
    ok: true,
    draftId,
    updatedAt: written?.updatedAt ?? null,
  });
}
