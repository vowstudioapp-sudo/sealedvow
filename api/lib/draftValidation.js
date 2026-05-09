// ============================================================================
// /api/lib/draftValidation.js — Permissive draft write validator (PR #18a)
//
// Drafts are intentionally incomplete; this validator only catches absurd or
// hostile payloads. Full Zod validation against CoupleData is the EXCLUSIVE
// responsibility of /api/verify-payment.js at payment time, where the data
// must be complete.
//
// What this rejects:
//   - data not an object / null / array
//   - data JSON-serialized > 100 KB (cheap DOS guard)
//   - prototype pollution: __proto__ / constructor / prototype as own keys
//     anywhere in the data tree
//   - step not 1/2/3
//   - draftState / persistenceStatus not in their respective enums
//   - top-level data string fields > 500 chars (10000 for known long-form)
//
// Returns { ok: true } or { ok: false, reason: '<MACHINE_CODE>' }.
// ============================================================================

const MAX_DATA_BYTES = 100_000;
const MAX_SHORT_STRING = 500;
const MAX_LONG_STRING = 10_000;

// Long-form CoupleData fields that legitimately exceed 500 chars. Cap matches
// the existing MAX_TEXT_LENGTH in lib/coupleDataValidator.js (full validator
// at payment time stays the canonical gate).
const LONG_FORM_FIELDS = new Set(['finalLetter', 'senderRawThoughts']);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Forward-index for monotonicity enforcement (server side). MUST stay in sync
// with DRAFT_STATE_ORDER in /types/draft.ts — that file is the TypeScript
// source-of-truth; this is the JS mirror for Vercel-Node endpoints which
// cannot import from a .ts file at runtime.
export const DRAFT_STATE_ORDER = Object.freeze({
  IN_PROGRESS: 0,
  GENERATED: 1,
  REFINED: 2,
  PREVIEWED: 3,
  READY_FOR_PAYMENT: 4,
  COMPLETED: 5,
});

const DRAFT_STATE_VALUES = new Set(Object.keys(DRAFT_STATE_ORDER));
const PERSISTENCE_STATUS_VALUES = new Set(['ACTIVE', 'PAUSED', 'ABANDONED']);

export function isDraftState(value) {
  return typeof value === 'string' && DRAFT_STATE_VALUES.has(value);
}

// Recursive walk: any node whose own-key set intersects FORBIDDEN_KEYS fails.
// Defends against payloads constructed via JSON.parse where __proto__ ends up
// as an own property and downstream merge/clone code could pollute Object.
function hasPrototypePollution(node) {
  if (node === null || typeof node !== 'object') return false;
  for (const key of Object.keys(node)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (hasPrototypePollution(node[key])) return true;
  }
  return false;
}

export function validateDraftWrite({ data, step, draftState, persistenceStatus }) {
  // data shape
  if (data === undefined || data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'INVALID_DATA_SHAPE' };
  }

  // size cap
  let serialized;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return { ok: false, reason: 'DATA_NOT_SERIALIZABLE' };
  }
  if (serialized.length > MAX_DATA_BYTES) {
    return { ok: false, reason: 'DATA_TOO_LARGE' };
  }

  // prototype pollution
  if (hasPrototypePollution(data)) {
    return { ok: false, reason: 'PROTOTYPE_POLLUTION' };
  }

  // top-level string field length cap
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string') {
      const cap = LONG_FORM_FIELDS.has(key) ? MAX_LONG_STRING : MAX_SHORT_STRING;
      if (val.length > cap) {
        return { ok: false, reason: 'STRING_TOO_LONG' };
      }
    }
  }

  // step
  if (step !== undefined && step !== null && step !== 1 && step !== 2 && step !== 3) {
    return { ok: false, reason: 'INVALID_STEP' };
  }

  // draftState
  if (draftState !== undefined && !DRAFT_STATE_VALUES.has(draftState)) {
    return { ok: false, reason: 'INVALID_DRAFT_STATE' };
  }

  // persistenceStatus
  if (persistenceStatus !== undefined && !PERSISTENCE_STATUS_VALUES.has(persistenceStatus)) {
    return { ok: false, reason: 'INVALID_PERSISTENCE_STATUS' };
  }

  return { ok: true };
}
