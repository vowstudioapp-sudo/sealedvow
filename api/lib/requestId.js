// ============================================================================
// /api/lib/requestId.js — Correlation IDs (H1)
//
// Single 16-char hex ID per payment flow. Generated server-side at create-order,
// returned to client, propagated through verify-payment, stored on
// shared/{sessionKey}.requestId and payments/{paymentId}.requestId. Logged in
// every [Verify] / [Razorpay] line so an operator can grep one ID and see the
// entire creator → payment → provisioning journey.
// ============================================================================

import crypto from 'crypto';

export function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

export function extractRequestId(req) {
  const fromHeader = req.headers['x-request-id'];
  const fromBody = req.body?.requestId;
  if (typeof fromHeader === 'string' && /^[a-f0-9]{16}$/i.test(fromHeader)) return fromHeader;
  if (typeof fromBody === 'string' && /^[a-f0-9]{16}$/i.test(fromBody)) return fromBody;
  return null;
}
