import { useEffect, useRef, useState } from 'react';
import type { CoupleData } from '../types';

const STORAGE_KEY = 'vday_data_draft';
// Separate key from App.tsx 'vday_data' (post-finalize). This avoids
// collision between mid-form drafts and post-refine state.
const CURRENT_SCHEMA_VERSION = 1;
const DEFAULT_DEBOUNCE_MS = 1000;

interface StoredDraft {
  version: number;
  data: Partial<CoupleData>;
  savedAt: string;
}

// Text-only, no media. Safe to restore as-is.
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
  'musicType',
  'musicUrl',
  'revealMethod',
  'unlockDate',
  'locationMemory',
  'manualMapLink',
  'hasGift',
  'giftType',
  'giftTitle',
  'giftLink',
];

// Restore wholesale. Coupons are text data; sessionId preserves continuity.
const STRUCTURED_TEXT_FIELDS: (keyof CoupleData)[] = [
  'coupons',
  'sessionId',
];

function selectiveHydrate(stored: Partial<CoupleData>): Partial<CoupleData> {
  const safe: Partial<CoupleData> = {};
  const allowedFields = [...TEXT_SAFE_FIELDS, ...STRUCTURED_TEXT_FIELDS];
  for (const field of allowedFields) {
    if (field in stored && stored[field] !== undefined) {
      // @ts-expect-error — index assignment across keyof union
      safe[field] = stored[field];
    }
  }
  return safe;
}

function readDraft(): Partial<CoupleData> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (parsed.version !== CURRENT_SCHEMA_VERSION) {
      console.warn(
        '[usePreparationPersistence] Discarding draft with version',
        parsed.version,
        'expected',
        CURRENT_SCHEMA_VERSION
      );
      return null;
    }
    if (typeof parsed.data !== 'object' || parsed.data === null) return null;
    return selectiveHydrate(parsed.data);
  } catch (err) {
    console.warn('[usePreparationPersistence] Read failed:', err);
    return null;
  }
}

function writeDraft(data: CoupleData): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredDraft = {
      version: CURRENT_SCHEMA_VERSION,
      data,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // QuotaExceededError or serialization failure — log and continue.
    // User typing is never blocked by persistence failure.
    console.warn('[usePreparationPersistence] Write failed:', err);
  }
}

export interface PersistenceResult {
  hydratedData: Partial<CoupleData> | null;
}

export function usePreparationPersistence(
  data: CoupleData,
  options: { debounceMs?: number; enabled?: boolean } = {}
): PersistenceResult {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = options;

  const [hydratedData] = useState<Partial<CoupleData> | null>(() => {
    if (!enabled) return null;
    return readDraft();
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      writeDraft(data);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, debounceMs, enabled]);

  return { hydratedData };
}

export function clearPreparationDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[usePreparationPersistence] Clear failed:', err);
  }
}
