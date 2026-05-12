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
//   - top-level data string fields exceeding tiered length caps:
//       finalLetter / senderRawThoughts → 10000 (long-form text)
//       userImageUrl / aiImageUrl / musicUrl / giftLink / manualMapLink → 2000
//         (Firebase Storage signed URLs run 600-900 chars typical, up to
//          ~1500 for v4 signed URLs — 2000 leaves headroom but still rejects
//          pathological payloads. URL allowlist refinement at payment-time
//          validator is the actual security control; this is a DoS bound.)
//       all other string fields → 500
//
// Returns { ok: true } or { ok: false, reason: '<MACHINE_CODE>' }.
// On STRING_TOO_LONG, the reason includes the offending field name as
// `STRING_TOO_LONG:<field>` for diagnostic efficiency.
// ============================================================================

const MAX_DATA_BYTES = 100_000;
const MAX_SHORT_STRING = 500;
const MAX_URL_STRING = 2_000;
const MAX_LONG_STRING = 10_000;

// PR-48 Phase 2 (D5) — server-enforced cap on non-ABANDONED drafts per user.
// Doctrine §6.5: Count(ACTIVE) + Count(PAUSED) ≤ 3. ABANDONED is unbounded.
// Enforced inside the atomic transaction in /api/drafts/save.js so concurrent
// creates cannot both pass a stale pre-transaction count check.
export const MAX_DRAFTS = 3;

// Long-form CoupleData fields that legitimately exceed 500 chars. Cap matches
// the existing MAX_TEXT_LENGTH in lib/coupleDataValidator.js (full validator
// at payment time stays the canonical gate).
const LONG_FORM_FIELDS = new Set(['finalLetter', 'senderRawThoughts']);

// Top-level URL-bearing fields. Need a higher cap than the 500-char default
// because Firebase Storage signed URLs (used by /api/upload-media for cover
// images, etc.) are typically 600-900 chars due to the embedded RSA-SHA256
// signature. Nested URLs (memoryBoard[].url, audio.url, video.url,
// sacredLocation.googleMapsUri) are not validated here — they're inside
// arrays/objects, gated only by MAX_DATA_BYTES. Payment-time validator
// handles per-field nested URL validation.
const URL_FIELDS = new Set([
  'userImageUrl',
  'aiImageUrl',
  'musicUrl',
  'giftLink',
  'manualMapLink',
]);

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

  // top-level string field length cap (tiered)
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string') {
      const cap = LONG_FORM_FIELDS.has(key)
        ? MAX_LONG_STRING
        : URL_FIELDS.has(key)
          ? MAX_URL_STRING
          : MAX_SHORT_STRING;
      if (val.length > cap) {
        // Field-name suffix aids triage when the reject surfaces in logs
        // or error responses. Format: STRING_TOO_LONG:<fieldName>.
        return { ok: false, reason: `STRING_TOO_LONG:${key}` };
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

// ============================================================================
// PR-48 Phase 2 (D1) — expectedRevision request-shape validator.
//
// Every mutating request against an existing draft MUST include
// `expectedRevision: number` matching the stored draft's current revision.
// Per docs/contracts/active-paused-state-machine.md §6:
//   * UPDATE without expectedRevision  → 400 MISSING_EXPECTED_REVISION
//   * UPDATE with non-integer / < 1    → 400 INVALID_EXPECTED_REVISION_FORMAT
//   * UPDATE with stale value          → 409 STALE_REVISION (handled in
//                                         /api/drafts/save.js inside the
//                                         atomic transaction, not here)
//
// This helper checks request shape only. Comparison against stored value
// happens inside the transaction boundary at the call site.
// ============================================================================
export function validateExpectedRevision(value, { required }) {
  if (value === undefined || value === null) {
    return required
      ? { ok: false, reason: 'MISSING_EXPECTED_REVISION' }
      : { ok: true };
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return { ok: false, reason: 'INVALID_EXPECTED_REVISION_FORMAT' };
  }
  return { ok: true };
}
