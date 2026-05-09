// ============================================================================
// scripts/test-draft-state-logic.mjs — PR #18a observer-logic harness
//
// Run: node scripts/test-draft-state-logic.mjs
//
// Exercises decideTransition + the observer's early-return logic without
// React. The codebase has no test framework; this is a self-contained Node
// ESM script per the prompt's Section 11 fallback.
//
// COVERAGE
//   ✓ Case 1 — Forward progression fires correct transitions
//   ✓ Case 2 — Sticky PREVIEWED — backward UIStage produces no write
//   ✓ Case 3 — Disabled hook produces no writes
//   ✓ Case 4 — Null draftId produces no writes even when enabled
//   ⊘ Case 5 — Server rejection rolls back local state
//   ⊘ Case 6 — Request-token guard prevents stale rollback
//
// Cases 5 & 6 require React useRef + fetch lifecycle. Per the prompt's
// Section 11 fallback ("don't force-fit it"), they are exercised by:
//   (a) the dormant mount in App.tsx running through real production stage
//       flow (boundary-detection + monotonic-check + early-return are live),
//   (b) the network/UI integration in PR #18b.
// The pure decision logic and the early-return guard ARE covered here, which
// is the part most likely to silently misbehave.
//
// IMPORTANT — DUPLICATION NOTE
// The decideTransition logic below is INLINED from /hooks/draftStateLogic.ts.
// Vercel-Node's module loader cannot import .ts at runtime; the alternatives
// (transpile, install tsx) are out of scope for 18a. If you change the logic
// in draftStateLogic.ts, update this file too.
// ============================================================================

// ── INLINED from /hooks/draftStateLogic.ts (keep in sync) ──────────────────

const DRAFT_STATE_ORDER = Object.freeze({
  IN_PROGRESS: 0,
  GENERATED: 1,
  REFINED: 2,
  PREVIEWED: 3,
  READY_FOR_PAYMENT: 4,
  COMPLETED: 5,
});

const UI_STAGE_TO_DRAFT_STATE = Object.freeze({
  PREPARE: 'IN_PROGRESS',
  REFINE: 'GENERATED',
  PERSONAL_INTRO: 'REFINED',
  QUESTION: 'REFINED',
  MAIN_EXPERIENCE: 'PREVIEWED',
  PAYMENT: 'READY_FOR_PAYMENT',
  // SHARE intentionally absent — server-side write owns COMPLETED.
});

function decideTransition(uiStage, lastPersistedDraftState) {
  const candidate = UI_STAGE_TO_DRAFT_STATE[uiStage];
  if (!candidate) return { kind: 'noop', reason: 'no_candidate' };
  const lastIndex = lastPersistedDraftState !== null
    ? DRAFT_STATE_ORDER[lastPersistedDraftState]
    : -1;
  const candidateIndex = DRAFT_STATE_ORDER[candidate];
  if (candidateIndex < lastIndex) return { kind: 'noop', reason: 'not_monotonic' };
  if (candidateIndex === lastIndex) return { kind: 'noop', reason: 'same_state' };
  return { kind: 'write', candidate };
}

// ── Observer simulation (mirrors the hook's main loop without React) ───────

/**
 * Walk a UIStage sequence as the observer would, returning the list of writes.
 * Mirrors the React observer hook's effect body except for the useRef +
 * fetch lifecycle (those need real React + a mock fetch — out of scope).
 *
 * Importantly, this includes the early-return guard so cases 3 & 4 are
 * exercised against the same condition the hook uses.
 */
function simulateObserver({ enabled, draftId, uiStageSequence }) {
  let lastPersisted = null;
  const writes = [];
  for (const uiStage of uiStageSequence) {
    if (!enabled || !draftId) continue;             // ← early return
    const decision = decideTransition(uiStage, lastPersisted);
    if (decision.kind !== 'write') continue;
    writes.push(decision.candidate);
    lastPersisted = decision.candidate;             // ← optimistic advance
  }
  return writes;
}

// ── Test harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`      expected: ${e}`);
    console.log(`      actual:   ${a}`);
    failed++;
  }
}

// ── Case 1 — Forward progression fires correct transitions ─────────────────

console.log('\nCase 1 — Forward progression');
{
  const writes = simulateObserver({
    enabled: true,
    draftId: 'd-1',
    uiStageSequence: ['PREPARE', 'REFINE', 'PERSONAL_INTRO', 'QUESTION', 'MAIN_EXPERIENCE', 'PAYMENT'],
  });
  assertEqual(
    writes,
    ['IN_PROGRESS', 'GENERATED', 'REFINED', 'PREVIEWED', 'READY_FOR_PAYMENT'],
    '5 writes, in order; PERSONAL_INTRO→QUESTION (both REFINED) yields one write',
  );
}

// ── Case 2 — Sticky PREVIEWED ─────────────────────────────────────────────

console.log('\nCase 2 — Sticky PREVIEWED');
{
  const writes = simulateObserver({
    enabled: true,
    draftId: 'd-1',
    uiStageSequence: ['PREPARE', 'REFINE', 'MAIN_EXPERIENCE', 'REFINE', 'MAIN_EXPERIENCE'],
  });
  assertEqual(
    writes,
    ['IN_PROGRESS', 'GENERATED', 'PREVIEWED'],
    '3 writes; second REFINE rejected (not_monotonic), second MAIN_EXPERIENCE rejected (same_state)',
  );
}

// ── Case 3 — Disabled hook ────────────────────────────────────────────────

console.log('\nCase 3 — Disabled hook');
{
  const writes = simulateObserver({
    enabled: false,
    draftId: null,
    uiStageSequence: ['PREPARE', 'REFINE', 'PERSONAL_INTRO', 'QUESTION', 'MAIN_EXPERIENCE', 'PAYMENT'],
  });
  assertEqual(writes, [], 'zero writes when disabled');
}

// ── Case 4 — Null draftId ─────────────────────────────────────────────────

console.log('\nCase 4 — Null draftId even when enabled');
{
  const writes = simulateObserver({
    enabled: true,
    draftId: null,
    uiStageSequence: ['PREPARE', 'REFINE', 'PERSONAL_INTRO', 'QUESTION', 'MAIN_EXPERIENCE', 'PAYMENT'],
  });
  assertEqual(writes, [], 'zero writes when draftId is null');
}

// ── Decision-table coverage (extra confidence) ────────────────────────────

console.log('\nExtra — decideTransition decision table');
{
  // Non-milestone UIStages return no_candidate
  assertEqual(decideTransition('LANDING', null), { kind: 'noop', reason: 'no_candidate' }, 'LANDING → no_candidate');
  assertEqual(decideTransition('SHARE', null), { kind: 'noop', reason: 'no_candidate' }, 'SHARE → no_candidate (server-owned)');
  assertEqual(decideTransition('SOULMATE_SYNC', null), { kind: 'noop', reason: 'no_candidate' }, 'SOULMATE_SYNC → no_candidate');
  assertEqual(decideTransition('MASTER_CONTROL', null), { kind: 'noop', reason: 'no_candidate' }, 'MASTER_CONTROL → no_candidate');
  // Same-state guard
  assertEqual(decideTransition('PERSONAL_INTRO', 'REFINED'), { kind: 'noop', reason: 'same_state' }, 'PERSONAL_INTRO when already REFINED → same_state');
  assertEqual(decideTransition('QUESTION', 'REFINED'), { kind: 'noop', reason: 'same_state' }, 'QUESTION when already REFINED → same_state');
  // Backward guard
  assertEqual(decideTransition('REFINE', 'PREVIEWED'), { kind: 'noop', reason: 'not_monotonic' }, 'REFINE after PREVIEWED → not_monotonic');
  assertEqual(decideTransition('PREPARE', 'COMPLETED'), { kind: 'noop', reason: 'not_monotonic' }, 'PREPARE after COMPLETED → not_monotonic');
  // First-time write
  assertEqual(decideTransition('PREPARE', null), { kind: 'write', candidate: 'IN_PROGRESS' }, 'PREPARE from null → write IN_PROGRESS');
  assertEqual(decideTransition('PAYMENT', 'PREVIEWED'), { kind: 'write', candidate: 'READY_FOR_PAYMENT' }, 'PAYMENT after PREVIEWED → write READY_FOR_PAYMENT');
}

// ── Cases 5 & 6 — documentation only ──────────────────────────────────────

console.log('\nCase 5 — Server rejection rollback');
console.log('  ⊘ exercised by dormant mount in production stage flow + 18b integration');

console.log('\nCase 6 — Request-token race');
console.log('  ⊘ exercised by dormant mount in production stage flow + 18b integration');

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
