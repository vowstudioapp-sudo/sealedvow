// ============================================================================
// /api/load-session.js — SECURE SESSION PROXY
//
// Server-side proxy for reading session data from Firebase RTDB.
// Prevents direct client-side RTDB access and enforces validation.
// ============================================================================

import { Redis } from "@upstash/redis";
import admin from "firebase-admin";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
}

const adminDb = admin.database();

const ALLOWED_ORIGINS = [
  "https://www.sealedvow.com",
  "https://sealedvow.com",
  "https://sealedvow.vercel.app"
];

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

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
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }

  // ── SESSION LOAD RATE LIMITING ──
  const RATE_LIMIT_WINDOW = 60; // seconds
  const MAX_REQUESTS = 10; // per IP per minute

  try {
    const ip = getClientIP(req);
    const key = `session_load_rate:${ip}`;
    const current = await kv.incr(key);

    if (current === 1) {
      await kv.expire(key, RATE_LIMIT_WINDOW);
    }

    if (current > MAX_REQUESTS) {
      return res.status(429).json({
        error: "Too many requests. Please wait a minute."
      });
    }

  } catch (kvError) {
    console.error("[SessionRateLimit] KV unavailable:", kvError.message);
    return res.status(503).json({
      error: "Service temporarily unavailable. Please try again."
    });
  }

  // ── VALIDATE INPUT ──
  const { sessionKey } = req.body || {};

  if (!sessionKey || typeof sessionKey !== "string") {
    return res.status(400).json({ error: "Invalid session key." });
  }

  // Validate format: exactly 8 characters, alphanumeric lowercase
  if (sessionKey.length !== 8 || !/^[a-z0-9]+$/.test(sessionKey)) {
    return res.status(400).json({ error: "Invalid session key." });
  }

  // ── CHECK FIREBASE CONFIG ──
  const firebaseDbUrl = process.env.FIREBASE_DB_URL;
  if (!firebaseDbUrl) {
    console.error("[LoadSession] Missing FIREBASE_DB_URL");
    return res.status(500).json({ error: "Server configuration error." });
  }

  try {
    // ── READ FROM FIREBASE ──
    const snapshot = await adminDb
      .ref(`shared/${sessionKey}`)
      .once('value');

    const sessionData = snapshot.val();

    if (!sessionData) {
      return res.status(404).json({ error: "Session not found." });
    }

    // ── RETURN SESSION DATA ──
    return res.status(200).json(sanitizeSession(sessionData));

  } catch (error) {
    console.error("[LoadSession] Error loading session:", error.message);
    return res.status(500).json({ error: "Failed to load session." });
  }
}
