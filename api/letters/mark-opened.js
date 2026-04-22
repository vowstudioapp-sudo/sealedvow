// ============================================================================
// /api/letters/mark-opened.js — RECEIVER OPEN BEACON
//
// Called by the client when the receiver opens the envelope. Idempotent:
// if openedAt is already set, does nothing. If the letter has a senderUid
// (i.e., was created by a logged-in sender), mirrors openedAt to the
// sender's dashboard entry in the same atomic update.
//
// Must remain uncached — this is a lifecycle write, not a read.
// ============================================================================

import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const { limited } = await rateLimit(req, {
    keyPrefix: 'mark_opened_rate',
    windowSeconds: 60,
    max: 30,
  });

  if (limited) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const { sessionKey } = req.body || {};

  if (!sessionKey || typeof sessionKey !== 'string' || !/^[a-z0-9]{8}$/.test(sessionKey)) {
    return res.status(400).json({ error: 'Invalid session key.' });
  }

  try {
    const snap = await adminDb.ref(`shared/${sessionKey}`).once('value');
    const shared = snap.val();
    if (!shared) {
      return res.status(404).json({ error: 'Not found.' });
    }

    // Idempotent — first open wins.
    if (shared.openedAt) {
      return res.status(200).json({ ok: true, alreadyOpened: true });
    }

    const now = Date.now();
    const updates = {};
    updates[`shared/${sessionKey}/openedAt`] = now;
    if (shared.senderUid) {
      updates[`users/${shared.senderUid}/letters/${sessionKey}/openedAt`] = now;
    }
    await adminDb.ref().update(updates);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[MarkOpened] Error:', err.message);
    return res.status(500).json({ error: 'Failed to mark opened.' });
  }
}
