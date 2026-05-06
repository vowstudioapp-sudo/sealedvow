// ============================================================================
// /api/admin/reconcile-payments.js — Daily Razorpay ↔ RTDB reconciliation
//
// Cross-checks captured Razorpay payments against our payments/ + shared/
// trees and classifies discrepancies into orphan / inProgress / stuck /
// amountDrift / ghost / healthy buckets. Read-only — no mutations.
// Invoked daily by Vercel Cron (Authorization: Bearer CRON_SECRET) or
// manually via curl with ADMIN_SECRET.
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

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // M4: sensitive admin data — never cache responses.
    res.setHeader('Cache-Control', 'no-store');

    // ── AUTH (Pattern A from api/admin/* files, extended for CRON_SECRET) ──
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error('[Reconcile] Missing ADMIN_SECRET');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const cronSecret = process.env.CRON_SECRET;
    const adminMatch = safeBufferEqual(token, adminSecret);
    const cronMatch = cronSecret ? safeBufferEqual(token, cronSecret) : false;

    if (!adminMatch && !cronMatch) {
      console.warn('[Reconcile] Unauthorized', { ip: getClientIp(req) });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ── Razorpay credentials ──
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      console.error('[Reconcile] Missing Razorpay credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // ── Window param: ?days=N, default 1, clamped to [1, 7] ──
    let days = parseInt(req.query?.days, 10);
    if (Number.isNaN(days)) days = 1;
    if (days < 1) days = 1;
    if (days > 7) {
      console.warn('[Reconcile] days clamped to 7');
      days = 7;
    }

    // ── Time window — UNITS MATTER ──
    // claimedAt and receivedAt in our RTDB are MILLISECONDS (Date.now()).
    // Razorpay's created_at and the /v1/payments from/to params are SECONDS.
    // Every conversion below is explicit. NEVER mix units.
    const scanStartMs = Date.now();
    const nowMs = Date.now();
    const toSeconds = Math.floor(nowMs / 1000);
    const fromSeconds = toSeconds - (days * 86400);
    const BUFFER_SECONDS = 5 * 60;            // 5 min, matches Razorpay seconds
    const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 min, matches our ms timestamps

    console.log('[Reconcile] Scan started', { days, fromSeconds, toSeconds });

    // ── Fetch from Razorpay (paginated, capped at MAX_PAGES) ──
    const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const allItems = [];
    let skip = 0;
    let pages = 0;
    const MAX_PAGES = 10;
    let truncated = false;

    while (pages < MAX_PAGES) {
      const url = `https://api.razorpay.com/v1/payments?from=${fromSeconds}&to=${toSeconds}&count=100&skip=${skip}`;
      const response = await fetch(url, { headers: { 'Authorization': auth } });
      if (!response.ok) {
        console.error('[Reconcile] Razorpay fetch failed', { status: response.status, page: pages });
        return res.status(502).json({ error: 'Razorpay API error', status: response.status });
      }
      const data = await response.json();
      const items = data.items || [];
      allItems.push(...items);
      pages++; // increment AFTER successful fetch
      if (items.length < 100) break;
      skip += 100;
    }
    if (pages >= MAX_PAGES) truncated = true;
    const pagesScanned = pages;

    // ── Filter: only captured, then apply 5-min recency buffer ──
    // item.created_at and toSeconds are both seconds; BUFFER_SECONDS too.
    const captured = allItems.filter(item => item.status === 'captured');
    const beforeBuffer = captured.length;
    const afterBuffer = captured.filter(item => item.created_at <= (toSeconds - BUFFER_SECONDS));
    const skippedRecent = beforeBuffer - afterBuffer.length;

    // ── Classify into 6 buckets in STRICT ORDER ──
    // ORDER IS LOAD-BEARING. Earlier checks short-circuit later ones via
    // if/else if. DO NOT REORDER — preserved exactly per spec:
    //   1. orphan      — no record at all
    //   2. inProgress  — recent claim, not yet a problem (count only)
    //   3. stuck       — old claim, never finished
    //   4. amountDrift — has session, amount differs (priority over ghost)
    //   5. ghost       — has session, shared/ missing (CRITICAL)
    //   6. healthy     — fully reconciled (count only)
    //   7. unknown     — record exists but matches no pattern (should be 0)
    //
    // The shared/{sessionKey} read happens ONLY in the ghost branch — saves
    // an RTDB read per orphan / stuck / inProgress / amountDrift item.
    const orphans = [];
    const stuck = [];
    const ghosts = [];
    const amountDrifts = [];
    let healthyCount = 0;
    let inProgressCount = 0;
    let unknownCount = 0;

    for (const item of afterBuffer) {
      const snap = await adminDb.ref('payments/' + item.id).once('value');
      const record = snap.val();

      if (record === null) {
        orphans.push(item);
        console.warn('[Reconcile] Orphan detected', { paymentId: item.id, amount: item.amount });
      } else if (
        record.claiming === true &&
        !record.sessionKey &&
        (Date.now() - record.claimedAt) <= STUCK_THRESHOLD_MS
      ) {
        inProgressCount++;
      } else if (
        record.claiming === true &&
        !record.sessionKey &&
        (Date.now() - record.claimedAt) > STUCK_THRESHOLD_MS
      ) {
        stuck.push({ item, record });
        console.warn('[Reconcile] Stuck claim detected', {
          paymentId: item.id,
          ageSeconds: Math.floor((Date.now() - record.claimedAt) / 1000),
        });
      } else if (record.sessionKey && record.amount !== item.amount) {
        amountDrifts.push({ item, record });
        console.warn('[Reconcile] Amount drift detected', {
          paymentId: item.id,
          razorpayAmount: item.amount,
          rtdbAmount: record.amount,
        });
      } else if (record.sessionKey && record.amount === item.amount) {
        // Healthy-looking — verify shared/{sessionKey} actually exists.
        const sharedSnap = await adminDb.ref('shared/' + record.sessionKey).once('value');
        if (sharedSnap.val() === null) {
          ghosts.push({ item, record });
          console.warn('[Reconcile] Ghost detected', {
            paymentId: item.id,
            sessionKey: record.sessionKey,
          });
        } else {
          healthyCount++;
        }
      } else {
        console.warn('[Reconcile] Unclassifiable record', { paymentId: item.id });
        unknownCount++;
      }
    }

    const matched = healthyCount + amountDrifts.length + ghosts.length;
    const total = afterBuffer.length;
    const coverage = {
      matched,
      total,
      percent: total ? Math.round((matched / total) * 100) : 100,
    };

    const summary = {
      healthy: healthyCount,
      orphan: orphans.length,
      stuck: stuck.length,
      ghost: ghosts.length,
      amountDrift: amountDrifts.length,
      inProgress: inProgressCount,
      unknown: unknownCount,
    };

    const scanDurationMs = Date.now() - scanStartMs;

    console.log('[Reconcile] Scan complete', { summary, coverage, scanDurationMs });

    return res.status(200).json({
      windowStart: new Date(fromSeconds * 1000).toISOString(),
      windowEnd: new Date(toSeconds * 1000).toISOString(),
      daysScanned: days,
      pagesScanned,
      truncated,
      totalCapturedFromRazorpay: captured.length,
      skippedRecent,
      coverage,
      summary,
      issues: {
        orphans: orphans.map(item => ({
          paymentId: item.id,
          orderId: item.order_id,
          amount: item.amount,
          // item.created_at is seconds → convert to ms for ISO string
          capturedAt: new Date(item.created_at * 1000).toISOString(),
        })),
        stuck: stuck.map(({ item, record }) => ({
          paymentId: item.id,
          orderId: item.order_id,
          claimedAt: record.claimedAt,
          ageSeconds: Math.floor((Date.now() - record.claimedAt) / 1000),
        })),
        ghosts: ghosts.map(({ item, record }) => ({
          paymentId: item.id,
          sessionKey: record.sessionKey,
          amount: item.amount,
        })),
        amountDrift: amountDrifts.map(({ item, record }) => ({
          paymentId: item.id,
          razorpayAmount: item.amount,
          rtdbAmount: record.amount,
          sessionKey: record.sessionKey,
        })),
      },
      scanDurationMs,
    });
  } catch (err) {
    console.error('[Reconcile] CRITICAL', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
