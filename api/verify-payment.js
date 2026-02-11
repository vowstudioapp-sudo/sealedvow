import crypto from 'crypto';

// ============================================================================
// RAZORPAY PAYMENT VERIFICATION — HARDENED
// Signature → Replay check → Persist → Done
// ============================================================================

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowed = ['https://sealedvow.com', 'https://www.sealedvow.com', 'https://sealedvow.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  if (origin && (allowed.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, sessionKey } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: 'Missing verification fields.' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const firebaseDbUrl = process.env.FIREBASE_DB_URL;

  if (!keySecret) {
    console.error('[Razorpay] Missing RAZORPAY_KEY_SECRET');
    return res.status(500).json({ verified: false, error: 'Verification configuration error.' });
  }

  try {
    // STEP 1: Signature verification
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    if (!isValid) {
      console.warn(`[Razorpay] Signature mismatch: ${razorpay_order_id}`);
      return res.status(400).json({ verified: false, error: 'Verification failed.' });
    }

    // STEP 2: Replay protection
    if (firebaseDbUrl) {
      try {
        const existingRes = await fetch(`${firebaseDbUrl}/payments/${razorpay_payment_id}.json`);
        const existing = await existingRes.json();
        if (existing && existing.paymentId) {
          return res.status(200).json({ verified: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id, replay: true });
        }
      } catch {}
    }

    // STEP 3: Persist
    if (firebaseDbUrl) {
      try {
        await fetch(`${firebaseDbUrl}/payments/${razorpay_payment_id}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amount: 9900,
            sessionKey: sessionKey || null,
            verifiedAt: new Date().toISOString(),
          }),
        });

        await fetch(`${firebaseDbUrl}/orders/${razorpay_order_id}/status.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify('paid'),
        });
      } catch (dbErr) {
        console.error('[Razorpay] Persist failed:', dbErr);
      }
    }

    console.log(`[Razorpay] Verified: ${razorpay_payment_id}`);
    return res.status(200).json({ verified: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id });

  } catch (error) {
    console.error('[Razorpay] Verification error:', error);
    return res.status(500).json({ verified: false, error: 'Verification system error.' });
  }
}