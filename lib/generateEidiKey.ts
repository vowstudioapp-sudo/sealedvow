// ─────────────────────────────────────────────
// SealedVow — Eidi Key Generator
// Generates short, unguessable, URL-safe keys
// Example output: AX7F92, K9D3QL, P3T7XW
// ─────────────────────────────────────────────

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Removed: I, O, 0, 1 — avoids confusion when reading/sharing

const KEY_LENGTH = 6;
// 32^6 = 1 billion+ combinations — unguessable but short enough for WhatsApp sharing
// e.g. sealedvow.com/eidi/K7ZP4M

/**
 * Generates a cryptographically random Eidi key.
 * Works in both Node.js (API) and browser (if needed).
 */
export function generateEidiKey(): string {
  const bytes = new Uint8Array(KEY_LENGTH);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Browser or Node 19+
    crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback
    const { randomBytes } = require('crypto');
    const buf = randomBytes(KEY_LENGTH);
    for (let i = 0; i < KEY_LENGTH; i++) {
      bytes[i] = buf[i];
    }
  }

  return Array.from(bytes)
    .map(b => CHARSET[b % CHARSET.length])
    .join('');
}

/**
 * Validates that a given string looks like a valid Eidi key.
 * Use in API to reject obviously invalid keys early.
 */
export function isValidEidiKey(key: string): boolean {
  if (!key || key.length !== KEY_LENGTH) return false;
  return [...key].every(c => CHARSET.includes(c));
}