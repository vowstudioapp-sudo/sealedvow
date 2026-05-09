// ============================================================================
// /api/drafts/list.js — List the authenticated user's drafts (PR #18a)
//
// Returns ALL drafts (ACTIVE / PAUSED / ABANDONED), sorted by updatedAt desc.
// 18c filters / surfaces selectively. 18a deliberately does no filtering so
// the conflict picker (18c) and reminder enumeration (18d) have everything.
//
// Response: { ok: true, drafts: [...] } or { error: 'CODE' }.
// ============================================================================

import { adminDb, guardPost, rateLimit } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const user = await getSessionUser(req);
  if (!user?.uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { limited } = await rateLimit(req, {
    keyPrefix: 'drafts:list',
    windowSeconds: 60,
    max: 30,
  });
  if (limited) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
  }

  try {
    const snap = await adminDb.ref(`users/${user.uid}/drafts`).once('value');
    const drafts = snap.val() || {};
    const arr = Object.values(drafts).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    );
    return res.status(200).json({ ok: true, drafts: arr });
  } catch (err) {
    console.error('[drafts/list] Read failed:', err.message);
    return res.status(500).json({ error: 'READ_FAILED' });
  }
}
