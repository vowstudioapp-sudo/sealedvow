// ============================================================================
// /api/save-reply.js — RECEIVER REPLY HANDLER
//
// Allows a receiver to seal a one-time reply to the sender's letter.
// Uses Firebase transaction to ensure single-write atomicity.
// ============================================================================

import { adminDb, guardPost, rateLimit } from './lib/middleware.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  // ── RATE LIMITING ──
  const { limited } = await rateLimit(req, {
    keyPrefix: 'reply_rate',
    windowSeconds: 60,
    max: 8,
  });

  if (limited) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute." });
  }

  const { sessionKey, replyText } = req.body || {};

  if (!sessionKey || typeof sessionKey !== "string" || !/^[a-z0-9]{8}$/.test(sessionKey)) {
    return res.status(400).json({ error: "Invalid request." });
  }

  if (!replyText || typeof replyText !== "string") {
    return res.status(400).json({ error: "Reply is required." });
  }

  const cleanReply = replyText.trim();
  if (cleanReply.length < 1 || cleanReply.length > 500) {
    return res.status(400).json({ error: "Reply must be between 1 and 500 characters." });
  }

  const sanitizedReply = cleanReply
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  try {
    const sessionRef = adminDb.ref(`shared/${sessionKey}`);
    const result = await sessionRef.transaction(current => {
      if (!current) return;
      if (!current.replyEnabled) return;
      if (current.reply && current.reply.text) return;

      return {
        ...current,
        reply: {
          text: sanitizedReply,
          sealedAt: new Date().toISOString(),
        },
      };
    });

    if (!result.committed || !result.snapshot.val()) {
      return res.status(400).json({ error: "Reply is unavailable for this session." });
    }

    return res.status(200).json({ saved: true });
  } catch (error) {
    console.error("[SaveReply] Error:", error.message);
    return res.status(500).json({ error: "Failed to save reply." });
  }
}