import crypto from 'crypto';
import { db } from '../lib/firebaseAdmin';

export default async function handler(req, res) {
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

  const rawFilter =
    typeof req.query?.filter === 'string' ? req.query.filter.toLowerCase() : 'pending';

  // Backwards compatibility: older UI used `paid` for settled.
  const filter =
    rawFilter === 'all' ||
    rawFilter === 'pending' ||
    rawFilter === 'paid' ||
    rawFilter === 'settled' ||
    rawFilter === 'failed'
      ? rawFilter
      : 'pending';

  const snap = await db.ref('eidiClaims').once('value');

  if (!snap.exists()) {
    return res.json({ claims: [], filter });
  }

  const all = snap.val() || {};

  const normalizeStatus = (c) => {
    const s = String(c?.status || 'pending').toLowerCase();
    if (s === 'paid') return 'settled';
    return s;
  };

  const rows = Object.values(all).filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return normalizeStatus(c) === 'pending';
    if (filter === 'failed') return normalizeStatus(c) === 'failed';
    // `paid` or `settled`
    return normalizeStatus(c) === 'settled';
  });

  const sorted = rows.sort(
    (a, b) =>
      new Date(a?.claimedAt || a?.createdAt || 0).getTime() -
      new Date(b?.claimedAt || b?.createdAt || 0).getTime()
  );

  return res.json({ claims: sorted, filter });
}