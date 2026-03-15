// ============================================================================
// /api/create-eidi.js — Create a Sealed Eidi Envelope (PRODUCTION VERSION)
// 
// Supports both:
// - Simple Eidi (blessing + amount only) - v1 format
// - Rich Eidi (letter, memories, duas, eidi) - v2 format
// ============================================================================

import { adminDb, guardPost, getClientIP, rateLimit, setCors } from './lib/middleware.js';
import { generateEidiKey } from '../lib/generateEidiKey';
import { FEATURES } from '../config/features';

// ── LIMITS ──────────────────────────────────────────────────────────────
const MAX_PAYLOAD_SIZE = 15000;    // Prevent abuse
const MAX_AMOUNT       = 100_000;
const MAX_BLESSING_LEN = 1000;
const MAX_NAME_LEN     = 100;
const MAX_LETTER_LEN   = 2000;
const MAX_MEMORY_CAP   = 200;
const MAX_DUA_TEXT     = 300;

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

  // ── PAYLOAD SIZE CHECK (Security) ──
  const body = req.body || {};
  if (JSON.stringify(body).length > MAX_PAYLOAD_SIZE) {
    return res.status(400).json({ error: 'Payload too large.' });
  }

  // ── PARSE BODY ───────────────────────────────────────────────────────
  const currency = typeof body.currency === 'string' ? body.currency : 'INR';

  const {
    senderName,
    receiverName,
    relationship,
    blessing,
    blessingLanguage,
    voiceUrl,
    
    // Rich experience fields (v2)
    letter,        // { heading, body, sign }
    memories,      // [{ icon, caption }]
    duas,          // [{ icon, text }]
    eidi,          // { amount, message }
    
    // Legacy simple fields (v1 - backward compatible)
    amount,
    
    envelopeTheme = 'classic-green',
    unlockAt,
  } = body;

  // ── VALIDATION: BASIC FIELDS ────────────────────────────────────────
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

  // ── VALIDATION: BLESSING ────────────────────────────────────────────
  const hasBlessing = typeof blessing === 'string' && blessing.trim().length > 0;
  if (hasBlessing && blessing.trim().length > MAX_BLESSING_LEN) {
    return res.status(400).json({ error: 'Blessing is too long (max 1000 characters).' });
  }

  // ── VALIDATION: LETTER ──────────────────────────────────────────────
  let cleanLetter = null;
  if (letter && typeof letter === 'object') {
    const heading = typeof letter.heading === 'string' ? letter.heading.trim() : '';
    const body = typeof letter.body === 'string' ? letter.body.trim() : '';
    const sign = typeof letter.sign === 'string' ? letter.sign.trim() : '';
    
    if (body.length > MAX_LETTER_LEN) {
      return res.status(400).json({ error: 'Letter is too long (max 2000 characters).' });
    }
    
    // Only include letter if it has content
    if (heading || body || sign) {
      cleanLetter = { heading, body, sign };
    }
  }

  // ── VALIDATION: MEMORIES ────────────────────────────────────────────
  let cleanMemories = null;
  if (memories && Array.isArray(memories)) {
    if (memories.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 memories allowed.' });
    }
    
    // Filter out empty memories and validate
    const validMemories = memories.filter(mem => {
      if (!mem || typeof mem !== 'object') return false;
      if (!mem.icon || !mem.caption) return false;
      if (typeof mem.caption !== 'string') return false;
      if (mem.caption.trim().length === 0) return false;
      if (mem.caption.length > MAX_MEMORY_CAP) {
        throw new Error('Memory caption is too long (max 200 characters).');
      }
      return true;
    });
    
    if (validMemories.length > 0) {
      cleanMemories = validMemories.map(mem => ({
        icon: mem.icon.trim(),
        caption: mem.caption.trim()
      }));
    }
  }

  // ── VALIDATION: DUAS ────────────────────────────────────────────────
  let cleanDuas = null;
  if (duas && Array.isArray(duas)) {
    if (duas.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 duas allowed.' });
    }
    
    // Filter out empty duas and validate
    const validDuas = duas.filter(dua => {
      if (!dua || typeof dua !== 'object') return false;
      if (!dua.icon || !dua.text) return false;
      if (typeof dua.text !== 'string') return false;
      if (dua.text.trim().length === 0) return false;
      if (dua.text.length > MAX_DUA_TEXT) {
        throw new Error('Dua text is too long (max 300 characters).');
      }
      return true;
    });
    
    if (validDuas.length > 0) {
      cleanDuas = validDuas.map(dua => ({
        icon: dua.icon.trim(),
        text: dua.text.trim()
      }));
    }
  }

  // ── VALIDATION: EIDI ────────────────────────────────────────────────
  let cleanEidi = null;
  
  if (eidi && typeof eidi === 'object') {
    // New format: { amount, message }
    const eidiAmount = eidi.amount;
    
    // CRITICAL FIX: Handle both number and string inputs
    const parsedAmount = typeof eidiAmount === 'string' ? Number(eidiAmount) : eidiAmount;
    
    if (typeof parsedAmount !== 'number' || isNaN(parsedAmount) || !Number.isInteger(parsedAmount)) {
      return res.status(400).json({ error: 'Eidi amount must be a whole number.' });
    }
    if (parsedAmount < 0) {
      return res.status(400).json({ error: 'Eidi amount cannot be negative.' });
    }
    if (parsedAmount > MAX_AMOUNT) {
      return res.status(400).json({ error: `Amount must be under ₹${MAX_AMOUNT.toLocaleString()}.` });
    }
    
    if (parsedAmount > 0) {
      cleanEidi = {
        amount: parsedAmount,
        message: typeof eidi.message === 'string' ? eidi.message.trim() : '',
        currency: currency
      };
    }
  } else if (amount !== undefined) {
    // Legacy format: direct amount field (v1 backward compatibility)
    const parsedAmount = typeof amount === 'string' ? Number(amount) : amount;
    
    if (typeof parsedAmount !== 'number' || isNaN(parsedAmount) || !Number.isInteger(parsedAmount)) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }
    if (parsedAmount < 0) {
      return res.status(400).json({ error: 'Amount cannot be negative.' });
    }
    if (parsedAmount > MAX_AMOUNT) {
      return res.status(400).json({ error: `Amount must be under ₹${MAX_AMOUNT.toLocaleString()}.` });
    }
    
    if (parsedAmount > 0) {
      cleanEidi = {
        amount: parsedAmount,
        message: '',
        currency: currency
      };
    }
  }

  // ── AT LEAST ONE PIECE OF CONTENT ───────────────────────────────────
  const hasContent = hasBlessing || cleanLetter || cleanMemories || cleanDuas || cleanEidi;
  if (!hasContent) {
    return res.status(400).json({ error: 'Please add content to your Eidi card.' });
  }

  // ── VALIDATION: OTHER FIELDS ────────────────────────────────────────
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
  if (voiceUrl) {
    if (typeof voiceUrl !== 'string' || !voiceUrl.startsWith('https://') || !voiceUrl.includes('firebasestorage.googleapis.com')) {
      return res.status(400).json({ error: 'Invalid voice URL.' });
    }
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

  // ── DETERMINE VERSION ────────────────────────────────────────────────
  const isRichCard = !!(cleanLetter || cleanMemories || cleanDuas);
  const version = isRichCard ? 2 : 1;

  // ── BUILD RECORD ─────────────────────────────────────────────────────
  const eidiRecord = {
    version,
    id,
    createdAt: Date.now(),

    senderName:   senderName.trim(),
    receiverName: receiverName.trim(),
    ...(relationship && typeof relationship === 'string' && relationship.trim() && {
      relationship: relationship.trim().slice(0, 50)
    }),

    ...(hasBlessing && { blessing: blessing.trim() }),
    ...(blessingLanguage && typeof blessingLanguage === 'string' && {
      blessingLanguage: blessingLanguage.trim()
    }),
    ...(voiceUrl && { voiceUrl }),

    // Rich experience fields (v2 only)
    ...(cleanLetter && { letter: cleanLetter }),
    ...(cleanMemories && { memories: cleanMemories }),
    ...(cleanDuas && { duas: cleanDuas }),
    ...(cleanEidi && { eidi: cleanEidi }),

    envelopeTheme,
    ...(unlockAt !== undefined && { unlockAt }),

    // State tracking
    opened:    false,
    openedAt:  null,
    claimed:   false,
    claimedAt: null,
    claimedBy: null,
  };

  // ── SAVE TO FIREBASE ─────────────────────────────────────────────────
  try {
    await adminDb.ref(`eidi/${id}`).set(eidiRecord);
    console.log(`[create-eidi] ✓ v${version} ${ip} created ${id} — ${senderName.trim()} → ${receiverName.trim()}`);
  } catch (dbErr) {
    console.error('[create-eidi] Firebase write failed:', dbErr);
    return res.status(500).json({ error: 'Failed to save envelope. Please try again.' });
  }

  return res.status(201).json({ id });
}