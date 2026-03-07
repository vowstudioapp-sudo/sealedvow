// ============================================================================
// /api/load-eidi.js — Load a Sealed Eidi Envelope
// ============================================================================

import { adminDb, getClientIP, rateLimit, setCors } from './lib/middleware.js';
import { isValidEidiKey } from '../lib/generateEidiKey';
import { FEATURES } from '../config/features';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // ── FEATURE FLAG ──
  if (!FEATURES.eidiEnabled) {
    return res.status(404).json({ error: 'Not found.' });
  }

  // ── RATE LIMITING ──
  const ip = getClientIP(req);
  const { limited } = await rateLimit(req, {
    keyPrefix: 'eidi_load',
    windowSeconds: 60,
    max: 30,
  });
  if (limited) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  // ── KEY VALIDATION ──────────────────────────────────────────────────

  // Normalize to uppercase — prevents valid keys failing due to case
  const rawId = typeof req.query.id === 'string' ? req.query.id : null;
  const id    = rawId ? rawId.toUpperCase() : null;

  if (!id) {
    return res.status(400).json({ error: 'Eidi ID is required.' });
  }

  // Rate-limit invalid key probes BEFORE returning — blocks brute-force scanners
  if (!isValidEidiKey(id)) {
    await rateLimit(req, {
      keyPrefix: 'eidi_probe',
      windowSeconds: 60,
      max: 10,
    });
    return res.status(404).json({ error: 'Eidi not found.' });
  }

  // ── FETCH FROM FIREBASE ──────────────────────────────────────────────

  let record;
  try {
    const snap = await adminDb.ref(`eidi/${id}`).once('value');
    record = snap.val();
  } catch (dbErr) {
    console.error('[load-eidi] Firebase read failed:', dbErr);
    return res.status(500).json({ error: 'Failed to load envelope. Please try again.' });
  }

  if (!record) {
    return res.status(404).json({ error: 'Eidi not found.' });
  }

  // ── UNLOCK CHECK ─────────────────────────────────────────────────────

  const now = Date.now();

  const unlockAt = Number(record.unlockAt);
  if (unlockAt && now < unlockAt) {
    return res.status(200).json({
      locked:       true,
      lockedUntil:  unlockAt,
      receiverName: record.receiverName,
    });
  }

  // ── MARK OPENED (first time only) ───────────────────────────────────
  // Non-fatal — envelope loads even if state update fails

  if (!record.opened) {
    try {
      await adminDb.ref(`eidi/${id}`).update({
        opened:   true,
        openedAt: now,
      });
      console.log(`[load-eidi] ✓ ${ip} opened ${id} for ${record.receiverName}`);
    } catch (updateErr) {
      console.error('[load-eidi] Failed to mark opened:', updateErr);
    }
  }

  // ── BUILD SAFE RESPONSE ──────────────────────────────────────────────
  // Never return: version, createdAt, opened, openedAt

  return res.status(200).json({
    locked: false,

    senderName:   record.senderName,
    receiverName: record.receiverName,
    ...(record.relationship     && { relationship:      record.relationship }),
    ...(record.blessing         && { blessing:          record.blessing }),
    ...(record.blessingLanguage && { blessingLanguage:  record.blessingLanguage }),
    ...(record.voiceUrl         && { voiceUrl:          record.voiceUrl }),

    // Use !== undefined — avoids hiding amount:0 if ever allowed later
    ...(record.amount   !== undefined && { amount:   record.amount }),
    ...(record.currency !== undefined && { currency: record.currency }),

    envelopeTheme: record.envelopeTheme,
  });
}