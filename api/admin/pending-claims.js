import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

const db = admin.database();

export default async function handler(req, res) {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
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