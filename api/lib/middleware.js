// ============================================================================
// /api/lib/middleware.js — Shared Server Infrastructure
//
// Single source of truth for:
//   - Firebase Admin initialization
//   - Upstash Redis initialization
//   - CORS configuration
//   - Client IP extraction
//   - Rate limiting (with graceful Redis fallback)
//
// Every API route imports from here. No duplication.
// ============================================================================

import admin from "firebase-admin";
import { Redis } from "@upstash/redis";

// ══════════════════════════════════════════════════════════════════════
// FIREBASE ADMIN (singleton)
// ══════════════════════════════════════════════════════════════════════

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

export const adminDb = admin.database();

// ══════════════════════════════════════════════════════════════════════
// UPSTASH REDIS (singleton)
// ══════════════════════════════════════════════════════════════════════

export const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ══════════════════════════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════════════════════════

// TODO: Make env-driven once staging/preview environments are set up:
//   const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [];
// Not done now because: (a) no .env.example exists yet, (b) adding a new
// required env var during an infra refactor risks deploy failures.
const ALLOWED_ORIGINS = [
  "https://www.sealedvow.com",
  "https://sealedvow.com",
  "https://sealedvow.vercel.app",
  "http://localhost:5173",      // Vite default port
  "http://localhost:3000",      // Alternative port
  "http://127.0.0.1:5173",      // Explicit IP
];

export function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

// ══════════════════════════════════════════════════════════════════════
// CLIENT IP
// ══════════════════════════════════════════════════════════════════════

export function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// ══════════════════════════════════════════════════════════════════════
// RATE LIMITER (with graceful Redis fallback)
//
// Returns: { limited: boolean }
//
// If Redis is unavailable, logs the error and ALLOWS the request
// through. Rate limiting is a soft dependency — it must never cause
// a total service outage.
// ══════════════════════════════════════════════════════════════════════

export async function rateLimit(req, { keyPrefix, windowSeconds = 60, max = 10 } = {}) {
  try {
    const ip = getClientIP(req);
    const key = `${keyPrefix}:${ip}`;
    const current = await kv.incr(key);

    if (current === 1) {
      await kv.expire(key, windowSeconds);
    }

    if (current > max) {
      return { limited: true };
    }

    return { limited: false };
  } catch (err) {
    // ⚠️ INTENTIONAL SOFT-FAIL — DO NOT CHANGE TO 503.
    // If Redis is unavailable, we degrade rate limiting but never block
    // business logic. Payments, session loads, and AI calls must not fail
    // because a rate-limiting dependency is down. This was a deliberate
    // architectural decision after discovering that the original per-route
    // rate limiters returned 503 on Redis failure, causing total outage.
    console.error(`[RateLimit] Redis unavailable (${keyPrefix}):`, err.message);
    return { limited: false };
  }
}

// ══════════════════════════════════════════════════════════════════════
// COMMON GUARDS (preflight, method, content-type)
// ══════════════════════════════════════════════════════════════════════

/**
 * Handles OPTIONS preflight, method check, and content-type check.
 * Returns true if the request was handled (caller should return early).
 * Returns false if the request should proceed to business logic.
 *
 * NOTE: This enforces application/json only. Do NOT use for endpoints
 * that accept other content types (e.g. Razorpay webhooks send
 * application/x-www-form-urlencoded, file uploads use multipart/form-data).
 * Those routes should handle their own method/content-type checks.
 */
export function guardPost(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }

  if (!req.headers['content-type']?.includes('application/json')) {
    res.status(415).json({ error: 'Unsupported Media Type' });
    return true;
  }

  return false;
}