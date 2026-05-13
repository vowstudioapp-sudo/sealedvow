# PR-48.A — Implementation Diagnostic

**Date:** 13 May 2026
**Scope:** PR-48.A — multi-draft revert + sync-confidence foundation (single-draft pivot v1.2 §12)
**Mode:** Read-only architecture review. No code modifications. No fix prompts.
**Source proposal:** [docs/proposals/single-draft-pivot.md](../proposals/single-draft-pivot.md) v1.2 (founder-locked)
**Method:** File-by-file trace of v1.2 §12 PR-48.A scope items against the existing codebase. Each ask answered with current-state file:line anchors, dependency ordering, and surfaced spec ambiguities.

---

## 0. Disposition

PR-48.A is implementable as scoped. The work spans **two clearly separable workstreams** that should be sequenced explicitly:

1. **Revert workstream** (deletions + simplifications) — purely subtractive, well-bounded, no dependency edges into the new sync-confidence schema. Can land as one or two commits with mostly mechanical edits.
2. **Sync-confidence workstream** (UID namespacing + revision schema + debounced semantic divergence + projection rule + migration) — substantive, with three real dependency edges and one founder-decision gate (P1/P2/P3 anonymous-namespace policy).

**Single must-resolve-before-code blocker surfaced:** v1.2 §4.5 leaves the anonymous-namespace policy at "PR-48.A implementer chooses ONE during implementation." The recommendation is P1, but the implementation surface for P1 vs P2 vs P3 differs by 50–150 LOC (UI affordance vs. silent preserve). Lock the choice before code starts. See §12 below.

**Eight smaller spec edges surfaced**, each individually resolvable in a single sentence amendment or implementer judgment call. See §13 below.

The diagnostic finds no architectural blocker, no missing prerequisite, and no doctrine contradiction. The 600-LOC-removed / 250-LOC-added estimate in v1.2 §12 is plausible; my recount tracks: ~870 LOC across files marked for full deletion (useDraftStateObserver 168 + pause 162 + resume 232 + discard 144 + lifecycleDraft 130 + handleSignInSaveLocalDraftAsNew ~80), with ~150 LOC of simplification offsets in App.tsx + save.js.

---

## 1. File-level change map (by scope item)

### 1.1 New local autosave schema (`lastKnownCloudRevision` + `hasLocalChanges`)

**Modified — primary surface:**
- [`hooks/usePreparationPersistence.ts`](../../hooks/usePreparationPersistence.ts)
  - `:9` — bump `CURRENT_SCHEMA_VERSION = 2` to `3` (decision below in §1.5 migration)
  - `:13` — extend `SUPPORTED_SCHEMA_VERSIONS = [1, 2]` → `[1, 2, 3]` (or `[2, 3]` if we drop v1 support concurrently)
  - `:18-30` — extend `StoredDraft` interface with `lastKnownCloudRevision: number | null` and `hasLocalChanges: boolean`
  - `:207-244` `readDraft()` — extend the parse path to surface the two new fields with safe defaults (`lastKnownCloudRevision: null`, `hasLocalChanges: false`)
  - `:246-267` `writeDraft()` — extend the read-merge payload construction to preserve both fields through autosave writes
  - `:303-321` `writeStage()` — same read-merge extension
  - `:336-358` `writeDraftId()` — same read-merge extension
  - `:460-479` `writeDraftFromExternal()` — same read-merge extension

**Net:** ~30 LOC added to `usePreparationPersistence.ts` for schema-shape work alone (separate from the §1.3 debounced-divergence machinery and §1.4 UID-namespace resolution).

### 1.2 New `lastSyncedSnapshot` in-memory ref (projected per §4.4)

**New surface:** the ref lives **inside `usePreparationPersistence`'s hook body**, not in App.tsx. Rationale:
- The debounced-divergence check (per L2) runs inside the hook's autosave timer.
- App.tsx already owns hydration; it writes the baseline at hydration time, but reads against it happen inside the hook's debounce.
- Putting the ref outside the hook would require a callback-shaped contract to flush it.

**Modified:**
- [`hooks/usePreparationPersistence.ts`](../../hooks/usePreparationPersistence.ts):279-298 — `usePreparationPersistence` hook body. Add `const lastSyncedSnapshotRef = useRef<Partial<CoupleData> | null>(null)` and a setter function exposed via the hook's return type (the hook currently returns `void`; will need to return an imperative API or accept a hydration-callback prop).
- [`App.tsx`](../../App.tsx):944-961 `applyCloudActiveToState` — co-commit the `lastSyncedSnapshot` write alongside the `data`/`draftRecord` updates (Issue #2 batched-write contract).
- [`App.tsx`](../../App.tsx):723-735 `handleStaleRevisionReloadLatest` cloud-hydration branch — same co-commit.
- [`App.tsx`](../../App.tsx):1358-1374 the silent Case A hydration branch — same co-commit.

**Decision deferred to implementer:** ref vs. React state. v1.2 §4.2's "all four writes batched in same React commit" is satisfied if all four are setters within one event handler; if `lastSyncedSnapshot` is a ref, the ordering is "ref write precedes setState." Either satisfies the doctrine.

### 1.3 Debounced semantic divergence (L2)

**Modified — primary surface:**
- [`hooks/usePreparationPersistence.ts`](../../hooks/usePreparationPersistence.ts):286-297 — the existing `useEffect` with `setTimeout`/`writeDraft` is the existing 1000ms debounce. Extend its inner closure:
  - Maintain a per-render `dirtyBitRef` (optimistic; flips true on any field mutation since last sync)
  - When the debounce fires: compute `projected(data)`, deep-equal it against `lastSyncedSnapshotRef.current`, derive settled `hasLocalChanges`, persist alongside `data` in `writeDraft()`

**Hook API expansion required.** Currently `usePreparationPersistence(data, step, options): void`. PR-48.A needs the hook to expose:
- A way for App.tsx to **seed/update** `lastSyncedSnapshotRef` on hydration boundaries
- A way for App.tsx to **read** the settled `hasLocalChanges` at reconciliation gate time (v1.2 §4.4: "reconciliation never reads transient optimistic state")
- A way for App.tsx to **flush** the in-flight debounce synchronously before reading `hasLocalChanges` at sign-in

These can be exposed via an imperative ref-style API or by promoting the hook from `void` to returning a small object. The PR-48.A implementer picks. (Recommendation: return `{ flushAndReadDirty(): boolean; seedSnapshot(projected: Partial<CoupleData>): void }` for explicit boundaries.)

**Net:** ~50–80 LOC added inside the hook for the divergence machinery + API.

### 1.4 UID-namespaced storage key resolution (L1)

**Modified — primary surface:**
- [`hooks/usePreparationPersistence.ts`](../../hooks/usePreparationPersistence.ts):4 — replace the `STORAGE_KEY = 'vday_data_draft'` module-level constant with an `activeKey(uid: string | null): string` resolver function:
  - Signed-in → `vday_data_draft:${uid}`
  - Signed-out → `vday_data_draft:anonymous`
- Every operation that currently reads `STORAGE_KEY` (7 sites in this file) must now resolve via `activeKey(uid)`:
  - `:210` `readDraft()` `getItem`
  - `:261` `writeDraft()` `setItem`
  - `:317` `writeStage()` `setItem`
  - `:354` `writeDraftId()` `setItem` (also `:339` `readDraft()`-call inside it)
  - `:363` `clearPreparationDraft()` `removeItem`
  - `:408` `getDraftMetadata()` `getItem`
  - `:475` `writeDraftFromExternal()` `setItem`
- **Signature change required:** every exported function (`readDraft`, `peekDraft`, `writeStage`, `writeDraftId`, `writeDraftFromExternal`, `clearPreparationDraft`, `getDraftMetadata`, `usePreparationPersistence`) must accept the current `uid` or resolve it via `useAuth` inside the hook. Module-level functions (called from App.tsx outside React) need uid passed in as a parameter — OR the resolver reads from a module-level cache updated by App.tsx.

**Modified — call sites:**
- [`App.tsx`](../../App.tsx):78,85 — import surface; new helpers may be needed
- [`App.tsx`](../../App.tsx):367 `peekDraft()` synchronous mount-time read — needs the uid at mount. **Auth-resolution race:** `useAuth` returns `loading: true` on cold mount until `onAuthStateChanged` fires once. The mount-time `peekDraft()` cannot wait for that. Implementer must choose:
  - **(a)** Use `auth.currentUser?.uid` directly (Firebase SDK exposes a synchronous getter) — works if Firebase has rehydrated by the time JS executes, but unreliable on cold incognito.
  - **(b)** Fall back to `anonymous` namespace on cold mount; re-hydrate from user namespace once `serverSessionReady` flips true. Adds a re-read effect but is honest about the auth-rehydration window.
  - **(c)** Block mount-time hydration until auth resolves. Changes boot UX (flash-then-load); breaks PR-47.1's sync mount-read contract.
  - Recommendation: (b). See dependency ordering in §2 below.
- [`App.tsx`](../../App.tsx):614,731,789,790,806,807,879,945,946,1045,1046,1133,1233,1284,1367,2077,2087,2205 — every `writeDraftId`, `writeStage`, `clearPreparationDraft`, `writeDraftFromExternal` call site needs the uid passed in (or a wrapper that resolves it from a context/hook).
- [`components/PreparationForm.tsx`](../../components/PreparationForm.tsx):91,98,150,155,200 — every `peekDraft`, `getDraftMetadata`, `usePreparationPersistence`, `clearPreparationDraft` call site needs the same.
- [`components/DraftResumeModal.tsx`](../../components/DraftResumeModal.tsx):3 — imports `DraftMetadata` type only; no functional change.

**Lifecycle issue (mid-session auth change):** if a user signs in mid-session while `PreparationForm` is mounted, the autosave hook is currently keyed to `data, step, debounceMs, enabled`. It does NOT re-key on uid change. PR-48.A must:
- Add `uid` to the effect's dep list so the next debounce write goes to the new namespace
- Decide what happens to the in-flight `data` content (does the anonymous content persist in the anonymous namespace, untouched? Or follow per P1/P2/P3 §4.5 choice?)
- Per P1 recommendation: leave anonymous content untouched; subsequent writes go to user namespace. The hook needs to handle the transition write correctly — first write after sign-in writes to user namespace (now empty) without clobbering anonymous's prior persisted content.

### 1.5 Migration of existing `vday_data_draft` entries

**Modified — migration trigger location decision required.** Three candidates:
- **(α) Module load in `usePreparationPersistence.ts`** — runs once on JS bundle parse. Synchronous. Cannot know current uid (auth hasn't fired). Would namespace everything to anonymous and force user to re-reconcile on next sign-in. Wrong choice for signed-in users.
- **(β) First effect in `App.tsx` after `serverSessionReady` flips** — async, knows uid. Can correctly route migration to user namespace if signed-in, else anonymous. Adds one-time complexity but is the only correct choice.
- **(γ) First hook call inside `usePreparationPersistence` mount** — similar to β but runs deeper in the component tree. Same auth-timing constraints. Less load-bearing than β for the read-path migration.

**Recommendation: β.** Migration runs as a one-time effect in App.tsx gated on `!authLoading && serverSessionReady` (signed-in) or `!authLoading && !authUser` (signed-out confirmed). The effect:
1. Reads legacy `vday_data_draft` (no namespace)
2. If absent → no-op
3. If present:
   - Apply `selectiveHydrate` to extract the projected data
   - Compute `meaningfulContent(projected)` per v1.2 §3
   - Determine target namespace: `vday_data_draft:${uid}` if signed-in, `vday_data_draft:anonymous` if signed-out
   - Write the migrated entry with `{ ...projected, lastKnownCloudRevision: null, hasLocalChanges: meaningfulContent(projected) }` (per v1.2 §11.8: non-meaningful → `hasLocalChanges = false` to skip false-positive Case B)
   - Remove the legacy key
4. Surface a one-time migration completion flag (e.g., a `localStorage['vday_data_draft:_migrated_v1_2']` marker) so the effect doesn't re-run after a successful migration

**Alternative per v1.2 §11.8:** bump `CURRENT_SCHEMA_VERSION` so the readDraft path discards pre-pivot entries. More aggressive (any meaningful pre-pivot content is silently lost). Recommendation: do not take this path without founder lock — the soft-migration above is the trust-preserving choice.

**Net:** ~50 LOC added (new effect in App.tsx + helper in `usePreparationPersistence.ts`).

### 1.6 `utils/meaningfulContent.ts` (new file)

**Created:**
- [`utils/meaningfulContent.ts`](../../utils/meaningfulContent.ts) — new file. Exports a single function:
  ```ts
  export function meaningfulContent(data: Partial<CoupleData> | null): boolean
  ```
  Predicate per v1.2 §3:
  - `recipientName?.trim().length > 0` OR
  - `senderName?.trim().length > 0` OR
  - `finalLetter?.trim().length >= 50` (per spec: ≥50 chars after trim) OR
  - At least one media upload: `memoryBoard.length > 0 || userImageUrl || audio?.url || video?.url || hasGift`
  - **Always operates on projected view.** Caller must apply `selectiveHydrate` first OR the function applies it internally.

**Consumed by:**
- The migration trigger (§1.5) — to set initial `hasLocalChanges` correctly
- The reconciliation gate in App.tsx (replaces the current `getDraftMetadata().hasMeaningfulContent` predicate)
- Server-side validation if needed (§3 mentions "if needed")

**Conflict with existing predicate.** [`hooks/usePreparationPersistence.ts`](../../hooks/usePreparationPersistence.ts):378-389,416-428 already contains a `MEANINGFUL_DRAFT_FIELDS` allowlist and `MEANINGFUL_CONTENT_THRESHOLD = 2` heuristic (≥2 non-empty fields from the allowlist). This predicate is DIFFERENT from v1.2 §3:
- v1.2 §3 is **disjunctive single-field** (any one of recipient/sender/body≥50chars/any media is sufficient)
- Existing is **conjunctive count** (≥2 fields from a fixed list)

The existing predicate is used by `getDraftMetadata()` and consumed at [App.tsx:1320-1321](../../App.tsx:1320) (reconciliation gate's local-meaningful check). PR-48.A must replace the call site with the new predicate. **Document the divergence** so post-merge reviewers understand the meaningful-content surface changed shape, not just location.

**Net:** ~25 LOC added in new file; ~15 LOC removed from `usePreparationPersistence.ts` (the old predicate); App.tsx call site swapped.

### 1.7 Endpoint deletions

**Deleted (full file removal):**
- [`api/drafts/pause.js`](../../api/drafts/pause.js) — 162 LOC, ATR-2 pause endpoint
- [`api/drafts/resume.js`](../../api/drafts/resume.js) — 232 LOC, atomic pause-and-promote (Phase 3)
- [`api/drafts/discard.js`](../../api/drafts/discard.js) — 144 LOC, ABANDONED transition

**Evaluated separately per v1.2 §11.1:**
- [`api/drafts/transition.js`](../../api/drafts/transition.js) — 197 LOC. v1.2 §11.1 leaves this open: SAVED state transition may still be needed for "letter sent" recording. **For PR-48.A purposes:** the transition.js endpoint is currently called ONLY by `useDraftStateObserver.ts:117` (which is being fully removed per L3). Once the observer is gone, the endpoint has zero client callers. Recommendation for PR-48.A: leave `transition.js` in place but mark it as dead code (no active caller). Decide deletion in PR-48.B when the new API surface (`POST /api/draft`) is designed and the SAVED-state recording mechanism is locked.

### 1.8 `utils/lifecycleDraft.ts` deletion

**Deleted:**
- [`utils/lifecycleDraft.ts`](../../utils/lifecycleDraft.ts) — 130 LOC (defines `pauseDraft`, `discardDraft`, `LifecycleResult`, `LifecycleInput`)

**Call sites that must be removed (in App.tsx):**
- [`App.tsx:81`](../../App.tsx:81) — `import { pauseDraft, discardDraft } from './utils/lifecycleDraft';`
- [`App.tsx:861-864`](../../App.tsx:861) — `pauseDraft` call inside `handleBeginNewSaveAndStartNew`
- [`App.tsx:899-902`](../../App.tsx:899) — `discardDraft` call inside `handleBeginNewDiscardAndStartNew`
- [`App.tsx:985-988`](../../App.tsx:985) — `pauseDraft` call inside `handleSignInSaveLocalDraftAsNew`

The first two are inside handlers that survive into PR-48.B (Begin Again flow) but get reshaped: PR-48.B introduces `DELETE /api/draft` (§9.1) which replaces `discardDraft`, and Begin Again's "Save & Start New" path disappears entirely (single-draft model has no "save current as new draft" semantics — Begin Again is destructive only). For PR-48.A specifically, the handlers themselves should be simplified (or removed) to break the dependency on the endpoints being deleted.

### 1.9 "Save Local Draft as New" removal

**Removed from App.tsx:**
- [`App.tsx:977-1059`](../../App.tsx:977) — `handleSignInSaveLocalDraftAsNew` function (~80 LOC)
- [`App.tsx:2336`](../../App.tsx:2336) — `onSaveLocalDraftAsNew={handleSignInSaveLocalDraftAsNew}` prop wire
- [`App.tsx:942`](../../App.tsx:942) — `caseBInFlightRef` declaration (only used by this handler)

**Removed from `SignInReconciliationModal`:**
- [`components/SignInReconciliationModal.tsx:44`](../../components/SignInReconciliationModal.tsx:44) — `onSaveLocalDraftAsNew: () => void;` prop in interface
- [`components/SignInReconciliationModal.tsx:62`](../../components/SignInReconciliationModal.tsx:62) — destructured prop
- [`components/SignInReconciliationModal.tsx:153-159`](../../components/SignInReconciliationModal.tsx:153) — the "Save Local Draft as New" button JSX (~7 LOC)
- Comment cleanup at `:11-22` — the locked 3-button spec no longer applies; will become 2-button per v1.2 §5.2

**PR-48.B follow-on:** the modal's remaining 2 buttons (`Continue Dashboard Draft` and `Discard Local Draft`) are operationally identical (both call `applyCloudActiveToState`). v1.2 §5.2 collapses them into a single "Continue Saved Draft" button + a "Continue Recent Edits" button (which is a NEW behavior — preserves local). The PR-48.A scope is just removing "Save Local Draft as New"; the deeper modal reshape happens in PR-48.B.

### 1.10 `MAX_DRAFTS` cap removal

**Modified:**
- [`api/lib/draftValidation.js:39`](../../api/lib/draftValidation.js:39) — remove `export const MAX_DRAFTS = 3;`
- [`api/lib/draftValidation.js:35-38`](../../api/lib/draftValidation.js:35) — remove the doctrine comment block above
- [`api/drafts/save.js:58`](../../api/drafts/save.js:58) — remove the `MAX_DRAFTS` import
- [`api/drafts/save.js:235-244`](../../api/drafts/save.js:235) — remove the cap-check block inside the CREATE transaction; also remove the `nonAbandonedCount` computation at `:232-234` if it has no other consumer
- [`api/drafts/save.js:47`](../../api/drafts/save.js:47) — remove the `// Cap rule:` doctrine comment

**Single-ACTIVE invariant retained.** The check at [`api/drafts/save.js:246-260`](../../api/drafts/save.js:246) (ACTIVE_DRAFT_EXISTS) stays — single-draft model still wants exactly one ACTIVE per user. The cap was the "≤3 non-abandoned" check; the single-ACTIVE is a separate invariant.

**Client-side cleanup:**
- [`utils/saveDraft.ts:38`](../../utils/saveDraft.ts:38) — the `{ kind: 'cap_exceeded'; current: number; limit: number }` variant of `SaveDraftResult`. Server will never return `CAP_EXCEEDED` after the removal. Keep the variant for the v1.2 transition period (defensive against stale server) OR remove. Recommendation: remove in PR-48.A for cleanliness.
- [`utils/saveDraft.ts:120-126`](../../utils/saveDraft.ts:120) — the corresponding 409 `CAP_EXCEEDED` branch in `saveDraft()`
- [`App.tsx:1165-1170`](../../App.tsx:1165) — the `case 'cap_exceeded':` branch in `handleSaveAndContinueLater`'s switch

### 1.11 `useDraftStateObserver` removal (L3)

**Deleted:**
- [`hooks/useDraftStateObserver.ts`](../../hooks/useDraftStateObserver.ts) — 168 LOC
- [`hooks/draftStateLogic.ts`](../../hooks/draftStateLogic.ts) — 67 LOC. **Candidate for partial deletion** but used elsewhere: `UI_STAGE_TO_DRAFT_STATE` and `decideTransition` are exported. App.tsx imports `UI_STAGE_TO_DRAFT_STATE` at line 145 and consumes it at lines 826, 1007, 1070 to compute `draftStateToSend` for save calls. The pure decision function `decideTransition` becomes orphaned with observer removal. Recommendation: keep `UI_STAGE_TO_DRAFT_STATE` (still consumed by save handlers); delete `decideTransition` and the `TransitionDecision` type. ~30 LOC net trim within the file.

**Removed from App.tsx:**
- [`App.tsx:79`](../../App.tsx:79) — `import { useDraftStateObserver } from './hooks/useDraftStateObserver';`
- [`App.tsx:1392-1411`](../../App.tsx:1392) — the entire `useDraftStateObserver({...})` call + its comment block

**`draftRecord` shape simplification:**
- [`App.tsx:490-498`](../../App.tsx:490) — current shape `{ draftId, seedDraftState, revision }`. Without the observer, `seedDraftState`'s observer-seeding consumer goes away. **But** the save handlers at lines 826-829, 1007-1012, 1070-1075 use `draftRecord.seedDraftState` for monotonicity logic when computing `draftStateToSend`. That logic survives PR-48.A. So `seedDraftState` stays; only the observer's `currentRevision` prop wiring goes away. Recommendation: defer `draftRecord` shape change to PR-48.B when the new API and reconciliation are wired.

**Test/doctrine references:**
- No tests exist in the repo (per package.json — no test runner)
- `docs/contracts/active-paused-state-machine.md` references the observer indirectly; will be archived (§1.12)
- `docs/doctrine/local-persistence-contract.md:140` references `/api/drafts/transition` — needs update when transition.js fate is locked (§1.7)

### 1.12 Doctrine doc moves and additions

**Moved (with header note):**
- [`docs/contracts/active-paused-state-machine.md`](../../docs/contracts/active-paused-state-machine.md) → `docs/archived/2026-05-12-active-paused-state-machine.md`
- The new file location requires the `docs/archived/` directory to be created (does not currently exist — confirmed via `ls docs/`).
- Prepend a header note: "**Status: ARCHIVED 13 May 2026.** Superseded by the single-draft pivot ([docs/proposals/single-draft-pivot.md](../proposals/single-draft-pivot.md) v1.2). This document represents the multi-draft (ACTIVE/PAUSED) architecture that was attempted and reverted. Preserved for institutional learning per v1.2 §10.4. **Do not reintroduce these patterns** without explicit user evidence per single-draft-product-fit doctrine."
- **types/draft.ts:64 reference** — `// See docs/contracts/active-paused-state-machine.md §6.` — update to point to the new archived path, OR remove the reference since the doc is no longer authoritative. Recommendation: rewrite the comment to reference the new sync-confidence doctrine (§1.13 below).

**Created:**
- `docs/doctrine/sync-confidence.md` — new doctrine doc per v1.2 §14.2. Covers:
  - Revision comparison model (not naked booleans)
  - `lastKnownCloudRevision` + `hasLocalChanges` schema
  - Semantic-divergence definition (with debounced evaluation per L2)
  - `selectiveHydrate` projection rule for `lastSyncedSnapshot`
  - Meaningful-content predicate (§3)
  - Emotional trust contract (never silently destroy)
  - Atomicity rule for destructive operations (DELETE before clear)
  - CAS on POST and DELETE
  - §4.6 synchronization-boundaries doctrine
  - §4.5 active-key resolution doctrine (UID-namespaced keys; no auto-merge of anonymous)
  - The chosen P1/P2/P3 anonymous-namespace policy with rationale

**Doctrine cross-references to update:**
- [`docs/doctrine/local-persistence-contract.md:85-136`](../../docs/doctrine/local-persistence-contract.md:85) — the §6.5 PR-48 amendment references multi-draft constructs (PersistenceStatus enum, ACTIVE/PAUSED/ABANDONED, Count(ACTIVE)+Count(PAUSED)≤3). This whole section needs rewriting under the single-draft model. Decision required: rewrite in-place OR move §6.5 to archived alongside the active-paused-state-machine doc and add a NEW §6.5 amendment that points to `sync-confidence.md`.

  Recommendation: in-place rewrite. The §6.5 section's intent ("cloud is the authoritative cross-device draft store; local autosave doesn't independently create cloud drafts") is preserved by single-draft. Only the multi-draft state machine references need pruning. A clean rewrite that retains the §6.5 numbering preserves doctrine continuity.
- [`docs/doctrine/local-persistence-contract.md:140`](../../docs/doctrine/local-persistence-contract.md:140) — references the soon-deleted `/api/drafts/transition`. Update or remove.

---

## 2. Migration ordering within PR-48.A

Dependency graph between scope items, ordered to minimize intermediate broken states. Each "Phase" can land as one or more commits; phases must not interleave.

### Phase A — Purely subtractive (zero new dependencies)

1. **Remove `handleSignInSaveLocalDraftAsNew`** + button + modal prop (§1.9). Self-contained.
2. **Remove `useDraftStateObserver` + draftStateLogic's `decideTransition`** (§1.11). Self-contained except for the App.tsx hook call.
3. **Remove `MAX_DRAFTS`** cap (§1.10). Touches save.js + draftValidation.js + utils/saveDraft.ts + App.tsx's switch case.

Phase A leaves the codebase in a **functional state with reduced surface**. Save still works, reconciliation modals still render (just with 2 buttons in the sign-in case), no observer fires `/transition`. All endpoints still exist (`transition.js`, `pause.js`, `resume.js`, `discard.js`) and their handlers in App.tsx still call them through `pauseDraft`/`discardDraft` (Begin Again flow).

### Phase B — Endpoint + lifecycle helper deletion

4. **Delete `utils/lifecycleDraft.ts`** (§1.8) AFTER simplifying or removing the App.tsx handlers that call it. The Begin Again handlers (`handleBeginNewSaveAndStartNew`, `handleBeginNewDiscardAndStartNew`) need to be either:
   - **(b1)** Simplified to local-only (just clear local, no cloud call) — temporary state, PR-48.B will wire `DELETE /api/draft`
   - **(b2)** Removed entirely + Begin Again becomes a no-op or local-only — but BeginNewPromptModal users would still see the buttons
   - Recommendation: (b1). Documents the transitional state honestly; PR-48.B replaces with `DELETE /api/draft`.
5. **Delete `api/drafts/pause.js`, `resume.js`, `discard.js`** (§1.7). After step 4, no client code calls these.

Phase B ordering matters: deleting the endpoints before removing the App.tsx callers would 404 the live Begin Again flow.

### Phase C — Sync-confidence schema (additive)

6. **Add `utils/meaningfulContent.ts`** (§1.6). Self-contained new file. No consumers yet.
7. **Add UID-namespacing infrastructure** (§1.4):
   - Add `activeKey(uid)` resolver
   - Add `uid` parameter (or auth-reading internal) to every persistence helper
   - Update all call sites in App.tsx + PreparationForm.tsx
   - **At this point**, all reads/writes route through namespaced keys, but legacy `vday_data_draft` (no namespace) entries are unreachable.
8. **Add migration effect in App.tsx** (§1.5). First run: legacy entries get moved to the appropriate namespace.
9. **Extend `StoredDraft` schema** with `lastKnownCloudRevision` + `hasLocalChanges` (§1.1). Bump `CURRENT_SCHEMA_VERSION` to 3. Update `SUPPORTED_SCHEMA_VERSIONS` to include 3. Update all readDraft/writeDraft paths.
10. **Add `lastSyncedSnapshot` ref + debounced semantic-divergence machinery** in `usePreparationPersistence.ts` (§1.2, §1.3). Expose imperative API for hydration seeding and flush-and-read.
11. **Wire App.tsx hydration paths to co-commit `lastSyncedSnapshot`** at the three hydration boundaries.
12. **Replace the `hasMeaningfulContent` predicate** at App.tsx:1320 with the new `meaningfulContent()` import.

### Phase D — Doctrine

13. **Create `docs/archived/`** directory.
14. **Move `docs/contracts/active-paused-state-machine.md`** with header note.
15. **Rewrite `docs/doctrine/local-persistence-contract.md` §6.5** in-place.
16. **Add `docs/doctrine/sync-confidence.md`**.

### Intermediate states audit

After Phase A: functional, reduced surface, no `Save Local Draft as New`, no observer, no cap.
After Phase B: functional, no pause/resume/discard endpoints, Begin Again is local-only.
After Phase C7: functional, namespaced storage, but no migration → legacy users see "empty form" on first load post-deploy. **Phase C7 alone is a broken intermediate.** Combine Phase C7 + Phase C8 into a single commit (or land them in the same PR with C8 unconditionally following C7) to avoid this window.
After Phase C9: schema bumped; old StoredDraft entries get re-parsed and surface defaults for new fields. Working state.
After Phase C12: full sync-confidence machinery live; reconciliation gate uses new predicate.
After Phase D: doctrine matches code.

### Recommended commit structure

- **Commit 1:** Phase A (subtractive). Single commit or three separate, no order dependency.
- **Commit 2:** Phase B step 4 (App.tsx handler simplification).
- **Commit 3:** Phase B step 5 (endpoint file deletes).
- **Commit 4:** Phase C steps 6 + 7 + 8 (must land together to avoid broken intermediate).
- **Commit 5:** Phase C steps 9 + 10 + 11 + 12 (schema + ref + wiring + predicate swap; can land as one or two commits at implementer discretion).
- **Commit 6:** Phase D (doctrine).

Total: 5–6 commits per PR.

---

## 3. UID namespacing implementation trace

### 3.1 Call sites that currently read or write `vday_data_draft`

**Direct localStorage operations (single source: [hooks/usePreparationPersistence.ts](../../hooks/usePreparationPersistence.ts)):**

| Line | Function | Operation |
|---|---|---|
| `:210` | `readDraft` | `localStorage.getItem(STORAGE_KEY)` |
| `:261` | `writeDraft` | `localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))` |
| `:317` | `writeStage` | `localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))` |
| `:354` | `writeDraftId` | `localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))` |
| `:363` | `clearPreparationDraft` | `localStorage.removeItem(STORAGE_KEY)` |
| `:408` | `getDraftMetadata` | `localStorage.getItem(STORAGE_KEY)` |
| `:475` | `writeDraftFromExternal` | `localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))` |

`STORAGE_KEY = 'vday_data_draft'` is defined once at `:4`. PR-47.1 explicitly chose this collapsed-bucket architecture; the doctrine at [`docs/doctrine/local-persistence-contract.md:11-17`](../../docs/doctrine/local-persistence-contract.md:11) names this as the sole local persistence authority. UID-namespacing extends the same authority across multiple users on the same browser; it does not violate the "single authority" rule (per-uid there is still exactly one bucket).

### 3.2 Active-key resolution

**Required: every operation needs the current uid.**

The hook (`usePreparationPersistence`) is the easy case: call `useAuth()` at the top, capture `user?.uid`, pass it to the inner `writeDraft` calls. The debounce effect's dep list adds `uid`.

The module-level functions (`peekDraft`, `writeStage`, `writeDraftId`, `clearPreparationDraft`, `getDraftMetadata`, `writeDraftFromExternal`) are called from React components OUTSIDE the hook — including from App.tsx's synchronous mount-time initializers (line 367 `peekDraft()`) where there is no hook context. These cannot call `useAuth()`.

**Three resolution options:**

- **(a) Pass `uid` as a parameter to every helper.** Most explicit. Forces every call site to know its auth context. App.tsx's `peekDraft()` at line 367 becomes `peekDraft(auth.currentUser?.uid ?? null)`. Heaviest call-site churn (~20 locations).
- **(b) Resolver function that reads `auth.currentUser` directly inside each helper.** Firebase SDK exposes `auth.currentUser?.uid` synchronously. Reliable AFTER Firebase has rehydrated (which on cold mount is uncertain — Firebase Auth's restoration is asynchronous, even though the getter is synchronous). Risk: cold-mount reads under uncertain auth state.
- **(c) Module-level UID cache, updated by an App.tsx-mounted effect that subscribes to `onAuthStateChanged`.** All helpers read from the cache. Cache starts null (treats as anonymous). Once auth resolves, cache populates. Subsequent reads/writes namespace correctly. Cold-mount reads go to anonymous namespace; that's the honest answer when we don't know who the user is.

**Recommendation: (c) with a small refinement.** Option (c) handles the auth-rehydration window honestly (anonymous fallback). PR-48.A adds a tiny module:

```
hooks/usePreparationPersistence.ts:
  let _activeUid: string | null = null;
  export function setActiveUid(uid: string | null): void { _activeUid = uid; }
  function activeKey(): string { return _activeUid ? `vday_data_draft:${_activeUid}` : 'vday_data_draft:anonymous'; }
```

App.tsx adds an effect:
```
useEffect(() => {
  setActiveUid(authUser?.uid ?? null);
}, [authUser?.uid]);
```

This pattern violates strict "no module-level mutable state" rules but is appropriate here because:
- The uid is functionally a singleton per browser session
- React context would require provider plumbing through every consumer
- Strict mode double-invocation is benign (idempotent setter)

**Founder lock might be required here** if there's a preference against module-level mutable state.

### 3.3 React lifecycle — mid-session auth change

**Scenario:** user opens app signed-out, types into PreparationForm, then signs in mid-session.

Sequence with option (c):
1. Anonymous: `_activeUid = null`. Autosave writes go to `vday_data_draft:anonymous`. Working content lives there.
2. User clicks Sign In. Firebase popup resolves. `useAuth` flips `user` to populated, then `serverSessionReady` to true.
3. App.tsx's effect fires: `setActiveUid(authUser.uid)`. Now `_activeUid = 'abc123'`.
4. App.tsx's hydration effect fires (the same one at App.tsx:1211). It does `GET /api/drafts/list` (currently; replaced by `GET /api/draft` in PR-48.B). The current code at App.tsx:1319-1346 reads `getDraftMetadata()` — which now namespaces to `vday_data_draft:abc123` (empty for first sign-in) instead of `vday_data_draft:anonymous` (where the work actually lives).
5. **PROBLEM:** the reconciliation gate sees "local empty + cloud whatever" → Case A silent. The user's anonymous-namespace work is now invisible to the reconciliation gate. Per v1.2 §4.5 P1: anonymous content stays in its namespace untouched. ✓ doctrinally correct.
6. PreparationForm's `usePreparationPersistence` hook is mounted. Its debounce effect was running against `data` (the form state, which still has the user's typed content). On next debounce, it writes to the new active key (`vday_data_draft:abc123`). The user's typed content now exists in BOTH namespaces.
7. The dep-list change on `uid` re-fires the effect immediately on sign-in. Cancels existing debounce, schedules new one targeting new namespace.

**Edge:** if PreparationForm's `usePreparationState` `data` is still in memory at sign-in time (no remount), the content persists into the user namespace via autosave. That's the **silent merge** behavior — anonymous content effectively follows the user into their namespace via memory rather than via storage merge. **This may violate a strict reading of the P1 "preserve only" doctrine** which suggests the anonymous content stays put.

**Implementation question for founder/implementer:** does the user's typed-but-not-yet-saved content at sign-in time:
- (i) Continue to be the editor's working copy and get autosaved to the user namespace on next debounce (silent transfer via memory)
- (ii) Get wiped on sign-in, with the user namespace's empty/cloud-hydrated content replacing it (visible loss of typed work)
- (iii) Trigger the Case B reconciliation modal (if cloud is also meaningful) so the user explicitly chooses

Per v1.2 §4.5 strict P1: anonymous storage stays untouched. But in-memory content's fate isn't specified. The Case B reconciliation gate compares storage-side meaningful content; in-memory content that hasn't debounce-flushed yet isn't visible to it.

**Recommendation: implementer locks (i)** — the user's in-progress typing is preserved as the working copy of the user namespace. The anonymous-namespace persisted entry from before sign-in stays put (P1). If the user signs out again, the anonymous-namespace entry is what they see; their post-sign-in work lives in their user namespace.

### 3.4 Sign-out transition

**Scenario:** signed-in user clicks Sign Out.

Sequence with option (c):
1. Signed-in: `_activeUid = 'abc123'`. Autosave writes go to `vday_data_draft:abc123`. Working content lives there.
2. User clicks Sign Out. `useAuth.signOut()` flips `user` to null, `serverSessionReady` to false.
3. App.tsx's effect fires: `setActiveUid(null)`. Now `_activeUid = null`.
4. App.tsx:1229-1238 sign-out branch fires: `setDraftRecord(null)`, `setLastSaveSuccessAt(null)`, `writeDraftId(null)` (which now namespaces to anonymous → no-op since no draft exists there yet), `setHydrationResolutionState('idle')`. **Note:** this call to `writeDraftId(null)` currently clears the legacy non-namespaced key (App.tsx:1233). After PR-48.A, it would no-op against the anonymous namespace. The intent (clear stale identity) is preserved because the user namespace's hint is no longer being read by the now-anonymous app.
5. User keeps editing. PreparationForm's `usePreparationState` `data` is still in memory. Next debounce writes to `vday_data_draft:anonymous`. User's post-sign-out edits live in anonymous namespace.
6. The signed-in user's content remains in `vday_data_draft:abc123`, untouched, recoverable on next sign-in.

**This is correct per v1.2 §4.5 sign-out transition rules.** No additional implementation work needed beyond the namespacing infrastructure.

### 3.5 Migration trigger and logic

Already covered in §1.5. Summary:

- Trigger: App.tsx effect, gated on `!authLoading` (and ideally `serverSessionReady` to know the user namespace correctly)
- One-time guard: `localStorage['vday_data_draft:_migrated_v1_2']` marker
- Logic:
  1. Read legacy `vday_data_draft` (no namespace)
  2. If absent → set marker, return
  3. If present:
     - Parse via existing `selectiveHydrate`
     - Compute `meaningfulContent(projected)`
     - Determine target: `vday_data_draft:${uid}` if signed-in, else `vday_data_draft:anonymous`
     - Write `{ ...storedFields, lastKnownCloudRevision: null, hasLocalChanges: meaningfulContent ? true : false }`
     - Remove legacy key
     - Set marker

**Founder decision required** if the alternative path (schema-bump-and-discard per v1.2 §11.8) is preferred. Recommendation: soft migration above.

---

## 4. Debounced semantic divergence implementation

### 4.1 Current autosave debounce location

[`hooks/usePreparationPersistence.ts:286-297`](../../hooks/usePreparationPersistence.ts:286):

```ts
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (!enabled) return;
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    writeDraft(data, step);
  }, debounceMs);
  return () => { if (timerRef.current) clearTimeout(timerRef.current); };
}, [data, step, debounceMs, enabled]);
```

`DEFAULT_DEBOUNCE_MS = 1000` at line 14. The `enabled` option exists at line 284 — `enabled=false` short-circuits the effect entirely (per v1.2 §5.2 Issue #1: pause-on-modal-open uses this).

### 4.2 Where `lastSyncedSnapshotRef` lives

**Inside the hook.** Rationale already covered in §1.2. Concretely:

```ts
const lastSyncedSnapshotRef = useRef<Partial<CoupleData> | null>(null);
const dirtyBitRef = useRef<boolean>(false);
const settledHasLocalChangesRef = useRef<boolean>(false);
```

App.tsx writes to `lastSyncedSnapshotRef` via an imperative API (hook return value) at hydration boundaries. The hook's debounce reads from it.

### 4.3 Optimistic dirtyBit vs settled `hasLocalChanges` — API surface

Per v1.2 §4.4, the relationship is:

- `dirtyBitRef` — optimistic. Flips to `true` on any field mutation since last sync. Cheap (no comparison).
- `settledHasLocalChangesRef` — reconciliation-grade. Updated on every debounce fire based on deep-equal of `projected(data)` against `lastSyncedSnapshotRef.current`.

**Critical rule (v1.2 §4.4):** reconciliation NEVER reads `dirtyBitRef`. Sign-in flow must flush the debounce first or wait for it.

**Hook API recommendation:**

```ts
interface UsePreparationPersistenceApi {
  seedSnapshot(projectedData: Partial<CoupleData>): void;
  flushAndReadDirty(): boolean;  // synchronously runs the divergence check, updates persistence, returns settled hasLocalChanges
  readSettledDirty(): boolean;   // just returns the cached settled value
}
export function usePreparationPersistence(
  data: CoupleData,
  step: StepValue,
  options: { debounceMs?: number; enabled?: boolean; uid?: string | null } = {}
): UsePreparationPersistenceApi
```

App.tsx's hydration paths call `seedSnapshot(projected(cloud.data))` at the three boundaries. App.tsx's sign-in reconciliation gate (the hydration effect) calls `flushAndReadDirty()` before evaluating `localMeaningful` so the dirty flag reflects settled state.

**Alternative:** rather than expose this API surface, App.tsx could maintain its own `lastSyncedSnapshot` (e.g., as a `useRef`) and pass it into the hook as a prop. The hook computes divergence against the prop value. Simpler API; couples App.tsx to the divergence logic. Tradeoff: implementer's call.

### 4.4 Places that might accidentally read transient optimistic state

**Reconciliation gate:** App.tsx:1319-1321 currently reads `getDraftMetadata().hasMeaningfulContent`. After PR-48.A, this becomes `meaningfulContent(projected(getLocalData()))`. Neither read goes through `hasLocalChanges`. **No risk from this surface.**

**The risk surface is anywhere App.tsx reads `hasLocalChanges` to decide reconciliation behavior.** Per current code, App.tsx doesn't read this field anywhere — it's a new field introduced by PR-48.A. The implementer must ensure that:
- The sign-in hydration effect (App.tsx:1211-1390) calls `flushAndReadDirty()` BEFORE evaluating Case B branch
- The Begin Again handler (App.tsx:777-803) calls `flushAndReadDirty()` BEFORE evaluating `localHasMeaningfulContent` (though Begin Again uses meaningful-content not dirty-flag; less load-bearing)
- The future `POST /api/draft` save flow (PR-48.B) reads `hasLocalChanges` only after flush

**Spec ambiguity surfaced:** v1.2 §4.4 says "reconciliation never reads transient optimistic state" but doesn't enumerate every reconciliation entry point. The doctrine binds; the implementer must apply it. Recommendation: add a code comment at every `flushAndReadDirty()` call site referencing v1.2 §4.4 so future maintenance preserves the contract.

---

## 5. `selectiveHydrate` projection integration

### 5.1 Current `selectiveHydrate` location

[`hooks/usePreparationPersistence.ts:85-197`](../../hooks/usePreparationPersistence.ts:85). Filters a `Partial<CoupleData>` through three allowlists:
- `TEXT_SAFE_FIELDS` (lines 36-63) — 24 fields including recipient/sender/finalLetter/myth/etc.
- `STRUCTURED_TEXT_FIELDS` (lines 66-69) — coupons, sessionId
- `MEDIA_FIELDS_RESTORED` (lines 76-83) — memoryBoard, userImageUrl, audio, video, aiImageUrl, sacredLocation

Each media field has a defensive validator branch inside `selectiveHydrate`. Fields NOT in any allowlist are silently dropped — these are the server-set fields (`status`, `sealedAt`, `createdAt`, `updatedAt`, `previewExpiresAt`, `replyEnabled`) and PII (`receiverPhoneNumber`) and security (`passcode*`).

### 5.2 Where `lastSyncedSnapshot` baseline is established

The three hydration paths in App.tsx that write `data`:

- [`App.tsx:944-961`](../../App.tsx:944) `applyCloudActiveToState` — sets `data = hydrateCoupleData(cloud.data)`. Used by Case A silent and (currently) by "Continue Dashboard Draft" and "Discard Local Draft" Case B handlers (the latter two are being collapsed in PR-48.B). After PR-48.A's wiring: must also call `seedSnapshot(selectiveHydrate(cloud.data))`.
- [`App.tsx:723-735`](../../App.tsx:723) `handleStaleRevisionReloadLatest` cloud reload — same.
- [`App.tsx:1358-1374`](../../App.tsx:1358) silent Case A in hydration effect — same.

**Important:** `hydrateCoupleData` (App.tsx:157, definition is a local helper) operates on the cloud data for in-memory consumption. It's not the same as `selectiveHydrate`. The seeded snapshot must be `selectiveHydrate(cloud.data)`, not `hydrateCoupleData(cloud.data)`, because:
- `selectiveHydrate` is the projection that the local persistence layer roundtrips through
- The dirty-flag semantic-divergence check compares two projections in the same space (per v1.2 §4.4 projection rule)
- Using `hydrateCoupleData` instead would still leave the projection mismatch that Issue #4 documented

**Implementer must surface `selectiveHydrate`** from `usePreparationPersistence.ts` as an exported function (it's currently a private helper at line 85). One-line API exposure.

### 5.3 `meaningfulContent` operates on projected view

Per v1.2 §3: "Same predicate evaluated identically on local autosave's `data` (in projected space — see §4.4) and on cloud snapshot's `data` (in projected space)."

The new `utils/meaningfulContent.ts` (§1.6) should either:
- Accept already-projected data and trust the caller, OR
- Apply `selectiveHydrate` internally

Recommendation: **apply internally.** Eliminates a class of caller bugs where someone passes raw cloud data and the predicate is evaluated on fields that wouldn't roundtrip. The performance cost is negligible (predicate is called at reconciliation time, not on every keystroke).

Concretely:
```ts
import { selectiveHydrate } from '../hooks/usePreparationPersistence';

export function meaningfulContent(data: Partial<CoupleData> | null | undefined): boolean {
  if (!data) return false;
  const p = selectiveHydrate(data);
  // ... v1.2 §3 predicate ...
}
```

This creates a one-way import: `utils/meaningfulContent.ts` depends on `hooks/usePreparationPersistence.ts`. Acceptable; no cycle.

---

## 6. `useDraftStateObserver` removal trace

### 6.1 Every import + call site

- [`App.tsx:79`](../../App.tsx:79) — import statement (the only consumer)
- [`App.tsx:1392-1411`](../../App.tsx:1392) — the `useDraftStateObserver({...})` call

### 6.2 `draftRecord.revision` reads — observer vs. direct

Today, `draftRecord.revision` is populated from two sources:
- **From `GET /api/drafts/list`** at [App.tsx:1361](../../App.tsx:1361) — the hydration effect's `setDraftRecord({ revision: oldest.revision ?? null })`
- **From `POST /api/drafts/save` success response** at [App.tsx:1127](../../App.tsx:1127) — `setDraftRecord({ revision: result.revision })`
- **NOT from the observer.** The observer maintains its own internal `lastPersistedRevisionRef` and uses it for CAS on subsequent `/transition` calls. It updates the ref from `/transition` responses but does NOT write back to App.tsx's `draftRecord.revision`.

This means: removing the observer does NOT affect any `draftRecord.revision` read in App.tsx. The revision value continues to be populated by hydration and save responses, exactly as today. **No retrofit needed at the read sites.**

### 6.3 Tests, types, doctrine references

- **Tests:** none exist (no test runner in the repo).
- **Types:** `useDraftStateObserver`'s types (`UseDraftStateObserverArgs`, `TransitionDecision`) are defined in the observer file and `draftStateLogic.ts`. No external consumers. Safe to delete with the files.
- **Doctrine:**
  - `docs/contracts/active-paused-state-machine.md` references the observer indirectly (the contract was designed around the observer's milestone-write pattern). This doc moves to archived.
  - `docs/doctrine/local-persistence-contract.md:140` mentions `/api/drafts/transition`. The endpoint is not deleted in PR-48.A (left for §11.1 evaluation in PR-48.B). The doctrine reference can stand temporarily, but should be updated when transition.js's fate is locked.
- **PR-48 Phase 3 implementation references:** `hooks/useDraftStateObserver.ts` itself contains extensive comments about Phase 3 revision-CAS behavior, race protection, seeding semantics. These are historical and disappear with the file deletion. No external file documents this content.
- **Related cleanup:** `draftStateLogic.ts`'s `decideTransition` and `TransitionDecision` type become orphaned. `UI_STAGE_TO_DRAFT_STATE` (the same file) is still consumed by App.tsx save handlers. Keep `UI_STAGE_TO_DRAFT_STATE`; delete `decideTransition` and `TransitionDecision`.

---

## 7. Endpoint deletions trace

### 7.1 Client-side imports of each endpoint

**`/api/drafts/pause` callers:**
- [`utils/lifecycleDraft.ts:125`](../../utils/lifecycleDraft.ts:125) — `pauseDraft` wrapper
- Consumers of `pauseDraft`:
  - [`App.tsx:861-864`](../../App.tsx:861) — inside `handleBeginNewSaveAndStartNew`
  - [`App.tsx:985-988`](../../App.tsx:985) — inside `handleSignInSaveLocalDraftAsNew` (the Save Local handler being removed per §1.9)

**`/api/drafts/resume` callers:**
- [`utils/lifecycleDraft.ts`](../../utils/lifecycleDraft.ts) — NOT wrapped. Resume was deferred to Phase 5 per the file header.
- **Zero client consumers.** The endpoint is dead code already. Deleting it is purely server-side.

**`/api/drafts/discard` callers:**
- [`utils/lifecycleDraft.ts:129`](../../utils/lifecycleDraft.ts:129) — `discardDraft` wrapper
- Consumers of `discardDraft`:
  - [`App.tsx:899-902`](../../App.tsx:899) — inside `handleBeginNewDiscardAndStartNew`

**`/api/drafts/transition` callers:**
- [`hooks/useDraftStateObserver.ts:117`](../../hooks/useDraftStateObserver.ts:117) — the ONLY caller. Once the observer is removed (§1.11), the endpoint has zero callers.
- Decision deferred per v1.2 §11.1.

### 7.2 Shared types

`PersistenceStatus` (from `types/draft.ts:24`) is shared between the endpoints' return shape and:
- [`utils/lifecycleDraft.ts:11,17,58,78,85`](../../utils/lifecycleDraft.ts:11) — uses the type for `LifecycleResult.persistenceStatus`
- [`App.tsx:699,1275`](../../App.tsx:699) — uses the type for `/api/drafts/list` response parsing
- [`api/lib/draftValidation.js:77,144`](../../api/lib/draftValidation.js:77) — server-side enum validation
- [`api/verify-payment.js:60`](../../api/verify-payment.js:60) — server-side query for ACTIVE draft (the `markActiveDraftCompleted` function)

**`PersistenceStatus` does not get deleted in PR-48.A.** The concept of ACTIVE survives single-draft architecture (the user has one ACTIVE draft, or they don't). The PAUSED concept disappears but the enum value can remain in the type until PR-48.B explicitly narrows it.

**Narrowing path for PR-48.B:** `PersistenceStatus` collapses to `'ACTIVE' | 'ABANDONED'` (or perhaps just `'ACTIVE'` with deletion being a record-removal rather than a status). Defer this narrowing to PR-48.B where the API surface change is the natural carrier.

### 7.3 Non-PR-48 flow dependencies

**Admin tools, debugging hooks, other consumers:** none surfaced. Grep across `api/`, `components/`, `utils/`, `hooks/` confirms no other call sites.

**`api/verify-payment.js:60`** queries `users/{uid}/drafts` filtered to `persistenceStatus === 'ACTIVE'` to find the draft to mark COMPLETED on payment success. This consumer survives single-draft architecture (it still finds the ACTIVE draft, of which there is now exactly one). The query is at the data layer, not the endpoint layer — it doesn't depend on `/api/drafts/{pause,resume,discard}`. Safe to leave untouched in PR-48.A.

---

## 8. `MAX_DRAFTS` removal trace

### 8.1 Location and consumers

- **Defined:** [`api/lib/draftValidation.js:39`](../../api/lib/draftValidation.js:39) — `export const MAX_DRAFTS = 3;`
- **Imported by:** [`api/drafts/save.js:58`](../../api/drafts/save.js:58) (only consumer)
- **Used at:** [`api/drafts/save.js:235`](../../api/drafts/save.js:235) (`nonAbandonedCount >= MAX_DRAFTS` check) and `:241` (`limit: MAX_DRAFTS` in error body)
- **Client-side surface for the error:** [`utils/saveDraft.ts:120-126`](../../utils/saveDraft.ts:120) handles 409 `CAP_EXCEEDED`; [`App.tsx:1165-1170`](../../App.tsx:1165) the `case 'cap_exceeded':` switch branch.

### 8.2 Removal impact

- **Tests:** none.
- **Other validation paths:** none. `validateDraftWrite` (the main validator) does not reference `MAX_DRAFTS`. The cap is enforced exclusively inside `/api/drafts/save.js`'s CREATE-path transaction.
- **Comment cleanup:** lines 35-38 (doctrine block) and `:47` (`Cap rule:` comment) reference MAX_DRAFTS. Both should be removed.
- **The `nonAbandonedCount` computation** at `:232-234` becomes unreferenced. Remove the line.

After removal, the CREATE-path transaction still enforces single-ACTIVE at `:246-260`. That's the only remaining concurrent-create guard, and it's the correct one for single-draft.

---

## 9. "Save Local Draft as New" removal trace

### 9.1 App.tsx surface

- [`App.tsx:925-940`](../../App.tsx:925) — comment block describing the three Phase 4 sign-in handlers. Remove the references to "Save Local Draft as New."
- [`App.tsx:977-1059`](../../App.tsx:977) — `handleSignInSaveLocalDraftAsNew` function body (~80 LOC). Remove.
- [`App.tsx:942`](../../App.tsx:942) — `caseBInFlightRef` declaration (only consumer is the removed handler). Remove.
- [`App.tsx:2336`](../../App.tsx:2336) — `onSaveLocalDraftAsNew={handleSignInSaveLocalDraftAsNew}` JSX prop wire. Remove.

### 9.2 SignInReconciliationModal surface

- [`components/SignInReconciliationModal.tsx:44`](../../components/SignInReconciliationModal.tsx:44) — `onSaveLocalDraftAsNew: () => void;` prop. Remove from interface.
- [`components/SignInReconciliationModal.tsx:62`](../../components/SignInReconciliationModal.tsx:62) — destructured prop. Remove.
- [`components/SignInReconciliationModal.tsx:153-159`](../../components/SignInReconciliationModal.tsx:153) — the button JSX. Remove.
- [`components/SignInReconciliationModal.tsx:3-22`](../../components/SignInReconciliationModal.tsx:3) — header comment describing the 3-button spec. Update to describe the 2-button spec, or defer the deep rewrite to PR-48.B when the modal's surviving 2 buttons get reshaped per v1.2 §5.2.

### 9.3 State machine references

`ReconciliationState` union at [`App.tsx:107-125`](../../App.tsx:107) has the `kind: 'sign_in_case_b'` variant. The variant survives; only the handler triggered by one of its buttons goes away. No type changes required in PR-48.A.

`HydrationResolutionState` at [`App.tsx:138-142`](../../App.tsx:138) — unchanged. The `needs_reconciliation` state is still set when Case B fires; the modal still renders; the user resolves via one of the remaining buttons.

**No orphaned state machine references after the removal.** The "Save Local Draft as New" handler was a leaf — nothing else in App.tsx assumes its existence as a state transition.

---

## 10. Out-of-scope spillover risks

### 10.1 PersistenceStatus enum lifetime

Already covered in §7.2. The full enum (`ACTIVE` | `PAUSED` | `ABANDONED`) survives PR-48.A. The `PAUSED` and `ABANDONED` values become un-write-able from the client (no endpoints write them after PR-48.A's deletions), but the type still admits them so historical drafts in the DB don't deserialize-fail. Narrowing happens in PR-48.B.

### 10.2 ReconciliationState union narrowing

[`App.tsx:107-125`](../../App.tsx:107) — the union has four variants today (`none`, `stale_revision`, `begin_new`, `sign_in_case_b`). After PR-48.A:
- `none` — survives
- `stale_revision` — survives (PR-48.B will reshape the modal copy but the state variant stays)
- `begin_new` — survives but its handlers get simplified (no cloud calls in PR-48.A; PR-48.B adds `DELETE /api/draft`)
- `sign_in_case_b` — survives with two buttons instead of three

**No narrowing required in PR-48.A.** The union is the right shape for the interim state.

### 10.3 DraftRecord shape

[`App.tsx:490-498`](../../App.tsx:490) `{ draftId, seedDraftState, revision }`. Without the observer:
- `seedDraftState` was consumed by the observer's seeding (deleted) AND by save handlers' monotonicity logic (App.tsx:826-829, 1007-1012, 1070-1075). The save-handler consumption survives.
- `revision` is consumed by save handlers' CAS payload construction. Survives.
- `draftId` consumed everywhere. Survives.

**No shape change in PR-48.A.** PR-48.B may simplify when the new API surface (`POST /api/draft` returning a different response shape) lands.

### 10.4 BeginNewPromptModal lifecycle

[`components/BeginNewPromptModal.tsx`](../../components/BeginNewPromptModal.tsx) — 110 LOC. Two of its three buttons (`Save & Start New`, `Discard & Start New`) call handlers that depend on `pauseDraft`/`discardDraft`. PR-48.A removes those helpers (§1.8). PR-48.A must therefore EITHER:
- Simplify the modal handlers to local-only (per Phase B step 4 recommendation), OR
- Delete the modal entirely + replace Begin Again with an immediate local clear (no modal)

Recommendation: simplify handlers, keep modal. PR-48.B replaces the modal with `BeginAgainConfirmationModal` per v1.2 §8.1/§8.2. Don't double-churn the file.

### 10.5 `lastSaveSuccessAt` / `lastSaveError` surface

These two pieces of state at [`App.tsx:634-635`](../../App.tsx:634) drive the save-affordance UI in RefineStage and MainExperience ([`App.tsx:2090-2092`, `2180-2182`](../../App.tsx:2090)). They survive PR-48.A — the save flow still uses them.

**Note:** `lastSaveSuccessAt` currently gets seeded from the cloud `updatedAt` at hydration (App.tsx:1372). This pre-Phase-4 behavior is correct under single-draft and survives.

### 10.6 `pendingActionRef` + `commitPendingAction` gating

[`App.tsx:455-584`](../../App.tsx:455) — the sign-in prompt + hydration-gated commit mechanism. Survives PR-48.A unchanged. `commitPendingAction`'s wait-for-resolution logic still applies (Case B modal still fires; pending actions still defer).

### 10.7 `draftStateLogic.ts` `UI_STAGE_TO_DRAFT_STATE` map

[`hooks/draftStateLogic.ts:22-29`](../../hooks/draftStateLogic.ts:22). Consumed by App.tsx save handlers (lines 826, 1007, 1070). Survives PR-48.A. Only `decideTransition` (the observer's consumer) is deleted.

### 10.8 Dashboard / MyLettersModal

[`components/MyLettersModal.tsx`](../../components/MyLettersModal.tsx) renders SENT letters, not drafts. Currently has no "Drafts" tab. PR-48.C will add one. PR-48.A does not touch this file. **No spillover risk.**

---

## 11. Test impact

### 11.1 Existing test infrastructure

**None.** Confirmed via `package.json` — scripts are `dev`, `build` (= `tsc && vite build`), `preview`. Only static check is TypeScript compilation. No vitest, no jest, no test runner.

### 11.2 What this means for PR-48.A

The migration's correctness (§1.5) is the highest-risk area without tests. A bug in the migration could silently lose user content (anonymous local entries failing to namespace correctly, etc.). Without a test runner, the safety mechanisms are:
- **Manual smoke testing** before merge
- **Defensive read in `selectiveHydrate`** — invalid entries fail gracefully
- **The one-time migration marker** — prevents re-running on a bad state

### 11.3 Recommended pre-merge smoke tests

(Not code; manual checklist for the implementer to run before merging PR-48.A.)

1. **Anonymous user, no prior content:** load app, type "Hello", refresh → content survives. Sign in → reconciliation gate evaluates correctly.
2. **Anonymous user, with prior legacy `vday_data_draft`:** populate the legacy key manually in DevTools, load app, verify migration moves it to `vday_data_draft:anonymous`, marker is set, legacy key is removed.
3. **Signed-in user, with prior legacy `vday_data_draft`:** same as above but verify migration moves to `vday_data_draft:${uid}`.
4. **Two users on same browser:** sign in as User A, type "A's letter", sign out, sign in as User B → verify User A's content is invisible (still in `vday_data_draft:userAUid`), User B sees their own namespace (empty or cloud-hydrated).
5. **Debounced dirty flag:**
   - Type a character → optimistic `dirtyBit` flips. Wait 1000ms → settled `hasLocalChanges` flips.
   - Type a character then delete it (within 1000ms) → `dirtyBit` flips but settled `hasLocalChanges` stays false after the debounce fires (semantic-divergence sees no net change).
6. **`selectiveHydrate` projection:**
   - Manually populate `vday_data_draft:${uid}` with a fake entry including `status: 'paid'` (a server-set field). Reload → verify `status` is dropped by `selectiveHydrate` and doesn't enter local data.
7. **No background observer fires:** open Network tab, type, navigate REFINE → PERSONAL_INTRO → QUESTION → MAIN_EXPERIENCE. Verify zero `/api/drafts/transition` calls.
8. **Save still works (with revision flow):** sign in, type, click Save → verify `POST /api/drafts/save` returns `{revision: N}`, the response's revision is captured into `draftRecord.revision`, and the next save echoes it as `expectedRevision`.
9. **Cap-exceeded path is dead:** create 3 drafts manually in Firebase (using the legacy multi-draft path) for one user, then try to create a 4th via the client. Verify it succeeds (no `CAP_EXCEEDED`). (Note: requires direct DB setup since the client can no longer create multiples through normal flow.)
10. **`MAX_DRAFTS` server-side removal:** same as #9, server should not 409 on the 4th.
11. **No `Save Local Draft as New` button:** sign in, trigger Case B, verify modal shows only 2 buttons.

### 11.4 Static-check coverage

`npm run build` runs `tsc`. All type errors from the schema/API/import changes will surface there. The implementer should run `tsc --noEmit` after each Phase commit to catch type drift early.

---

## 12. Anonymous-namespace policy choice (§4.5)

### 12.1 The three options

Per v1.2 §4.5, "If the anonymous-namespace entry has meaningful content at sign-in":

- **(P1) Preserve only.** Anonymous entry stays in its namespace, untouched. If user signs out again, it reappears. No UI surface in the signed-in state.
- **(P2) Explicit import prompt.** A small one-time modal asks: "You wrote a draft while signed out. Import it to your account, discard it, or keep it for now?" User chooses.
- **(P3) Silent import-when-empty.** If user-namespaced is empty AND cloud is empty, anonymous content moves to user namespace as the user's "current" draft.

v1.2 recommends **P1**. v1.2 §11.6 explicitly leaves the choice to PR-48.A implementer with the doctrine doc as the locking artifact.

### 12.2 What P1 looks like in concrete implementation

1. **At sign-in:** the existing hydration effect at [App.tsx:1211-1390](../../App.tsx:1211) runs. It reads from `vday_data_draft:${uid}` (user namespace) per the §3 namespacing infrastructure.
2. **Anonymous namespace is NOT consulted by the hydration gate.** The reconciliation gate at App.tsx:1319-1346 evaluates local-meaningful from the user namespace, not from anonymous.
3. **The anonymous entry sits in `vday_data_draft:anonymous` untouched.** No effect reads or moves it.
4. **On sign-out:** the effect at App.tsx:1229-1238 runs. Subsequent edits write to `vday_data_draft:anonymous` (per §3.4). The pre-sign-in anonymous content is still there; it now becomes the persisted entry for the signed-out user.
5. **No UI surface in signed-in state.** No modal, no toast, no "your anonymous draft is preserved" notification.

**Edge — what about the in-memory typed content at sign-in moment?** Per §3.3 recommendation (i): the in-memory `data` follows the user. Their typed-but-unsaved content from the anonymous session becomes the working copy of the user namespace via the next autosave debounce. **This is technically a silent merge of in-memory content** (memory does not respect namespace boundaries). The persisted anonymous entry stays put per P1. The user perceives "my work is still here" because the editor's working copy didn't change; meanwhile a snapshot of their earlier anonymous work also persists in the anonymous namespace, recoverable on sign-out.

**This is the recommended behavior** but it's a subtle deviation from a strict reading of P1 ("Anonymous entry stays in its namespace, untouched"). The doctrine doc should explicitly describe the in-memory transfer so future engineers understand the rule.

---

## 13. Summary: founder-decision gates before code

To unblock PR-48.A implementation:

| Gate | Decision needed | Recommendation | Required? |
|---|---|---|---|
| **L4 — Anonymous-namespace policy** | P1 / P2 / P3 | P1 | YES — material UX surface |
| **L5 — Migration policy** | Soft-migration / schema-bump-discard | Soft-migration | YES — material data-loss risk |
| **L6 — `draftStateLogic.ts` cleanup** | Delete `decideTransition`, keep `UI_STAGE_TO_DRAFT_STATE` | Yes | No — implementer judgment |
| **L7 — Module-level uid cache vs param-passing** | Option (c) module cache / (a) param every call | (c) module cache | No — implementer judgment |
| **L8 — Hook API shape** | Return imperative API vs accept props | Return imperative API | No — implementer judgment |
| **L9 — `transition.js` fate in PR-48.A** | Leave for PR-48.B / delete now | Leave for PR-48.B | No — already deferred per §11.1 |
| **L10 — `BeginNewPromptModal` interim handlers** | Simplify to local-only / delete modal | Simplify | No — implementer judgment |
| **L11 — `cap_exceeded` SaveDraftResult variant** | Remove in PR-48.A / keep for transition | Remove | No — implementer judgment |

**Two gates are blocking; six are advisory.** The two blockers (L4 + L5) can be locked in a single founder review of this diagnostic; everything else proceeds.

---

## 14. Closing

PR-48.A is well-scoped and implementable. The deletions are clean (no hidden consumers); the additions are localized (UID namespacing concentrates in `usePreparationPersistence.ts`; debounced divergence concentrates in the same file's hook body); the migration is one effect in App.tsx.

The largest implementation surface is **UID-namespacing call-site churn** (~20 helper-call updates across App.tsx + PreparationForm.tsx). The largest semantic risk is **the migration step** (per §1.5; soft-migration is the trust-preserving choice).

PR-48.A's exit criteria per v1.2 §12 — "Audit pass, smoke test (existing flows still work, UID namespacing functional, dirty-flag behaves correctly across mutation/sync cycles), merge to `pr48-cloud-draft-sync`" — are achievable with the 5–6 commit structure in §2.

**Recommended sequence:** founder locks L4 + L5 → PR-48.A implementation begins in Phase A → audit each phase before next → ship.

---

End of diagnostic. No code modified. No fix prompts. Awaiting founder lock on L4 + L5.
