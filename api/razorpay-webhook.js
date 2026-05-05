// ============================================================================
// /api/razorpay-webhook.js — Razorpay webhook receiver (log-only, idempotent)
//
// Verifies HMAC SHA-256 against RAZORPAY_WEBHOOK_SECRET, dedupes by
// x-razorpay-event-id, and appends to webhookEvents/{eventId}. Does NOT
// provision sessions — verify-payment owns that path because it has the
// user's coupleData. This handler exists for cross-checking and the daily
// reconciliation sweep.
// ============================================================================

import crypto from 'crypto';
import admin from 'firebase-admin';

// HMAC must be computed over the raw bytes Razorpay sent — re-serializing
// after JSON.parse changes whitespace/key order and breaks verification.
export const config = { api: { bodyParser: false } };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
}

const db = admin.database();

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!req.headers['content-type']?.includes('application/json')) {
      return res.status(415).json({ error: 'Unsupported Media Type' });
    }

    const rawBody = await readRawBody(req);

    if (rawBody.length === 0) {
      console.log('[Webhook] Empty body');
      return res.status(400).json({ error: 'Empty body' });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] Missing RAZORPAY_WEBHOOK_SECRET');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // ── HMAC SHA-256 over raw body, BEFORE any JSON parsing ──
    const providedSignature = req.headers['x-razorpay-signature'];
    if (!providedSignature || typeof providedSignature !== 'string') {
      console.warn('[Webhook] Invalid signature', { ip: getClientIp(req) });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    let isValid;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(providedSignature, 'hex'),
      );
    } catch {
      isValid = false;
    }

    if (!isValid) {
      console.warn('[Webhook] Invalid signature', { ip: getClientIp(req) });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // ── Signature good — safe to parse and inspect ──
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const eventId = req.headers['x-razorpay-event-id'];
    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'Missing event ID' });
    }

    // Field shape varies by event type — every access guarded with ?. so
    // the handler never crashes on a payload variant:
    //   payment.captured / payment.failed → payload.payment.entity
    //   order.paid                        → payload.order.entity
    //   refund.created                    → payload.refund.entity
    const paymentEntity = parsedPayload?.payload?.payment?.entity;
    const orderEntity = parsedPayload?.payload?.order?.entity;
    const refundEntity = parsedPayload?.payload?.refund?.entity;

    const event = parsedPayload?.event || null;
    const paymentId = paymentEntity?.id || refundEntity?.payment_id || null;
    const orderId = paymentEntity?.order_id || orderEntity?.id || null;
    const amount = paymentEntity?.amount ?? refundEntity?.amount ?? null;
    const status = paymentEntity?.status || null;

    console.log('[Webhook] Received', { eventId, event });

    // Razorpay retries any non-2xx with exponential backoff. The transaction
    // guarantees only one writer wins even if two retries arrive at once;
    // returning 200 on duplicate prevents retry storms.
    const ref = db.ref('webhookEvents/' + eventId);
    const txnResult = await ref.transaction(current => {
      if (current !== null) return; // already recorded — abort
      return {
        receivedAt: Date.now(),
        event,
        paymentId,
        orderId,
        amount,
        status,
        rawPayload: parsedPayload,
      };
    });

    if (!txnResult.committed) {
      console.log('[Webhook] Duplicate event, skipping', { eventId });
      return res.status(200).json({ ok: true, duplicate: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Webhook] CRITICAL: Unexpected error', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
