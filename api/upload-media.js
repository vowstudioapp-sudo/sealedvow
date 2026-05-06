// ============================================================================
// /api/upload-media.js — MEDIA UPLOAD HANDLER
//
// Accepts base64-encoded files in JSON body, uploads to Firebase Storage
// via Admin SDK. Returns public download URL.
//
// Supports: cover images, memory board photos, videos, audio recordings.
//
// Architecture decision: base64 in JSON body (not multipart/form-data).
// Reason: images are already compressed to ~1MB on the client side,
// base64 adds ~33% = ~1.33MB, well within Vercel's 4.5MB body limit.
// This avoids adding a multipart parsing dependency (busboy/formidable).
// ============================================================================

import admin from 'firebase-admin';
import { Redis } from '@upstash/redis';
import { guardPost, rateLimit, getClientIP } from './lib/middleware.js';
import { getSessionUser } from './lib/auth.js';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

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

const TOKEN_UPLOAD_CAP = 20;
const DAILY_STORAGE_CAP = 100 * 1024 * 1024; // 100 MB / actor / day

// ── LAZY BUCKET INITIALIZATION ──
// Initialized inside handler, not at module level, to ensure Firebase Admin
// is fully initialized before accessing Storage API.
let _bucket = null;

function getBucket() {
  if (!_bucket) {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET
      || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`;
    _bucket = admin.storage().bucket(bucketName);
  }
  return _bucket;
}

// ── VALIDATION ──

// STEP 2: video uploads disabled at API gate (C7) — large per-file size made
// it the dominant cost-attack vector. Re-enable only with paid-actor binding.
const ALLOWED_TYPES = ['cover', 'memory', 'audio'];

const ALLOWED_MIME_PREFIXES = {
  cover: ['image/jpeg', 'image/png', 'image/webp'],
  memory: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm'],
  audio: ['audio/webm', 'audio/mp4', 'audio/mpeg'],
};

const MAX_SIZES = {
  cover: 2 * 1024 * 1024,    // 2MB (already compressed on client)
  memory: 2 * 1024 * 1024,   // 2MB per photo
  video: 15 * 1024 * 1024,   // 15MB
  audio: 3 * 1024 * 1024,    // 3MB
};

function validateSessionId(sessionId) {
  // sessionId is a client-generated UUID (crypto.randomUUID()).
  // The shared/ record only exists after payment, so we cannot do a DB lookup here.
  // Format validation prevents abuse; rate limiting handles the rest.
  return sessionId && typeof sessionId === 'string' && /^[a-f0-9-]{36}$/i.test(sessionId);
}

function getExtension(mimeType) {
  const subtype = mimeType.split('/')[1];
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'mpeg') return 'mp3';
  return subtype;
}

function extractBase64(dataUri) {
  // Accepts data URI format: data:mime/type;base64,DATA
  if (!dataUri.startsWith('data:')) return null;

  const parts = dataUri.split(',');
  if (parts.length !== 2) return null;

  const mimeMatch = parts[0].match(/data:([^;]+);base64/);
  if (!mimeMatch) return null;

  return {
    mimeType: mimeMatch[1],
    buffer: Buffer.from(parts[1], 'base64'),
  };
}

// ── HANDLER ──

export default async function handler(req, res) {
  // guardPost handles CORS, OPTIONS, method check, content-type check
  if (guardPost(req, res)) return;

  // ── STEP 1 (C7): UPLOAD TOKEN VERIFICATION ──
  // Token must be minted by /api/prepare-upload-session and bound to
  // (actor, sessionId). Closes the UUID-rotation cost-abuse vector.
  const uploadToken = req.headers['x-upload-token'];
  if (!uploadToken || typeof uploadToken !== 'string' || !/^[a-f0-9]{32}$/i.test(uploadToken)) {
    console.warn('[UploadAuth] Missing or invalid token');
    return res.status(401).json({ error: 'Missing or invalid upload token' });
  }

  // Undefined sentinel distinguishes KV failure from missing key.
  const tokenRecord = await safeKV(() => kv.hgetall(`upload_token:${uploadToken}`), undefined);
  if (tokenRecord === undefined) {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  if (!tokenRecord || Object.keys(tokenRecord).length === 0) {
    console.warn('[UploadAuth] Token not found or expired');
    return res.status(401).json({ error: 'Token not found or expired' });
  }

  // Explicit expiresAt check (defense against stale-eviction edge case where
  // Upstash hasn't yet purged a TTL'd key).
  if (Date.now() > Number(tokenRecord.expiresAt)) {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Need sessionId from body to enforce session binding.
  const { sessionId, file, type, index } = req.body || {};

  // Actor binding — strict.
  const ip = getClientIP(req);
  let requestUid = null;
  try {
    const sessionUser = await getSessionUser(req);
    requestUid = sessionUser?.uid || null;
  } catch {}
  const requestActor = requestUid || `ip:${ip}`;
  if (tokenRecord.actor !== requestActor) {
    console.warn('[UploadAuth] Actor mismatch');
    return res.status(403).json({ error: 'Token does not belong to this actor' });
  }

  // SessionId binding — token can only upload to its bound session
  // (closes griefing vector where attacker overwrites a victim's pre-payment
  // session by stealing/guessing their sessionId).
  if (tokenRecord.sessionId !== sessionId) {
    console.warn('[UploadAuth] Session mismatch');
    return res.status(403).json({ error: 'Token does not match session' });
  }

  // Token-level upload count cap.
  if (Number(tokenRecord.uploadCount) >= TOKEN_UPLOAD_CAP) {
    return res.status(429).json({ error: 'Token upload limit reached' });
  }

  // ── RATE LIMITING (defense-in-depth, post-token) ──
  const { limited } = await rateLimit(req, {
    keyPrefix: 'upload_rate',
    windowSeconds: 60,
    max: 20, // allow burst uploads (memory board = up to 10 at once)
  });

  if (limited) {
    return res.status(429).json({ error: 'Too many uploads. Please wait a minute.' });
  }

  try {
    // sessionId/file/type/index already destructured above for the token check.
    const uploadedByUid = requestUid;

    // ── VALIDATE INPUTS ──

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    if (!validateSessionId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session format' });
    }

    const MAX_UPLOADS = 20;
    const countRef = admin.database().ref(`prepQuota/${sessionId}/uploadCount`);
    const txnResult = await countRef.transaction((current) => {
      if (current === null) return 1;
      if (current >= MAX_UPLOADS) return; // abort
      return current + 1;
    });
    if (!txnResult.committed) {
      return res.status(429).json({ error: 'Upload limit reached' });
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid upload type.' });
    }

    if (!file || typeof file !== 'string') {
      return res.status(400).json({ error: 'Missing file data.' });
    }

    // ── PARSE BASE64 ──

    const parsed = extractBase64(file);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid file format. Expected base64 data URI.' });
    }

    const { mimeType, buffer } = parsed;

    // ── VALIDATE MIME TYPE ──

    const allowedMimes = ALLOWED_MIME_PREFIXES[type];
    if (!allowedMimes.includes(mimeType)) {
      return res.status(400).json({
        error: `Invalid file type for ${type}. Allowed: ${allowedMimes.join(', ')}`,
      });
    }

    // ── VALIDATE SIZE ──

    const maxSize = MAX_SIZES[type];
    if (buffer.length > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      return res.status(400).json({ error: `File too large. Maximum ${maxMB}MB for ${type}.` });
    }

    // ── STEP 4 (C7): PER-ACTOR DAILY STORAGE CAP ──
    // Race window exists between this read and the post-upload incrby below
    // (two concurrent uploads can both pass). Acceptable for MVP — abuse
    // already massively reduced by token + actor binding. Deferred to a Lua
    // CAS script post-launch if needed.
    const today = todayKey();
    const storageKey = `upload_storage_daily:${requestActor}:${today}`;
    const rawDaily = await safeKV(() => kv.get(storageKey), undefined);
    if (rawDaily === undefined) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    const currentBytes = Number(rawDaily || 0);
    if (Number.isNaN(currentBytes)) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    if (currentBytes + buffer.length > DAILY_STORAGE_CAP) {
      console.warn('[UploadCap] Daily storage cap hit');
      return res.status(429).json({ error: 'Daily storage limit reached' });
    }

    // ── BUILD STORAGE PATH ──

    const ext = getExtension(mimeType);
    let storagePath;

    if (type === 'cover') {
      storagePath = `sessions/${sessionId}/cover.${ext}`;
    } else if (type === 'memory') {
      // STEP 3 (C7): bounded memory index 0-9; Date.now() fallback dropped.
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 9) {
        return res.status(400).json({ error: 'Invalid memory index — must be integer 0-9' });
      }
      storagePath = `sessions/${sessionId}/memory/${index}.${ext}`;
    } else if (type === 'audio') {
      storagePath = `sessions/${sessionId}/audio.${ext}`;
    }

    // ── UPLOAD TO FIREBASE STORAGE ──

    const bucket = getBucket();
    const fileRef = bucket.file(storagePath);

    await fileRef.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          sessionId,
          ...(uploadedByUid ? { uploadedByUid } : {}),
          uploadType: type,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // ── STEP 5 (C7): POST-UPLOAD COUNTER UPDATES ──
    // hincrby preserves the token's TTL — token cannot be kept alive
    // indefinitely via uploads. Daily storage counter gets a TTL on first hit.
    await safeKV(() => kv.hincrby(`upload_token:${uploadToken}`, 'uploadCount', 1));
    await safeKV(() => kv.hincrby(`upload_token:${uploadToken}`, 'uploadedBytes', buffer.length));

    const newDailyBytes = await safeKV(() => kv.incrby(storageKey, buffer.length));
    if (newDailyBytes === buffer.length) {
      await safeKV(() => kv.expire(storageKey, 86400));
    }

    return res.status(200).json({ url, success: true });

  } catch (err) {
    console.error('[UploadMedia] Error:', {
      message: err.message,
      sessionId: req.body?.sessionId,
      type: req.body?.type,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
}