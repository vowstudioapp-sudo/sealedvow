import crypto from 'crypto';
import { db } from '../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : '';

  const expected = Buffer.from(process.env.ADMIN_SECRET || '');
  const actual = Buffer.from(token);

  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { claimId } = req.body || {};
  if (!claimId) {
    return res.status(400).json({ error: 'Missing claimId' });
  }

  try {
    const claimRef = db.ref(`eidiClaims/${claimId}`);
    const snap = await claimRef.once('value');

    if (!snap.exists()) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const row = snap.val();
    const currentStatus = String(row?.status || 'pending').toLowerCase();
    const normalized =
      currentStatus === 'paid' || currentStatus === 'settled'
        ? 'settled'
        : currentStatus;

    if (normalized !== 'settled' && normalized !== 'failed') {
      return res.status(400).json({ error: 'Claim is not settled/failed' });
    }

    const now = new Date().toISOString();
    const adminId = 'admin';

    await claimRef.transaction((current) => {
      if (!current) return current;
      const cs = String(current.status || 'pending').toLowerCase();
      const ns = cs === 'paid' || cs === 'settled' ? 'settled' : cs;

      if (ns !== 'settled' && ns !== 'failed') return current;

      const existingLog = Array.isArray(current.action_log) ? current.action_log : [];

      return {
        ...current,
        status: 'pending',
        settled_at: null,
        settled_by: null,
        utr_number: null,
        notes: current.notes && typeof current.notes === 'string' ? current.notes : null,
        paidAt: null,
        failed_at: null,
        failed_reason: null,
        action_log: [
          ...existingLog,
          {
            action: ns === 'failed' ? 'reverted_failed_to_pending' : 'undo_settlement',
            timestamp: now,
            admin: adminId
          }
        ]
      };
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('REVERT CLAIM ERROR:', err);
    return res.status(500).json({ error: 'Failed to revert claim' });
  }
}
