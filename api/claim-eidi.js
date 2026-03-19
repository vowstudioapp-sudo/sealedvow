import admin from 'firebase-admin';

/* =========================
   🔐 FIREBASE INIT
========================= */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
    }),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

const db = admin.database();
const CLAIM_EXPIRY_HOURS = 48;
const MAX_ATTEMPTS_PER_SESSION = 3;
const MAX_ATTEMPTS_PER_IP_PER_SESSION = 5;

function normalizePhone(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/^\+91/, '').replace(/\D/g, '').trim();
}

function toEpochMs(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  const first = typeof raw === 'string' ? raw.split(',')[0]?.trim() : '';
  return first || req.socket?.remoteAddress || 'unknown';
}

function ipToKey(ip) {
  return String(ip || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function normalizeEidiAmount(value) {
  if (value === null || value === undefined) return 0;
  const raw = typeof value === 'string' ? value : String(value);
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return 0;
  const parsed = parseInt(digits, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isSessionPaid(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.status === 'paid') return true;
  if (data.status === 'captured') return true;
  if (data.paymentStatus === 'captured') return true;
  if (data.paymentStatus === 'paid') return true;
  return false;
}

/* =========================
   🚀 HANDLER
========================= */
export default async function handler(req, res) {

  // ✅ FORCE CORS (no logic, no conditions)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sessionKey, upiId, phoneNumber } = req.body || {};

    // ✅ Basic validation
    if (!sessionKey || !upiId || !phoneNumber) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (!upiId.includes('@')) {
      return res.status(400).json({ error: "Invalid UPI" });
    }

    const cleanPhone = normalizePhone(phoneNumber);

    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      return res.status(400).json({ error: "Invalid phone" });
    }

    const sessionRef = db.ref(`shared/${sessionKey}`);
    const sessionSnap = await sessionRef.once('value');
    const sessionData = sessionSnap.val();

    if (!sessionData) {
      return res.status(404).json({ error: "Session not found" });
    }

    const sessionCreatedAtMs = toEpochMs(sessionData.sealedAt || sessionData.createdAt);
    if (!sessionCreatedAtMs) {
      return res.status(400).json({ error: "Invalid session timestamp" });
    }

    const expiryMs = CLAIM_EXPIRY_HOURS * 60 * 60 * 1000;
    if (Date.now() - sessionCreatedAtMs > expiryMs) {
      return res.status(410).json({ error: "Claim window expired" });
    }

    const expectedReceiverPhone = normalizePhone(
      sessionData.receiverPhone ||
      sessionData.receiverPhoneNumber ||
      sessionData.intendedReceiverPhone ||
      ''
    );

    if (expectedReceiverPhone && cleanPhone !== expectedReceiverPhone) {
      return res.status(403).json({ error: "Phone does not match intended receiver" });
    }

    const resolvedClaimAmount = normalizeEidiAmount(
      sessionData.eidiAmount ?? sessionData.timeShared
    );

    if (sessionData.eidiClaimed) {
      return res.status(400).json({ error: "Already claimed" });
    }

    // Only enforce occasion if it's present; legacy records may omit it.
    if (sessionData.occasion && sessionData.occasion !== 'eid') {
      return res.status(400).json({ error: "Invalid occasion" });
    }

    if (!isSessionPaid(sessionData)) {
      return res.status(400).json({ error: "Payment not captured" });
    }

    if (resolvedClaimAmount <= 0) {
      return res.status(400).json({ error: "Invalid Eidi amount" });
    }

    const clientIp = getClientIp(req);
    const ipKey = ipToKey(clientIp);
    const attemptsRef = db.ref(`claimAttempts/${sessionKey}`);

    const attemptsTxn = await attemptsRef.transaction((current) => {
      const curr = current || {};
      const ipAttempts = curr.ipAttempts || {};
      const totalAttempts = Number(curr.totalAttempts || 0);
      const currentIpAttempts = Number(ipAttempts[ipKey] || 0);

      if (totalAttempts >= MAX_ATTEMPTS_PER_SESSION) return;
      if (currentIpAttempts >= MAX_ATTEMPTS_PER_IP_PER_SESSION) return;

      return {
        ...curr,
        totalAttempts: totalAttempts + 1,
        lastAttemptAt: new Date().toISOString(),
        ipAttempts: {
          ...ipAttempts,
          [ipKey]: currentIpAttempts + 1
        }
      };
    });

    if (!attemptsTxn.committed) {
      return res.status(429).json({ error: "Too many claim attempts. Try later." });
    }

    const eidiClaimedRef = db.ref(`shared/${sessionKey}/eidiClaimed`);
    const lockResult = await eidiClaimedRef.transaction((current) => {
      if (current === true) return;
      return true;
    });

    if (!lockResult.committed) {
      const lockedSnap = await eidiClaimedRef.once('value');
      if (lockedSnap.val() === true) {
        return res.status(400).json({ error: "Already claimed" });
      }
      return res.status(400).json({ error: "Claim could not be processed" });
    }

    const claimRef = db.ref('eidiClaims').push();

    try {
      const nowIso = new Date().toISOString();
      await claimRef.set({
        claimId: claimRef.key,
        sessionKey,
        senderName: sessionData.senderName || '',
        recipientName: sessionData.recipientName || '',
        eidiAmount: resolvedClaimAmount,
        upiId: upiId.toLowerCase(),
        phoneNumber: cleanPhone,
        status: 'pending',
        claimedAt: nowIso,
        created_at: nowIso,
        settled_at: null,
        settled_by: null,
        utr_number: null,
        notes: null,
        failed_at: null,
        failed_reason: null,
        action_log: [
          {
            action: 'created',
            timestamp: nowIso,
            admin: 'system'
          }
        ]
      });

      await sessionRef.update({
        claimId: claimRef.key
      });
    } catch (persistErr) {
      console.error("CLAIM_PERSIST_ERROR:", persistErr);
      try {
        await eidiClaimedRef.remove();
      } catch (rollbackErr) {
        console.error("CLAIM_ROLLBACK_ERROR:", rollbackErr);
      }
      return res.status(500).json({ error: "Claim could not be saved. Try again." });
    }

    const senderDisplay =
      (typeof sessionData.senderName === 'string' && sessionData.senderName.trim()) ||
      (typeof sessionData.fromName === 'string' && sessionData.fromName.trim()) ||
      '';

    return res.status(200).json({
      success: true,
      claimId: claimRef.key,
      eidiAmount: resolvedClaimAmount,
      senderName: senderDisplay,
      recipientName:
        typeof sessionData.recipientName === 'string' ? sessionData.recipientName : ''
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}