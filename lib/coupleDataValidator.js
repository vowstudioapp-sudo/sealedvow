// ============================================================================
// /lib/coupleDataValidator.js — Shared CoupleData schema (C11 + C12 fix)
//
// Single source of truth for CoupleData validation. Imported by:
//   - App.tsx (client localStorage hydration)
//   - api/verify-payment.js (server-side gate before writing shared/{sessionKey})
//
// Closes C11 (URL allowlist enforcement) and C12 (nested-object passthrough)
// by parsing the entire payload through Zod, including nested objects and
// arrays whose string fields and URLs are validated by the schema.
// ============================================================================

import { z } from 'zod';

// ── SECURITY LIMITS ──
export const SECURITY_LIMITS = Object.freeze({
  MAX_TEXT_LENGTH: 10_000,
  MAX_NAME_LENGTH: 100,
  MAX_CAPTION_LENGTH: 200,
  MAX_COUPONS: 10,
  MAX_MEMORY_PHOTOS: 10,
});

// ── SANITIZATION ──
// Belt-and-suspenders denylist: even though Zod validates structure and URLs,
// strip explicit XSS substrings from text fields. Defense-in-depth — the
// upstream schema enforces enum/length/URL allowlist; this only handles
// pathological text-field content if the schema ever loosens.
export function sanitizeString(input) {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

// ── URL ALLOWLIST (strict — host-bounded) ──
// https: only. Host must be one of the 7 trusted domains (or subdomain).
// Used by every internal URL field — media URLs, music (YouTube), maps —
// where we control the universe of valid hosts.
export function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    const isExactOrSubdomainOf = (baseHost) =>
      host === baseHost || host.endsWith(`.${baseHost}`);

    return (
      parsed.protocol === 'https:' &&
      (
        isExactOrSubdomainOf('firebasestorage.googleapis.com') ||
        isExactOrSubdomainOf('storage.googleapis.com') ||
        isExactOrSubdomainOf('googleapis.com') ||
        isExactOrSubdomainOf('archive.org') ||
        isExactOrSubdomainOf('youtube.com') ||
        isExactOrSubdomainOf('youtu.be') ||
        isExactOrSubdomainOf('google.com')
      )
    );
  } catch {
    return false;
  }
}

// ── HTTPS-ONLY VALIDATOR (permissive — open host) ──
// Used for fields where we cannot enumerate valid hosts (giftLink — users
// paste Amazon, Etsy, gift cards, payment app deep links). Still blocks
// javascript:, data:, file:, ftp:, etc. — anything non-https. Anchor href
// is the render surface; safeUrl() at GiftReveal provides a second layer.
export function isHttpsUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !!u.hostname;
  } catch {
    return false;
  }
}

// ── NESTED SCHEMAS ──
const CouponSchema = z.object({
  id: z.string().max(50),
  title: z.string().max(200).transform(sanitizeString),
  description: z.string().max(500).transform(sanitizeString),
  icon: z.string().max(10),
  isOpen: z.boolean(),
  isClaimed: z.boolean().optional(),
  isSpecial: z.boolean().optional(),
});

const SacredLocationSchema = z.object({
  placeName: z.string().max(200).transform(sanitizeString),
  description: z.string().max(500).transform(sanitizeString),
  googleMapsUri: z.string().max(500).refine(isValidUrl),
});

const MemoryPhotoSchema = z.object({
  url: z.string().max(500).refine(isValidUrl),
  caption: z.string().max(SECURITY_LIMITS.MAX_CAPTION_LENGTH).transform(sanitizeString),
  angle: z.number().min(-30).max(30),
  xOffset: z.number().min(-100).max(100),
  yOffset: z.number().min(-100).max(100),
});

const VideoDataSchema = z.object({
  url: z.string().max(500).refine(isValidUrl),
  source: z.enum(['user', 'ai']),
  duration: z.number().min(0).max(600).optional(),
});

const AudioDataSchema = z.object({
  url: z.string().max(500).refine(isValidUrl),
  source: z.enum(['user', 'ai']),
  duration: z.number().min(0).max(300).optional(),
});

// ── MAIN SCHEMA ──
export const CoupleDataSchema = z.object({
  recipientName: z.string().min(1).max(SECURITY_LIMITS.MAX_NAME_LENGTH).transform(sanitizeString),
  senderName: z.string().min(1).max(SECURITY_LIMITS.MAX_NAME_LENGTH).transform(sanitizeString),
  receiverPhoneNumber: z
    .string()
    .max(20)
    .transform(sanitizeString)
    .optional(),

  theme: z.enum(['obsidian', 'velvet', 'crimson', 'midnight', 'evergreen', 'pearl']),
  occasion: z.enum(['anniversary', 'apology', 'just-because', 'thank-you', 'eid', 'birthday']),

  sessionId: z.string().uuid().optional(),

  status: z.enum(['draft', 'preview', 'paid', 'delivered']).optional(),
  isPaid: z.boolean().optional(),
  isPreview: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  previewExpiresAt: z.string().optional(),

  timeShared: z.string().max(200).transform(sanitizeString).optional(),
  relationshipIntent: z.string().max(500).transform(sanitizeString).optional(),
  sharedMoment: z.string().max(2000).transform(sanitizeString).optional(),
  finalLetter: z.string().max(SECURITY_LIMITS.MAX_TEXT_LENGTH).transform(sanitizeString).optional(),
  senderRawThoughts: z.string().max(SECURITY_LIMITS.MAX_TEXT_LENGTH).transform(sanitizeString).optional(),
  writingMode: z.enum(['self', 'assisted']).optional(),
  myth: z.string().max(1000).transform(sanitizeString).optional(),

  userImageUrl: z.string().max(500).refine(isValidUrl).optional(),
  aiImageUrl: z.string().max(500).refine(isValidUrl).optional(),
  video: VideoDataSchema.optional(),
  audio: AudioDataSchema.optional(),

  musicType: z.enum(['preset', 'youtube']).optional(),
  musicUrl: z.string().max(500).refine(isValidUrl).optional(),

  revealMethod: z.enum(['vigil', 'remote', 'sync', 'immediate']).optional(),
  unlockDate: z.string().nullable().optional(),

  hasGift: z.boolean().optional(),
  giftType: z.enum(['voyage', 'gastronomy', 'spectacle', 'treasure', 'other']).optional(),
  giftTitle: z.string().max(200).transform(sanitizeString).optional(),
  giftLink: z.string().max(500).refine(isHttpsUrl).optional(),

  coupons: z.array(CouponSchema).max(SECURITY_LIMITS.MAX_COUPONS).optional(),

  locationMemory: z.string().max(500).transform(sanitizeString).optional(),
  manualMapLink: z.string().max(500).refine(isValidUrl).optional(),
  sacredLocation: SacredLocationSchema.optional(),

  memoryBoard: z.array(MemoryPhotoSchema).max(SECURITY_LIMITS.MAX_MEMORY_PHOTOS).optional(),
  futureImages: z.array(z.string().max(500).refine(isValidUrl)).max(10).optional(),

  passcodeEnabled: z.boolean().optional(),
  passcodeHint: z.string().max(200).transform(sanitizeString).optional(),
});

// ── VALIDATION FUNCTION ──
// Returns { success: true, data } on parse, { success: false, error } on fail.
// Caller decides what to do (server returns 400; client discards localStorage).
//
// The explicit JSDoc return type pins data to CoupleData so TS callers
// (App.tsx) get full type narrowing — Zod's inference via JS+allowJs is
// unreliable in the presence of `.transform()`, defaulting to optional `any`.
/**
 * @param {unknown} raw
 * @returns {{ success: true, data: import('../types').CoupleData } | { success: false, error: string }}
 */
export function validateCoupleData(raw) {
  try {
    return { success: true, data: CoupleDataSchema.parse(raw) };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues ?? [];
      const issue = issues[0];
      const path = issue?.path?.join('.') || '';
      const message = issue?.message ?? 'Invalid data';
      return { success: false, error: path ? `${path}: ${message}` : message };
    }
    return { success: false, error: 'Invalid data' };
  }
}
