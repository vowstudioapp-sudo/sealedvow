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
import { guardPost, rateLimit } from './lib/middleware.js';
import { getSessionUser } from './lib/auth.js';

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

const ALLOWED_TYPES = ['cover', 'memory', 'video', 'audio'];

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

  // ── RATE LIMITING ──
  const { limited } = await rateLimit(req, {
    keyPrefix: 'upload_rate',
    windowSeconds: 60,
    max: 20, // allow burst uploads (memory board = up to 10 at once)
  });

  if (limited) {
    return res.status(429).json({ error: 'Too many uploads. Please wait a minute.' });
  }

  try {
    const { sessionId, file, type, index } = req.body || {};
    let uploadedByUid = null;
    try {
      const sessionUser = await getSessionUser(req);
      uploadedByUid = sessionUser?.uid || null;
    } catch {
      // swallow errors — upload must not fail due to auth
    }

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

    // ── BUILD STORAGE PATH ──

    const ext = getExtension(mimeType);
    let storagePath;

    if (type === 'cover') {
      storagePath = `sessions/${sessionId}/cover.${ext}`;
    } else if (type === 'memory') {
      const idx = (typeof index === 'number' && index >= 0) ? index : Date.now();
      storagePath = `sessions/${sessionId}/memory/${idx}.${ext}`;
    } else if (type === 'video') {
      storagePath = `sessions/${sessionId}/video.${ext}`;
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