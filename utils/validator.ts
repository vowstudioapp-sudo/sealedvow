import { z } from 'zod';
import { CoupleData } from '../types';

/**
 * SECURITY LIMITS
 */
export const SECURITY_LIMITS = {
  MAX_TEXT_LENGTH: 10_000,
  MAX_NAME_LENGTH: 100,
  MAX_CAPTION_LENGTH: 200,
  MAX_COUPONS: 10,
  MAX_MEMORY_PHOTOS: 10,
} as const;

/**
 * SANITIZATION
 * Removes dangerous HTML/JS from text
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * URL VALIDATION
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (
        parsed.hostname.includes('firebasestorage.googleapis.com') ||
        parsed.hostname.includes('storage.googleapis.com') ||
        parsed.hostname.includes('googleapis.com') ||
        parsed.hostname.includes('archive.org') ||
        parsed.hostname.includes('youtube.com') ||
        parsed.hostname.includes('youtu.be') ||
        parsed.hostname.includes('google.com')
      )
    );
  } catch {
    return false;
  }
}

/**
 * SCHEMAS
 */
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

/**
 * MAIN SCHEMA
 */
export const CoupleDataSchema = z.object({
  recipientName: z.string().min(1).max(SECURITY_LIMITS.MAX_NAME_LENGTH).transform(sanitizeString),
  senderName: z.string().min(1).max(SECURITY_LIMITS.MAX_NAME_LENGTH).transform(sanitizeString),

  theme: z.enum(['obsidian', 'velvet', 'crimson', 'midnight', 'evergreen', 'pearl']),
  occasion: z.enum(['valentine', 'anniversary', 'apology', 'just-because', 'long-distance', 'thank-you']),

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
  giftLink: z.string().max(500).refine(isValidUrl).optional(),

  coupons: z.array(CouponSchema).max(SECURITY_LIMITS.MAX_COUPONS).optional(),

  locationMemory: z.string().max(500).transform(sanitizeString).optional(),
  manualMapLink: z.string().max(500).refine(isValidUrl).optional(),
  sacredLocation: SacredLocationSchema.optional(),

  memoryBoard: z.array(MemoryPhotoSchema).max(SECURITY_LIMITS.MAX_MEMORY_PHOTOS).optional(),
  futureImages: z.array(z.string().max(500).refine(isValidUrl)).max(10).optional(),

  passcodeEnabled: z.boolean().optional(),
  passcodeHint: z.string().max(200).transform(sanitizeString).optional(),
});

/**
 * VALIDATION FUNCTION
 */
export function validateCoupleData(
  raw: unknown
): { success: true; data: CoupleData } | { success: false; error: string } {
  try {
    return { success: true, data: CoupleDataSchema.parse(raw) as CoupleData };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const issues = (err as z.ZodError<unknown>).issues ?? [];
      const message = issues[0]?.message ?? 'Invalid data';
      return { success: false, error: message };
    }
    return { success: false, error: 'Invalid data' };
  }
}