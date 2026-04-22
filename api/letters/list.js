// ============================================================================
// /api/letters/list.js — DASHBOARD LIST
//
// Returns every letter the authenticated user has sent. Joins
// users/{uid}/letters (lifecycle timestamps) with shared/{sessionKey}
// (display fields) and derives a status of 'sent' | 'opened' | 'replied'.
// ============================================================================

import { adminDb, guardPost } from '../lib/middleware.js';
import { getSessionUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const user = await getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const snap = await adminDb.ref(`users/${user.uid}/letters`).once('value');
    const entries = snap.val() || {};
    const sessionKeys = Object.keys(entries);

    const results = await Promise.all(
      sessionKeys.map(async (key) => {
        const entry = entries[key] || {};
        try {
          const sharedSnap = await adminDb.ref(`shared/${key}`).once('value');
          const shared = sharedSnap.val() || {};

          const openedAt = entry.openedAt || null;
          const repliedAt = entry.repliedAt || null;
          const status = repliedAt ? 'replied' : openedAt ? 'opened' : 'sent';

          return {
            sessionKey: key,
            recipientName: shared.recipientName || '—',
            occasion: shared.occasion || 'unknown',
            createdAt: entry.createdAt || null,
            openedAt,
            repliedAt,
            status,
          };
        } catch {
          return null;
        }
      })
    );

    const letters = results
      .filter((r) => r !== null)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.status(200).json({ letters });
  } catch (err) {
    console.error('[Letters/list] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load letters.' });
  }
}
