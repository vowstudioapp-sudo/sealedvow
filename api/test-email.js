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

import { guardPost } from './lib/middleware.js';
import { sendLetterSealedEmail } from '../lib/email/sendEmail.js';

// Default recipient. Matches the user's email surfaced in project context.
const DEFAULT_TEST_RECIPIENT = 'ajmal.fahad@gmail.com';

// Obvious test stubs — NOT realistic values. Anyone glancing at a preview
// deploy email should immediately see these are non-production.
const STUB_SENDER_NAME = 'Test Sender';
const STUB_FORMATTED_AMOUNT = '₹0.00';
const STUB_PAYMENT_ID = 'test_payment_id';
const STUB_FORMATTED_DATE = 'Test Date';

// TEMPORARY: rate limiting bypassed for preview verification only.
// This endpoint will be removed or admin-gated before any production wiring.
// See PR-45 / PR-45.5 in branch history. Do not copy this pattern to other routes.
export default async function handler(req, res) {
  // Method + content-type guard. guardPost handles OPTIONS preflight + CORS.
  if (!guardPost(req, res)) return;

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
