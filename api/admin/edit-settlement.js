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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
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

