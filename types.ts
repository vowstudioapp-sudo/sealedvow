/**
 * VOW Application Types
 * Clean, stable, production-safe
 * No base64, no over-engineering
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum AppStage {
  LANDING = 'LANDING',
  PREPARE = 'PREPARE',
  REFINE = 'REFINE',
  PREVIEW = 'PREVIEW',
  PAYMENT = 'PAYMENT',
  SHARE = 'SHARE',
  PERSONAL_INTRO = 'PERSONAL_INTRO',
  ENVELOPE = 'ENVELOPE',
  QUESTION = 'QUESTION',
  SOULMATE_SYNC = 'SOULMATE_SYNC',
  MAIN_EXPERIENCE = 'MAIN_EXPERIENCE',
  MASTER_CONTROL = 'MASTER_CONTROL',
}

export enum LetterStatus {
  DRAFT = 'draft',
  PREVIEW = 'preview',
  PAID = 'paid',
  DELIVERED = 'delivered',
}

// ============================================================================
// UNION TYPES
// ============================================================================

export type Occasion =
  | 'valentine'
  | 'anniversary'
  | 'apology'
  | 'just-because'
  | 'long-distance'
  | 'thank-you';

export type Theme =
  | 'obsidian'
  | 'velvet'
  | 'crimson'
  | 'midnight'
  | 'evergreen'
  | 'pearl';

export type RevealMethod =
  | 'immediate'
  | 'remote'
  | 'vigil'
  | 'sync';

export type GiftType =
  | 'voyage'
  | 'gastronomy'
  | 'spectacle'
  | 'treasure'
  | 'other';

export type WritingMode =
  | 'self'
  | 'assisted';

export type MusicType =
  | 'preset'
  | 'youtube';

// ============================================================================
// SUPPORTING INTERFACES
// ============================================================================

export interface Coupon {
  id: string;
  title: string;
  description: string;
  icon: string;
  isOpen: boolean;
  isClaimed?: boolean;
  isSpecial?: boolean;
}

export interface SacredLocation {
  placeName: string;
  description?: string;
  googleMapsUri?: string;
  latLng?: {
    lat: number;
    lng: number;
  };
}

export interface MemoryPhoto {
  url: string;       // Firebase Storage URL
  caption: string;
  angle: number;     // -30 to 30
  xOffset: number;   // -100 to 100
  yOffset: number;   // -100 to 100
}

export interface VideoData {
  url: string;       // Firebase Storage URL
  source: 'user' | 'ai';
  duration?: number; // seconds
}

export interface AudioData {
  url: string;       // Firebase Storage URL
  source: 'user' | 'ai';
  duration?: number; // seconds
}

// ============================================================================
// MAIN DOMAIN OBJECT
// ============================================================================

export interface CoupleData {
  // -------------------------------------------------------------------------
  // IDENTITY
  // -------------------------------------------------------------------------

  sessionId?: string;
  recipientName: string;
  senderName: string;

  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------

  status?: LetterStatus;
  createdAt?: string;        // ISO timestamp
  updatedAt?: string;        // ISO timestamp
  sealedAt?: string;         // ISO timestamp — set at payment verification
  previewExpiresAt?: string; // ISO timestamp

  // -------------------------------------------------------------------------
  // CONTENT
  // -------------------------------------------------------------------------

  occasion: Occasion;
  writingMode?: WritingMode;
  finalLetter?: string;
  myth?: string; // AI-generated poetic framing / narrative layer

  timeShared?: string;
  relationshipIntent?: string;
  sharedMoment?: string;

  // -------------------------------------------------------------------------
  // VISUAL THEME
  // -------------------------------------------------------------------------

  theme: Theme;

  // -------------------------------------------------------------------------
  // MEDIA (Firebase Storage URLs ONLY)
  // -------------------------------------------------------------------------

  userImageUrl?: string;
  aiImageUrl?: string;
  video?: VideoData;
  audio?: AudioData;

  // Editor-only video configuration (used by PreparationForm cinematic controls)
  videoSource?: 'none' | 'upload' | 'veo';
  videoAspectRatio?: '9:16' | '16:9';
  videoResolution?: '720p' | '1080p';
  videoStyle?: 'cinematic' | 'dreamy' | 'vintage';

  // -------------------------------------------------------------------------
  // MUSIC
  // -------------------------------------------------------------------------

  musicType?: MusicType;
  musicUrl?: string;

  // -------------------------------------------------------------------------
  // REVEAL / RITUAL
  // -------------------------------------------------------------------------

  revealMethod?: RevealMethod;
  unlockDate?: string | null;

  // -------------------------------------------------------------------------
  // GRAND GESTURE
  // -------------------------------------------------------------------------

  hasGift?: boolean;
  giftType?: GiftType;
  giftTitle?: string;
  giftLink?: string;

  // -------------------------------------------------------------------------
  // PROMISES
  // -------------------------------------------------------------------------

  coupons?: Coupon[];

  // -------------------------------------------------------------------------
  // LOCATION MEMORY
  // -------------------------------------------------------------------------

  locationMemory?: string;
  manualMapLink?: string;
  sacredLocation?: SacredLocation;

  // -------------------------------------------------------------------------
  // MEMORY BOARD
  // -------------------------------------------------------------------------

  memoryBoard?: MemoryPhoto[];

  // -------------------------------------------------------------------------
  // OPTIONAL PASSCODE (SENDER CONTROLLED)
  // -------------------------------------------------------------------------

  passcodeEnabled?: boolean; // default false
  passcodeHint?: string;     // optional, shown to receiver
  passcodeHashRef?: string; // server-side reference (never store plaintext)
}

// ============================================================================
// ERROR TYPE
// ============================================================================

export interface AppError {
  code: string;
  message: string;
  timestamp: string;  // ISO timestamp
  recoverable: boolean;
  details?: unknown;
}