// ============================================================================
// RAZORPAY ORDER CREATION + FOUNDER ACCESS (HARDENED)
// Transaction-based single-use codes. Generic error messages. No info leaks.
// ============================================================================

import crypto from 'crypto';
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TIER_PRICES = {
  standard: 9900,
  reply: 14900,
};

const TIER_PRODUCTS = {
  standard: 'sealedvow_standard',
  reply: 'sealedvow_reply',
};

const ALLOWED_ORIGINS = [
  "https://www.sealedvow.com",
  "https://sealedvow.com",
  "https://sealedvow.vercel.app"
];

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// ── Firebase REST transaction via ETag conditional write ──
// RTDB REST API supports conditional requests with ETags.
// Read with ETag → write with If-Match → 412 if changed = retry.
// This prevents double-redemption under concurrent requests.

function buildUrl(path) {
  const base = process.env.FIREBASE_DB_URL;
  const secret = process.env.FIREBASE_DB_SECRET;
  if (secret) return `${base}/${path}.json?auth=${secret}`;
  return `${base}/${path}.json`;
}

async function founderTransaction(code) {
  const url = buildUrl(`founderCodes/${code}`);
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // 1. Read with ETag
    const readRes = await fetch(url, {
      method: 'GET',
      headers: { 'X-Firebase-ETag': 'true' },
    });

    if (!readRes.ok) return { valid: false };

    const etag = readRes.headers.get('etag');
    const data = await readRes.json();

    // 2. Validate
    if (!data) return { valid: false };
    if (!data.active) return { valid: false };
    if (data.used >= data.maxUses) return { valid: false };
    if (data.expiresAt && Date.now() > data.expiresAt) return { valid: false };

    // 3. Prepare update
    const updated = {
      ...data,
      used: data.used + 1,
      redeemedAt: Date.now(),
      active: (data.used + 1) >= data.maxUses ? false : data.active,
    };

    // 4. Conditional write with If-Match (ETag)
    const writeRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'if-match': etag,
      },
      body: JSON.stringify(updated),
    });

    if (writeRes.ok) {
      // Transaction succeeded
      return { valid: true, tier: data.tier || 'reply' };
    }

    if (writeRes.status === 412) {
      // ETag mismatch — another request modified first, retry
      console.warn(`[FounderCode] ETag conflict on attempt ${attempt + 1}, retrying...`);
      continue;
    }

    // Unexpected error
    return { valid: false };
  }

  // All retries exhausted — concurrent redemption won
  return { valid: false };
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── GLOBAL IP RATE LIMITING ──
  const RATE_LIMIT_WINDOW = 60;
  const MAX_REQUESTS = 5;

  try {
    const ip = getClientIP(req);
    const key = `payment_rate:${ip}`;
    const current = await kv.incr(key);

    if (current === 1) {
      await kv.expire(key, RATE_LIMIT_WINDOW);
    }

    if (current > MAX_REQUESTS) {
      return res.status(429).json({
        error: "Too many requests. Please wait a minute."
      });
    }
  } catch (kvError) {
    console.error("[PaymentRateLimit] KV unavailable:", kvError.message);
    return res.status(503).json({
      error: "Service temporarily unavailable. Please try again."
    });
  }

  const { tier = 'standard', founderCode } = req.body || {};

  // ════════════════════════════════════════════════════════════
  // PATH A: FOUNDER CODE
  // ════════════════════════════════════════════════════════════
  if (founderCode) {
    if (typeof founderCode !== 'string' || founderCode.trim().length === 0 || founderCode.trim().length > 50) {
      // ── FOUNDER CODE FAIL LIMITER ──
      try {
        const ip = getClientIP(req);
        const failKey = `founder_fail:${ip}`;
        const failCount = await kv.incr(failKey);

        if (failCount === 1) {
          await kv.expire(failKey, 3600);
        }

        if (failCount > 10) {
          return res.status(429).json({
            error: "Too many invalid founder code attempts."
          });
        }
      } catch (kvError) {
        console.error("[FounderFailLimit] KV unavailable:", kvError.message);
        return res.status(503).json({
          error: "Service temporarily unavailable."
        });
      }
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    const normalized = founderCode.trim().toUpperCase();
    const result = await founderTransaction(normalized);

    if (!result.valid) {
      // ── FOUNDER CODE FAIL LIMITER ──
      try {
        const ip = getClientIP(req);
        const failKey = `founder_fail:${ip}`;
        const failCount = await kv.incr(failKey);

        if (failCount === 1) {
          await kv.expire(failKey, 3600);
        }

        if (failCount > 10) {
          return res.status(429).json({
            error: "Too many invalid founder code attempts."
          });
        }
      } catch (kvError) {
        console.error("[FounderFailLimit] KV unavailable:", kvError.message);
        return res.status(503).json({
          error: "Service temporarily unavailable."
        });
      }
      // Generic error — never leak whether code exists, expired, or was used
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    console.log(`[FounderCode] ✓ ${normalized} redeemed`);

    // Generate a one-time token for verify-payment to consume.
    // This prevents frontend from faking paymentMode=founder without
    // having gone through server-side code validation first.
    const tokenBytes = crypto.randomBytes(16).toString('hex');
    const tokenUrl = buildUrl(`founderTokens/${tokenBytes}`);
    await fetch(tokenUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: result.tier,
        createdAt: Date.now(),
        consumed: false,
      }),
    });

    return res.status(200).json({
      founderApproved: true,
      tier: result.tier,
      founderToken: tokenBytes,
    });
  }

  // ════════════════════════════════════════════════════════════
  // PATH B: NORMAL RAZORPAY FLOW
  // ════════════════════════════════════════════════════════════
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const firebaseDbUrl = process.env.FIREBASE_DB_URL;
  const firebaseDbSecret = process.env.FIREBASE_DB_SECRET;

  if (!keyId || !keySecret) {
    console.error('[Razorpay] Missing credentials');
    return res.status(500).json({ error: 'Payment configuration error.' });
  }

  const validTier = TIER_PRICES[tier] ? tier : 'standard';
  const amount = TIER_PRICES[validTier];
  const product = TIER_PRODUCTS[validTier];

  try {
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        notes: { product, tier: validTier },
      }),
    });

    if (!orderResponse.ok) {
      const errData = await orderResponse.json().catch(() => ({}));
      console.error('[Razorpay] Order creation failed:', errData);
      return res.status(502).json({ error: 'Failed to create payment order.' });
    }

    const order = await orderResponse.json();

    if (firebaseDbUrl) {
      try {
        const url = firebaseDbSecret
          ? `${firebaseDbUrl}/orders/${order.id}.json?auth=${firebaseDbSecret}`
          : `${firebaseDbUrl}/orders/${order.id}.json`;

        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            tier: validTier,
            currency: 'INR',
            status: 'created',
            createdAt: new Date().toISOString(),
          }),
        });
      } catch (dbErr) {
        console.error('[Razorpay] Failed to persist order:', dbErr);
      }
    }

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });

  } catch (error) {
    console.error('[Razorpay] Order error:', error);
    return res.status(500).json({ error: 'Payment system error.' });
  }
}