// ============================================================================
// /api/create-eidi.js — Create a Sealed Eidi Envelope
// ============================================================================

import { adminDb, guardPost, getClientIP, rateLimit, setCors } from './lib/middleware.js';
import { generateEidiKey } from '../lib/generateEidiKey';
import { FEATURES } from '../config/features';

const MAX_AMOUNT       = 100_000;
const MAX_BLESSING_LEN = 1000;
const MAX_NAME_LEN     = 100;

const VALID_THEMES     = ['classic-green', 'golden-royal', 'animated-moon', 'ottoman-art'];
const VALID_CURRENCIES = ['INR', 'USD', 'AED'];

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (guardPost(req, res)) return;

  // ── FEATURE FLAG ──
  if (!FEATURES.eidiEnabled) {
    return res.status(404).json({ error: 'Not found.' });
  }

  // ── RATE LIMITING ──
  const ip = getClientIP(req);
  const { limited } = await rateLimit(req, {
    keyPrefix: 'eidi_create',
    windowSeconds: 60,
    max: 10,
  });
  if (limited) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  // ── PARSE BODY ───────────────────────────────────────────────────────

  const body = req.body || {};

  // Normalize currency separately — avoids null/undefined bypassing default
  const currency = typeof body.currency === 'string' ? body.currency : 'INR';

  const {
    senderName,
    receiverName,
    relationship,
    blessing,
    blessingLanguage,
    voiceUrl,
    amount,
    envelopeTheme = 'classic-green',
    unlockAt,
  } = body;

  // ── VALIDATION ──────────────────────────────────────────────────────

  if (!senderName || typeof senderName !== 'string' || senderName.trim().length === 0) {
    return res.status(400).json({ error: 'Sender name is required.' });
  }
  if (!receiverName || typeof receiverName !== 'string' || receiverName.trim().length === 0) {
    return res.status(400).json({ error: 'Receiver name is required.' });
  }
  if (senderName.trim().length > MAX_NAME_LEN) {
    return res.status(400).json({ error: 'Sender name is too long.' });
  }
  if (receiverName.trim().length > MAX_NAME_LEN) {
    return res.status(400).json({ error: 'Receiver name is too long.' });
  }

  const hasBlessing = typeof blessing === 'string' && blessing.trim().length > 0;
  const hasAmount   = typeof amount === 'number' && amount > 0;

  if (!hasBlessing && !hasAmount) {
    return res.status(400).json({ error: 'Please add a blessing or an Eidi amount.' });
  }

  // Explicit type guard — rejects "500" string amounts
  if (amount !== undefined && typeof amount !== 'number') {
    return res.status(400).json({ error: 'Invalid amount.' });
  }
  if (hasBlessing && blessing.trim().length > MAX_BLESSING_LEN) {
    return res.status(400).json({ error: 'Blessing is too long (max 1000 characters).' });
  }
  if (hasAmount && !Number.isInteger(amount)) {
    return res.status(400).json({ error: 'Amount must be a whole number.' });
  }
  if (hasAmount && amount > MAX_AMOUNT) {
    return res.status(400).json({ error: `Amount must be under ₹${MAX_AMOUNT.toLocaleString()}.` });
  }
  if (!VALID_THEMES.includes(envelopeTheme)) {
    return res.status(400).json({ error: 'Invalid envelope theme.' });
  }
  if (!VALID_CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: 'Invalid currency.' });
  }
  if (unlockAt !== undefined) {
    if (typeof unlockAt !== 'number' || unlockAt <= Date.now()) {
      return res.status(400).json({ error: 'Unlock time must be in the future.' });
    }
  }
  if (voiceUrl && (!voiceUrl.startsWith('https://') || !voiceUrl.includes('firebasestorage.googleapis.com'))) {
    return res.status(400).json({ error: 'Invalid voice URL.' });
  }

  // ── GENERATE UNIQUE KEY ──────────────────────────────────────────────

  let id;
  let attempts = 0;

  while (attempts < 5) {
    const candidate = generateEidiKey();
    const existing  = await adminDb.ref(`eidi/${candidate}`).once('value');
    if (!existing.val()) {
      id = candidate;
      break;
    }
    attempts++;
    console.warn(`[create-eidi] Key collision attempt ${attempts}: ${candidate}`);
  }

  if (!id) {
    console.error('[create-eidi] Failed to generate unique key after 5 attempts');
    return res.status(500).json({ error: 'Failed to create envelope. Please try again.' });
  }

  // ── BUILD RECORD ─────────────────────────────────────────────────────

  const eidiRecord = {
    version:      1,
    id,
    createdAt:    Date.now(),

    senderName:   senderName.trim(),
    receiverName: receiverName.trim(),
    ...(relationship && relationship.trim() && { relationship: relationship.trim().slice(0, 50) }),

    ...(hasBlessing && { blessing: blessing.trim() }),
    ...(blessingLanguage && { blessingLanguage }),
    ...(voiceUrl && { voiceUrl }),

    ...(hasAmount && { amount, currency }),

    envelopeTheme,
    ...(unlockAt !== undefined && { unlockAt }),

    // State — always set server-side, never trust client
    opened:   false,
    openedAt: null,
  };

  // ── SAVE TO FIREBASE ─────────────────────────────────────────────────

  try {
    await adminDb.ref(`eidi/${id}`).set(eidiRecord);
    console.log(`[create-eidi] ✓ ${ip} created ${id} — ${senderName.trim()} → ${receiverName.trim()}`);
  } catch (dbErr) {
    console.error('[create-eidi] Firebase write failed:', dbErr);
    return res.status(500).json({ error: 'Failed to save envelope. Please try again.' });
  }

  return res.status(201).json({ id });
}