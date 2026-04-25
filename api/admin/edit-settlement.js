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

  const { claimId, utr_number, notes } = req.body || {};
  if (!claimId) return res.status(400).json({ error: 'Missing claimId' });
  if (typeof utr_number !== 'string' || !utr_number.trim()) {
    return res.status(400).json({ error: 'UTR number is required' });
  }

  try {
    const claimRef = db.ref(`eidiClaims/${claimId}`);
    const snap = await claimRef.once('value');
    if (!snap.exists()) return res.status(404).json({ error: 'Claim not found' });

    const now = new Date().toISOString();
    const adminId = 'admin';

    const result = await claimRef.transaction((current) => {
      if (!current) return current;

      const currentStatus = String(current.status || 'pending').toLowerCase();
      const normalized = currentStatus === 'paid' ? 'settled' : currentStatus;

      if (normalized !== 'settled') return current;

      const existingLog = Array.isArray(current.action_log) ? current.action_log : [];
      return {
        ...current,
        utr_number: utr_number.trim(),
        notes: typeof notes === 'string' ? notes : current.notes || null,
        action_log: [
          ...existingLog,
          {
            action: 'edit_settlement',
            timestamp: now,
            admin: adminId
          }
        ]
      };
    });

    if (!result.committed) {
      return res.status(400).json({ error: 'Could not edit settlement' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('EDIT SETTLEMENT ERROR:', err);
    return res.status(500).json({ error: 'Failed to edit settlement' });
  }
}

