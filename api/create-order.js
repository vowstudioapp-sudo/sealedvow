// ============================================================================
// RAZORPAY ORDER CREATION — Tier-based pricing
// Tier is validated server-side. Amount determined by tier, never by frontend.
// ============================================================================

const TIER_PRICES = {
    standard: 9900,  // ₹99 in paise
    reply: 14900,    // ₹149 in paise
  };
  
  const TIER_PRODUCTS = {
    standard: 'sealedvow_standard',
    reply: 'sealedvow_reply',
  };
  
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
  
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const firebaseDbUrl = process.env.FIREBASE_DB_URL;
  
    if (!keyId || !keySecret) {
      console.error('[Razorpay] Missing credentials');
      return res.status(500).json({ error: 'Payment configuration error.' });
    }
  
    const { tier = 'standard' } = req.body || {};
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
          await fetch(`${firebaseDbUrl}/orders/${order.id}.json`, {
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