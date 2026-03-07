// ============================================================================
// /api/load-session.js — SECURE SESSION PROXY
//
// Server-side proxy for reading session data from Firebase RTDB.
// Prevents direct client-side RTDB access and enforces validation.
// ============================================================================

import { adminDb, guardPost, rateLimit } from './lib/middleware.js';

function sanitizeSession(data = {}) {
  return {
    senderName: data.senderName,
    recipientName: data.recipientName,
    finalLetter: data.finalLetter,
    myth: data.myth,
    timeShared: data.timeShared,
    occasion: data.occasion,
    theme: data.theme,
    sealedAt: data.sealedAt,
    createdAt: data.createdAt,
    revealMethod: data.revealMethod,
    unlockDate: data.unlockDate,
    userImageUrl: data.userImageUrl,
    aiImageUrl: data.aiImageUrl,
    video: data.video,
    videoSource: data.videoSource,
    audio: data.audio,
    musicUrl: data.musicUrl,
    musicType: data.musicType,
    memoryBoard: data.memoryBoard,
    sacredLocation: data.sacredLocation,
    coupons: data.coupons,
    hasGift: data.hasGift,
    giftTitle: data.giftTitle,
    giftNote: data.giftNote,
    giftLink: data.giftLink,
    replyEnabled: data.replyEnabled,
    sessionId: data.sessionId,
  };
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  // ── RATE LIMITING ──
  const { limited } = await rateLimit(req, {
    keyPrefix: 'session_load_rate',
    windowSeconds: 60,
    max: 10,
  });

  if (limited) {
    return res.status(429).json({
      error: "Too many requests. Please wait a minute."
    });
  }

  // ── VALIDATE INPUT ──
  const { sessionKey } = req.body || {};

  if (!sessionKey || typeof sessionKey !== "string") {
    return res.status(400).json({ error: "Invalid session key." });
  }

  if (sessionKey.length !== 8 || !/^[a-z0-9]+$/.test(sessionKey)) {
    return res.status(400).json({ error: "Invalid session key." });
  }

  try {
    const snapshot = await adminDb
      .ref(`shared/${sessionKey}`)
      .once('value');

    const sessionData = snapshot.val();

    if (!sessionData) {
      return res.status(404).json({ error: "Session not found." });
    }

    // Only return fully paid sessions — reject half-created or corrupted records
    if (sessionData.status !== 'paid') {
      console.warn(`[LoadSession] Non-paid session accessed: ${sessionKey} (status: ${sessionData.status})`);
      return res.status(404).json({ error: "Session not found." });
    }

    return res
      .status(200)
      .setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
      .json(sanitizeSession(sessionData));

  } catch (error) {
    console.error("[LoadSession] Error loading session:", error.message);
    return res.status(500).json({ error: "Failed to load session." });
  }
}