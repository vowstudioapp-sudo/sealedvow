// ============================================================================
// /api/admin/orphan-audit.js — Storage orphan AUDIT (Phase 1, no deletion)
//
// Read-only diagnostic. Lists Firebase Storage files under sessions/ that
// are NOT referenced by any shared/{sessionKey} record, classified by age.
//
// Phase 1 SCOPE — strict:
//   - GET only, admin-authenticated, no Storage writes/deletes
//   - Hard MAX_FILES cap per scan (1000) — single Storage page request
//   - Returns JSON report with classification buckets
//   - Manual invocation only (NO cron entry yet)
//
// Phase 2 (deletion) is a separate PR. Will require explicit ?delete=true
// AND an X-Confirm-Delete header. Not implemented here.
// ============================================================================

import '../lib/env.js'; // H3: cold-start required-env validation (side-effect import)

import crypto from 'crypto';
import admin from 'firebase-admin';

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

const MAX_FILES = 1000;            // single-page Storage list cap
const DEFAULT_DAYS = 1;
const MAX_DAYS = 7;
const ALLOWED_PREFIX = /^sessions\/$/; // only allow scoping to sessions/ for Phase 1

function safeBufferEqual(provided, expected) {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

function getBucket() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET
    || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`;
  return admin.storage().bucket(bucketName);
}

// Extract sessionId from a Firebase Storage signed URL (path contains
// "sessions/{36-char-uuid}/..."). Returns null if no match.
const SESSION_ID_RE = /\/sessions\/([0-9a-f-]{36})\//i;
function extractSessionId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(SESSION_ID_RE);
  return m ? m[1].toLowerCase() : null;
}

// Walk a shared/{key} record and collect every URL field that may contain
// a sessions/{sessionId} path. Includes legacy video.url for old records.
function collectSessionIdsFromRecord(record, into) {
  if (!record || typeof record !== 'object') return;
  const candidates = [
    record.userImageUrl,
    record.aiImageUrl,
    record.audio?.url,
    record.video?.url, // legacy, post-C7 won't grow but old data may carry it
  ];
  for (const url of candidates) {
    const sid = extractSessionId(url);
    if (sid) into.add(sid);
  }
  if (Array.isArray(record.memoryBoard)) {
    for (const photo of record.memoryBoard) {
      const sid = extractSessionId(photo?.url);
      if (sid) into.add(sid);
    }
  }
}

// Extract sessionId from a storage path "sessions/{sessionId}/something.ext".
const PATH_SESSION_ID_RE = /^sessions\/([0-9a-f-]{36})\//i;
function extractSessionIdFromPath(path) {
  if (!path || typeof path !== 'string') return null;
  const m = path.match(PATH_SESSION_ID_RE);
  return m ? m[1].toLowerCase() : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // M4: sensitive admin data — never cache responses.
    res.setHeader('Cache-Control', 'no-store');

    // ── AUTH (mirror reconcile-payments.js) ──
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error('[OrphanAudit] Missing ADMIN_SECRET');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const cronSecret = process.env.CRON_SECRET;
    const adminMatch = safeBufferEqual(token, adminSecret);
    const cronMatch = cronSecret ? safeBufferEqual(token, cronSecret) : false;

    if (!adminMatch && !cronMatch) {
      console.warn('[OrphanAudit] Unauthorized', { ip: getClientIp(req) });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ── Window param ──
    let days = parseInt(req.query?.days, 10);
    if (Number.isNaN(days)) days = DEFAULT_DAYS;
    if (days < 1) days = 1;
    if (days > MAX_DAYS) days = MAX_DAYS;

    // ── Prefix param (strictly limited to sessions/ in Phase 1) ──
    const rawPrefix = typeof req.query?.prefix === 'string' ? req.query.prefix : 'sessions/';
    const prefix = ALLOWED_PREFIX.test(rawPrefix) ? rawPrefix : 'sessions/';

    const scanStartedAt = new Date().toISOString();
    const scanStartMs = Date.now();
    const ageThresholdMs = days * 24 * 60 * 60 * 1000;
    const cutoffMs = Date.now() - ageThresholdMs;

    console.log('[OrphanAudit] Scan started', { days, prefix });

    // ── Build the alive-sessionId set from shared/ ──
    const aliveSessionIds = new Set();
    let rtdbError = null;
    try {
      const snap = await adminDb.ref('shared').once('value');
      const all = snap.val() || {};
      for (const key of Object.keys(all)) {
        collectSessionIdsFromRecord(all[key], aliveSessionIds);
      }
    } catch (err) {
      rtdbError = err.message;
      console.warn('[OrphanAudit] RTDB read failed (will mark all files unknown)', { error: err.message });
    }

    // ── List Storage files (single page, capped) ──
    const bucket = getBucket();
    let files = [];
    let storageError = null;
    try {
      const [pageFiles] = await bucket.getFiles({
        prefix,
        maxResults: MAX_FILES,
        autoPaginate: false,
      });
      files = pageFiles;
    } catch (err) {
      storageError = err.message;
      console.warn('[OrphanAudit] Storage list failed', { error: err.message });
    }

    // ── Classify ──
    const orphans = [];
    let activeCount = 0;
    let recentCount = 0;
    let unknownCount = 0;

    for (const file of files) {
      const meta = file.metadata || {};
      const path = file.name;
      const createdMs = meta.timeCreated ? Date.parse(meta.timeCreated) : NaN;
      const sessionId = extractSessionIdFromPath(path);

      // recent: file too new to safely classify (might be mid-flow)
      if (Number.isFinite(createdMs) && createdMs > cutoffMs) {
        recentCount++;
        continue;
      }

      // unknown: path doesn't match expected shape
      if (!sessionId) {
        unknownCount++;
        continue;
      }

      // If RTDB read failed, we can't classify — bucket as unknown
      if (rtdbError) {
        unknownCount++;
        continue;
      }

      if (aliveSessionIds.has(sessionId)) {
        activeCount++;
      } else {
        orphans.push({
          path,
          sessionId,
          size: Number(meta.size || 0),
          createdAt: meta.timeCreated || null,
          ageHours: Number.isFinite(createdMs)
            ? Math.floor((Date.now() - createdMs) / (60 * 60 * 1000))
            : null,
        });
      }
    }

    const truncated = files.length >= MAX_FILES;
    if (truncated) {
      console.warn('[OrphanAudit] Truncated', { totalFilesScanned: files.length, MAX_FILES });
    }

    const summary = {
      totalFilesScanned: files.length,
      totalSessionsAlive: aliveSessionIds.size,
      orphan: orphans.length,
      active: activeCount,
      recent: recentCount,
      unknown: unknownCount,
    };

    const scanDurationMs = Date.now() - scanStartMs;
    console.log('[OrphanAudit] Scan complete', { summary, scanDurationMs });

    return res.status(200).json({
      scanWindow: {
        ageThresholdDays: days,
        prefix,
        scanStartedAt,
        scanDurationMs,
      },
      summary,
      orphans,
      truncated,
      ...(rtdbError ? { rtdbError } : {}),
      ...(storageError ? { storageError } : {}),
      phase: 'audit-only — no files deleted',
    });
  } catch (err) {
    console.error('[OrphanAudit] CRITICAL', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
