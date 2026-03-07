// ─────────────────────────────────────────────
// SealedVow — Eidi Types
// Eidi-specific types only. Nothing duplicated
// from the main types.ts file.
// ─────────────────────────────────────────────

export type EnvelopeTheme =
  | 'classic-green'   // Free
  | 'golden-royal'    // Free
  | 'animated-moon'   // Premium ₹29
  | 'ottoman-art';    // Premium ₹49

export type BlessingLanguage = 'en' | 'ur' | 'ar' | 'hi';

export type EidiCurrency = 'INR' | 'USD' | 'AED';

export interface EidiData {
  // Schema versioning — increment on breaking changes
  version: 1;

  // Identity
  id: string;                        // Generated key e.g. "AX7F92"
  createdAt: number;                 // Unix timestamp ms

  // People
  senderName: string;
  receiverName: string;
  relationship?: string;             // Optional — "beta", "bhai", "beti" etc.

  // Content
  blessing?: string;                 // Optional — text dua / blessing
  blessingLanguage?: BlessingLanguage;
  voiceUrl?: string;                 // Firebase Storage URL if voice recorded
  amount?: number;                   // Symbolic Eidi amount (optional)
  currency?: EidiCurrency;           // Future-proof — defaults to INR

  // Experience
  envelopeTheme: EnvelopeTheme;
  unlockAt?: number;                 // Unix timestamp ms — if time-locked to Eid morning
  revealSenderAfterOpen?: boolean;   // default true — false = "Mystery Eidi" mode

  // State — never trust client, always set server-side
  opened: boolean;                   // Default: false (set by server on create)
  openedAt?: number;                 // When receiver opened
}

// ─────────────────────────────────────────────
// Reveal logic derived from EidiData
// ─────────────────────────────────────────────

export type RevealOutcome =
  | { type: 'blessing-and-amount'; blessing: string; amount: number }
  | { type: 'blessing-only';       blessing: string }
  | { type: 'amount-only';         amount: number }
  | { type: 'invalid' };            // Both missing — blocked at creation

export function getRevealOutcome(data: EidiData): RevealOutcome {
  const hasBlessing = typeof data.blessing === 'string' && data.blessing.trim().length > 0;
  const hasAmount   = typeof data.amount   === 'number' && data.amount > 0;

  if (hasBlessing && hasAmount)  return { type: 'blessing-and-amount', blessing: data.blessing!, amount: data.amount! };
  if (hasBlessing && !hasAmount) return { type: 'blessing-only',       blessing: data.blessing! };
  if (!hasBlessing && hasAmount) return { type: 'amount-only',         amount: data.amount! };
  return { type: 'invalid' };
}

// ─────────────────────────────────────────────
// API request / response shapes
// ─────────────────────────────────────────────

export interface CreateEidiRequest {
  senderName:        string;
  receiverName:      string;
  relationship?:     string;
  blessing?:         string;
  blessingLanguage?: BlessingLanguage;
  voiceUrl?:         string;
  amount?:           number;
  currency?:         EidiCurrency;   // Future-proof for real money
  envelopeTheme:     EnvelopeTheme;
  unlockAt?:         number;
}

export interface CreateEidiResponse {
  id: string;                        // Frontend builds URL: /eidi/{id}
                                     // Avoids localhost/staging/prod mismatch
}

export interface LoadEidiResponse {
  data:         EidiData;
  locked:       boolean;             // true if unlockAt is in the future
  lockedUntil?: number;              // Unix ms — for countdown display
}