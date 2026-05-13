# PR-48.A — Implementation Strategy

**Date:** 13 May 2026
**Document type:** Operational specification for implementation commits.
**Status:** Locked. Founder + cross-voice reviewers verify against this for drift before each commit.
**Sources:**
- [docs/proposals/single-draft-pivot.md](./single-draft-pivot.md) v1.2 (doctrine)
- [docs/diagnostics/2026-05-13-pr-48a-implementation-diagnostic.md](../diagnostics/2026-05-13-pr-48a-implementation-diagnostic.md) (codebase trace)
- This document (binding implementation strategy)

**Architectural framing:** PR-48.A is a **systems integrity migration**, not a feature PR. The behavioral contract:
- Preserves user trust (no silent data loss anywhere)
- Preserves state continuity (every intermediate commit must be functionally valid)
- Prevents invisible corruption (no hidden mutable coordination)
- Surgical migration discipline (no opportunistic cleanup mid-flight)

---

## 1. Locked decisions reference table

| ID | Decision | Rationale |
|---|---|---|
| **L4** | Anonymous-namespace policy: **P1 (preserve-only)**. Persisted anonymous entry untouched at sign-in. In-memory `data` follows the user via autosave debounce. | Simplest UX, no new modal surface. Edge case documented in sync-confidence doctrine. |
| **L5** | Migration policy: **soft-migration**. Legacy `vday_data_draft` → namespaced key with meaningful-content check setting `hasLocalChanges` correctly to skip false-positive Case B. | Trust-preserving. Schema-bump-and-discard alternative silently loses meaningful pre-pivot content. |
| **L6** | Keep `UI_STAGE_TO_DRAFT_STATE` in `hooks/draftStateLogic.ts`. Delete `decideTransition` + `TransitionDecision` type. | Save handlers (App.tsx:826,1007,1070) still consume the map; observer's decision function becomes orphaned. |
| **L7** | **Explicit uid parameter passing.** Every persistence helper accepts `uid` as an explicit param. **Rejected:** the diagnostic's option (c) module-level uid cache. | v1.2 §4.6 synchronization-boundaries doctrine forbids hidden coordination state. Module-level mutable cache is exactly that. ~20 call-site updates is the price of migration discipline. |
| **L8** | Hook returns imperative API: `{ seedSnapshot(projected), flushAndReadDirty(): boolean, readSettledDirty(): boolean }`. App.tsx is the imperative caller; PreparationForm ignores the returned object. | Single source of truth for `lastSyncedSnapshot` + `dirtyBit` lives in the hook. App.tsx triggers boundary operations explicitly. |
| **L9** | Leave `api/drafts/transition.js` in place. Its only caller (`useDraftStateObserver`) is deleted; endpoint becomes zero-caller dead code. | Fate decision deferred to PR-48.B per v1.2 §11.1 (SAVED-state recording mechanism still TBD). Do not delete in PR-48.A. |
| **L10** | Simplify `handleBeginNewSaveAndStartNew` + `handleBeginNewDiscardAndStartNew` to local-only operations. No cloud calls in PR-48.A. | Required by Phase B endpoint deletions. PR-48.B replaces with `DELETE /api/draft` + new `BeginAgainConfirmationModal`. |
| **L11** | Remove `cap_exceeded` variant from `SaveDraftResult`, the matching 409 branch in `saveDraft()`, the App.tsx switch branch. Remove `MAX_DRAFTS` constant + its usage in `save.js`. | Cap concept retires with multi-draft. Single-ACTIVE invariant (separate check) remains. |

---

## 2. Phase A diffs — purely subtractive (zero new dependencies)

Phase A removes three independent surfaces. After Phase A: the codebase is functionally reduced; all flows still work; no observer fires `/transition`; no `Save Local Draft as New` button; no `CAP_EXCEEDED` path.

### 2.A.1 Remove "Save Local Draft as New" (L11-adjacent, but distinct removal)

**App.tsx removals:**
- `App.tsx:925-940` — comment block describing 3-button Phase 4 sign-in handlers. Update to describe the surviving 2 handlers, OR defer the comment rewrite to PR-48.B when the modal is reshaped per v1.2 §5.2.
- `App.tsx:942` — `const caseBInFlightRef = useRef(false);` (sole consumer is the removed handler).
- `App.tsx:977-1059` — entire `handleSignInSaveLocalDraftAsNew` async function (~80 LOC).
- `App.tsx:2336` — `onSaveLocalDraftAsNew={handleSignInSaveLocalDraftAsNew}` JSX prop on `<SignInReconciliationModal>`.

**`components/SignInReconciliationModal.tsx` removals:**
- `:44` — `onSaveLocalDraftAsNew: () => void;` line in `Props` interface.
- `:62` — `onSaveLocalDraftAsNew,` line in destructured props.
- `:153-159` — the `<button>` element for "Save Local Draft as New" + the surrounding tertiary-button styling object (the button is the secondary-class one; verify exact lines after Phase A.2 lands).
- `:3-22` — header comment block describing 3-button locked spec. Update to 2-button spec OR defer to PR-48.B. **Recommendation: defer comment rewrite to PR-48.B** so this PR's diff is minimal in the modal file.

**Verification:** `grep -r "handleSignInSaveLocalDraftAsNew\|onSaveLocalDraftAsNew\|SaveLocalDraftAsNew\|caseBInFlightRef" --include="*.ts" --include="*.tsx"` returns zero matches after the change.

### 2.A.2 Remove `useDraftStateObserver` + `decideTransition` (L6)

**Files deleted:**
- `hooks/useDraftStateObserver.ts` (168 LOC) — entire file.

**`hooks/draftStateLogic.ts` partial deletion (L6):**
- KEEP `UI_STAGE_TO_DRAFT_STATE` (lines 22-29) — consumed by App.tsx save handlers.
- KEEP `DRAFT_STATE_ORDER` import (line 18) — required by removed function but ALSO used implicitly via the kept map (no, actually `DRAFT_STATE_ORDER` is used inside `decideTransition` only; check call sites). Actually App.tsx imports `DRAFT_STATE_ORDER` from `types/draft` (App.tsx:144), not from `draftStateLogic.ts`. So the file-internal use of `DRAFT_STATE_ORDER` goes away with `decideTransition`. KEEP only `UI_STAGE_TO_DRAFT_STATE` + the `AppStage`/`DraftState` type imports it needs.
- DELETE `decideTransition` function (lines 47-67), `TransitionDecision` type (lines 31-33), and the file's top JSDoc/comments about the observer's decision flow (lines 1-14 — preserve a 1-line comment describing the remaining map's purpose).

**App.tsx removals:**
- `App.tsx:79` — `import { useDraftStateObserver } from './hooks/useDraftStateObserver';`
- `App.tsx:1392-1411` — the entire `useDraftStateObserver({...})` invocation + the lengthy comment block above it documenting PR-#18b activation semantics.

**No changes needed at App.tsx:826,1007,1070** — those save handlers consume `UI_STAGE_TO_DRAFT_STATE`, which is kept.

**`draftRecord.seedDraftState` stays.** Save handlers' monotonicity logic still reads it. Per diagnostic §10.3.

**Verification:**
- `grep -r "useDraftStateObserver\|decideTransition\|TransitionDecision" --include="*.ts" --include="*.tsx"` returns zero matches.
- `npm run build` passes (TypeScript compilation).

### 2.A.3 Remove `MAX_DRAFTS` cap (L11)

**`api/lib/draftValidation.js` removals:**
- `:35-38` — doctrine comment block above `MAX_DRAFTS`.
- `:39` — `export const MAX_DRAFTS = 3;` line.

**`api/drafts/save.js` removals:**
- `:47` — `// Cap rule: Count(ACTIVE) + Count(PAUSED) ≤ MAX_DRAFTS. ABANDONED unbounded.` doctrine comment.
- `:58` — `MAX_DRAFTS,` line in import from `draftValidation.js`.
- `:232-234` — `const allDrafts = Object.values(drafts).filter(Boolean); const nonAbandonedCount = allDrafts.filter(...)` block.
- `:235-244` — the `if (nonAbandonedCount >= MAX_DRAFTS) { ... }` block (cap check + abort body).

**Note:** the `allDrafts` variable computed at `:231` is also consumed at `:247` (`const existingActive = allDrafts.find(...)`). KEEP the `allDrafts` computation; remove only `nonAbandonedCount` and its usage. Re-verify line numbers post-edit; the cap-check block is contiguous with the ACTIVE-check block that follows.

**`utils/saveDraft.ts` removals (L11):**
- `:38` — `| { kind: 'cap_exceeded'; current: number; limit: number }` variant in `SaveDraftResult` union.
- `:120-126` — the `if (res.status === 409 && body?.error === 'CAP_EXCEEDED') { ... }` block.
- `:82-83` — `current?: number; limit?: number;` fields in the inline `body` type (only consumed by the removed branch).

**App.tsx removals:**
- `:1165-1170` — the `case 'cap_exceeded':` switch branch in `handleSaveAndContinueLater`.

**Verification:**
- `grep -r "MAX_DRAFTS\|CAP_EXCEEDED\|cap_exceeded" --include="*.ts" --include="*.tsx" --include="*.js"` returns zero matches.
- Server still returns 409 `ACTIVE_DRAFT_EXISTS` for the single-ACTIVE invariant (unchanged behavior).

### 2.A — Phase A exit state

- ✓ Save flow works (with `ACTIVE_DRAFT_EXISTS` still possible).
- ✓ Reconciliation modal renders with 2 buttons (Continue Dashboard, Discard Local) — both still call `applyCloudActiveToState`. Operationally identical; will be reshaped in PR-48.B.
- ✓ Begin Again works (still calls `pauseDraft`/`discardDraft` via lifecycleDraft.ts — not yet deleted).
- ✓ No `/api/drafts/transition` calls fire.
- ✓ No server-side cap enforcement.
- ✓ `tsc` passes.

---

## 3. Phase B diffs — endpoint + lifecycle helper deletion

Phase B has internal ordering: simplify App.tsx callers BEFORE deleting their endpoint dependencies. Otherwise the live Begin Again flow 404s in the intermediate state.

### 3.B.1 Simplify `BeginNewPromptModal` handlers to local-only (L10)

**App.tsx modifications:**

- `App.tsx:817-889` — `handleBeginNewSaveAndStartNew` function. **Replace entire body** with local-only behavior: bypass the save+pause sequence; just clear local + reset state. Equivalent to calling `finalizeBeginNewLocalReset()` directly. Add a transitional comment noting PR-48.B will reintroduce cloud-aware behavior via `POST /api/draft` + `DELETE /api/draft`.
  - New body (strategy, not code): set `beginNewInFlightRef.current = true`; call `finalizeBeginNewLocalReset()` (which already exists at line 805 and clears local + UI + sets reconciliation back to none).
  - The function can be renamed in PR-48.B; for PR-48.A preserve the name so the modal prop wiring at `:2316` is unchanged.

- `App.tsx:891-918` — `handleBeginNewDiscardAndStartNew` function. **Replace entire body** with local-only behavior: bypass the `discardDraft` cloud call; just clear local. Same shape as 3.B.1 above.

- `App.tsx:805-815` — `finalizeBeginNewLocalReset` stays unchanged. It's the local-clear primitive both simplified handlers now use.

- `App.tsx:861-864` — `pauseDraft({...})` call inside `handleBeginNewSaveAndStartNew`. Removed by the body replacement above.
- `App.tsx:865-885` — surrounding orchestration in `handleBeginNewSaveAndStartNew`. Removed.
- `App.tsx:898-915` — `discardDraft({...})` call + orchestration inside `handleBeginNewDiscardAndStartNew`. Removed.

**BeginNewPromptModal.tsx itself is NOT modified in Phase B.** The modal's button labels still say "Save & Start New" and "Discard & Start New"; their behavior is now both local-clear in PR-48.A. UX-suboptimal but transitional; PR-48.B replaces the entire modal.

**Verification:**
- `grep -n "pauseDraft\|discardDraft" App.tsx` returns zero matches.
- Begin Again flow tested in dev: click button → confirm → local clears → no network call to `/api/drafts/pause` or `/api/drafts/discard`.

### 3.B.2 Delete `utils/lifecycleDraft.ts`

**File deleted:** `utils/lifecycleDraft.ts` (130 LOC).

**App.tsx removals:**
- `App.tsx:81` — `import { pauseDraft, discardDraft } from './utils/lifecycleDraft';` line.

After 3.B.1, no consumer of these imports remains. Removing the import is a one-line edit.

**Verification:**
- `grep -r "lifecycleDraft\|pauseDraft\|discardDraft" --include="*.ts" --include="*.tsx"` returns zero matches.
- `tsc` passes.

### 3.B.3 Delete server endpoints

**Files deleted:**
- `api/drafts/pause.js` (162 LOC)
- `api/drafts/resume.js` (232 LOC)
- `api/drafts/discard.js` (144 LOC)

After 3.B.2, no client code references these endpoints. Server-side deletion is purely additive (subtractive) and does not affect any other endpoint.

**`api/drafts/transition.js` is LEFT IN PLACE (L9).** Becomes zero-caller code; deletion deferred to PR-48.B.

**Verification:**
- `ls api/drafts/` shows only `list.js`, `save.js`, `transition.js`.
- Production deploy: existing client codepaths never hit the deleted endpoints. Stale clients (browser tabs open from before Phase B) could 404 on Begin Again; acceptable for v1 since Begin Again is user-initiated, the user can refresh, and no data is destroyed.

### 3.B — Phase B exit state

- ✓ Begin Again works (local-only; no cloud calls).
- ✓ `utils/lifecycleDraft.ts` removed.
- ✓ Three endpoints removed (`pause`, `resume`, `discard`); `transition.js` remains per L9.
- ✓ `tsc` passes.
- ✓ Save flow unchanged.

---

## 4. Phase C diffs — sync-confidence schema (substantive)

Phase C is the substantive workstream. **C.6 + C.7 + C.8 must land in a single commit** (or as a tightly-bundled three-commit sequence with no intervening release) to avoid a broken intermediate where users see empty forms post-namespace-introduction with no migration.

### 4.C.6 Add `utils/meaningfulContent.ts`

**File created:** `utils/meaningfulContent.ts` (~25 LOC).

**File shape (strategy, not code):**
```
- Import: type CoupleData from '../types'
- Import: selectiveHydrate from '../hooks/usePreparationPersistence'  (new export per §4.C.10)
- Single exported function: meaningfulContent(data: Partial<CoupleData> | null | undefined): boolean
- Internal: applies selectiveHydrate(data) first; then evaluates the v1.2 §3 predicate
- Predicate logic (disjunctive single-field, per v1.2 §3):
    - recipientName?.trim().length > 0  → true
    - senderName?.trim().length > 0     → true
    - finalLetter?.trim().length >= 50  → true  (50-char threshold per spec)
    - Any media: memoryBoard.length > 0, userImageUrl truthy, audio?.url truthy, video?.url truthy, hasGift === true  → true
    - Otherwise: false
```

**Consumed by:**
- The migration trigger (§4.C.8)
- App.tsx reconciliation gate (replaces `getDraftMetadata().hasMeaningfulContent` at App.tsx:1320-1321)
- The PreparationForm's resume-modal decision branch (current consumer at `components/PreparationForm.tsx:97-111` reads `getDraftMetadata().hasMeaningfulContent`). **Decision: do NOT swap PreparationForm's predicate in PR-48.A.** PreparationForm's resume-modal heuristic uses meaningfulness for a different purpose (silent-restore window logic). Changing it risks reshaping PreparationForm's modal-decision behavior outside PR-48.A's locked scope. List in §10 out-of-scope-observed.

**Conflict with existing predicate (`hooks/usePreparationPersistence.ts:378-389,416-428`):** the old predicate (`MEANINGFUL_DRAFT_FIELDS` + `MEANINGFUL_CONTENT_THRESHOLD = 2`) is conjunctive-count; the new is disjunctive-single-field. The old predicate stays in place for the `getDraftMetadata()` consumer (PreparationForm). The new predicate is used at reconciliation-gate sites.

**Future cleanup (out-of-scope):** unifying the two predicates is a PR-48.D candidate. For PR-48.A: two predicates coexist; their consumers are distinct.

### 4.C.7 UID-namespacing infrastructure (L7)

**`hooks/usePreparationPersistence.ts` modifications:**

- `:4` — replace `const STORAGE_KEY = 'vday_data_draft';` with an internal helper:
  ```
  function activeKey(uid: string | null): string {
    return uid ? `vday_data_draft:${uid}` : 'vday_data_draft:anonymous';
  }
  ```
  No module-level mutable state. Pure function.

- **Signature changes** — every helper accepts `uid: string | null` as an explicit parameter (L7):

  | Function | Current signature | New signature |
  |---|---|---|
  | `readDraft` (`:207`) | `readDraft(): DraftPeek \| null` | `readDraft(uid: string \| null): DraftPeek \| null` |
  | `writeDraft` (`:246`) | `writeDraft(data: CoupleData, step: StepValue): void` | `writeDraft(uid: string \| null, data: CoupleData, step: StepValue): void` |
  | `peekDraft` (`:272`) | `peekDraft(): DraftPeek` | `peekDraft(uid: string \| null): DraftPeek` |
  | `writeStage` (`:303`) | `writeStage(stage: AppStage): void` | `writeStage(uid: string \| null, stage: AppStage): void` |
  | `writeDraftId` (`:336`) | `writeDraftId(draftId: string \| null): void` | `writeDraftId(uid: string \| null, draftId: string \| null): void` |
  | `clearPreparationDraft` (`:360`) | `clearPreparationDraft(): void` | `clearPreparationDraft(uid: string \| null): void` |
  | `getDraftMetadata` (`:405`) | `getDraftMetadata(): DraftMetadata \| null` | `getDraftMetadata(uid: string \| null): DraftMetadata \| null` |
  | `writeDraftFromExternal` (`:460`) | `writeDraftFromExternal(updates: Partial<CoupleData>): void` | `writeDraftFromExternal(uid: string \| null, updates: Partial<CoupleData>): void` |
  | `usePreparationPersistence` (`:279`) | `(data, step, options): void` | `(data, step, options & { uid?: string \| null }): UsePreparationPersistenceApi` (see §4.C.9) |

  All internal `localStorage.getItem/setItem/removeItem` calls swap `STORAGE_KEY` → `activeKey(uid)`.

- **Read-merge writes (`writeDraft`, `writeStage`, `writeDraftId`, `writeDraftFromExternal`)** — these helpers do `existing = readDraft()` before writing to preserve fields. The internal `readDraft(uid)` call now needs the uid. Pass through.

- **Hook's debounce effect (`:288-297`)** — currently `useEffect(..., [data, step, debounceMs, enabled])`. Add `uid` to the dep list so the next debounce write targets the new namespace after auth-state change. The effect's inner `writeDraft(data, step)` becomes `writeDraft(uid, data, step)`.

**App.tsx modifications — 20 call-site updates:**

Every existing call site at App.tsx lines 614, 731, 789, 790, 806, 807, 879, 945, 946, 1045, 1046, 1133, 1233, 1284, 1367, 2077, 2087, 2205 must pass `uid` as the first argument. The uid is `authUser?.uid ?? null` (already captured via `useAuth` at App.tsx:450).

**Special case: mount-time `peekDraft()` at App.tsx:367.** This runs in `useMemo(..., [])` BEFORE the `useAuth` hook has resolved. Options:
- **Use `authUser?.uid ?? null` directly.** On cold mount, `authUser` is null (Firebase not yet rehydrated); peek reads from `vday_data_draft:anonymous`.
- **Re-peek after auth resolves.** Add an effect that re-reads from the now-known user namespace once `serverSessionReady` is true. Use this read to update `data` state if it was null at mount.

**Recommended: cold-mount reads from anonymous namespace; re-hydrate via the `/api/drafts/list` effect (App.tsx:1211) once auth resolves.** The existing hydration effect already replaces `data` from cloud when signed-in. Migration step (§4.C.8) ensures that legacy non-namespaced content lands in the correct namespace before this re-hydration matters.

**Mount-time data initializer (App.tsx:377-390)** also reads `initialDraft` from the mount-time peek. Same anonymous-namespace cold-read pattern applies. The post-mount hydration effect corrects course.

**`components/PreparationForm.tsx` modifications:**
- `:91` — `useRef(peekDraft())` becomes `useRef(peekDraft(uidFromContext))`. **Problem:** PreparationForm doesn't currently consume `useAuth`. Two options:
  - **(α)** PreparationForm imports + uses `useAuth` at the top, captures uid, passes through to all `peekDraft`/`getDraftMetadata`/`usePreparationPersistence`/`clearPreparationDraft` calls. Minimal new prop surface.
  - **(β)** App.tsx passes `uid` as a prop to `<PreparationForm uid={authUser?.uid ?? null} ...>`. More explicit; one new prop.
  - **Recommended: (α).** Keeps the prop surface stable; avoids prop-drilling auth concern. PreparationForm is already aware of auth indirectly (via DraftResumeModal's behavior).
- `:98` — `getDraftMetadata()` → `getDraftMetadata(uid)`.
- `:150` — initial step computation reads `initialDraftRef.current.step` (no namespace concern since it's already-read state).
- `:155` — `usePreparationPersistence(data, step)` → `usePreparationPersistence(data, step, { uid })`. The hook now returns an imperative API; PreparationForm ignores the returned object per L8.
- `:200` — `clearPreparationDraft()` → `clearPreparationDraft(uid)`.

**`components/DraftResumeModal.tsx`** — imports only the `DraftMetadata` type at `:3`. No functional change.

**Verification:**
- `grep -n "STORAGE_KEY" hooks/usePreparationPersistence.ts` returns zero matches (constant fully removed; replaced by `activeKey()` function).
- `grep -n "peekDraft()\|getDraftMetadata()\|writeStage(\|writeDraftId(\|clearPreparationDraft()\|writeDraftFromExternal(" --include="*.ts" --include="*.tsx" -r` shows every call site passes uid (no parameter-less invocations).
- `tsc` passes — the signature changes would surface type errors if any call site was missed.

### 4.C.7.5 Schema version acceptance (Commit 4 scope — load-bearing for migration readability)

**Scope contract:** Schema-acceptance changes MUST land in Commit 4 alongside namespacing + migration. Without this, Commit 4's migration writes `version: 3` payloads that the existing `readDraft` path rejects (per `SUPPORTED_SCHEMA_VERSIONS = [1, 2]` check at `hooks/usePreparationPersistence.ts:214`) — migrated drafts become temporarily invisible until Commit 5 ships. That intermediate violates §8 state continuity.

**`hooks/usePreparationPersistence.ts` modifications:**

- `:9` — bump `CURRENT_SCHEMA_VERSION = 2` → `CURRENT_SCHEMA_VERSION = 3`.
- `:13` — extend `SUPPORTED_SCHEMA_VERSIONS = [1, 2]` → `SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3]`. (Three versions supported simultaneously: v1 pre-stage legacy, v2 PR-47.1 current, v3 PR-48.A new.)
- `:18-30` — extend `StoredDraft` interface to admit the two new optional fields:
  ```
  lastKnownCloudRevision?: number | null;
  hasLocalChanges?: boolean;
  ```
  Both are optional in the interface so v1/v2 entries (which lack them) still type-check on read. The runtime read path applies safe defaults.
- `:207-244` `readDraft()` — when parsing a stored entry, surface the two new fields with safe defaults:
  - If `parsed.lastKnownCloudRevision` is a number → use it; else `null`.
  - If `parsed.hasLocalChanges` is a boolean → use it; else `false`.
  - These defaults are correct for v1/v2 entries (never synced under the new model; treat as clean). Migration sets them correctly for legacy entries per §4.C.8.
- `:246-267` `writeDraft()` — extend the read-merge payload construction so debounce writes preserve `lastKnownCloudRevision` and `hasLocalChanges` from the existing entry. New writes by the debounce default `hasLocalChanges` to the settled flag computed by the hook's divergence machinery (introduced in Commit 5; until then, default to the existing value or `false`).

**Why Commit 4 must already understand v3 payloads:** the migration code at §4.C.8 writes `version: 3` entries. Without the bumped `SUPPORTED_SCHEMA_VERSIONS`, `readDraft()` warns and returns `null` for migrated entries, treating them as absent. Users would see empty forms after migration completes. Bundling the schema-acceptance changes into Commit 4 closes this window.

**What Commit 4 does NOT include (deferred to Commit 5):**
- The runtime divergence machinery (`lastSyncedSnapshotRef`, `dirtyBitRef`, `settledHasLocalChangesRef`) and its debounce-time computation.
- The imperative API (`seedSnapshot`, `flushAndReadDirty`, `readSettledDirty`).
- The hook's return shape change from `void` to `UsePreparationPersistenceApi`.
- The hydration co-commit wiring in App.tsx.

**Net for Commit 4 from §4.C.7.5:** ~10 LOC added (constant edits + interface extensions + read-path defaults). Read/write paths produce schema-v3-shaped entries with new fields populated by migration logic OR by debounce passthrough; the runtime semantic-divergence computation that produces `hasLocalChanges` correctly lives in Commit 5.

**Verification (added to Phase C checklist §9):**
- `grep -n "CURRENT_SCHEMA_VERSION" hooks/usePreparationPersistence.ts` shows the value is `3`.
- `grep -n "SUPPORTED_SCHEMA_VERSIONS" hooks/usePreparationPersistence.ts` shows the array contains `3` (along with `1`, `2`).
- Smoke test (Commit 4): after migration, the migrated entry is readable via `peekDraft(uid)` (does not return null, does not warn "Discarding draft with unsupported version").

### 4.C.8 Migration effect in App.tsx (L5)

**New effect added to App.tsx**, gated on auth resolution. Placement: near the existing hydration effect at App.tsx:1211 (logical grouping).

**Effect shape (strategy):**
```
useEffect(() => {
  // Migration runs once per browser per namespace target (anonymous OR
  // per-uid). Namespace-scoped markers prevent re-runs WITHIN a namespace
  // while still allowing migration to fire later for OTHER namespaces
  // (e.g., anonymous migrates today; user signs in tomorrow → user-namespace
  // migration fires on first signed-in launch).
  if (typeof window === 'undefined') return;
  if (authLoading) return;  // wait for Firebase to resolve auth
  // Note: do NOT gate on serverSessionReady; migration only needs to know
  // the uid, not whether the cookie is minted. authUser?.uid is sufficient.

  // TIGHTENING 3: namespace-aware marker. A single global marker would let
  // anonymous migration permanently suppress later signed-in migration (or
  // vice versa), stranding legacy entries restored after the first marker
  // was set. The marker MUST be scoped to the migration target's namespace.
  const marker = authUser?.uid
    ? `vday_data_draft:_migrated_v1_2:${authUser.uid}`
    : 'vday_data_draft:_migrated_v1_2:anonymous';
  if (window.localStorage.getItem(marker)) return;

  const legacy = window.localStorage.getItem('vday_data_draft');
  if (!legacy) {
    // No legacy entry to migrate INTO this namespace; mark this namespace
    // as resolved and exit. Other namespaces (the opposite of current
    // signed-in state) remain unmarked; they get their own marker check
    // when the auth state changes and this effect re-fires.
    window.localStorage.setItem(marker, '1');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(legacy);
  } catch {
    // Malformed legacy entry; treat as absent. Remove + mark this namespace.
    window.localStorage.removeItem('vday_data_draft');
    window.localStorage.setItem(marker, '1');
    return;
  }

  // Apply selectiveHydrate to extract the projected data (security/PII fields stripped).
  // selectiveHydrate is now exported from hooks/usePreparationPersistence (per §4.C.10).
  const projected = selectiveHydrate(parsed.data ?? {});
  const meaningful = meaningfulContent(projected);

  // Build the new schema-v3 payload.
  // Target namespace: vday_data_draft:${uid} if signed-in, else :anonymous.
  const targetKey = authUser?.uid
    ? `vday_data_draft:${authUser.uid}`
    : 'vday_data_draft:anonymous';

  const payload = {
    version: 3,
    data: projected,
    step: parsed.step,
    stage: parsed.stage,
    draftId: parsed.draftId,
    savedAt: parsed.savedAt ?? new Date().toISOString(),
    lastKnownCloudRevision: null,
    hasLocalChanges: meaningful,
  };

  try {
    window.localStorage.setItem(targetKey, JSON.stringify(payload));
    window.localStorage.removeItem('vday_data_draft');
    window.localStorage.setItem(marker, '1');  // marker set LAST — partial
                                                // failures leave legacy intact
                                                // for retry on next launch.
  } catch (err) {
    // QuotaExceeded or other storage failure. Do NOT remove legacy; the
    // next launch retries. Do NOT set marker.
    console.warn('[migration] vday_data_draft → namespaced failed:', err);
  }
}, [authLoading, authUser?.uid]);
```

**Why namespace-aware markers (TIGHTENING 3):**

The original strategy used a single global marker `vday_data_draft:_migrated_v1_2`. That design conflicts with the document's own stated invariant ("Migration runs once per browser per (anonymous OR user-namespace) target"):

- **Failure mode 1 — anonymous-blocks-user:** Anonymous user opens the app post-deploy; no legacy entry exists; global marker is set. User signs in later; if Firebase pushes a legacy `vday_data_draft` entry from a different device's older session (rare but possible via browser sync extensions, restored profiles, etc.) — migration never re-fires; user-namespace stays empty.
- **Failure mode 2 — user-blocks-anonymous:** Signed-in user migrates their legacy entry; global marker set. User signs out; subsequent anonymous editing produces no legacy entry, but if any future flow restores or repopulates `vday_data_draft` (e.g., a recovery utility, or a future debugging tool), migration never runs for the anonymous namespace.
- **Failure mode 3 — restored legacy entries:** any flow that restores `vday_data_draft` after the global marker is set (browser sync, manual user recovery, debug-tool reset) finds the migration permanently disabled. The legacy entry sits indefinitely, unreachable through the namespaced read paths.

Namespace-aware markers close all three modes. The marker says "this namespace has been resolved against legacy" — not "we've migrated this browser, full stop." If a legacy entry shows up later (e.g., user signs in and Firebase syncs the prior session's local data — speculative but possible), the user-namespace marker hasn't been set yet, migration fires for the user namespace, and the entry lands correctly.

**Invariants preserved (TIGHTENING 3 does not change these):**
- **"Marker set LAST":** the per-namespace marker is set ONLY after `setItem(targetKey)` AND `removeItem(legacy)` both succeed. Partial-failure semantics unchanged.
- **Migration ordering:** parse → project → meaningful-check → setItem(target) → removeItem(legacy) → setItem(marker). Unchanged.
- **No multi-marker coordination logic:** the per-namespace marker is read/written independently. There is no cross-namespace state machine, no "wait for both markers to be set," no shared lock. Each namespace migrates when its target's effect fires.

**Migration trigger sequencing:**
- Effect dependency on `authLoading` + `authUser?.uid` means it fires twice on cold mount: once with `authLoading=true` (early-returns), once with `authLoading=false` (executes for the current namespace).
- If user signs in mid-session (uid changes), the effect re-fires with a different namespace target. The per-namespace marker for `${uid}` is checked independently of the `:anonymous` marker. If the user-namespace hasn't been migrated yet AND a legacy entry still exists, migration runs for that namespace.
- If user signs out (uid → null), effect re-fires with `:anonymous` as the namespace target. Same per-namespace marker discipline.
- Per-namespace short-circuit: each marker is read/written under its own key. Setting the `:anonymous` marker does NOT prevent later migration for `:${uid}` and vice versa.

**Edge case — sign-in BEFORE migration runs:** if the user is already signed-in when the migration effect first fires (rehydrated Firebase session), `authUser?.uid` is populated; legacy entry migrates directly to the user namespace and sets `vday_data_draft:_migrated_v1_2:${uid}`. Correct.

**Edge case — anonymous user migrates, then signs in later:** legacy entry (if present at anonymous time) migrates to `:anonymous` namespace; `vday_data_draft:_migrated_v1_2:anonymous` is set. After sign-in, the user-namespace marker hasn't been set yet; the effect re-fires; if no legacy entry exists at that moment (the prior migration consumed it), the effect early-exits and sets `vday_data_draft:_migrated_v1_2:${uid}`. If a legacy entry HAS reappeared (browser sync, recovery flow), it migrates into the user namespace correctly. Per L4 (P1), the prior `:anonymous` namespace entry stays put regardless.

**Edge case — migration sets `hasLocalChanges = true` for meaningful pre-pivot content:** post-migration, the reconciliation gate sees meaningful local + (possibly) meaningful cloud → Case B modal fires. This is the documented v1.2 §11.8 acceptance: meaningful pre-pivot users may see one extra modal during the rollout window. The alternative (schema-bump-and-discard) silently loses their content.

### 4.C.9 Hook API expansion (L8)

**`hooks/usePreparationPersistence.ts` hook body modifications:**

**New TypeScript interface (exported):**
```ts
export interface UsePreparationPersistenceApi {
  seedSnapshot(projected: Partial<CoupleData>): void;
  flushAndReadDirty(): boolean;
  readSettledDirty(): boolean;
}
```

**Hook return shape changes** from `void` to `UsePreparationPersistenceApi`. The hook's body:

```
// New refs (live inside the hook):
const lastSyncedSnapshotRef = useRef<Partial<CoupleData> | null>(null);
const dirtyBitRef = useRef<boolean>(false);
const settledHasLocalChangesRef = useRef<boolean>(false);

// Existing debounce effect (lines 286-297), extended:
useEffect(() => {
  if (!enabled) return;
  if (timerRef.current) clearTimeout(timerRef.current);
  // Optimistic dirty flip on every mutation (cheap; no comparison):
  dirtyBitRef.current = true;
  timerRef.current = setTimeout(() => {
    // Settled divergence check: compare projected(data) against snapshot.
    const projected = selectiveHydrate(data);
    const baseline = lastSyncedSnapshotRef.current;
    const settled = baseline === null ? true : !deepEqual(projected, baseline);
    settledHasLocalChangesRef.current = settled;
    // Persist alongside data:
    writeDraftWithFlags(uid, data, step, {
      lastKnownCloudRevision: /* preserved from existing entry */ ,
      hasLocalChanges: settled,
    });
    dirtyBitRef.current = false;  // reset; next mutation will re-flip
  }, debounceMs);
  return () => { if (timerRef.current) clearTimeout(timerRef.current); };
}, [data, step, debounceMs, enabled, uid]);

// Imperative API exposed via stable callbacks:
const api = useMemo<UsePreparationPersistenceApi>(() => ({
  seedSnapshot: (projected) => {
    lastSyncedSnapshotRef.current = projected;
    // After seeding from a hydration boundary, the working copy IS the seed.
    // Settled dirty flag becomes false; persisted flag updates on next write.
    settledHasLocalChangesRef.current = false;
    dirtyBitRef.current = false;
  },
  flushAndReadDirty: () => {
    // Cancel pending debounce, run divergence check synchronously, persist.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const projected = selectiveHydrate(data);
    const baseline = lastSyncedSnapshotRef.current;
    const settled = baseline === null ? true : !deepEqual(projected, baseline);
    settledHasLocalChangesRef.current = settled;
    writeDraftWithFlags(uid, data, step, { ..., hasLocalChanges: settled });
    return settled;
  },
  readSettledDirty: () => settledHasLocalChangesRef.current,
}), [data, step, uid]);

return api;
```

**Hook self-seeding on first mount (PATCH 2 invariant — load-bearing for ref-bridge edge):**

The ref-bridge architecture (PreparationForm owns the hook; App.tsx receives the imperative API via callback) has an edge case: if cloud hydration completes while `PreparationForm` is unmounted (e.g., user is at REFINE stage when sign-in resolves), App.tsx's hydration co-commit calls `persistenceApiRef.current?.seedSnapshot(...)` — but `persistenceApiRef.current` is `null` (the hook hasn't mounted yet). The seedSnapshot call is silently skipped (per the optional-chain).

Later, when the user navigates back to PREPARE, PreparationForm mounts; the hook initializes `lastSyncedSnapshotRef.current = null`. The first mutation triggers a debounce; the divergence check reads `baseline === null` and returns `settled = true` — a **false-positive `hasLocalChanges`** even though the working copy was hydrated from cloud and has not actually diverged.

**Invariant:** on first hook mount, if `lastSyncedSnapshotRef.current === null`, initialize it from `selectiveHydrate(data)`. The initial mounted working state IS the baseline because it originated from persisted or hydrated state, and no divergence has yet occurred.

**Implementation shape (strategy):**
```
// Mount-time self-seeding effect — runs once per hook lifetime.
// Idempotent: explicit App.tsx-driven seedSnapshot() that lands first wins;
// self-seeding only fires if the ref is still null at mount.
useEffect(() => {
  if (lastSyncedSnapshotRef.current === null) {
    lastSyncedSnapshotRef.current = selectiveHydrate(data);
    settledHasLocalChangesRef.current = false;
    dirtyBitRef.current = false;
  }
  // Empty dep list: this is a strictly once-per-mount invariant. Do NOT add
  // `data` to deps — we explicitly do NOT want to re-seed when data changes
  // (that would erase divergence semantics across mutations).
}, []);
```

**Doctrinal overwrite guard (TIGHTENING 2 — load-bearing, do not remove):**

> The self-seed path executes only when `lastSyncedSnapshotRef.current === null`. It MUST NEVER overwrite an existing synchronized baseline. This guard is doctrinal, not optimization: without it, a future remount regression could silently erase divergence state seeded by a prior `seedSnapshot` call.

The `if (lastSyncedSnapshotRef.current === null)` check is the entire mechanism that distinguishes "first-ever mount of this hook instance" from "subsequent remount where the ref was carried by an explicit `seedSnapshot` and divergence state already exists." A future engineer "simplifying" the effect by removing the guard — or by changing the effect's deps to re-fire on `data` change — would re-baseline the snapshot at every render, erasing any accumulated dirty-flag truth. The grep-level §9 checklist captures the invariant; the prose above captures the *why*.

**This is NOT fallback logic, NOT inferred reconciliation, NOT a replacement for the explicit hydration co-commit contract (§4.C.10).** It is a strict mount-time baseline initialization invariant. Hydration boundaries in App.tsx still call `seedSnapshot()` explicitly per the §4.C.10 contract; those calls overwrite the self-seeded baseline with the canonical cloud-projected snapshot. The self-seed only protects the edge where hydration completed while the hook was unmounted.

**Why not seed at every mount?** Because the hook may re-mount after a remount triggered by `prepFormResetKey` (App.tsx:773). On those remounts, the prior persisted `vday_data_draft:${uid}` entry's `lastKnownCloudRevision` and `hasLocalChanges` flags are still valid; the snapshot should reflect what's actually on disk. Self-seeding from `selectiveHydrate(data)` is correct because `data` at mount equals what `peekDraft(uid)` returned (the persisted projected content) — by construction the baseline aligns.

**Edge — what if `data` is empty at mount (fresh user, no persisted content)?** `selectiveHydrate({})` returns `{}`. `lastSyncedSnapshotRef.current = {}`. First mutation flips `dirtyBit`, debounce fires, divergence check: `deepEqual(projected({recipientName: 'A'}), {})` → `false` → `settled = true`. Correct.

**Why `useMemo` and not `useCallback` for each method:**
- The API object's reference identity should be stable per render (or at least re-key on uid changes).
- Consumers (App.tsx) may pass the API to other hooks/components; an object that thrashes identity every render causes unnecessary re-renders downstream.
- `useMemo` on the object with `[data, step, uid]` deps is sufficient — App.tsx reads the methods imperatively, not declaratively.

**Clarification: `writeDraftWithFlags(...)` is NOT a new helper.** It denotes the existing `writeDraft(uid, data, step)` (§1.1 / §4.C.7) extended in Commit 4 (§4.C.7.5) to also preserve `lastKnownCloudRevision` and `hasLocalChanges` through the read-merge payload construction. The naming `writeDraftWithFlags` in the strategy code blocks is a readability hint; the actual implementation extends `writeDraft`'s read-merge to include the two new fields. No new function is added.

**Important: `deepEqual` choice.** Two acceptable options:
- **(δ)** Hand-rolled recursive deep-equal on the projected CoupleData shape. ~30 LOC. No new dependency.
- **(ε)** JSON.stringify both sides and string-compare. Simpler. Slightly slower for large payloads but acceptable at 1000ms debounce. No new dependency.
- **(ζ)** Add a deep-equal library (e.g., `fast-deep-equal`). New dep.

**Recommended: (ε) JSON.stringify comparison** for PR-48.A simplicity. Performance is fine at debounce cadence (per v1.2 §4.4 L2 performance contract). If real-world data shows it's too slow, (δ) is a follow-up swap with the same API.

**Implementation note for (ε):** both sides of the comparison pass through `selectiveHydrate` BEFORE serialization. This ensures:
- **Deterministic projection shape** — only allowlisted fields appear in the serialized form, eliminating drift from incidentally-present server-set fields.
- **Minimized key-order false positives** — JS object key ordering is implementation-defined but stable for same-shaped objects produced by the same projection function. Both `selectiveHydrate(data)` and `selectiveHydrate(snapshot)` iterate the same allowlist arrays in the same order, producing identical key ordering. `JSON.stringify` thus produces comparable strings without explicit key sorting.
- **No PII/security/server-set leakage** — fields excluded from the allowlist (status, sealedAt, passcode*, etc.) cannot influence the divergence check regardless of how they got into the input objects.

**App.tsx consumption pattern:**
- App.tsx does NOT directly own `usePreparationPersistence` — it's called inside PreparationForm. App.tsx cannot call the hook's returned methods.
- **Architectural problem:** App.tsx needs `seedSnapshot` and `flushAndReadDirty` at hydration/sign-in boundaries, but the hook is mounted inside PreparationForm (a deeper component).

**Resolution: hook lifts up.** PR-48.A's L8 implies the hook becomes callable from App.tsx (so App.tsx owns the imperative API). Two implementation patterns:

- **(η) Move the hook call to App.tsx.** App.tsx calls `usePreparationPersistence(data, step, { uid, enabled })` and captures the API. App.tsx passes `enabled={false}` when PREPARE isn't the active stage (so the autosave doesn't fire on stages where App.tsx's `data` is the working copy). **Problem:** PreparationForm has its own `data` state (`usePreparationState`); App.tsx's `data` is null during PREPARE. Hook would not see PreparationForm's edits.

- **(θ) Hook stays in PreparationForm; App.tsx accesses API via a ref bridge.** Pattern: App.tsx creates a `useRef<UsePreparationPersistenceApi | null>(null)`, passes a setter callback to PreparationForm, PreparationForm calls the setter with its hook's returned API in an effect. App.tsx then reads from the ref at boundary moments.

  **Recommended: (θ).** Preserves the existing dual-`data` architecture (PreparationForm owns PREPARE working copy via `usePreparationState`; App.tsx owns post-REFINE `data`). The ref bridge is a controlled imperative coupling.

  Concretely, PreparationForm receives a new prop `onPersistenceApiReady?: (api: UsePreparationPersistenceApi) => void`. In an effect: `useEffect(() => { onPersistenceApiReady?.(persistenceApi); }, [persistenceApi, onPersistenceApiReady])`. App.tsx wires the prop to a ref-setter.

  **Drawback 1 — gate runs before hook mounts:** App.tsx-owned reconciliation gating (App.tsx:1319-1346) runs in an effect that may execute BEFORE PreparationForm has mounted and called `onPersistenceApiReady`. The gate must handle "API not yet available" gracefully (treat as if `hasLocalChanges` is consistent with `meaningfulContent(local)` — the dirty bit doesn't change the gate decision for first-sign-in scenarios where local is freshly typed).

  **Drawback 2 — hydration while hook unmounted:** if hydration co-commits fire while PreparationForm is unmounted (e.g., user at REFINE), `seedSnapshot()` is silently skipped. **Mitigation: hook self-seeding invariant** (see subsection above). On next PreparationForm mount, the hook initializes `lastSyncedSnapshotRef.current = selectiveHydrate(data)` since `data` at mount equals the persisted/hydrated content. False-positive divergence is prevented.

**Alternative resolution: dual-hook architecture (REJECTED).** Mounting `usePreparationPersistence` in both App.tsx and PreparationForm violates "no dual sources of truth" (anti-drift constraint #5). Do not pursue.

**Recommended for PR-48.A: (θ) ref bridge + self-seeding invariant.** Acknowledged complexity; preserved single-source-of-truth invariant; ref-bridge baseline edge closed by mount-time self-seed.

### 4.C.10 `selectiveHydrate` export + lastSyncedSnapshot wiring

**`hooks/usePreparationPersistence.ts` modifications:**
- `:85` — `function selectiveHydrate(stored: Partial<CoupleData>)...` → `export function selectiveHydrate(stored: Partial<CoupleData>)...`. One-word addition.

**App.tsx imports update:**
- `App.tsx:78` import — add `selectiveHydrate` to the named import list:
  ```
  import { writeDraftFromExternal, peekDraft, writeStage, writeDraftId, clearPreparationDraft, selectiveHydrate } from './hooks/usePreparationPersistence';
  ```

**App.tsx hydration paths — co-commit `seedSnapshot` (anti-drift constraint #6):**

The three hydration sites must call `seedSnapshot(selectiveHydrate(cloud.data))` alongside the existing setData/setDraftRecord writes. All four writes (data, lastSyncedSnapshot, lastKnownCloudRevision, hasLocalChanges) must occur within the same event handler so React batches them into a single commit.

**Site 1: `applyCloudActiveToState` (App.tsx:944-961):**
- After `setData(hydrateCoupleData(cloud.data));` — call `persistenceApiRef.current?.seedSnapshot(selectiveHydrate(cloud.data));`.
- The `setDraftRecord({...})` call already includes the revision; that's the `lastKnownCloudRevision` write into draftRecord state. **Note:** `lastKnownCloudRevision` per v1.2 is a field on the StoredDraft schema (persisted), not on draftRecord. Need to write it via the hook's persistence layer too. The hook's `seedSnapshot` should ALSO write `lastKnownCloudRevision: cloud.revision` and `hasLocalChanges: false` to localStorage.

  **Refined `seedSnapshot` signature:**
  ```ts
  seedSnapshot(projected: Partial<CoupleData>, revision: number | null): void;
  ```
  Or expose a separate `recordCloudSync(revision)` method. **Recommended: single combined method with optional revision arg.** `seedSnapshot(projected, revision?)` writes both refs AND persists the revision/dirty-flag updates.

**Site 2: `handleStaleRevisionReloadLatest` (App.tsx:723-735):**
- After `setData(hydrateCoupleData(candidate.data));` and `setDraftRecord({...candidate.revision});` — call `persistenceApiRef.current?.seedSnapshot(selectiveHydrate(candidate.data), candidate.revision);`.

**Site 3: Silent Case A hydration (App.tsx:1358-1374):**
- After `setDraftRecord({draftId, seedDraftState, revision: oldest.revision ?? null});` — there's no `setData()` here in the silent Case A path. The hydration is "revision-only" because the user has no meaningful local AND we trust cloud silently. Actually: the existing code does NOT setData in this path. **But per v1.2 §4.2 "Full hydration (Case A silent)"** — `data = projected(cloud.data)` is required. The existing code is wrong/incomplete relative to v1.2.

  **Wait — this is a substantive behavioral change.** In current PR-48 Phase 4 code, silent Case A only updates draftRecord; the user's editor state is whatever was there. Under single-draft v1.2, silent Case A should also setData with cloud's content + seed the snapshot.

  **Decision required: is the silent Case A behavior change in scope for PR-48.A?**

  Per v1.2 §5.1 Case A row "Local meaningful: No / Cloud meaningful: Yes" → "Silent — hydrate from cloud (full hydration per §4.2). Local autosave is replaced with `projected(cloud.data)`."

  This is the v1.2 specified behavior. **Yes, in scope for PR-48.A.** The hydration effect needs the data-replacement write added.

  **Caveat:** the existing PR-48 Phase 4 silent Case A code at App.tsx:1358-1374 may be intentionally limited (Phase 4 Limitation #1 per [docs/diagnostics/2026-05-13-phase4-continue-dashboard-bug.md](../diagnostics/2026-05-13-phase4-continue-dashboard-bug.md)). PR-48.A correcting this is consistent with v1.2's full-hydration semantics; no scope creep.

  Add to Site 3:
  - `setData(hydrateCoupleData(oldest.data));`
  - `persistenceApiRef.current?.seedSnapshot(selectiveHydrate(oldest.data), oldest.revision ?? null);`

**Site 4: Save success (App.tsx:1124-1142):**
- After `setDraftRecord({...result.revision});` — call `persistenceApiRef.current?.seedSnapshot(selectiveHydrate(data), result.revision);`. Cloud now mirrors local; the snapshot baseline = the data we just saved.

**`hasLocalChanges` writes happen inside the hook**, not in App.tsx. App.tsx's `seedSnapshot` call sets it to `false` (per v1.2 §4.2 Full Hydration row). The hook persists.

### 4.C — Phase C exit state

By end of Commit 4 (C.6 + C.7 + C.7.5 + C.8 bundle):
- ✓ `utils/meaningfulContent.ts` exists and is consumed at reconciliation gate.
- ✓ All persistence helpers accept explicit `uid` parameter (L7).
- ✓ Storage keys are namespaced (`vday_data_draft:${uid}` or `vday_data_draft:anonymous`).
- ✓ `CURRENT_SCHEMA_VERSION = 3`; `SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3]`; `StoredDraft` admits the two new optional fields.
- ✓ Legacy `vday_data_draft` migrated to namespaced v3 key on first launch post-deploy; migrated entries are readable; marker prevents re-runs.
- ✓ `hasLocalChanges` is set at migration time per meaningful-content heuristic; debounce-time semantic comparison NOT yet active (deferred to Commit 5).

By end of Commit 5 (C.9 + C.10):
- ✓ Hook returns imperative API; App.tsx accesses via ref bridge from PreparationForm.
- ✓ Hook self-seeds `lastSyncedSnapshotRef` on first mount when null (PATCH 2 invariant).
- ✓ `selectiveHydrate` exported; `meaningfulContent` applies it internally.
- ✓ Debounce-time semantic-divergence check runs every 1000ms and updates persisted `hasLocalChanges`.
- ✓ Four hydration co-commit sites updated (apply+stale-reload+silent-Case-A+save-success).
- ✓ Reconciliation gate uses `meaningfulContent()` from new utility.
- ✓ `tsc` passes throughout.

---

## 5. Phase D — doctrine doc shape outline

### 5.D.1 Archive existing contract

- Create directory `docs/archived/` (does not currently exist).
- `mv docs/contracts/active-paused-state-machine.md docs/archived/2026-05-12-active-paused-state-machine.md`.
- Prepend a status header to the moved file:
  ```
  > **Status: ARCHIVED 13 May 2026.** Superseded by the single-draft pivot
  > ([docs/proposals/single-draft-pivot.md](../proposals/single-draft-pivot.md) v1.2).
  > This document represents the multi-draft (ACTIVE/PAUSED) architecture that
  > was attempted and reverted. Preserved for institutional learning per v1.2
  > §10.4. **Do not reintroduce these patterns** without explicit user evidence
  > per the single-draft-product-fit doctrine.
  ```

### 5.D.2 Update `docs/doctrine/local-persistence-contract.md` §6.5

In-place rewrite of `§6.5 Cloud draft authority (PR-48)` (lines 85-136). Recommendation per diagnostic §1.12: preserve §6.5 numbering, rewrite content for single-draft.

New §6.5 content (strategy outline, not content):
- One-line statement: "PR-48 establishes a single cloud-resumable draft per user."
- Invariants (rewritten):
  1. At most one cloud draft per user exists at any time.
  2. Local autosave (UID-namespaced) NEVER independently creates cloud drafts.
  3. Cloud content changes only at explicit save boundaries (§4.6).
  4. Live editing is sovereign in local memory between saves.
  5. Reconciliation surfaces always end with one explicit surviving authority.
- Authority by boundary (table reworked for single-draft).
- Pointer: "Full sync-confidence specification: see [docs/doctrine/sync-confidence.md](sync-confidence.md)."
- Remove all references to PersistenceStatus state machine (ACTIVE/PAUSED transitions).
- Remove heartbeat metadata rule (not part of single-draft v1.2).
- Preserve the existing §6 architectural rule ("Persistence observes composition; it does not govern composition") which v1.2 honors.

Also update `docs/doctrine/local-persistence-contract.md:140` reference to `/api/drafts/transition` — note transition.js fate is pending PR-48.B decision.

### 5.D.3 Create `docs/doctrine/sync-confidence.md`

**Document shape — section headings only** (content authored during Phase D commit):

```markdown
# Sync Confidence Doctrine

**Status:** Active doctrine. Established with PR-48.A.
**Context:** [docs/proposals/single-draft-pivot.md](../proposals/single-draft-pivot.md) v1.2.

## 1. Purpose
## 2. The sync-confidence model
### 2.1 Local autosave schema (v3)
### 2.2 Why revision-comparison beats `isLocalSynced` boolean
## 3. Meaningful content predicate
### 3.1 The disjunctive single-field rule
### 3.2 Projection — predicate operates on selectiveHydrate output
### 3.3 Why 50 characters
## 4. Semantic divergence (`hasLocalChanges`)
### 4.1 Definition
### 4.2 Projection rule (load-bearing)
### 4.3 Debounced evaluation (L2 performance contract)
### 4.4 Optimistic dirtyBit vs settled hasLocalChanges
### 4.5 Reconciliation reads only settled state
## 5. The lastSyncedSnapshot ref
### 5.1 Lifecycle (hook-internal)
### 5.2 Hydration co-commit contract (§4.2 batched-write)
### 5.3 Imperative API surface (seedSnapshot, flushAndReadDirty, readSettledDirty)
## 6. Active-key resolution (UID namespacing — L1)
### 6.1 The two namespaces (anonymous, user)
### 6.2 Read/write resolution rules
### 6.3 Anonymous-namespace policy: P1 (preserve-only)
### 6.4 In-memory continuity at sign-in (the documented edge)
### 6.5 Sign-out transition
### 6.6 Migration from pre-pivot keys (soft-migration)
## 7. Synchronization boundaries (§4.6 doctrine)
### 7.1 Three boundaries: hydration, save, delete reconciliation
### 7.2 No background sync helpers
### 7.3 No periodic revision watchdogs
### 7.4 What's forbidden (enumeration)
## 8. Atomicity for destructive operations
### 8.1 DELETE before local clear (PR-48.B preview)
### 8.2 CAS protection on POST and DELETE
## 9. Emotional trust contract
### 9.1 Never silently destroy user writing
### 9.2 Local divergent edits always survive STALE_REVISION
### 9.3 Begin Again is the only destructive path (and it's explicit)
## 10. Forbidden patterns (codification)
### 10.1 Hidden coordination state (module-level mutable caches)
### 10.2 Per-keystroke deep-equality
### 10.3 Auto-merge of divergent edits
### 10.4 Inventory thinking imported into emotional architecture
## 11. Implementation references
### 11.1 hooks/usePreparationPersistence.ts (StoredDraft schema, hook API)
### 11.2 utils/meaningfulContent.ts (the predicate)
### 11.3 App.tsx (hydration co-commit sites; migration effect)
## 12. Authority change log
```

**Length target:** ~300-450 lines (~half the size of `local-persistence-contract.md` since some material is referenced from v1.2 rather than restated).

---

## 6. Commit sequencing

5–6 commits per PR. Each commit has explicit exit criteria. Commits within a phase may interleave; commits across phases must NOT (anti-drift constraint #1).

### Commit 1 — Phase A (subtractive)

**Scope:** All three Phase A items in one commit (or three small commits at implementer discretion; no order dependency).
- Remove "Save Local Draft as New" (§2.A.1)
- Remove `useDraftStateObserver` + `decideTransition` (§2.A.2)
- Remove `MAX_DRAFTS` cap (§2.A.3)

**Exit criteria:**
- `npm run build` passes (tsc + vite).
- Manual smoke: type in PreparationForm, save while signed in, verify save succeeds and Network tab shows zero `/api/drafts/transition` calls.
- Manual smoke: trigger Case B reconciliation (sign in with meaningful local + meaningful cloud); verify modal shows 2 buttons (Continue Dashboard, Discard Local), not 3.
- `grep` verifications per §2.A items return clean.

### Commit 2 — Phase B.1 (App.tsx handler simplification)

**Scope:** Simplify `handleBeginNewSaveAndStartNew` + `handleBeginNewDiscardAndStartNew` to local-only operations (§3.B.1).

**Exit criteria:**
- `npm run build` passes.
- Manual smoke: trigger Begin Again from PreparationForm resume modal; verify local clears + UI resets + Network tab shows zero calls to `/api/drafts/pause` or `/api/drafts/discard`.
- BeginNewPromptModal's three buttons still render; their behavior is now uniform local-clear (transitional state).
- `grep "pauseDraft\|discardDraft" App.tsx` returns zero matches.

### Commit 3 — Phase B.2 + B.3 (lifecycleDraft + endpoint deletion)

**Scope:**
- Delete `utils/lifecycleDraft.ts` (§3.B.2).
- Delete `api/drafts/pause.js`, `api/drafts/resume.js`, `api/drafts/discard.js` (§3.B.3).

**Exit criteria:**
- `npm run build` passes.
- `grep -r "lifecycleDraft\|pauseDraft\|discardDraft" --include="*.ts" --include="*.tsx"` returns zero matches.
- `ls api/drafts/` shows only `list.js`, `save.js`, `transition.js`.
- All flows tested in Commit 2 still pass.

### Commit 4 — Phase C.6 + C.7 + C.7.5 + C.8 (BUNDLED — broken intermediate avoidance)

**Scope (all four must land together):**
- Create `utils/meaningfulContent.ts` (§4.C.6).
- UID-namespacing infrastructure: signature changes + call-site updates (§4.C.7).
- **Schema version acceptance** (§4.C.7.5): bump `CURRENT_SCHEMA_VERSION = 3`, extend `SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3]`, extend `StoredDraft` interface with optional `lastKnownCloudRevision` + `hasLocalChanges`, add safe-default read-path handling. **Load-bearing for migration readability.**
- Migration effect in App.tsx (§4.C.8) writes `version: 3` payloads with `lastKnownCloudRevision: null` and `hasLocalChanges` set per meaningful-content check.

**Why bundled:** three intermediate-state failure modes must be closed in one commit:
- **C.7 alone:** namespaced read/write paths against legacy non-namespaced storage → users see empty forms (their content is at `vday_data_draft`, app reads from `vday_data_draft:anonymous` or `vday_data_draft:${uid}`).
- **C.8 alone (without C.7.5):** migration writes `version: 3` payloads, but `SUPPORTED_SCHEMA_VERSIONS = [1, 2]` makes `readDraft` reject them → migrated drafts are invisible until Commit 5.
- **C.7.5 alone:** schema reader accepts v3 but no v3 entries exist yet → no observable effect, but creates a half-implemented commit that fails the "every commit functionally valid" contract.

All four must ship together. Anti-drift constraint #1 (no phase interleaving) does NOT apply within a phase; bundling sub-items inside Phase C is the explicit design.

**Exit criteria:**
- `npm run build` passes.
- `grep -n "STORAGE_KEY" hooks/usePreparationPersistence.ts` returns zero matches.
- `grep -n "CURRENT_SCHEMA_VERSION" hooks/usePreparationPersistence.ts` shows value `3`.
- `grep -n "SUPPORTED_SCHEMA_VERSIONS" hooks/usePreparationPersistence.ts` shows array containing `3`.
- Smoke test 1: anonymous user, fresh browser, type → refresh → content survives (now at `vday_data_draft:anonymous`).
- Smoke test 2: populate legacy `vday_data_draft` manually in DevTools; reload; verify migration moves it to the correct namespace; the namespace-scoped marker is set (per §4.C.8 marker shape); legacy key removed.
- Smoke test 3: signed-in user with legacy content; verify migration targets `vday_data_draft:${uid}` correctly.
- Smoke test 4: User A signs in, types, signs out; User B signs in — User A's content invisible (still in A's namespace).
- **Smoke test 5 (v3 readability verification — closes the schema-acceptance gate from §4.C.7.5):** After migration completes, migrated schema-v3 entries are readable through `peekDraft(uid)` / `readDraft(uid)` with NO "unsupported version" warnings emitted to console. Verify both:
  - **(a)** the returned `DraftPeek` has the expected `data` / `step` / `stage` / `draftId` fields populated AND the new `lastKnownCloudRevision` / `hasLocalChanges` fields surface with their migration-set values (`null` / `true|false` per meaningful-content heuristic);
  - **(b)** the browser console is clean of any schema-version-related warnings — no `[usePreparationPersistence] Discarding draft with unsupported version` message during or after migration.

### Commit 5 — Phase C.9 + C.10 (runtime sync-confidence machinery + hydration co-commit)

**Scope (runtime only — schema acceptance already landed in Commit 4 per §4.C.7.5):**
- Add `lastSyncedSnapshot` ref + `dirtyBitRef` + `settledHasLocalChangesRef` in hook (§4.C.9).
- Extend the existing debounce effect to compute settled `hasLocalChanges` via semantic-divergence check; persist via the extended write path (§4.C.9).
- Expose imperative API `{ seedSnapshot, flushAndReadDirty, readSettledDirty }` (§4.C.9).
- Hook self-seeding invariant on first mount (§4.C.9; PATCH 2): if `lastSyncedSnapshotRef.current === null` at mount, initialize from `selectiveHydrate(data)`.
- Hook return shape changes from `void` to `UsePreparationPersistenceApi`.
- Export `selectiveHydrate` from hook (§4.C.10).
- Wire ref-bridge between App.tsx and PreparationForm so App.tsx can call the API (§4.C.9 (θ)).
- Wire four hydration co-commit sites: `applyCloudActiveToState`, `handleStaleRevisionReloadLatest`, silent Case A, save success (§4.C.10).
- Add silent Case A's setData write per v1.2 §4.2 Full Hydration semantics (§4.C.10 Site 3 caveat).
- Replace `getDraftMetadata().hasMeaningfulContent` at App.tsx:1320-1321 with `meaningfulContent()` from new utility.

**Exit criteria:**
- `npm run build` passes.
- Smoke test 6: type a character, wait 1000ms, verify settled `hasLocalChanges` flips to true (inspect localStorage entry).
- Smoke test 7: type then delete within 1000ms; debounce fires; settled `hasLocalChanges` stays false (semantic divergence sees no net change).
- Smoke test 8: silent Case A path now hydrates editor from cloud (corrects pre-existing Phase 4 Limitation #1).
- Smoke test 9: save success — `lastSyncedSnapshot` updates to the saved data; subsequent mutations correctly flip dirty.
- Smoke test 10: manually populate user-namespace entry with `status: 'paid'` (server-set field); reload; verify `selectiveHydrate` drops it on hydration.

### Commit 6 — Phase D (doctrine)

**Scope:**
- Create `docs/archived/` directory.
- Move `docs/contracts/active-paused-state-machine.md` → `docs/archived/2026-05-12-active-paused-state-machine.md` with prepended status note (§5.D.1).
- Rewrite `docs/doctrine/local-persistence-contract.md §6.5` (§5.D.2).
- Update `docs/doctrine/local-persistence-contract.md:140` transition.js reference.
- Create `docs/doctrine/sync-confidence.md` with content per §5.D.3 outline.
- Update `types/draft.ts:64` comment that references `active-paused-state-machine.md`.

**Exit criteria:**
- All cross-references resolve (no broken markdown links via manual review).
- `docs/archived/` exists with the moved file.
- `docs/doctrine/sync-confidence.md` exists with all 12 sections.
- Doctrine review passes (founder + cross-voice).

---

## 7. Failure-mode handling

### 7.1 If a Phase A change breaks something

**Symptom:** smoke test fails after Phase A commit (e.g., save flow regression).

**Diagnosis:** Phase A is purely subtractive; regressions are most likely:
- An unnoticed consumer of the deleted code (e.g., a comment that pointed to a now-gone constant; a TypeScript import that surfaces as a compile error)
- An unintended side effect of the observer removal (e.g., a downstream effect that depended on `/transition` firing — none surfaced in diagnostic, but possible)

**Recovery:** `git revert` the Phase A commit. Re-investigate via the diagnostic for missed consumers. Re-attempt with the missed consumer's removal/update included.

**Anti-pattern to avoid:** "patch on top" — adding a workaround for the missed consumer without understanding why it broke. Revert + re-investigate is the right path.

### 7.2 If migration on first launch has an issue

**Symptom:** Phase C commit deploys; users report empty forms despite having had content yesterday.

**Diagnosis options:**
- Migration effect didn't fire (auth resolution timing — `authLoading` stuck true).
- Migration effect threw during parse (malformed legacy entry; the try/catch at §4.C.8 should mark + skip, but a logic bug could leave data orphaned).
- Migration wrote to wrong namespace (uid resolved incorrectly).
- Marker was set but write failed (`localStorage.setItem` quota exceeded between the two operations).

**Recovery (in order of escalation):**
1. **User self-recovery:** clear the relevant namespace-scoped marker in DevTools. If anonymous: `vday_data_draft:_migrated_v1_2:anonymous`. If signed-in: `vday_data_draft:_migrated_v1_2:${uid}` (uid visible via Firebase console or `auth.currentUser?.uid`). Refresh; migration re-attempts for that namespace. Document this in a temporary user-facing help note if reports come in. Note: clearing one namespace's marker does NOT affect the other namespace's resolved state.
2. **Hotfix patch:** if a logic bug is identified, ship a patch commit that fixes the migration and resets the marker for all users (one-shot effect that clears the marker on next launch, then runs again with the fixed logic). This requires a versioned marker family (`vday_data_draft:_migrated_v1_2b:anonymous` + `vday_data_draft:_migrated_v1_2b:${uid}` for the second-attempt markers; the namespace-aware shape is preserved). Acceptable for migration bugs; not for ongoing schema changes.
3. **Full revert:** if the migration is fundamentally broken, revert Commit 4 and reissue with corrections. Users whose legacy data was already migrated stay migrated; users whose data was lost during the buggy window need restoration from their browser's localStorage (no server-side backup for anonymous content).

**Defensive design that minimizes risk:**
- Migration NEVER `removeItem(legacy)` before successfully `setItem(targetKey, payload)` (§4.C.8 ordering: setItem, then removeItem, then setMarker).
- The try/catch wraps the setItem; failure leaves legacy intact.
- The marker is set LAST, after both writes succeed. A partial failure (legacy removed, target write failed) is prevented by the ordering.

### 7.3 If `tsc` fails mid-Phase

**Symptom:** type errors after partial changes (e.g., signature change applied to some helpers but not all call sites).

**Recovery:** the type errors are the safety net. `tsc` surfaces every missed call site. Fix incrementally; do not commit until clean. Phase commit boundaries require `tsc` pass.

### 7.4 If a smoke test passes but real users report breakage

**Symptom:** post-deploy bug report (e.g., "I signed in and my draft disappeared").

**Diagnosis:** smoke tests cover anticipated paths. Real-world failure modes:
- Browser-specific localStorage behavior (Safari quotas, private-mode restrictions)
- Auth-state edge case not represented in smoke (e.g., user with two browser tabs, one signed-in one signed-out)
- Cloud state that conflicts with migrated local (e.g., user had legacy local + recently saved cloud; migration sets `hasLocalChanges=true` based on meaningful local; Case B modal fires unexpectedly)

**Recovery:** the v1.2 §11.8 acceptance applies — "meaningful pre-pivot users may see one extra modal during the rollout window; this is documented and time-limited." If the modal is correct behavior (user has divergent local + cloud), the bug report is actually working-as-designed; respond with explanatory help text.

If the modal is incorrect (false-positive Case B), the bug is in the migration's `hasLocalChanges` setting. Patch via §7.2 path 2.

### 7.5 If hydration completes while PreparationForm is unmounted

**Symptom (pre-PATCH-2):** user signs in while at REFINE; cloud hydration fires; `seedSnapshot()` is skipped (hook ref is null); user navigates back to PREPARE; PreparationForm mounts; first keystroke flips `hasLocalChanges = true` even though local content matches cloud → false-positive Case B on next sign-in cycle.

**Resolution:** the hook self-seeding invariant (PATCH 2, §4.C.9) prevents this. On first mount when `lastSyncedSnapshotRef.current === null`, the hook initializes it from `selectiveHydrate(data)`. The initial mounted working state IS the baseline.

**What to verify if this symptom occurs in real-world testing:**
- Confirm the hook's self-seeding effect is wired (mount-time `useEffect` with empty deps).
- Confirm `data` at mount equals the persisted projected content (i.e., `peekDraft(uid)` populated it).
- Confirm App.tsx's hydration co-commit at App.tsx:1358-1374 (silent Case A) also fired before the user returned to PREPARE — if so, `seedSnapshot` was the no-op case (null ref); the self-seed at next mount corrects.

If self-seeding does not resolve the symptom, the bug is elsewhere — most likely in App.tsx's `data` initializer not picking up the migrated/hydrated value at mount.

### 7.6 If a lock feels wrong during implementation

Per anti-drift constraint #7: STOP and flag for founder review. Do not silently deviate.

**Specific scenarios:**
- "L7 module-level cache would be so much simpler here" → no. The lock is binding for a reason (v1.2 §4.6 doctrine).
- "L8 imperative API is awkward; let me use context" → no. Flag the awkwardness; await direction.
- "L10 local-only handlers feel wrong because the modal still says 'Save & Start New'" → noted; PR-48.B fixes the modal copy. Transitional state is acknowledged.

---

## 8. State continuity verification

Explicit intermediate-state audit. After each commit, what is broken vs working?

| Commit | What works | What's broken / transitional | Acceptable? |
|---|---|---|---|
| **Before PR-48.A** | All current PR-48 Phase 4 multi-draft flows | "Two of three reconciliation buttons identical" (the bug v1.2 fixes) | N/A (baseline) |
| **After Commit 1** | Save flow, reconciliation modals (2 buttons), Begin Again, sign-in/sign-out | None observable | ✓ Yes |
| **After Commit 2** | All Commit 1 + Begin Again local-only | BeginNewPromptModal buttons all behave the same (transitional UX wart) | ✓ Yes — transitional, PR-48.B reshapes modal |
| **After Commit 3** | All Commit 2; no dead endpoint files | Stale clients (browser tabs from before deploy) might 404 on Begin Again | ✓ Yes — user can refresh; no data loss |
| **After Commit 4** | All Commit 3 + UID-namespaced storage + migration + **schema v3 acceptance** (read path admits v3; migrated entries readable). Reconciliation gate uses NEW `meaningfulContent` predicate. | `lastSyncedSnapshot` not yet seeded (runtime divergence machinery comes in Commit 5); `hasLocalChanges` field is present in stored entries but only set by migration's meaningful-content heuristic — not yet by debounce-time semantic comparison. Legacy `getDraftMetadata` predicate still consumed by PreparationForm. | ✓ Yes — migrated entries are readable; gate uses new predicate; PreparationForm's separate use of old predicate is documented out-of-scope |
| **After Commit 5** | All Commit 4 + runtime sync-confidence machinery (debounced semantic divergence, hook self-seeding, imperative API, hydration co-commits) + silent Case A correction | Doctrine docs still reference old contract | ✓ Yes — Commit 6 fixes |
| **After Commit 6** | Full PR-48.A scope complete | Nothing | ✓ Yes — ready for PR-48.B |

**Critical broken-intermediates to avoid:**
- **Commit 4 split into separate sub-commits that deploy independently.** Three failure modes are possible:
  - **C.7 alone (namespacing only):** users see empty forms (content at unprefixed `vday_data_draft`, app reads from namespaced keys).
  - **C.7 + C.8 without C.7.5 (namespacing + migration, no schema acceptance):** migration writes `version: 3` payloads; `readDraft` rejects them as unsupported version → migrated drafts invisible until Commit 5.
  - **C.7.5 alone (schema acceptance only):** no entries ever written in v3 → no observable effect but commit is half-implemented and violates the per-commit-functionally-valid contract.
  - **Mitigation:** Commit 4 bundles C.6 + C.7 + **C.7.5** + C.8 per §6. All four ship together.
- **Commit 5 deployed before Commit 4 (schema acceptance lives in Commit 4).** Impossible if commit ordering is honored, but worth noting: Commit 5's runtime divergence machinery assumes the storage schema admits `lastKnownCloudRevision` and `hasLocalChanges`. Commit 4 establishes that admission.

**Other intermediates verified safe:**
- Commit 2 → Commit 3 window: handlers simplified but endpoint files still exist. Safe; no 404 because no caller.
- Commit 3 → Commit 4 window: endpoints gone; schema unchanged. Safe; save/load flow uses only `/api/drafts/list` and `/api/drafts/save`, both still present.
- Commit 4 → Commit 5 window: schema v3 admitted; migrated entries readable; `hasLocalChanges` populated by migration's meaningful-content heuristic. Runtime debounce-time semantic comparison not yet active → `hasLocalChanges` does not update with subsequent mutations. **Acceptable temporarily:** the reconciliation gate runs at sign-in time after Commit 5 ships; during the Commit 4 → 5 window the gate may rely on a stale `hasLocalChanges` value, but the only consequence is potential false-positive Case B on first sign-in for a user who edited locally during the window. v1.2 §11.8 acceptance applies. **Recommendation: ship Commit 5 promptly after Commit 4.**
- Commit 5 → Commit 6 window: code matches v1.2 single-draft; doctrine still references multi-draft. Safe for runtime; doctrine review will catch but no user impact.

---

## 9. Anti-drift verification checklist (per phase)

Concrete, verifiable items. Each should be runnable as a grep/inspection step.

### Phase A checklist

- `grep -rn "handleSignInSaveLocalDraftAsNew\|onSaveLocalDraftAsNew\|caseBInFlightRef" --include="*.ts" --include="*.tsx"` → zero matches.
- `grep -rn "useDraftStateObserver\|decideTransition\|TransitionDecision" --include="*.ts" --include="*.tsx"` → zero matches.
- `grep -rn "MAX_DRAFTS\|CAP_EXCEEDED\|cap_exceeded" --include="*.ts" --include="*.tsx" --include="*.js"` → zero matches.
- `npm run build` exits 0.
- `hooks/draftStateLogic.ts` still exports `UI_STAGE_TO_DRAFT_STATE` (verify via grep or read).
- No new files created.
- `hooks/useDraftStateObserver.ts` does not exist.

### Phase B checklist

- `grep -rn "lifecycleDraft\|pauseDraft\|discardDraft" --include="*.ts" --include="*.tsx"` → zero matches.
- `ls api/drafts/` outputs exactly `list.js`, `save.js`, `transition.js` (three files).
- `npm run build` exits 0.
- `App.tsx`'s `handleBeginNewSaveAndStartNew` and `handleBeginNewDiscardAndStartNew` contain no `fetch(` calls and no `pauseDraft`/`discardDraft` references.
- `api/drafts/transition.js` exists unchanged (L9; no edits to this file's diff).

### Phase C checklist

- **L7 verification (explicit uid passing):**
  - `grep -n "STORAGE_KEY" hooks/usePreparationPersistence.ts` → zero matches (constant gone).
  - `grep -n "let _activeUid\|var _activeUid\|let activeUid\|var activeUid" hooks/usePreparationPersistence.ts` → zero matches (no module-level mutable uid cache).
  - `grep -rn "peekDraft()" --include="*.ts" --include="*.tsx"` → zero matches (every call passes a parameter).
  - Same check for `getDraftMetadata()`, `writeStage(\s*[A-Z]`, `writeDraftId(\s*[\"']`, `clearPreparationDraft()`, `writeDraftFromExternal(\s*\{` — verify all sites pass uid as first arg.
- **L8 verification (hook API):**
  - `hooks/usePreparationPersistence.ts` exports `UsePreparationPersistenceApi` interface with exactly three methods: `seedSnapshot`, `flushAndReadDirty`, `readSettledDirty`.
  - `usePreparationPersistence` hook signature returns `UsePreparationPersistenceApi` (not `void`).
  - `App.tsx` consumes the API via a ref bridge from PreparationForm; verify the `useRef<UsePreparationPersistenceApi | null>` exists.
  - `components/PreparationForm.tsx` does NOT call any method on the returned API (it ignores the returned object beyond passing it back to App.tsx via callback prop).
- **Single-source-of-truth (anti-drift constraint #5):**
  - `lastSyncedSnapshot` ref exists ONLY in `hooks/usePreparationPersistence.ts` (not duplicated in App.tsx or anywhere else).
  - `grep -rn "lastSyncedSnapshot" --include="*.ts" --include="*.tsx"` should show occurrences only inside the hook file (and the doctrine doc in Phase D).
- **§4.2 batched-write contract (anti-drift constraint #6):**
  - All four hydration sites (`applyCloudActiveToState`, `handleStaleRevisionReloadLatest`, silent Case A in hydration effect, save success in `handleSaveAndContinueLater`) include both `setData(...)` AND `persistenceApiRef.current?.seedSnapshot(...)` within the same synchronous block (no `setTimeout`, no `Promise.then` between them).
- **Migration verification:**
  - `App.tsx` contains exactly one new `useEffect` for migration, dep list `[authLoading, authUser?.uid]`.
  - Migration logic order is: parse → project → meaningful-check → setItem(target) → removeItem(legacy) → setItem(marker). Any reordering is a bug.
  - **Migration marker key is namespace-scoped (`...:anonymous` or `...:${uid}`), not global.** (TIGHTENING 3.) Verify by inspecting the effect: the marker variable is computed from `authUser?.uid` per the same ternary as `targetKey`. A literal `'vday_data_draft:_migrated_v1_2'` constant without a namespace suffix is a bug.
  - The `:anonymous` marker and `:${uid}` markers are read/written independently; setting one does NOT short-circuit the other. The effect re-fires when `authUser?.uid` changes and checks the appropriate marker for the new namespace.
- **selectiveHydrate export:**
  - `selectiveHydrate` is exported from `hooks/usePreparationPersistence.ts`.
  - `utils/meaningfulContent.ts` imports it and applies it internally.
- **meaningfulContent predicate:**
  - The function is disjunctive (returns true on ANY one condition), not conjunctive (does not require ≥2 fields).
  - 50-character threshold for `finalLetter` is exact (not 49, not 51).
- **Schema version acceptance (Commit 4 must include — §4.C.7.5):**
  - `grep -n "CURRENT_SCHEMA_VERSION" hooks/usePreparationPersistence.ts` shows the value is `3`.
  - `grep -n "SUPPORTED_SCHEMA_VERSIONS" hooks/usePreparationPersistence.ts` shows the array contains `3` alongside `1` and `2`.
  - `StoredDraft` interface includes `lastKnownCloudRevision?: number | null` and `hasLocalChanges?: boolean` (both optional so v1/v2 entries still type-check).
  - `readDraft()` applies safe defaults (`null` and `false`) when fields are absent.
  - After migration, the migrated entry is readable via `peekDraft(uid)` (no "Discarding draft with unsupported version" warning in console).
  - **After Commit 4: a migrated entry round-trips through `peekDraft` / `readDraft` without producing any console warning containing "unsupported version" or "Discarding draft".** (Closes the read-rejection class flagged by TIGHTENING 1.)
- **Hook self-seeding invariant (Commit 5 must include — PATCH 2 + TIGHTENING 2):**
  - Hook initializes `lastSyncedSnapshotRef.current` to `selectiveHydrate(data)` on first mount when the ref is `null`.
  - Self-seeding runs in a mount-time effect (or initializer); does NOT run after subsequent re-renders or remounts where the ref is non-null.
  - **§4.C.9 self-seed effect's body is wrapped in `if (lastSyncedSnapshotRef.current === null)`. No code path overwrites an existing baseline.** (TIGHTENING 2 — doctrinal overwrite guard. Verify by inspecting the effect: the entire body must be inside the null-check; no early returns or branches that bypass it.)
  - Verified by smoke test: mount PreparationForm with `data` containing typed content (e.g., recipient name); immediately read `flushAndReadDirty()` — returns `false` (no false-positive divergence).
- `npm run build` exits 0.

### Phase D checklist

- `docs/archived/2026-05-12-active-paused-state-machine.md` exists.
- `docs/contracts/active-paused-state-machine.md` does NOT exist.
- `docs/doctrine/sync-confidence.md` exists with all 12 top-level sections per §5.D.3.
- `docs/doctrine/local-persistence-contract.md §6.5` has been rewritten (verify it no longer references `PersistenceStatus`, `PAUSED`, `ABANDONED`, `MAX_DRAFTS`).
- All cross-references in the doctrine docs resolve to existing files.

---

## 10. Out-of-scope items observed during planning

Listed for future PRs. **Explicitly NOT addressed in PR-48.A.**

### 10.1 PreparationForm's resume-modal meaningful-content predicate

[`components/PreparationForm.tsx:97-111`](../../components/PreparationForm.tsx:97) consumes `getDraftMetadata().hasMeaningfulContent` for the silent-restore-vs-show-modal decision. This predicate (`MEANINGFUL_DRAFT_FIELDS` + threshold ≥2) is **different** from the new v1.2 §3 predicate. Two predicates coexist after PR-48.A.

**Why not in scope:** changing PreparationForm's decision predicate could reshape the resume-modal show/silent-restore behavior in ways outside PR-48.A's reconciliation-focused scope. Behavior change here is a UX call, not a sync-confidence call.

**Future PR candidate:** PR-48.D — unify the two predicates by removing `MEANINGFUL_DRAFT_FIELDS`/`MEANINGFUL_CONTENT_THRESHOLD` from `hooks/usePreparationPersistence.ts` and migrating PreparationForm + `getDraftMetadata()`'s consumers to the canonical predicate.

### 10.2 `PersistenceStatus` enum narrowing

`types/draft.ts:24` exposes `'ACTIVE' | 'PAUSED' | 'ABANDONED'`. After PR-48.A, only `'ACTIVE'` is write-able by the surviving client code. `PAUSED` and `ABANDONED` may still appear in DB records (multi-draft history).

**Why not in scope:** narrowing the type could break deserialization of historical drafts. The narrowing should pair with the new API surface design in PR-48.B (`GET /api/draft` returning a simpler shape).

**Future PR candidate:** PR-48.B — narrow `PersistenceStatus` to `'ACTIVE'` (or eliminate the field; single-draft model has no status enum semantics).

### 10.3 `draftRecord` shape simplification

`App.tsx:490-498` keeps `{ draftId, seedDraftState, revision }`. Without the observer, `seedDraftState`'s only consumer is the save handlers' monotonicity logic (which itself is multi-draft adjacent — single-draft has only one draft to update; monotonicity is over draftState progression for that draft, which survives).

**Why not in scope:** the save handlers' use of `seedDraftState` for monotonicity is correct under single-draft. Shape changes are PR-48.B's concern when the API surface evolves.

**Future PR candidate:** PR-48.B — if `POST /api/draft` returns a simpler response (e.g., just `{revision, updatedAt}`), `draftRecord` may collapse to `{revision: number | null}` or be eliminated entirely.

### 10.4 `BeginNewPromptModal` rewrite

PR-48.A leaves the modal file unchanged (only the App.tsx handlers it calls are simplified). The modal's button labels still say "Save & Start New" and "Discard & Start New" — both now behaving identically (local-clear).

**Why not in scope:** the locked PR-48.A scope is "remove multi-draft constructs"; modal copy/UX is PR-48.B's domain (per v1.2 §10.2 simplification commit `d5c8990`).

**Future PR candidate:** PR-48.B — replace `BeginNewPromptModal` with `BeginAgainConfirmationModal` per v1.2 §8.1/§8.2 (signed-in/signed-out copy + metadata preview).

### 10.5 `SignInReconciliationModal` button reshape

PR-48.A removes the third button ("Save Local Draft as New"). The remaining two buttons (Continue Dashboard, Discard Local) are operationally identical — both call `applyCloudActiveToState`. v1.2 §5.2 collapses to (Continue Saved Draft, Continue Recent Edits) which are operationally distinct.

**Why not in scope:** the reshape requires the new "Continue Recent Edits" behavior (revision-only hydration, preserving local content). That's a substantive behavior addition that pairs with the new `POST /api/draft` flow in PR-48.B.

**Future PR candidate:** PR-48.B — reshape to v1.2 §5.2 button set + revision-only hydration semantics.

### 10.6 `api/drafts/list.js` → `GET /api/draft` migration

PR-48.A still uses `/api/drafts/list` (returning an array). v1.2 §9.1 introduces `GET /api/draft` (returning a single record or 404).

**Why not in scope:** API surface change is PR-48.B per v1.2 §12.

**Future PR candidate:** PR-48.B.

### 10.7 `api/drafts/transition.js` deletion

Per L9: leave in place. Becomes zero-caller dead code after Phase A (observer removal). Fate decision in PR-48.B per v1.2 §11.1.

**Future PR candidate:** PR-48.B — decide: delete entirely, or repurpose for SAVED-state recording on letter-sent boundary.

### 10.8 Hydration failure modes (v1.2 §5.4)

v1.2 §5.4 specifies 401/5xx/network handling (exponential backoff retries, silent fallback to Case C). PR-48.A inherits the existing `.catch(() => { setHydrationResolutionState('resolved'); })` at App.tsx:1376-1385 which is the v1.0 silent-fallback behavior — already approximately correct but not the full v1.2 §5.4 specification.

**Why not in scope:** the v1.2 §5.4 retry semantics are paired with the new `GET /api/draft` API in PR-48.B.

**Future PR candidate:** PR-48.B.

### 10.9 Stage-aware hydration (v1.2 §5.5)

v1.2 §5.5 specifies REFINE+ stage hydration semantics (do NOT apply cloud silently; force Case B modal). PR-48.A does not implement this — silent Case A at App.tsx:1358-1374 hydrates regardless of stage.

**Why not in scope:** stage-aware hydration logic is paired with the reconciliation reshape in PR-48.B.

**Future PR candidate:** PR-48.B.

### 10.10 In-flight save serialization (v1.2 §5.6)

v1.2 §5.6 specifies defer-modal-until-save-resolves when sign-in fires during in-flight save. PR-48.A does not address; current behavior allows modal stacking in this rare edge.

**Why not in scope:** edge-case UX hardening; pairs with §5.4 + §5.5 reshape in PR-48.B.

**Future PR candidate:** PR-48.B.

### 10.11 Quota-error UX symmetry

[`docs/doctrine/local-persistence-contract.md §7`](../../docs/doctrine/local-persistence-contract.md) notes: "restoring symmetric, user-visible quota-error signaling across the surviving writers is a Phase 1 stabilization item." PR-48.A doesn't introduce this either.

**Why not in scope:** unrelated to single-draft pivot.

**Future PR candidate:** independent stabilization PR (not part of PR-48.x sequence).

### 10.12 `getDraftMetadata`'s consumption inside PreparationForm

Today, `getDraftMetadata` returns rich metadata for the resume-modal decision. After PR-48.A's uid-namespacing, PreparationForm needs the current uid to call `getDraftMetadata(uid)`. The signature change cascades but the behavior doesn't.

**Why noted here:** not a scope addition, just a call-site update covered by §4.C.7. Listed for clarity that PreparationForm's resume-modal decision flow continues to use the OLD meaningful-content predicate (per §10.1).

---

## 11. Verification roll-up before PR-48.A merge

Before opening PR-48.A for final review, the implementer should verify:

1. **All six commits land in the documented order.** No interleaving across phases. **Commit 4 bundles C.6 + C.7 + C.7.5 + C.8** — schema acceptance MUST land alongside namespacing + migration (otherwise migrated v3 entries are rejected by `readDraft`).
2. **All anti-drift checklists pass** (§9, per phase). Specifically: schema-version constants in `usePreparationPersistence.ts` show `3`; hook self-seeds `lastSyncedSnapshotRef` on first mount.
3. **All 11 smoke tests pass** (§7 references + §6 commit exit criteria, smoke tests 1–10 across Commits 4–5; the "11th" is the implicit static-check pass via `npm run build` per anti-drift checklists).
4. **All locked decisions honored** (L4 through L11 — review against §1 table).
5. **No out-of-scope items addressed** (§10 list — verify none of these were touched).
6. **`npm run build` passes** after every commit.
7. **Doctrine docs match code** after Commit 6.

The diff stat should approximate:
- ~870 LOC removed across deleted files (`useDraftStateObserver.ts` 168 + `pause.js` 162 + `resume.js` 232 + `discard.js` 144 + `lifecycleDraft.ts` 130 + `handleSignInSaveLocalDraftAsNew` ~80 + cap removal artifacts ~10).
- ~300 LOC added across new files (`meaningfulContent.ts` ~25 + `sync-confidence.md` ~350 + migration effect ~50 + hook API expansion ~80 + signature/call-site updates ~100, minus offsets).
- Net: ~550 LOC removed, ~300 added. Roughly aligns with v1.2 §12 estimate of 600 removed / 250 added.

---

## 12. Closing

PR-48.A is a systems integrity migration with locked discipline. The strategy above is the binding operational spec; every commit references this document for its scope and exit criteria; the anti-drift checklists are the gate.

Implementation begins after this document is approved by founder + cross-voice reviewers. Per the architectural framing, no commit ships without explicit verification against §9. State continuity is preserved at every intermediate phase per §8. Failure modes are handled defensively per §7. Out-of-scope items are deferred to PR-48.B+ per §10 — explicitly NOT addressed in this PR.

The diagnostic's two blocking gates (L4 + L5) are locked. The six advisory gates (L6 + L7 + L8 + L9 + L10 + L11) are locked. Implementation can begin.

---

End of original strategy. Stabilization delta follows.

---

## 13. Final Lock Verification Delta

This section records the corrections applied after founder + cross-voice review of the original strategy. Three patches integrated. No locked decisions changed. No architecture redesigned. No new module-level mutable state. No source code in this document.

### 13.1 What was corrected

**PATCH 1 — Schema version sequencing (critical):**
The original strategy placed `CURRENT_SCHEMA_VERSION = 3` and `SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3]` in Commit 5, while Commit 4's migration wrote `version: 3` payloads. This created a broken intermediate deploy state: between Commit 4 and Commit 5 shipping, `readDraft` would warn and return null for migrated entries (rejecting the unsupported version), making migrated drafts temporarily invisible.

Correction: a new sub-section **§4.C.7.5 "Schema version acceptance"** was added between §4.C.7 and §4.C.8. The schema-version constants, `StoredDraft` interface extension, and `readDraft` safe-default handling MUST land in Commit 4 alongside namespacing and migration. Commit 5's scope was reduced to runtime sync-confidence machinery only.

Affected sections updated: §4.C (new §4.C.7.5; revised §4.C exit state), §6 (Commit 4 scope expanded to bundle C.6 + C.7 + **C.7.5** + C.8; Commit 5 scope reduced; renamed "runtime machinery"), §8 (state continuity table rows for Commit 4 and Commit 5 rewritten; critical-broken-intermediate list expanded with three failure modes), §9 (Phase C checklist gained schema-acceptance grep checks), §11 (verification roll-up emphasizes Commit 4 bundling).

**PATCH 2 — Ref-bridge baseline edge:**
The original strategy's ref-bridge architecture (PreparationForm owns the hook; App.tsx accesses the imperative API via callback-set ref) had an unaddressed edge: if hydration co-commits fire while PreparationForm is unmounted (e.g., user at REFINE when sign-in resolves), `persistenceApiRef.current?.seedSnapshot()` silently no-ops. The hook later mounts with `lastSyncedSnapshotRef.current === null`, and the first mutation flips `hasLocalChanges = true` (false-positive divergence).

Correction: an explicit **hook self-seeding invariant** was added in §4.C.9. On first hook mount, if `lastSyncedSnapshotRef.current === null`, the hook initializes it from `selectiveHydrate(data)` — because the initial mounted working state IS the baseline (originating from persisted or hydrated content). Implementation shape provided; idempotence with explicit `seedSnapshot()` calls preserved.

Explicit framing: this is NOT fallback logic, NOT inferred reconciliation, NOT a replacement for the explicit hydration co-commit contract. It is a strict mount-time invariant that closes the ref-bridge unmount-window edge.

Affected sections updated: §4.C.9 (new subsection on self-seeding; (θ) ref-bridge drawback list expanded with Drawback 2 + mitigation pointer), §6 (Commit 5 scope explicitly lists self-seeding invariant), §9 (Phase C checklist gained self-seeding verification), §7 (new §7.5 "If hydration completes while PreparationForm is unmounted"; renumbered §7.5 → §7.6).

**PATCH 3 — Clarifications (non-blocking):**
- Clarified that `writeDraftWithFlags(...)` in §4.C.9 code blocks is NOT a new helper but a readability hint for the existing `writeDraft(uid, data, step)` extended with the new fields per §4.C.7.5.
- Added an implementation note under the JSON.stringify deepEqual recommendation: both comparison sides pass through `selectiveHydrate` BEFORE serialization, ensuring deterministic projection shape and minimizing key-order false positives. Informational; supports rather than redirects the design.

### 13.2 Why the migration is now safer

**Before the patches:**
1. Migrated drafts would have been invisible during the Commit 4 → Commit 5 window. Users with meaningful pre-pivot content would have seen empty forms post-migration, panicked, and possibly Begin-Again'd their work into oblivion before Commit 5 shipped.
2. Users navigating REFINE → PREPARE after sign-in would have seen a false-positive Case B reconciliation modal on next sign-in, eroding trust in the system's "no silent destruction" contract.

**After the patches:**
1. Schema acceptance ships in the same commit as the migration. There is no read-rejection window. Migrated entries are immediately readable; the only intermediate state is "schema v3 entries with `hasLocalChanges` populated by migration heuristic, not yet by debounce-time comparison" — which is acceptable per v1.2 §11.8.
2. The hook self-seeds its baseline at mount when the ref-bridge missed it. False-positive divergence is prevented by construction. The reconciliation gate sees the correct `hasLocalChanges` value regardless of mount-order timing.

**State continuity contract restored:** every intermediate commit is functionally valid for end-users. The "preserves user trust (no silent data loss)" architectural framing is upheld across all six commits.

### 13.3 Whether implementation can begin safely

**Yes.** All three patches integrate cleanly without modifying:
- Any of the 8 locked decisions (L4–L11) — verified.
- The Phase A/B/C/D structure — verified; only Commit 4 internal contents changed (added C.7.5 as a sub-item within the existing bundle).
- The ref-bridge architecture (θ) — preserved; the self-seeding invariant is an additive guard, not a redesign.
- The single-source-of-truth invariant (anti-drift constraint #5) — preserved; `lastSyncedSnapshotRef` still lives only in the hook.
- The no-module-level-mutable-state constraint (anti-drift constraint #4 / L7) — preserved; self-seeding uses a hook-local ref, not a module-level cache.

The strategy document is now internally consistent. The 5–6 commit structure remains intact. Anti-drift checklists are stronger (more concrete verification items). Failure-mode handling covers the ref-bridge edge explicitly.

**Implementation may begin at Commit 1 (Phase A — subtractive removals).** No further strategy revisions are anticipated before code starts. If implementation surfaces a constraint that requires deviation, halt and flag per anti-drift constraint #7.

---

End of strategy + stabilization delta. Final lock verification delta follows.

---

## 14. Final Lock Verification Delta

This section records the three tightenings applied after the second cross-voice review (ChatGPT) and before implementation lock. No locked decisions modified. No architecture changed. No migration flow redesigned.

### 14.1 What the three tightenings fixed

**TIGHTENING 1 — v3 readability verification gate (§6, §9):**
The prior Commit 4 exit criteria verified that migration HAPPENED (entries moved to namespaced keys, legacy keys removed) but did not explicitly verify that migrated v3 entries are READABLE through the live read path. That left exactly the failure class PATCH 1 closed — the broken-intermediate where `readDraft` rejects v3 — unverified at the commit boundary.

Correction: a dedicated **Smoke test 5** was added to Commit 4 exit criteria. It verifies two distinct conditions: (a) `peekDraft(uid)` / `readDraft(uid)` returns a fully-populated `DraftPeek` including the new `lastKnownCloudRevision` / `hasLocalChanges` fields with migration-set values; (b) the browser console is clean of any `Discarding draft with unsupported version` warnings during or after migration. Commit 5's smoke tests renumbered from 5–9 to 6–10. A corresponding round-trip verification line added to §9 Phase C checklist.

**TIGHTENING 2 — Self-seed doctrinal overwrite guard (§4.C.9, §9):**
The PATCH 2 self-seed effect's `if (lastSyncedSnapshotRef.current === null)` guard is structurally correct, but the *intent* was not explicit. A future engineer simplifying the effect (removing the guard, or adding `data` to the deps to "keep the baseline fresh") would silently re-baseline on every render, erasing accumulated divergence state and creating exactly the false-positive `hasLocalChanges` class PATCH 2 closed.

Correction: a doctrinal-overwrite-guard sentence was added immediately below the self-seed code shape in §4.C.9 — naming the guard as load-bearing, NOT optimization, and explaining the regression class it prevents. A corresponding verification line was added to §9 Phase C checklist asking reviewers to inspect the effect body for the wrapping null-check, with no early returns or branches bypassing it.

**TIGHTENING 3 — Migration marker namespace scope (§4.C.8, §7, §9):**
The prior migration marker was a single global key `vday_data_draft:_migrated_v1_2`. This conflicts with the document's own invariant ("Migration runs once per browser per (anonymous OR user-namespace) target"). Three failure modes:

- Anonymous migration sets the global marker; if a legacy entry later reappears for a signed-in user (browser sync, restore utility), user-namespace migration never fires.
- Signed-in migration sets the global marker; subsequent anonymous-namespace flows are equally locked out.
- Any legacy `vday_data_draft` entry restored AFTER the first marker write is permanently stranded.

Correction: the marker is now namespace-scoped:
```
const marker = authUser?.uid
  ? `vday_data_draft:_migrated_v1_2:${authUser.uid}`
  : 'vday_data_draft:_migrated_v1_2:anonymous';
```
Each namespace migrates independently when its target's effect fires. The `:anonymous` marker does NOT block `:${uid}` migration and vice versa. The "marker set LAST" invariant is preserved exactly. No multi-marker coordination logic added — each namespace is read/written under its own key with no cross-namespace state machine.

Affected sections updated: §4.C.8 (effect shape, why-namespace-aware analysis, trigger sequencing, edge cases all rewritten); §7.2 (user-recovery instructions updated to clear the correct namespace-scoped marker); §9 Phase C checklist (Migration verification block updated to require namespace-scoping); smoke test 2 in Commit 4 updated to verify the namespace-scoped marker rather than a global one.

### 14.2 Why migration / readability guarantees are now safer

**Before these tightenings:**
1. A subtle race existed where Commit 4 could ship and pass smoke tests 1–4 yet leave migrated entries unreadable until Commit 5 (because no explicit Commit 4 exit criterion verified the round-trip). The schema-acceptance fix from PATCH 1 was theoretically correct but not commit-gate-enforced.
2. The PATCH 2 self-seed guard was load-bearing but its intent lived only in commit context; six months from now an engineer cleaning up "redundant null checks" could erase it.
3. The migration marker was global, so any future flow that repopulates legacy `vday_data_draft` (Firebase profile sync, debug tools, browser restore) would find migration permanently disabled — stranding user content silently.

**After these tightenings:**
1. **Commit 4 cannot ship without verifying v3 readability.** Smoke test 5 is explicit; the §9 round-trip check is explicit; the failure class is gated at the commit boundary, not just in theory.
2. **The self-seed guard cannot be silently removed.** The doctrinal sentence names the regression it prevents; the §9 checklist requires reviewers to verify the null-check wraps the effect body. Future drift requires deliberate doctrine violation, not accidental cleanup.
3. **Migration can re-fire per namespace.** If a legacy entry shows up later under a different auth state, the relevant namespace's marker hasn't been set yet, and migration runs correctly. No content is permanently stranded by a single early marker write.

### 14.3 Why the self-seed invariant is now protected against future drift

Three layers of protection:

1. **Doctrinal prose in §4.C.9** — the new sentence under the self-seed code shape names the guard as "doctrinal, not optimization" and explains the regression class. This survives in the strategy document permanently and is referenced from the corresponding doctrine doc (`sync-confidence.md` §5 in Phase D).
2. **Inline code comment** — the existing `// Empty dep list: this is a strictly once-per-mount invariant...` comment in the code shape reinforces the intent at the code-edit level. Combined with the new doctrinal sentence, a future engineer touching this effect encounters two distinct signals before changing it.
3. **§9 Phase C checklist verification** — code review for any future PR that touches `usePreparationPersistence.ts` must verify the wrapping `if (lastSyncedSnapshotRef.current === null)` is present and the body is fully inside it. This is a structural check, grep-able and inspection-friendly.

Three independent surfaces have to be violated simultaneously for the invariant to be lost. Defense in depth.

### 14.4 Whether implementation is now considered lock-safe

**Yes.** All three tightenings integrate cleanly without:
- Modifying any locked decision L4–L11 (verified).
- Changing the Phase A/B/C/D structure or the 5–6 commit sequencing (verified).
- Redesigning migration flow architecture (verified — only the marker's scope was changed; the migration steps and ordering are unchanged).
- Introducing module-level mutable state (verified — the namespace-aware marker is computed from `authUser?.uid` at effect time, not cached).
- Adding multi-marker coordination or cross-namespace state machines (verified — each namespace is fully independent).
- Implementing code (verified — strategy document only).

The three commits' exit criteria are now strictly more rigorous than before. The Commit 4 → Commit 5 transition is gated on v3 readability. The self-seed invariant has doctrinal + code-comment + checklist protection. The migration marker handles re-fire scenarios correctly across namespaces.

**Strategy document is lock-safe.** Implementation may begin at Commit 1 (Phase A). If implementation surfaces a constraint requiring deviation from any of L4–L11 or from this strategy, halt and flag per anti-drift constraint #7. No further strategy revisions are anticipated before code starts.

---

End of strategy + stabilization delta + lock verification delta. No source code in this document. No application files modified. Awaiting approval to begin Commit 1 (Phase A).
