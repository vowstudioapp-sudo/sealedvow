// ============================================================================
// /lib/email/sendEmail.js — Resend transactional email service
//
// Single source of truth for outbound transactional emails. Two layers:
//
//   1. sendEmail({ to, subject, html, text? }) — generic Resend primitive.
//      Currency-agnostic, content-agnostic. Pure transport.
//
//   2. Template builders + send wrappers, one per transactional surface.
//      Currently: buildLetterSealedEmail / sendLetterSealedEmail.
//      Future surfaces (letter-opened notification, founder-code redemption,
//      etc.) each get their own builder + send wrapper in this file.
//
// Brand vocabulary protected — Sealed Vow seals letters, it does NOT
// "send", "deliver", "secure", "save", or "prepare" them. The sender
// shares the resulting private link manually. Copy must reflect that.
//
// Currency formatting — handled UPSTREAM (verify-payment.js etc.).
// This file receives a pre-formatted display string like "₹399.00" or
// "$4.99". sendEmail.js stays currency-agnostic so future INR / USD /
// EUR / AED / GBP support requires no template changes.
//
// Env vars expected (set in Vercel; mirror in .env.local for vercel dev):
//   RESEND_API_KEY      — Resend secret key
//   RESEND_FROM_EMAIL   — sender, e.g. "Sealed Vow <seal@sealedvow.com>"
// ============================================================================

import { Resend } from 'resend';

// ── Brand constants ─────────────────────────────────────────────────────────
// These are the only static brand values in this file. Everything else
// (names, amounts, IDs, dates) comes in as runtime parameters.
export const BRAND_NAME = 'Sealed Vow';
export const BRAND_TAGLINE = 'Private by design. Nothing public. Ever.';

// ── Singleton Resend client ─────────────────────────────────────────────────
// Vercel serverless containers may handle multiple requests; instantiate once
// per cold-start, not per send.
let _resend = null;

function getClient() {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[email/sendEmail] RESEND_API_KEY is not set. ' +
      'Add it to Vercel env vars (and .env.local for local dev).'
    );
  }
  _resend = new Resend(apiKey);
  return _resend;
}

function getFromAddress() {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      '[email/sendEmail] RESEND_FROM_EMAIL is not set. ' +
      'Expected format: "Sealed Vow <seal@sealedvow.com>"'
    );
  }
  return from;
}

// ── HTML escape — used for any user-supplied value interpolated into HTML ──
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// LAYER 1 — Generic Resend primitive
// ============================================================================

/**
 * Send a transactional email via Resend.
 *
 * @param {object} opts
 * @param {string | string[]} opts.to        — recipient address(es)
 * @param {string} opts.subject              — email subject
 * @param {string} opts.html                 — HTML body
 * @param {string} [opts.text]               — plain-text fallback (recommended)
 * @param {string | string[]} [opts.replyTo] — optional Reply-To header
 * @param {string} [opts.from]               — override sender (defaults to RESEND_FROM_EMAIL)
 * @returns {Promise<{ ok: true, id: string } | { ok: false, error: string, details?: unknown }>}
 *
 * Never throws. Always returns a result object so callers can decide
 * whether to surface the failure to the user or quietly retry.
 */
export async function sendEmail({ to, subject, html, text, replyTo, from } = {}) {
  // ── Argument validation ────────────────────────────────────────────────────
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { ok: false, error: 'sendEmail: `to` is required' };
  }
  if (!subject || typeof subject !== 'string') {
    return { ok: false, error: 'sendEmail: `subject` is required (string)' };
  }
  if (!html || typeof html !== 'string') {
    return { ok: false, error: 'sendEmail: `html` is required (string)' };
  }

  let client;
  let fromAddress;
  try {
    client = getClient();
    fromAddress = from || getFromAddress();
  } catch (initError) {
    console.error('[email/sendEmail] init error:', initError);
    return { ok: false, error: initError?.message || 'Resend init failed' };
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  const payload = {
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (text) payload.text = text;
  if (replyTo) payload.replyTo = Array.isArray(replyTo) ? replyTo : [replyTo];

  try {
    const { data, error } = await client.emails.send(payload);

    if (error) {
      // Resend returns structured errors in the `error` field, not via throw.
      console.error('[email/sendEmail] Resend API error:', {
        subject,
        to: payload.to,
        from: fromAddress,
        error,
      });
      return {
        ok: false,
        error: error.message || 'Resend send failed',
        details: error,
      };
    }

    if (!data || !data.id) {
      console.error('[email/sendEmail] unexpected Resend response:', { data });
      return { ok: false, error: 'Resend returned no message id' };
    }

    console.log('[email/sendEmail] sent', {
      id: data.id,
      to: payload.to,
      subject,
    });
    return { ok: true, id: data.id };
  } catch (sendError) {
    // Network / unexpected throw — log full context for debugging.
    console.error('[email/sendEmail] send threw:', {
      subject,
      to: payload.to,
      from: fromAddress,
      err: sendError?.message || sendError,
      stack: sendError?.stack,
    });
    return {
      ok: false,
      error: sendError?.message || 'Email send threw',
    };
  }
}

// ============================================================================
// LAYER 2 — "Letter sealed" transactional template
//
// Triggered on successful payment / letter completion. The receipt block
// (Amount paid / Payment ID / Date) renders as quiet editorial metadata,
// NOT as a fintech receipt panel — same body weight as surrounding copy,
// no bold values, no boxed background, no "Receipt" / "Order Summary"
// heading, no icons. Thin gold hairlines above + below mark the receipt
// as a separate beat without elevating it visually.
// ============================================================================

const LETTER_SEALED_SUBJECT = 'Your letter has been sealed.';

/**
 * Build the letter-sealed transactional email (subject + HTML + text).
 * Pure function — no side effects, no Resend calls. Useful for testing
 * the template independently or for future preview surfaces.
 *
 * @param {object} opts
 * @param {string} opts.senderName       — letter author's name (escaped before render)
 * @param {string} opts.shareUrl — full HTTPS URL to the sealed letter share path (required)
 * @param {{ formattedAmount: string, paymentId: string, formattedDate: string } | undefined} [opts.receipt]
 *        — when present, renders the Amount / Payment ID / Date block (paid + session-authenticated path)
 * @returns {{ subject: string, html: string, text: string }}
 * @throws if required params are missing
 */
export function buildLetterSealedEmail({ senderName, shareUrl, receipt } = {}) {
  if (!senderName) throw new Error('buildLetterSealedEmail: `senderName` required');
  if (!shareUrl) throw new Error('buildLetterSealedEmail: `shareUrl` required');

  const subject = LETTER_SEALED_SUBJECT;

  const safeSenderName = escapeHtml(senderName);
  const safeShareUrlForText = String(shareUrl);
  const safeShareUrlHtml = escapeHtml(shareUrl);
  const shareHref = String(shareUrl)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  let safeAmount = '';
  let safePaymentId = '';
  let safeDate = '';
  if (receipt) {
    if (!receipt.formattedAmount || !receipt.paymentId || !receipt.formattedDate) {
      throw new Error('buildLetterSealedEmail: `receipt` must include formattedAmount, paymentId, formattedDate');
    }
    safeAmount = escapeHtml(receipt.formattedAmount);
    safePaymentId = escapeHtml(receipt.paymentId);
    safeDate = escapeHtml(receipt.formattedDate);
  }

  const SANS = `Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;
  const SERIF = `'Cormorant Garamond',Georgia,serif`;

  const COLOR_BG_OUTER = '#120A16';
  const COLOR_BG_PANEL = '#1A1220';
  const COLOR_GOLD_HAIRLINE = 'rgba(212,175,55,0.18)';
  const COLOR_GOLD_HAIRLINE_RECEIPT = 'rgba(212,175,55,0.30)';
  const COLOR_GOLD_KICKER = '#E7D9B7';
  const COLOR_TITLE_CREAM = 'rgba(242,232,213,0.92)';
  const COLOR_BODY_CREAM = 'rgba(207,198,178,0.78)';
  const COLOR_BODY_CREAM_STRONG = 'rgba(207,198,178,0.85)';
  const COLOR_SIGNOFF_DIM = 'rgba(207,198,178,0.55)';
  const COLOR_TAGLINE_DIM = 'rgba(207,198,178,0.42)';

  const receiptHtml = receipt
    ? `
              <!-- Receipt block — quiet editorial metadata, NOT a fintech panel.
                   Thin gold hairlines above + below mark the beat without
                   elevating values. Each line uses body weight + body color. -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLOR_GOLD_HAIRLINE_RECEIPT};margin:0;">
                <tr><td style="font-size:0;line-height:0;height:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:24px 0 4px;font-family:${SANS};font-size:15px;line-height:1.7;color:${COLOR_BODY_CREAM};">
                Amount paid: ${safeAmount}
              </p>
              <p style="margin:0 0 4px;font-family:${SANS};font-size:15px;line-height:1.7;color:${COLOR_BODY_CREAM};">
                Payment ID: ${safePaymentId}
              </p>
              <p style="margin:0 0 24px;font-family:${SANS};font-size:15px;line-height:1.7;color:${COLOR_BODY_CREAM};">
                Date: ${safeDate}
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLOR_GOLD_HAIRLINE_RECEIPT};margin:0;">
                <tr><td style="font-size:0;line-height:0;height:0;">&nbsp;</td></tr>
              </table>
`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR_BG_OUTER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR_BG_OUTER};padding:48px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${COLOR_BG_PANEL};border:1px solid ${COLOR_GOLD_HAIRLINE};">

          <!-- Brand kicker -->
          <tr>
            <td style="padding:40px 40px 0;text-align:left;">
              <p style="margin:0;font-family:${SERIF};font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:${COLOR_GOLD_KICKER};">${escapeHtml(BRAND_NAME)}</p>
            </td>
          </tr>

          <!-- Letter body -->
          <tr>
            <td style="padding:32px 40px 40px;text-align:left;">

              <p style="margin:0 0 24px;font-family:${SANS};font-size:15px;line-height:1.7;color:${COLOR_BODY_CREAM_STRONG};">
                Dear ${safeSenderName},
              </p>

              <h1 style="margin:0 0 16px;font-family:${SERIF};font-size:24px;font-style:italic;font-weight:300;line-height:1.4;letter-spacing:0.02em;color:${COLOR_TITLE_CREAM};">
                Your letter has been sealed.
              </h1>

              <p style="margin:0 0 32px;font-family:${SANS};font-size:15px;line-height:1.7;color:${COLOR_BODY_CREAM};">
                Only the person you choose will be able to open it.
              </p>

              <!-- Share link — always present (PR-46.5). Visually separated from optional receipt below. -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLOR_GOLD_HAIRLINE_RECEIPT};margin:0;">
                <tr><td style="font-size:0;line-height:0;height:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:24px 0 8px;font-family:${SANS};font-size:15px;line-height:1.7;color:${COLOR_BODY_CREAM};">
                Your share link:
              </p>
              <p style="margin:0 0 24px;font-family:${SANS};font-size:15px;line-height:1.7;color:${COLOR_BODY_CREAM};">
                <a href="${shareHref}" style="color:${COLOR_TITLE_CREAM};text-decoration:underline;text-underline-offset:3px;">${safeShareUrlHtml}</a>
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLOR_GOLD_HAIRLINE_RECEIPT};margin:0;">
                <tr><td style="font-size:0;line-height:0;height:0;">&nbsp;</td></tr>
              </table>
              ${receiptHtml}

              <p style="margin:32px 0 32px;font-family:${SANS};font-size:15px;line-height:1.7;color:${COLOR_BODY_CREAM};">
                Thank you. This was something that mattered enough to be written properly.
              </p>

              <p style="margin:0;font-family:${SANS};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR_SIGNOFF_DIM};">
                — ${escapeHtml(BRAND_NAME)}
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:24px 0 0;font-family:${SANS};font-size:11px;color:${COLOR_TAGLINE_DIM};">
          ${escapeHtml(BRAND_TAGLINE)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textReceiptLines = receipt
    ? [
        '',
        `Amount paid: ${receipt.formattedAmount}`,
        `Payment ID: ${receipt.paymentId}`,
        `Date: ${receipt.formattedDate}`,
        '',
      ]
    : [];

  const text = [
    `Dear ${senderName},`,
    '',
    'Your letter has been sealed.',
    'Only the person you choose will be able to open it.',
    '',
    'Your share link:',
    safeShareUrlForText,
    ...textReceiptLines,
    'Thank you. This was something that mattered enough to be written properly.',
    '',
    `— ${BRAND_NAME}`,
    BRAND_TAGLINE,
  ].join('\n');

  return { subject, html, text };
}

/**
 * Build + send the letter-sealed transactional email.
 * Thin wrapper combining buildLetterSealedEmail + sendEmail. Use this
 * from any post-payment / letter-completion code path. Currency formatting
 * MUST happen upstream — pass formattedAmount as a display-ready string.
 *
 * @param {object} opts
 * @param {string | string[]} opts.to     — recipient(s)
 * @param {string} opts.senderName        — letter author name
 * @param {string} opts.shareUrl          — full share URL for the sealed letter
 * @param {{ formattedAmount: string, paymentId: string, formattedDate: string } | undefined} [opts.receipt]
 * @returns {Promise<{ ok: true, id: string } | { ok: false, error: string }>}
 */
export async function sendLetterSealedEmail({ to, senderName, shareUrl, receipt } = {}) {
  let built;
  try {
    built = buildLetterSealedEmail({ senderName, shareUrl, receipt });
  } catch (err) {
    return { ok: false, error: err?.message || 'sendLetterSealedEmail: template build failed' };
  }
  return sendEmail({
    to,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });
}
