// ============================================================================
// RAZORPAY ORDER CREATION + FOUNDER ACCESS (HARDENED)
// Transaction-based single-use codes. Generic error messages. No info leaks.
// ============================================================================

import crypto from 'crypto';
import { adminDb, kv, guardPost, getClientIP, rateLimit } from './lib/middleware.js';

const TIER_PRICES = {
  standard: 9900,
  reply: 14900,
};

const TIER_PRODUCTS = {
  standard: 'sealedvow_standard',
  reply: 'sealedvow_reply',
};

async function founderTransaction(code) {
  const ref = adminDb.ref('founderCodes/' + code);

  const result = await ref.transaction(current => {
    if (current === null) return current;
    if (!current.active) return;
    if (current.used >= current.maxUses) return;
    if (current.expiresAt && Date.now() > current.expiresAt) return;

    return {
      ...current,
      used: current.used + 1,
      redeemedAt: Date.now(),
      active: (current.used + 1) >= current.maxUses ? false : current.active,
    };
  });

  if (result.committed && result.snapshot.val()) {
    return { valid: true, tier: result.snapshot.val().tier || 'reply' };
  }

  return { valid: false };
}

// ── FOUNDER CODE FAIL LIMITER ──
async function trackFounderFail(req) {
  try {
    const ip = getClientIP(req);
    const failKey = `founder_fail:${ip}`;
    const failCount = await kv.incr(failKey);

    if (failCount === 1) {
      await kv.expire(failKey, 3600);
    }

    return failCount > 10;
  } catch (kvError) {
    console.error("[FounderFailLimit] KV unavailable:", kvError.message);
    // On Redis failure, don't block — degrade gracefully
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  // ── GLOBAL IP RATE LIMITING ──
  const { limited } = await rateLimit(req, {
    keyPrefix: 'payment_rate',
    windowSeconds: 60,
    max: 5,
  });

  if (limited) {
    return res.status(429).json({
      error: "Too many requests. Please wait a minute."
    });
  }

  let { tier = 'standard', founderCode } = req.body || {};

  // Input hygiene: ensure tier is always a string before validation
  if (typeof tier !== 'string') tier = 'standard';

  // ════════════════════════════════════════════════════════════
  // PATH A: FOUNDER CODE
  // ════════════════════════════════════════════════════════════
  if (founderCode) {
    if (typeof founderCode !== 'string' || founderCode.trim().length === 0 || founderCode.trim().length > 50) {
      const blocked = await trackFounderFail(req);
      if (blocked) {
        return res.status(429).json({ error: "Too many invalid founder code attempts." });
      }
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    const normalized = founderCode.trim().toUpperCase();
    const result = await founderTransaction(normalized);

    if (!result.valid) {
      const blocked = await trackFounderFail(req);
      if (blocked) {
        return res.status(429).json({ error: "Too many invalid founder code attempts." });
      }
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    console.log(`[FounderCode] ✓ ${normalized} redeemed`);

    // Generate a one-time token for verify-payment to consume.
    const tokenBytes = crypto.randomBytes(16).toString('hex');
    await adminDb.ref('founderTokens/' + tokenBytes).set({
      tier: result.tier,
      createdAt: Date.now(),
      consumed: false,
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

    // Persist order record BEFORE returning orderId to client.
      // verify-payment.js hard-depends on this record existing with amount + tier.
      // If this write fails, returning the orderId would create an unverifiable payment.
      try {
        await adminDb.ref('orders/' + order.id).set({
          amount,
          tier: validTier,
          currency: 'INR',
          status: 'created',
          createdAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.error('[Razorpay] CRITICAL: Failed to persist order record:', dbErr);
        // Order exists in Razorpay but not in our DB.
        // Do NOT return orderId — client cannot complete verification without it.
        // User has not been charged yet (order created ≠ payment captured).
        return res.status(500).json({ error: 'Order setup failed. Please retry.' });
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