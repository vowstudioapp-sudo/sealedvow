// ============================================================================
// /lib/email/sendEmail.js — Resend transactional email service
//
// Single source of truth for outbound emails. All transactional surfaces
// (order confirmation, letter delivery notification, receiver-side cues,
// founder-code redemption, etc.) flow through this utility.
//
// Env vars expected (set in Vercel; mirror in .env.local for vercel dev):
//   RESEND_API_KEY      — Resend secret key
//   RESEND_FROM_EMAIL   — sender, e.g. "Sealed Vow <seal@sealedvow.com>"
//
// Usage:
//   import { sendEmail } from '../lib/email/sendEmail.js';
//   const result = await sendEmail({
//     to: 'user@example.com',
//     subject: 'Your message has been sealed.',
//     html: '<p>…</p>',
//     text: 'plain fallback',
//   });
//   if (!result.ok) { /* log + fall back */ }
// ============================================================================

import { Resend } from 'resend';

// ── Singleton client ─────────────────────────────────────────────────────────
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
