import crypto from 'crypto';
import admin from "firebase-admin";

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

// ============================================================================
// /api/admin-generate-founder-codes.js — ADMIN-ONLY FOUNDER CODE GENERATOR
//
// Generates founder codes with collision checking and atomic Firebase writes.
// Protected by ADMIN_SECRET header authentication.
// ============================================================================

// ── SECURITY HELPERS ──

function safeCompare(a, b) {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(a),
      Buffer.from(b)
    );
  } catch {
    return false;
  }
}

// ── CODE GENERATION ──

/**
 * Sanitizes name for code prefix
 * - Uppercase only
 * - A-Z only
 * - Max 12 characters
 */
function sanitizeName(name) {
  if (!name || typeof name !== 'string') return null;
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .substring(0, 12);
}

/**
 * Generates random 5-character alphanumeric uppercase string
 */
function generateRandom5() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(5);
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generates a unique founder code with collision checking
 * Format: NAME-RANDOM5 or FOUNDER-RANDOM5
 */
async function generateUniqueCode(namePrefix = 'FOUNDER', maxAttempts = 5) {
  const prefix = namePrefix || 'FOUNDER';
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const random5 = generateRandom5();
    const code = `${prefix}-${random5}`;
    
    const snap = await adminDb.ref('founderCodes/' + code).once('value');
    const existing = snap.val();
    if (!existing) return code;
  }
  
  // All attempts exhausted
  throw new Error(`Failed to generate unique code after ${maxAttempts} attempts`);
}

/**
 * Creates Firebase record for a founder code
 */
function createCodeRecord(code, tier, expiryHours) {
  const now = Date.now();
  const expiresAt = now + (expiryHours * 60 * 60 * 1000);
  
  return {
    maxUses: 1,
    used: 0,
    active: true,
    expiresAt,
    tier,
    redeemedAt: null,
    createdAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }

  // ── ADMIN AUTHENTICATION ──
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('[Admin] Missing ADMIN_SECRET environment variable');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const providedSecret = req.headers['x-admin-secret'];
  if (!providedSecret || !safeCompare(providedSecret, adminSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── VALIDATE INPUT ──
  const { names, count = 1, tier = 'reply', expiryHours = 48 } = req.body || {};

  // Validate tier
  if (tier !== 'standard' && tier !== 'reply') {
    return res.status(400).json({ error: 'Invalid tier. Must be "standard" or "reply".' });
  }

  // Validate count (if names not provided)
  if (!names || !Array.isArray(names) || names.length === 0) {
    if (typeof count !== 'number' || count < 1 || count > 100) {
      return res.status(400).json({ error: 'Count must be between 1 and 100.' });
    }
    if (count > 50) {
      return res.status(400).json({ error: 'Too many codes in single request.' });
    }
  }

  // Validate expiryHours
  if (typeof expiryHours !== 'number' || expiryHours < 1 || expiryHours > 720) {
    return res.status(400).json({ error: 'Expiry hours must be between 1 and 720 (30 days).' });
  }

  try {
    // ── DETERMINE CODE GENERATION STRATEGY ──
    let namePrefixes = [];
    
    if (names && Array.isArray(names) && names.length > 0) {
      // Generate one code per name
      namePrefixes = names
        .map(name => sanitizeName(name))
        .filter(name => name && name.length > 0);
      
      if (namePrefixes.length === 0) {
        return res.status(400).json({ error: 'No valid names provided. Names must contain at least one A-Z character.' });
      }
    } else {
      // Generate generic codes
      const codeCount = Math.floor(count);
      namePrefixes = Array(codeCount).fill('FOUNDER');
    }

    // ── GENERATE ALL CODES ──
    const codes = [];
    const updates = {};

    for (const namePrefix of namePrefixes) {
      const code = await generateUniqueCode(namePrefix);
      codes.push(code);
      
      // Prepare Firebase record
      const record = createCodeRecord(code, tier, expiryHours);
      updates[`founderCodes/${code}`] = record;
    }

    // ── ATOMIC WRITE ALL CODES ──
    await adminDb.ref().update(updates);

    // ── LOG SUCCESS ──
    console.log(`[Admin] Generated ${codes.length} founder code(s).`);

    // ── RETURN RESPONSE ──
    return res.status(200).json({
      success: true,
      generated: codes,
    });

  } catch (error) {
    console.error('[Admin] Error generating founder codes:', error.message);
    return res.status(500).json({ error: 'Failed to generate founder codes.' });
  }
}
