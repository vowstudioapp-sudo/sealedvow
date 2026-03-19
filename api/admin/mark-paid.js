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
  // ✅ METHOD CHECK
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ AUTH CHECK
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { claimId, utr_number, notes } = req.body;

  if (!claimId) {
    return res.status(400).json({ error: 'Missing claimId' });
  }

  try {
    const claimRef = db.ref(`eidiClaims/${claimId}`);
    const snap = await claimRef.once('value');

    // ✅ EXISTENCE CHECK
    if (!snap.exists()) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (typeof utr_number !== 'string' || !utr_number.trim()) {
      return res.status(400).json({ error: 'UTR number is required' });
    }

    const now = new Date().toISOString();
    const adminId = 'admin';

    const result = await claimRef.transaction((current) => {
      if (!current) return current;

      const currentStatus = String(current.status || 'pending').toLowerCase();
      const normalized =
        currentStatus === 'paid' || currentStatus === 'settled'
          ? 'settled'
          : currentStatus;

      if (normalized === 'settled') return current;
      // Allow correcting a previously failed claim by settling it now.
      if (normalized !== 'pending' && normalized !== 'failed') return current;

      const existingLog = Array.isArray(current.action_log) ? current.action_log : [];

      return {
        ...current,
        status: 'settled',
        settled_at: now,
        settled_by: adminId,
        utr_number: utr_number.trim(),
        notes: typeof notes === 'string' ? notes : current.notes || '',
        paidAt: now, // backwards compatibility with older UI/data
        failed_at: null,
        failed_reason: null,
        action_log: [
          ...existingLog,
          {
            action: 'settled',
            timestamp: now,
            admin: adminId,
            utr_number: utr_number.trim(),
          }
        ]
      };
    });

    if (!result.committed) {
      const current = (await claimRef.once('value')).val() || {};
      const currentStatus = String(current.status || 'pending').toLowerCase();
      if (currentStatus === 'paid' || currentStatus === 'settled') {
        return res.status(400).json({ error: 'Claim already settled' });
      }
      if (currentStatus === 'failed') {
        return res.status(400).json({ error: 'Could not settle this failed claim' });
      }
      return res.status(400).json({ error: 'Could not settle claim' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('MARK PAID ERROR:', err);

    return res.status(500).json({
      error: 'Failed to mark as paid'
    });
  }
}