// ============================================================================
// scripts/test-draftid-hint-persistence.mjs — PR #21 persistence-layer harness
//
// Run: node scripts/test-draftid-hint-persistence.mjs
//
// Verifies that the localStorage draftId hint survives every write path
// without corrupting other fields, and that read-merge correctly preserves
// it when peripheral writes (debounced PreparationForm, stage transitions,
// external content updates) fire.
//
// This script does NOT exercise the React activation layer (App.tsx's lazy
// initializer + hydration reconciliation). Those are tested live in the
// browser via the recipe in PR #21's implementation summary.
//
// IMPORTANT — DUPLICATION NOTE
// The schema/write logic below is INLINED from
// /hooks/usePreparationPersistence.ts. Vercel-Node's module loader cannot
// import .ts at runtime; the alternatives (transpile, install tsx) are out
// of scope for PR #21. Same pattern as scripts/test-draft-state-logic.mjs.
// If you change the persistence hook, update this script too.
// ============================================================================

const STORAGE_KEY = 'vday_data_draft';
const CURRENT_SCHEMA_VERSION = 2;

// ── In-memory localStorage shim (mirrors browser API) ──────────────────────
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

// ── Inlined from hooks/usePreparationPersistence.ts ────────────────────────

function readDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (![1, 2].includes(parsed.version)) return null;
    if (typeof parsed.data !== 'object' || parsed.data === null) return null;
    const step = [1, 2, 3].includes(parsed.step) ? parsed.step : null;
    const stage = typeof parsed.stage === 'string' ? parsed.stage : null;
    const draftId =
      typeof parsed.draftId === 'string' && parsed.draftId.length > 0
        ? parsed.draftId
        : null;
    return { data: parsed.data, step, stage, draftId };
  } catch {
    return null;
  }
}

function peekDraft() {
  return readDraft() ?? { data: null, step: null, stage: null, draftId: null };
}

function writeDraft(data, step) {
  try {
    const existing = readDraft();
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      data,
      step,
      savedAt: new Date().toISOString(),
      ...(existing?.stage ? { stage: existing.stage } : {}),
      ...(existing?.draftId ? { draftId: existing.draftId } : {}),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function writeStage(stage) {
  try {
    const existing = readDraft();
    if (!existing || !existing.data) return;
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      data: existing.data,
      ...(existing.step ? { step: existing.step } : {}),
      stage,
      ...(existing.draftId ? { draftId: existing.draftId } : {}),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function writeDraftFromExternal(updates) {
  try {
    const existing = readDraft();
    if (!existing || !existing.data) return;
    const merged = { ...existing.data, ...updates };
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      data: merged,
      step: existing.step ?? 1,
      savedAt: new Date().toISOString(),
      ...(existing.stage ? { stage: existing.stage } : {}),
      ...(existing.draftId ? { draftId: existing.draftId } : {}),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function writeDraftId(draftId) {
  try {
    const existing = readDraft();
    if (!existing || !existing.data) return;
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      data: existing.data,
      ...(existing.step ? { step: existing.step } : {}),
      ...(existing.stage ? { stage: existing.stage } : {}),
      ...(draftId ? { draftId } : {}),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
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

function reset() {
  store.clear();
}

// ── Cases ──────────────────────────────────────────────────────────────────

console.log('\nCase 1 — Empty store: peekDraft returns nulls including draftId');
{
  reset();
  const peeked = peekDraft();
  assertEqual(peeked, { data: null, step: null, stage: null, draftId: null }, 'fresh peek shape');
}

console.log('\nCase 2 — writeDraftId on empty store is a no-op (no orphan record)');
{
  reset();
  writeDraftId('orphan-id-attempt');
  assertEqual(peekDraft().draftId, null, 'no orphan draft created');
  assertEqual(localStorage.getItem(STORAGE_KEY), null, 'localStorage untouched');
}

console.log('\nCase 3 — writeDraft establishes draft, then writeDraftId sets hint');
{
  reset();
  writeDraft({ recipientName: 'Saniya', senderName: 'Ajmal' }, 1);
  assertEqual(peekDraft().draftId, null, 'no hint yet');
  writeDraftId('cloud-confirmed-id-XYZ');
  assertEqual(peekDraft().draftId, 'cloud-confirmed-id-XYZ', 'hint set after writeDraftId');
  assertEqual(peekDraft().data.recipientName, 'Saniya', 'data preserved');
}

console.log('\nCase 4 — writeDraft (debounced PreparationForm) preserves draftId hint');
{
  reset();
  writeDraft({ recipientName: 'Saniya' }, 1);
  writeDraftId('hint-id-1');
  // Simulate debounced re-write (PreparationForm typing)
  writeDraft({ recipientName: 'Saniya', occasion: 'birthday' }, 2);
  assertEqual(peekDraft().draftId, 'hint-id-1', 'draftId survives writeDraft re-write');
  assertEqual(peekDraft().step, 2, 'step updated');
  assertEqual(peekDraft().data.occasion, 'birthday', 'data updated');
}

console.log('\nCase 5 — writeStage preserves draftId hint');
{
  reset();
  writeDraft({ recipientName: 'Saniya' }, 1);
  writeDraftId('hint-id-2');
  writeStage('REFINE');
  assertEqual(peekDraft().draftId, 'hint-id-2', 'draftId survives writeStage');
  assertEqual(peekDraft().stage, 'REFINE', 'stage updated');
}

console.log('\nCase 6 — writeDraftFromExternal preserves draftId hint');
{
  reset();
  writeDraft({ recipientName: 'Saniya' }, 1);
  writeDraftId('hint-id-3');
  writeStage('REFINE');
  writeDraftFromExternal({ finalLetter: 'AI generated content...' });
  assertEqual(peekDraft().draftId, 'hint-id-3', 'draftId survives writeDraftFromExternal');
  assertEqual(peekDraft().stage, 'REFINE', 'stage preserved');
  assertEqual(peekDraft().data.finalLetter, 'AI generated content...', 'external update applied');
}

console.log('\nCase 7 — Full lifecycle: type → save (set hint) → type more (preserve) → stage transition (preserve)');
{
  reset();
  writeDraft({ recipientName: 'Saniya', senderName: 'Ajmal' }, 1);
  // user clicks "Save and continue later" → server returns draftId
  writeDraftId('full-lifecycle-id');
  // user keeps typing → debounced write fires
  writeDraft({ recipientName: 'Saniya', senderName: 'Ajmal', occasion: 'anniversary' }, 1);
  assertEqual(peekDraft().draftId, 'full-lifecycle-id', 'hint after typing');
  // generate draft → AI letter mirrored back
  writeDraftFromExternal({ finalLetter: 'Generated...' });
  assertEqual(peekDraft().draftId, 'full-lifecycle-id', 'hint after AI mirror');
  // advance to REFINE
  writeStage('REFINE');
  assertEqual(peekDraft().draftId, 'full-lifecycle-id', 'hint after stage transition');
  // advance to PERSONAL_INTRO
  writeStage('PERSONAL_INTRO');
  assertEqual(peekDraft().draftId, 'full-lifecycle-id', 'hint after another stage transition');
}

console.log('\nCase 8 — writeDraftId(null) clears hint, preserves everything else');
{
  reset();
  writeDraft({ recipientName: 'Saniya' }, 2);
  writeDraftId('to-be-cleared');
  writeStage('REFINE');
  assertEqual(peekDraft().draftId, 'to-be-cleared', 'hint set');
  // Sign-out path or cloud-says-no-ACTIVE
  writeDraftId(null);
  assertEqual(peekDraft().draftId, null, 'hint cleared');
  assertEqual(peekDraft().stage, 'REFINE', 'stage preserved');
  assertEqual(peekDraft().step, 2, 'step preserved');
  assertEqual(peekDraft().data.recipientName, 'Saniya', 'data preserved');
}

console.log('\nCase 9 — Cloud-wins reconciliation: hint overwritten on mismatch');
{
  reset();
  writeDraft({ recipientName: 'Saniya' }, 1);
  // Stale hint from a previous session
  writeDraftId('stale-old-id');
  // Simulate hydration response: cloud has different ACTIVE
  writeDraftId('cloud-canonical-id');
  assertEqual(peekDraft().draftId, 'cloud-canonical-id', 'cloud-wins overwrite');
}

console.log('\nCase 10 — Backwards-compat: pre-PR-#21 draft (no draftId field) reads cleanly');
{
  reset();
  // Manually inject a v2 draft without draftId (mimics existing on-disk shape)
  const preExistingDraft = {
    version: 2,
    data: { recipientName: 'Saniya' },
    step: 1,
    stage: 'PREPARE',
    savedAt: new Date().toISOString(),
    // no draftId field
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preExistingDraft));
  assertEqual(peekDraft().draftId, null, 'pre-existing draft reads draftId as null');
  assertEqual(peekDraft().data.recipientName, 'Saniya', 'data preserved');
  assertEqual(peekDraft().stage, 'PREPARE', 'stage preserved');
  // Now hint gets added on next save
  writeDraftId('newly-assigned-id');
  assertEqual(peekDraft().draftId, 'newly-assigned-id', 'hint added without disturbing other fields');
}

console.log('\nCase 11 — Defensive: empty-string draftId not treated as set');
{
  reset();
  // Manually inject a draft with empty draftId
  const draftWithEmptyId = {
    version: 2,
    data: { recipientName: 'Saniya' },
    step: 1,
    draftId: '',
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draftWithEmptyId));
  assertEqual(peekDraft().draftId, null, 'empty-string draftId reads as null');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
