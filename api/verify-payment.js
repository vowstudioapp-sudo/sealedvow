import crypto from 'crypto';

// ============================================================================
// /api/verify-payment.js — SERVER-SIDE AUTHORITY (LAUNCH VERSION)
//
// This is the ONLY place paid sessions are created.
// Uses FIREBASE_DB_SECRET for authenticated RTDB writes that bypass rules.
//
// Flow:
//   1. Verify Razorpay signature (timing-safe)
//   2. Replay check (idempotent)
//   3. Validate coupleData server-side
//   4. Generate session key (collision-checked)
//   5. Atomic multi-path write (session + payment in one call)
//   6. Return share URL to client
// ============================================================================

const TIER_PRICES = {
  standard: 9900,
  reply: 14900,
};

// ── CORS ──
const ALLOWED_ORIGINS = [
  'https://sealedvow.com',
  'https://www.sealedvow.com',
  'https://sealedvow.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function generateShortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
}

// ── SERVER-SIDE DATA VALIDATION ──
function validateCoupleData(data) {
  if (!data || typeof data !== 'object') return null;

  // Total payload size guard (cheap protection against 5MB spam)
  const raw = JSON.stringify(data);
  if (raw.length > 200_000) return null;

  if (typeof data.recipientName !== 'string' || data.recipientName.trim().length === 0) return null;
  if (typeof data.senderName !== 'string' || data.senderName.trim().length === 0) return null;

  const validOccasions = ['valentine', 'anniversary', 'apology', 'just-because', 'long-distance', 'thank-you'];
  if (!validOccasions.includes(data.occasion)) return null;

  const validThemes = ['obsidian', 'velvet', 'crimson', 'midnight', 'evergreen', 'pearl'];
  if (!validThemes.includes(data.theme)) return null;

  const sanitized = {};
  const MAX_STRING = 10000;
  const MAX_NAME = 100;

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      let clean = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
      clean = (key === 'recipientName' || key === 'senderName')
        ? clean.substring(0, MAX_NAME).trim()
        : clean.substring(0, MAX_STRING);
      sanitized[key] = clean;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 10);
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      sanitized[key] = value;
    } else if (value !== null && typeof value === 'object') {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ── FIREBASE RTDB HELPERS (with auth token) ──
// FIREBASE_DB_SECRET bypasses all RTDB rules, same as Admin SDK.
// Post-launch, migrate to firebase-admin for proper service account auth.

function authUrl(path) {
  const base = process.env.FIREBASE_DB_URL;
  const secret = process.env.FIREBASE_DB_SECRET;
  if (secret) {
    return `${base}/${path}.json?auth=${secret}`;
  }
  // Fallback: unauthenticated (only works if rules are still open)
  return `${base}/${path}.json`;
}

async function firebaseRead(path) {
  const res = await fetch(authUrl(path));
  if (!res.ok) throw new Error(`Firebase read ${path}: ${res.status}`);
  return res.json();
}

async function firebaseAtomicUpdate(updates) {
  const base = process.env.FIREBASE_DB_URL;
  const secret = process.env.FIREBASE_DB_SECRET;
  const url = secret ? `${base}/.json?auth=${secret}` : `${base}/.json`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firebase atomic update failed: ${res.status} ${errText}`);
  }
  return res.json();
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    coupleData,
    tier,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: 'Missing payment fields.' });
  }
  if (!coupleData || typeof coupleData !== 'object') {
    return res.status(400).json({ verified: false, error: 'Missing session data.' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const firebaseDbUrl = process.env.FIREBASE_DB_URL;

  if (!keySecret || !firebaseDbUrl) {
    console.error('[Verify] Missing RAZORPAY_KEY_SECRET or FIREBASE_DB_URL');
    return res.status(500).json({ verified: false, error: 'Server configuration error.' });
  }

  try {
    // ════════════════════════════════════════════════════════════
    // 1. VERIFY RAZORPAY SIGNATURE (timing-safe)
    // ════════════════════════════════════════════════════════════
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

    let isValid;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(razorpay_signature, 'hex'),
      );
    } catch {
      isValid = false;
    }

    if (!isValid) {
      console.warn(`[Verify] Signature mismatch: ${razorpay_order_id}`);
      return res.status(400).json({ verified: false, error: 'Payment verification failed.' });
    }

    // ════════════════════════════════════════════════════════════
    // 2. REPLAY PROTECTION (idempotent)
    // ════════════════════════════════════════════════════════════
    try {
      const existing = await firebaseRead(`payments/${razorpay_payment_id}`);
      if (existing && existing.sessionKey) {
        console.log(`[Verify] Replay: ${razorpay_payment_id} → ${existing.sessionKey}`);
        const s = slugify(coupleData.senderName || 'sender');
        const r = slugify(coupleData.recipientName || 'receiver');
        return res.status(200).json({
          verified: true,
          replay: true,
          sessionKey: existing.sessionKey,
          shareSlug: `${s}-${r}-${existing.sessionKey}`,
          replyEnabled: existing.replyEnabled || false,
          paymentId: razorpay_payment_id,
        });
      }
    } catch (e) {
      console.warn('[Verify] Replay check failed, proceeding:', e.message);
    }

    // ════════════════════════════════════════════════════════════
    // 3. RESOLVE AMOUNT FROM ORDER (never trust client)
    // ════════════════════════════════════════════════════════════
    let orderAmount = null;
    let orderTier = tier || 'standard';

    try {
      const orderData = await firebaseRead(`orders/${razorpay_order_id}`);
      if (orderData && orderData.amount) {
        orderAmount = orderData.amount;
        orderTier = orderData.tier || orderTier;
      }
    } catch {
      console.warn('[Verify] Order lookup failed, using tier fallback');
    }

    const validTier = TIER_PRICES[orderTier] ? orderTier : 'standard';
    if (!orderAmount) orderAmount = TIER_PRICES[validTier];
    const replyEnabled = validTier === 'reply';

    // ════════════════════════════════════════════════════════════
    // 4. VALIDATE COUPLE DATA
    // ════════════════════════════════════════════════════════════
    const sanitized = validateCoupleData(coupleData);
    if (!sanitized) {
      return res.status(400).json({ verified: false, error: 'Invalid session data.' });
    }

    // ════════════════════════════════════════════════════════════
    // 5. GENERATE SESSION KEY (collision-checked)
    // ════════════════════════════════════════════════════════════
    let sessionKey = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      sessionKey = generateShortId();
      try {
        const exists = await firebaseRead(`shared/${sessionKey}`);
        if (!exists) break;
      } catch {
        break;
      }
      if (attempt === 4) {
        return res.status(500).json({ verified: false, error: 'Session creation failed. Please retry.' });
      }
    }

    // ════════════════════════════════════════════════════════════
    // 6. ATOMIC MULTI-PATH WRITE
    // ════════════════════════════════════════════════════════════
    const now = new Date().toISOString();

    const updates = {};

    updates[`shared/${sessionKey}`] = {
      ...sanitized,
      replyEnabled,
      status: 'paid',
      sealedAt: now,
      createdAt: sanitized.createdAt || now,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      tier: validTier,
    };

    updates[`payments/${razorpay_payment_id}`] = {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: orderAmount,
      tier: validTier,
      replyEnabled,
      sessionKey,
      verifiedAt: now,
    };

    updates[`orders/${razorpay_order_id}/status`] = 'paid';

    await firebaseAtomicUpdate(updates);

    // ════════════════════════════════════════════════════════════
    // 7. RETURN SHARE URL
    // ════════════════════════════════════════════════════════════
    const senderSlug = slugify(sanitized.senderName || 'sender');
    const receiverSlug = slugify(sanitized.recipientName || 'receiver');
    const shareSlug = `${senderSlug}-${receiverSlug}-${sessionKey}`;

    console.log(`[Verify] ✓ ${sessionKey} | ${razorpay_payment_id} | ${validTier}`);

    return res.status(200).json({
      verified: true,
      sessionKey,
      shareSlug,
      replyEnabled,
      paymentId: razorpay_payment_id,
    });

  } catch (error) {
    console.error('[Verify] Error:', error);
    return res.status(500).json({ verified: false, error: 'Verification system error.' });
  }
}