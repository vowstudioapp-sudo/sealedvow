// ============================================================================
// /api/test-email.js — TEMPORARY Resend integration smoke-test endpoint
//
// Sends a single test email to a hardcoded recipient and returns a JSON
// success/failure result. Intended for verifying the Resend pipeline only;
// REMOVE OR GATE before production launch (no auth on this endpoint
// beyond IP-based rate limiting).
//
// Usage:
//   POST /api/test-email          → uses default hardcoded recipient
//   POST /api/test-email          (body: {"to": "you@example.com"})
//                                 → optional override of recipient
// ============================================================================

import { guardPost, rateLimit, getClientIP } from './lib/middleware.js';
import { sendEmail } from '../lib/email/sendEmail.js';

// Default test recipient. Override per-request via JSON body { "to": "..." }.
// (Matches the user's email surfaced in the Claude Code project context.)
const DEFAULT_TEST_RECIPIENT = 'ajmal.fahad@gmail.com';

const TEST_SUBJECT = 'Your message has been sealed.';

// ── Premium dark-editorial brand-voice email template ────────────────────────
function buildTestHtml(recipientLabel) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Your message has been sealed.</title>
</head>
<body style="margin:0;padding:0;background:#120A16;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#120A16;padding:48px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#1A1220;border:1px solid rgba(212,175,55,0.18);">
          <tr>
            <td style="padding:48px 40px 16px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.12);">
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#E7D9B7;">Sealed Vow</p>
            </td>
          </tr>
          <tr>
            <td style="padding:48px 40px 16px;text-align:center;">
              <h1 style="margin:0 0 24px;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-style:italic;font-weight:300;line-height:1.35;letter-spacing:0.02em;color:rgba(242,232,213,0.92);">
                Your message has been sealed.
              </h1>
              <p style="margin:0 0 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:rgba(207,198,178,0.78);">
                It now waits for the person you wrote it for.
              </p>
              <p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:rgba(207,198,178,0.78);">
                You will know when they open it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 48px;text-align:center;">
              <p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(207,198,178,0.55);">
                — Sealed Vow
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:rgba(207,198,178,0.42);">
          Private by design. Nothing public. Ever.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildTestText() {
  return [
    'Your message has been sealed.',
    '',
    'It now waits for the person you wrote it for.',
    'You will know when they open it.',
    '',
    '— Sealed Vow',
    'Private by design. Nothing public. Ever.',
  ].join('\n');
}

export default async function handler(req, res) {
  // Method + content-type guard. guardPost handles OPTIONS preflight + CORS.
  if (!guardPost(req, res)) return;

  // IP-based rate limit — keep the test endpoint cheap to leave open during
  // verification but unable to be hammered. Soft-fails if Redis is down
  // (intentional behavior in middleware).
  const ip = getClientIP(req);
  const limit = await rateLimit(`test-email:${ip}`, 5, 60); // 5 per minute
  if (limit.limited) {
    res.status(429).json({
      ok: false,
      error: 'Rate limit exceeded for /api/test-email',
    });
    return;
  }

  // Optional recipient override from JSON body.
  let recipient = DEFAULT_TEST_RECIPIENT;
  try {
    const body = req.body || {};
    if (typeof body.to === 'string' && body.to.includes('@')) {
      recipient = body.to.trim();
    }
  } catch {
    // Body parsing handled by guardPost (JSON content-type enforced).
    // Any unexpected shape just falls back to the default recipient.
  }

  const result = await sendEmail({
    to: recipient,
    subject: TEST_SUBJECT,
    html: buildTestHtml(recipient),
    text: buildTestText(),
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
    subject: TEST_SUBJECT,
  });
}
