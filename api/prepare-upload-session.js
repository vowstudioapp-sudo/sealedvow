// ============================================================================
// /api/prepare-upload-session.js — Mint short-lived upload tokens (C7)
//
// Closes the unauthenticated-upload vector: /api/upload-media used to accept
// any client-generated UUID. Now uploads require an X-Upload-Token header,
// and tokens are server-minted, bound to actor + sessionId, expire in 1h,
// and have per-IP rate limits + daily mint caps.
// ============================================================================

import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { rateLimit, getClientIP } from './lib/middleware.js';
import { getSessionUser } from './lib/auth.js';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TOKEN_TTL_SECONDS = 3600;     // tokens live 1 hour
const MINT_RATE_WINDOW = 60;
const MINT_RATE_MAX = 5;            // 5 mints / 60s / IP
const MINT_DAILY_CAP = 30;          // 30 mints / day / IP

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function safeKV(fn, fallback = null) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const ALLOWED_ORIGINS = [
  'https://www.sealedvow.com',
  'https://sealedvow.com',
  'https://sealedvow.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Per-IP burst rate limit (5 / 60s)
  const { limited } = await rateLimit(req, {
    keyPrefix: 'upload_token_mint',
    windowSeconds: MINT_RATE_WINDOW,
    max: MINT_RATE_MAX,
  });
  if (limited) {
    return res.status(429).json({ error: 'Too many token mint attempts. Please wait a minute.' });
  }

  // Daily mint cap per IP — fail-closed on KV failure (undefined sentinel).
  const ip = getClientIP(req);
  const dailyKey = `upload_mint_daily:${ip}:${todayKey()}`;
  const dailyCount = await safeKV(() => kv.incr(dailyKey), undefined);
  if (dailyCount === undefined) {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  if (dailyCount === 1) {
    await safeKV(() => kv.expire(dailyKey, 86400));
  }
  if (dailyCount > MINT_DAILY_CAP) {
    return res.status(429).json({ error: 'Daily token mint limit reached' });
  }

  // Body validation — sessionId is required and must be UUID-shaped.
  const { sessionId } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
    return res.status(400).json({ error: 'Missing or invalid sessionId' });
  }

  // Resolve actor (uid if logged in, else IP).
  let uid = null;
  try {
    const sessionUser = await getSessionUser(req);
    uid = sessionUser?.uid || null;
  } catch {}
  const actor = uid || `ip:${ip}`;

  // Mint the token.
  const tokenId = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_SECONDS * 1000;

  const setResult = await safeKV(() => kv.hset(`upload_token:${tokenId}`, {
    actor,
    sessionId,
    expiresAt,
    uploadCount: 0,
    uploadedBytes: 0,
  }), undefined);
  if (setResult === undefined) {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  const expireResult = await safeKV(() => kv.expire(`upload_token:${tokenId}`, TOKEN_TTL_SECONDS), undefined);
  if (expireResult === undefined) {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  return res.status(200).json({ uploadToken: tokenId, expiresAt });
}
