import { useEffect, useRef } from 'react';
import type { CoupleData, AppStage } from '../types';

const STORAGE_KEY = 'vday_data_draft';
// PR-47.1 (Option F): single local persistence authority for creator-state
// recovery. The historical sibling `vday_data` (post-Refine snapshot) was
// removed; refined-state fidelity now lives entirely in this bucket via the
// extended selectiveHydrate allowlist below.
const CURRENT_SCHEMA_VERSION = 2;
// v1 drafts (pre-stage) are still readable; missing `stage` reads as undefined
// and the App-level validity guard falls back to the route default. The next
// write at v2 silently forward-migrates the on-disk shape.
const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1, 2];
const DEFAULT_DEBOUNCE_MS = 1000;

type StepValue = 1 | 2 | 3;

interface StoredDraft {
  version: number;
  data: Partial<CoupleData>;
  step?: StepValue;
  stage?: AppStage;
  // PR #21 — optimistic draftId hint. Persisted by App.tsx after a
  // successful /api/drafts/save and at hydration completion. Cloud /list
  // remains canonical; on hint vs cloud mismatch, cloud wins and the hint
  // is overwritten. The hint exists solely to close the post-mount race
  // window where the user could click save before /list hydration completed.
  draftId?: string;
  savedAt: string;
}

// Text-only, no media. Safe to restore as-is. PR-47.1 additions: `myth`
// (RefineStage AI narrative), `giftNote` (authored content), and the four
// editor-only video config fields — all previously only survived recovery
// via the now-deleted vday_data bucket.
const TEXT_SAFE_FIELDS: (keyof CoupleData)[] = [
  'recipientName',
  'senderName',
  'occasion',
  'theme',
  'timeShared',
  'relationshipIntent',
  'sharedMoment',
  'writingMode',
  'finalLetter',
  'senderRawThoughts',
  'myth',
  'musicType',
  'musicUrl',
  'revealMethod',
  'unlockDate',
  'locationMemory',
  'manualMapLink',
  'hasGift',
  'giftType',
  'giftTitle',
  'giftNote',
  'giftLink',
  'videoSource',
  'videoAspectRatio',
  'videoResolution',
  'videoStyle',
];

// Restore wholesale. Coupons are text data; sessionId preserves continuity.
const STRUCTURED_TEXT_FIELDS: (keyof CoupleData)[] = [
  'coupons',
  'sessionId',
];

// Media + validated-structured fields safe to restore. Storage URLs are
// stable across sessions in this product. PR-47.1 (Option F) promoted
// audio/video/aiImageUrl/sacredLocation into this allowlist when vday_data
// was deleted — refined-state fidelity now lives entirely in vday_data_draft,
// gated by defensive validators in selectiveHydrate below.
const MEDIA_FIELDS_RESTORED: (keyof CoupleData)[] = [
  'memoryBoard',
  'userImageUrl',
  'audio',
  'video',
  'aiImageUrl',
  'sacredLocation',
];

function selectiveHydrate(stored: Partial<CoupleData>): Partial<CoupleData> {
  const safe: Partial<CoupleData> = {};
  const allowedFields = [
    ...TEXT_SAFE_FIELDS,
    ...STRUCTURED_TEXT_FIELDS,
    ...MEDIA_FIELDS_RESTORED,
  ];
  for (const field of allowedFields) {
    if (field in stored && stored[field] !== undefined) {
      // Defensive validation for memoryBoard — drop malformed photos
      // (no url, wrong shape) instead of letting them crash the renderer.
      if (field === 'memoryBoard' && Array.isArray(stored.memoryBoard)) {
        safe.memoryBoard = stored.memoryBoard.filter(
          (photo) =>
            photo &&
            typeof photo === 'object' &&
            typeof photo.url === 'string' &&
            photo.url.length > 0
        );
        continue;
      }

      // Defensive validation for userImageUrl — drop empty strings.
      if (field === 'userImageUrl' && typeof stored.userImageUrl === 'string') {
        if (stored.userImageUrl.length > 0) {
          safe.userImageUrl = stored.userImageUrl;
        }
        continue;
      }

      // PR-47.1 (Option F): aiImageUrl — drop empty strings. Restoring
      // locally avoids a regen round-trip on refresh.
      if (field === 'aiImageUrl' && typeof stored.aiImageUrl === 'string') {
        if (stored.aiImageUrl.length > 0) {
          safe.aiImageUrl = stored.aiImageUrl;
        }
        continue;
      }

      // PR-47.1 (Option F): audio — require non-empty url and recognized
      // source. Drops malformed objects without crashing the renderer.
      if (field === 'audio' && stored.audio && typeof stored.audio === 'object') {
        const a = stored.audio as { url?: unknown; source?: unknown; duration?: unknown };
        if (
          typeof a.url === 'string' &&
          a.url.length > 0 &&
          (a.source === 'user' || a.source === 'ai')
        ) {
          safe.audio = {
            url: a.url,
            source: a.source,
            ...(typeof a.duration === 'number' ? { duration: a.duration } : {}),
          };
        }
        continue;
      }

      // PR-47.1 (Option F): video — same shape as audio.
      if (field === 'video' && stored.video && typeof stored.video === 'object') {
        const v = stored.video as { url?: unknown; source?: unknown; duration?: unknown };
        if (
          typeof v.url === 'string' &&
          v.url.length > 0 &&
          (v.source === 'user' || v.source === 'ai')
        ) {
          safe.video = {
            url: v.url,
            source: v.source,
            ...(typeof v.duration === 'number' ? { duration: v.duration } : {}),
          };
        }
        continue;
      }

      // PR-47.1 (Option F): sacredLocation — require placeName. Optional
      // fields (description, googleMapsUri, latLng) are restored only when
      // shape-valid; consumed by MainExperience.tsx for receiver preview.
      if (
        field === 'sacredLocation' &&
        stored.sacredLocation &&
        typeof stored.sacredLocation === 'object'
      ) {
        const s = stored.sacredLocation as {
          placeName?: unknown;
          description?: unknown;
          googleMapsUri?: unknown;
          latLng?: unknown;
        };
        if (typeof s.placeName === 'string' && s.placeName.length > 0) {
          const rawLatLng = s.latLng as { lat?: unknown; lng?: unknown } | undefined;
          const safeLatLng =
            rawLatLng &&
            typeof rawLatLng === 'object' &&
            typeof rawLatLng.lat === 'number' &&
            typeof rawLatLng.lng === 'number'
              ? { lat: rawLatLng.lat, lng: rawLatLng.lng }
              : undefined;
          safe.sacredLocation = {
            placeName: s.placeName,
            ...(typeof s.description === 'string' ? { description: s.description } : {}),
            ...(typeof s.googleMapsUri === 'string' ? { googleMapsUri: s.googleMapsUri } : {}),
            ...(safeLatLng ? { latLng: safeLatLng } : {}),
          };
        }
        continue;
      }

      // @ts-expect-error — index assignment across keyof union
      safe[field] = stored[field];
    }
  }
  return safe;
}

interface DraftPeek {
  data: Partial<CoupleData> | null;
  step: StepValue | null;
  stage: AppStage | null;
  // PR #21 — optimistic draftId hint surfaced for App.tsx's lazy initializer.
  draftId: string | null;
}

function readDraft(): DraftPeek | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(parsed.version)) {
      console.warn(
        '[usePreparationPersistence] Discarding draft with unsupported version',
        parsed.version,
        'supported',
        SUPPORTED_SCHEMA_VERSIONS
      );
      return null;
    }
    if (typeof parsed.data !== 'object' || parsed.data === null) return null;
    const safe = selectiveHydrate(parsed.data);
    // step is optional for backward compat with PR #7 drafts (no step field).
    // Caller treats null as "use default step 1".
    const step: StepValue | null =
      parsed.step === 1 || parsed.step === 2 || parsed.step === 3
        ? parsed.step
        : null;
    // optional for v1 drafts (no stage field); caller re-validates against data.
    const stage: AppStage | null =
      typeof parsed.stage === 'string' ? (parsed.stage as AppStage) : null;
    // PR #21 — draftId hint, optional for any pre-PR-#21 draft.
    const draftId: string | null =
      typeof parsed.draftId === 'string' && parsed.draftId.length > 0
        ? parsed.draftId
        : null;
    return { data: safe, step, stage, draftId };
  } catch (err) {
    console.warn('[usePreparationPersistence] Read failed:', err);
    return null;
  }
}

function writeDraft(data: CoupleData, step: StepValue): void {
  if (typeof window === 'undefined') return;
  try {
    // Read-merge: preserve `stage` (PR #16) and `draftId` hint (PR #21) so
    // debounced PreparationForm writes don't clobber values written by
    // App.tsx via writeStage / writeDraftId.
    const existing = readDraft();
    const payload: StoredDraft = {
      version: CURRENT_SCHEMA_VERSION,
      data,
      step,
      savedAt: new Date().toISOString(),
      ...(existing?.stage ? { stage: existing.stage } : {}),
      ...(existing?.draftId ? { draftId: existing.draftId } : {}),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // QuotaExceededError or serialization failure — log and continue.
    // User typing is never blocked by persistence failure.
    console.warn('[usePreparationPersistence] Write failed:', err);
  }
}

// One-shot synchronous read for use at component mount, before the
// state hook initializes. Returns { data: null, step: null } if no
// draft exists or the stored draft is incompatible / malformed.
export function peekDraft(): DraftPeek {
  return readDraft() ?? { data: null, step: null, stage: null, draftId: null };
}

// Ongoing-write-only hook. The hook does NOT hydrate — use peekDraft()
// at component mount to seed initial state. The hook persists (data, step)
// to localStorage on every change with debounce.
export function usePreparationPersistence(
  data: CoupleData,
  step: StepValue,
  options: { debounceMs?: number; enabled?: boolean } = {}
): void {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      writeDraft(data, step);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, step, debounceMs, enabled]);
}

// Synchronous single-field stage update. Called from App.tsx's safeSetStage on
// every gated transition. No-ops without an existing draft — stage with no
// data behind it would fail the App-level validity guard anyway.
export function writeStage(stage: AppStage): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readDraft();
    if (!existing || !existing.data) return;
    const payload: StoredDraft = {
      version: CURRENT_SCHEMA_VERSION,
      data: existing.data as CoupleData,
      ...(existing.step ? { step: existing.step } : {}),
      stage,
      // PR #21 — preserve draftId hint through stage transitions.
      ...(existing.draftId ? { draftId: existing.draftId } : {}),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[usePreparationPersistence] Stage write failed:', err);
  }
}

// PR #21 — Synchronous single-field draftId hint update. Called from App.tsx
// after a successful /api/drafts/save (and during hydration when cloud
// reconciles). Pass null to clear the hint (e.g., on sign-out, or when
// hydration determines the cloud has no ACTIVE draft for this user).
//
// Cloud /list remains canonical. This hint exists solely to close the
// post-mount race window where the user could click save before /list
// hydration completed and trigger a 409 ACTIVE_DRAFT_EXISTS.
//
// No-ops gracefully if no draft exists yet — drafts get created lazily by
// writeDraft / writeDraftFromExternal when the user types something. Calling
// writeDraftId on an empty store doesn't materialize a draft; the hint will
// be picked up by the next read-merge write.
export function writeDraftId(draftId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readDraft();
    if (!existing || !existing.data) {
      // No draft exists yet (anonymous user with no localStorage content).
      // Clearing a non-existent hint is a no-op; setting one without an
      // underlying draft would create an orphan record. Skip both.
      return;
    }
    const payload: StoredDraft = {
      version: CURRENT_SCHEMA_VERSION,
      data: existing.data as CoupleData,
      ...(existing.step ? { step: existing.step } : {}),
      ...(existing.stage ? { stage: existing.stage } : {}),
      ...(draftId ? { draftId } : {}),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[usePreparationPersistence] DraftId write failed:', err);
  }
}

export function clearPreparationDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[usePreparationPersistence] Clear failed:', err);
  }
}

// Hand-rolled list (Patch 1). Every field here is EMPTY by default in
// usePreparationState's initial data. The heuristic checks ≥2 non-empty.
// Adding fields with default values to this list would defeat the
// heuristic — modal would appear for users who haven't done anything
// meaningful.
//
// NOT included: 'theme', 'occasion', 'writingMode', 'musicType',
// 'revealMethod', 'hasGift', 'giftType', 'relationshipIntent', 'coupons'
// — all have defaults set on fresh state.
const MEANINGFUL_DRAFT_FIELDS: (keyof CoupleData)[] = [
  'recipientName',
  'senderName',
  'sharedMoment',
  'senderRawThoughts',
  'finalLetter',
  'memoryBoard',
  'userImageUrl',
  'audio',
];

const MEANINGFUL_CONTENT_THRESHOLD = 2;

export interface DraftMetadata {
  recipientName: string;
  step: StepValue;
  wordCount: number;
  photoCount: number;
  hasVoiceNote: boolean;
  hasCoverImage: boolean;
  savedAt: string;
  hasMeaningfulContent: boolean;
}

// Returns metadata about the saved draft, or null if none exists.
// Does not mutate state. Used by PreparationForm to decide whether to
// show the resume modal vs silent-restore vs start-empty.
export function getDraftMetadata(): DraftMetadata | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(parsed.version)) return null;
    if (!parsed.data) return null;

    const data = parsed.data as Partial<CoupleData>;

    let meaningfulFieldCount = 0;
    for (const field of MEANINGFUL_DRAFT_FIELDS) {
      const value = data[field];
      if (typeof value === 'string') {
        if (value.trim().length > 0) meaningfulFieldCount++;
      } else if (Array.isArray(value)) {
        if (value.length > 0) meaningfulFieldCount++;
      } else if (value !== null && value !== undefined && value !== false) {
        meaningfulFieldCount++;
      }
    }
    const hasMeaningfulContent =
      meaningfulFieldCount >= MEANINGFUL_CONTENT_THRESHOLD;

    const writingText = data.finalLetter || data.senderRawThoughts || '';
    const wordCount = writingText.trim()
      ? writingText.trim().split(/\s+/).length
      : 0;

    const photoCount = Array.isArray(data.memoryBoard)
      ? data.memoryBoard.length
      : 0;

    return {
      recipientName: data.recipientName || '',
      step: parsed.step ?? 1,
      wordCount,
      photoCount,
      hasVoiceNote: Boolean(data.audio),
      hasCoverImage: Boolean(data.userImageUrl),
      savedAt: parsed.savedAt,
      hasMeaningfulContent,
    };
  } catch (err) {
    console.warn('[getDraftMetadata] failed:', err);
    return null;
  }
}

// External-write helper for components that own form data outside the
// PreparationForm hook (e.g. RefineStage feeding the AI draft back via
// App.tsx). Reads the existing draft, merges in `updates`, writes back
// preserving the existing step + stage. No-ops if no draft exists yet —
// we don't create orphan drafts from the refine layer.
export function writeDraftFromExternal(updates: Partial<CoupleData>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readDraft();
    if (!existing || !existing.data) return;
    const merged = { ...existing.data, ...updates } as CoupleData;
    const payload: StoredDraft = {
      version: CURRENT_SCHEMA_VERSION,
      data: merged,
      step: existing.step ?? 1,
      savedAt: new Date().toISOString(),
      ...(existing.stage ? { stage: existing.stage } : {}),
      // PR #21 — preserve draftId hint through external content updates.
      ...(existing.draftId ? { draftId: existing.draftId } : {}),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[usePreparationPersistence] External write failed:', err);
  }
}
