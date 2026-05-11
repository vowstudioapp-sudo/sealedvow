// ============================================================================
// /api/test-email.js — TEMPORARY Resend integration smoke-test endpoint
//
// Sends the letter-sealed transactional email to a hardcoded recipient
// using OBVIOUS TEST STUBS for all dynamic fields, so preview verification
// can never be mistaken for a real receipt.
//
// Defaults can be overridden per-request via JSON body:
//   {
//     "to":              "you@example.com",
//     "senderName":      "Test Sender",
//     "formattedAmount": "₹0.00",
//     "paymentId":       "test_payment_id",
//     "formattedDate":   "Test Date"
//   }
//
// REMOVE OR GATE this endpoint before production launch — no auth beyond
// IP-based rate limiting.
// ============================================================================

import { guardPost, rateLimit, getClientIP } from './lib/middleware.js';
import { sendLetterSealedEmail } from '../lib/email/sendEmail.js';

// Default recipient. Matches the user's email surfaced in project context.
const DEFAULT_TEST_RECIPIENT = 'ajmal.fahad@gmail.com';

// Obvious test stubs — NOT realistic values. Anyone glancing at a preview
// deploy email should immediately see these are non-production.
const STUB_SENDER_NAME = 'Test Sender';
const STUB_FORMATTED_AMOUNT = '₹0.00';
const STUB_PAYMENT_ID = 'test_payment_id';
const STUB_FORMATTED_DATE = 'Test Date';

export default async function handler(req, res) {
  // Method + content-type guard. guardPost handles OPTIONS preflight + CORS.
  if (!guardPost(req, res)) return;

  // IP-based rate limit — keep test endpoint cheap to leave open during
  // verification but unable to be hammered. Soft-fails if Redis is down.
  const ip = getClientIP(req);
  const limit = await rateLimit(`test-email:${ip}`, 5, 60); // 5 per minute
  if (limit.limited) {
    res.status(429).json({
      ok: false,
      error: 'Rate limit exceeded for /api/test-email',
    });
    return;
  }

  // Optional per-request overrides from JSON body.
  const body = (req.body && typeof req.body === 'object') ? req.body : {};

  const recipient =
    (typeof body.to === 'string' && body.to.includes('@'))
      ? body.to.trim()
      : DEFAULT_TEST_RECIPIENT;

  const senderName =
    (typeof body.senderName === 'string' && body.senderName.trim())
      ? body.senderName.trim()
      : STUB_SENDER_NAME;

  const formattedAmount =
    (typeof body.formattedAmount === 'string' && body.formattedAmount.trim())
      ? body.formattedAmount.trim()
      : STUB_FORMATTED_AMOUNT;

  const paymentId =
    (typeof body.paymentId === 'string' && body.paymentId.trim())
      ? body.paymentId.trim()
      : STUB_PAYMENT_ID;

  const formattedDate =
    (typeof body.formattedDate === 'string' && body.formattedDate.trim())
      ? body.formattedDate.trim()
      : STUB_FORMATTED_DATE;

  const result = await sendLetterSealedEmail({
    to: recipient,
    senderName,
    formattedAmount,
    paymentId,
    formattedDate,
  });

  if (!result.ok) {
    res.status(500).json({
      ok: false,
      error: result.error,
      to: recipient,
    });
    return;
  }

  res.status(200).json({
    ok: true,
    id: result.id,
    to: recipient,
    subject: 'Your letter has been sealed.',
    stubsUsed: {
      senderName,
      formattedAmount,
      paymentId,
      formattedDate,
    },
  });
}
