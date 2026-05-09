// ============================================================================
// /api/drafts/transition.js — Move a draft's draftState forward (PR #18a)
//
// Body: { draftId, draftState }
// Response: { ok: true, draftState } or { error: 'CODE' }.
//
// Status codes:
//   200 + ok   — transition committed
//   200 + ok   — no-op (requested state equals current; no spurious updatedAt)
//   400        — MISSING_FIELDS / INVALID_DRAFT_STATE
//   401        — Unauthorized
//   404        — DRAFT_NOT_FOUND
//   409        — NON_MONOTONIC (requested state's index < current's index)
//
// The monotonic guard is enforced server-side here AND client-side in the
// observer hook. Both are required: the observer guard prevents spurious
// network calls; the server guard is the canonical invariant.
// ============================================================================

import admin from 'firebase-admin';
import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';
import { DRAFT_STATE_ORDER, isDraftState } from '../lib/draftValidation.js';

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

  const { draftId, draftState: nextDraftState } = req.body || {};

  if (!draftId || !nextDraftState) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }
  if (!isDraftState(nextDraftState)) {
    return res.status(400).json({ error: 'INVALID_DRAFT_STATE' });
  }

  const draftRef = adminDb.ref(`users/${user.uid}/drafts/${draftId}`);
  const snap = await draftRef.once('value');
  const existing = snap.val();

  if (!existing) {
    return res.status(404).json({ error: 'DRAFT_NOT_FOUND' });
  }

  const currentIndex = DRAFT_STATE_ORDER[existing.draftState] ?? -1;
  const nextIndex = DRAFT_STATE_ORDER[nextDraftState];

  // Monotonic guard
  if (nextIndex < currentIndex) {
    return res.status(409).json({
      error: 'NON_MONOTONIC',
      current: existing.draftState,
      requested: nextDraftState,
    });
  }

  // No-op on same state — avoids spurious updatedAt bumps from observer
  // dwell-time fires (e.g., PERSONAL_INTRO → QUESTION both map to REFINED).
  if (nextIndex === currentIndex) {
    return res.status(200).json({
      ok: true,
      draftState: existing.draftState,
    });
  }

  try {
    await draftRef.update({
      draftState: nextDraftState,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });
  } catch (err) {
    console.error('[drafts/transition] Write failed:', err.message);
    return res.status(500).json({ error: 'WRITE_FAILED' });
  }

  return res.status(200).json({ ok: true, draftState: nextDraftState });
}
