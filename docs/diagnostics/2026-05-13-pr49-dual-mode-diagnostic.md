# PR-49 Dual-Mode Persistence — Codebase Diagnostic

**Date:** 13 May 2026
**Branch:** `pr48-cloud-draft-sync` @ `7a853c9`
**Source of truth:** [`docs/proposals/dual-mode-persistence.md`](../proposals/dual-mode-persistence.md)
**Mode:** Read-only inventory. No code changes performed.
**Method:** `git grep` and file:line evidence against current HEAD. Every finding classified against invariants I1–I7 and anti-patterns A1–A7 from the proposal.

Drift classification legend: `harmless anchor` (line number shifted, no semantics) · `structural` (file moved/renamed/refactored) · `hidden dependency` (consumer not anticipated in the proposal) · `blocker` (something fundamental that requires founder decision before code starts).

---

## Section 1 — Conflicts (code that contradicts dual-mode invariants)

### 1.1 Sign-in reconciliation modal + handlers — violates I3, I5, A3

**Surfaces:**
- [`components/SignInReconciliationModal.tsx`](../../components/SignInReconciliationModal.tsx) entire file (170 LOC)
- App.tsx `applyCloudActiveToState` at `:936`
- App.tsx `handleSignInContinueDashboardDraft` at `:955`
- App.tsx `handleSignInDiscardLocalDraft` at `:962`
- App.tsx render switch at `:2202–2218` (`reconciliation.kind === 'sign_in_case_b'`)
- App.tsx hydration effect at `:1218–1252` (Case A/B split, sets `kind: 'sign_in_case_b'`)

**Invariant violated:** I5 (no reconciliation logic in the codebase); I3 (no sign-in prompt after entry-point gate — this is a post-sign-in reconciliation prompt, which is the same anti-pattern in another shape); A3 (reconciliation modals in any form).

**Description:** The entire Case A vs Case B sign-in path exists to reconcile local-meaningful with cloud-meaningful state. Under dual-mode, mode is locked at entry; local and cloud never coexist for one session; reconciliation is structurally impossible.

**Drift:** structural — the modal file, the handlers, the `'sign_in_case_b'` discriminator variant in `ReconciliationState`, and the hydration effect's Case A/B branch all need to go away. PR-49 deletes this surface.

### 1.2 `ReconciliationState` union + state — violates I5, A3

**Surfaces:**
- App.tsx `type ReconciliationState` at `:106` (4 variants: `none`, `stale_revision`, `begin_new`, `sign_in_case_b`)
- App.tsx `const [reconciliation, setReconciliation] = ...` at `:641`
- All `setReconciliation` call sites (15+ within App.tsx)

**Invariant violated:** I5; A3.

**Description:** The whole reconciliation state machine, including its non-sign-in variants (`stale_revision`, `begin_new`), encodes "we have two authorities and need to mediate." Under dual-mode this collapses entirely: authenticated mode has no stale-revision case (single user, single draft, no concurrent reconciliation surface needed for save errors — those become plain error toasts), and `begin_new` becomes mode-specific behavior with no need for a discriminated-union state.

**Drift:** structural.

### 1.3 `HydrationResolutionState` + the pending-action gate — violates I3, I5

**Surfaces:**
- App.tsx `type HydrationResolutionState` at `:137` (states: `idle`, `hydrating`, `needs_reconciliation`, `resolved`)
- App.tsx `const [hydrationResolutionState, setHydrationResolutionState] = ...` at `:511–512`
- App.tsx `commitPendingAction` at `:528–571` (defers action until `'resolved'`)
- App.tsx watcher effect at `:576–584`
- App.tsx `pendingActionRef`, `pendingCancelRef` at `:454–457`

**Invariant violated:** I3 (sign-in must not gate post-entry actions); I5.

**Description:** The hydration-gate machine exists to defer actions until reconciliation resolves. Under dual-mode, authenticated mode loads the user's single cloud draft directly (no Case A/B split, no `'needs_reconciliation'` state). Guest mode does not hydrate from cloud at all. The gate, the `pendingActionRef` plumbing, and the `commitPendingAction` deferral disappear.

**Drift:** structural.

### 1.4 Stale-revision modal + handlers — violates I5, A3

**Surfaces:**
- [`components/StaleRevisionModal.tsx`](../../components/StaleRevisionModal.tsx) entire file (109 LOC)
- App.tsx `handleStaleRevisionReloadLatest` at `:673`
- App.tsx `handleStaleRevisionKeepLocalForNow` at `:742`
- App.tsx `handleStaleRevisionCancel` at `:749`
- App.tsx switch case `'stale_revision'` at `:1057–1075` (inside `handleSaveAndContinueLater`)

**Invariant violated:** I5; A3.

**Description:** Stale-revision is a multi-writer reconciliation concept. Under dual-mode there is exactly one writer per draft: the user, in the mode they chose at entry. A "Save and Continue" click that fails should surface a plain error toast and retry; no modal mediates between "local edits" and "cloud edits" because cloud never has independent edits to mediate against.

**Drift:** structural.

### 1.5 Mid-flow sign-in prompts (post-entry) — violates I3, A4

**Surfaces:**
- App.tsx `runOrPromptSignIn` at `:514–528` (the gate function)
- Call site at `:1093` — `handleSaveAndContinueLater` wraps the save in `runOrPromptSignIn(action, 'persistence', ...)`. **This is a sign-in prompt fired AFTER the user clicked Save during PREPARE/REFINE.** Violates I3 directly.
- Call site at `:1667` — `onPayment` for Eidi flow wraps payment-stage entry. Mid-flow sign-in prompt before payment.
- Call site at `:2057` — `onPayment` for Vow flow at MainExperience → PAYMENT transition. Mid-flow sign-in prompt before payment.
- [`components/SignInPromptModal.tsx`](../../components/SignInPromptModal.tsx) entire file (variants: `'payment'` and `'persistence'`).

**Invariant violated:** I3 (no sign-in prompt fires after the entry-point gate. The payment flow never asks the user to sign in.); A4 (cross-mode migration on later sign-in).

**Description:** Three distinct surfaces currently fire a sign-in prompt mid-flow:
- **At save click (Save and Continue Later):** guest who clicks Save is prompted to sign in to "save your letter and pick it back up on any device." Variant: `'persistence'`. Under dual-mode, save is a per-mode behavior — guests save locally with no prompt; authenticated users saved at entry.
- **At payment-stage entry (Eidi):** sign-in prompt before payment.
- **At payment-stage entry (Vow):** sign-in prompt before payment.

Under dual-mode, the mode is chosen at entry. Guests pay as guests (with an email field for receipt). Authenticated users pay signed-in. No mid-flow prompts.

**Drift:** structural. All three call sites + the `runOrPromptSignIn` helper + the `SignInPromptModal` component + the `pendingActionRef` plumbing collectively retire.

### 1.6 Begin Again cloud-aware orchestration — violates I4 (mode separation) and partially A5 (cross-mode hydration)

**Surfaces:**
- App.tsx `handleBeginAgainRequest` at `:776–802`
- App.tsx `finalizeBeginNewLocalReset` at `:804–814`
- App.tsx `handleBeginNewSaveAndStartNew` at `:816–888`
- App.tsx `handleBeginNewDiscardAndStartNew` at `:890–917`
- App.tsx `handleBeginNewCancel` at `:919–922`
- [`components/BeginNewPromptModal.tsx`](../../components/BeginNewPromptModal.tsx) entire file (110 LOC)
- App.tsx render at `:2193–2199`

**Invariant violated:** I4 (local touched only by guest path; cloud only by authenticated path — but these handlers conditionally call both); A5 (cross-mode hydration in spirit — the same Begin-Again flow tries to handle "local content with optional cloud ACTIVE").

**Description:** The current Begin Again flow opens a modal whose buttons mix local-clear and cloud-pause semantics (`handleBeginNewSaveAndStartNew` does pause-then-create; `handleBeginNewDiscardAndStartNew` does discard-then-clear). Under dual-mode:
- **Guest path:** Begin Again clears local autosave. No modal. No cloud call.
- **Authenticated path:** Begin Again deletes the user's cloud draft via a single DELETE call (or RTDB removal). No modal needed beyond a destructive-action confirmation.

The current handler set assumes both local and cloud are addressable in the same flow, which dual-mode forbids.

**Drift:** structural. PR-49 splits into mode-specific Begin Again handlers (or a single handler that branches on mode at the outermost level, with no shared cloud-aware body).

### 1.7 `persistenceStatus` state machine + ACTIVE/PAUSED/ABANDONED — violates §5.2 (retire entirely)

**Surfaces:**
- [`types/draft.ts:24`](../../types/draft.ts:24) — `export type PersistenceStatus = 'ACTIVE' | 'PAUSED' | 'ABANDONED';`
- [`types/draft.ts:48`](../../types/draft.ts:48) — `isPersistenceStatus` type guard
- [`types/draft.ts:58`](../../types/draft.ts:58) — `persistenceStatus` field on `DraftDocument`
- App.tsx `:142, :698, :710, :1176, :1177` — type imports + reads
- `api/lib/draftValidation.js:89, :138` — schema validation
- `api/drafts/save.js` — single-ACTIVE check + write at `:228, :230, :233, :237, :238, :245, :260`
- `api/drafts/list.js:34` — reads all drafts (no filter by status)
- `api/drafts/pause.js` — entire endpoint (162 LOC) transitions ACTIVE → PAUSED
- `api/drafts/resume.js` — entire endpoint (232 LOC) transitions PAUSED → ACTIVE with atomic demote
- `api/drafts/discard.js` — entire endpoint (144 LOC) transitions to ABANDONED
- `api/verify-payment.js:60` — `.orderByChild('persistenceStatus').equalTo('ACTIVE')` (the `markActiveDraftCompleted` helper)
- `api/verify-payment.js:85` — comment: "persistenceStatus stays ACTIVE — COMPLETED is a draftState, not a status"
- `utils/lifecycleDraft.ts:11, :17, :58, :78, :85` — `PersistenceStatus` type + result shape

**Invariant violated:** dual-mode §5.2 retires the entire state machine. Authenticated users have at most one cloud draft (single record, no status — present or absent). Guests have no cloud draft.

**Description:** The state machine spans 11 files. Retirement requires:
- Removing the `PersistenceStatus` type + guard from `types/draft.ts`.
- Removing the `persistenceStatus` field from `DraftDocument`.
- Updating `api/drafts/save.js` to drop the single-ACTIVE check (becomes record-or-no-record).
- Updating `api/lib/draftValidation.js` to remove `PERSISTENCE_STATUS_VALUES` and the validation branch.
- Updating `api/verify-payment.js:60` — the `markActiveDraftCompleted` helper queries by `persistenceStatus === 'ACTIVE'` to find the draft to mark `COMPLETED`. After retirement this becomes "find the user's one cloud draft" (no filter, or `drafts/{draftId}` direct read keyed by some new identity).
- Deleting `pause.js`, `resume.js`, `discard.js` endpoints entirely.

**Drift:** structural — substantial removal surface across server + client + types.

### 1.8 `expectedRevision` CAS plumbing — violates I5 (no reconciliation logic)

**Surfaces:**
- `api/drafts/save.js:151–185` — UPDATE-path revision check (STALE_REVISION / INVALID_REVISION)
- `api/lib/draftValidation.js:151+` — `validateExpectedRevision` helper
- `api/drafts/pause.js`, `resume.js`, `discard.js`, `transition.js` — all consume `expectedRevision`
- `utils/saveDraft.ts:23, :55, :111–118` — `expectedRevision` field on `SaveDraftInput` + STALE_REVISION result variant
- App.tsx `:841` — `input.expectedRevision = draftRecord.revision;`
- App.tsx `:1057–1075` — stale-revision case in switch (already flagged §1.4)
- `types/draft.ts:65` — `revision` field on `DraftDocument`

**Invariant violated:** I5 (revision-based CAS exists to mediate concurrent writers; dual-mode has at most one writer).

**Description:** CAS exists because two devices might concurrently edit the same cloud draft. Under dual-mode authenticated path, the user clicks "Save and Continue" — the server overwrites. There is no concurrent-edit scenario to reconcile. CAS becomes dead weight.

Caveat: the `revision` field on `DraftDocument` could remain useful as a write counter for debugging/audit, but the `expectedRevision` request validation and STALE_REVISION response branch retire.

**Drift:** structural. Removal surface across 6+ files.

### 1.9 Debounced autosave inside `usePreparationPersistence` — under dual-mode survives ONLY in guest path

**Surfaces:**
- [`hooks/usePreparationPersistence.ts:286–297`](../../hooks/usePreparationPersistence.ts:286) — the debounced effect (1000ms)
- [`components/PreparationForm.tsx:155`](../../components/PreparationForm.tsx:155) — `usePreparationPersistence(data, step);` call site

**Invariant violated:** A2 — "Auto-save-to-cloud during anonymous flow. Even with 'we won't reconcile, we'll just keep a backup.'" The hook today only writes localStorage, not cloud — so A2 is not violated by this hook directly. But in dual-mode authenticated mode, autosave-to-anything is replaced by "Save and Continue" on click. The hook stays for guest mode; the authenticated mode does NOT mount it.

**Description:** The debounced autosave is the guest-path persistence mechanism. Under dual-mode it survives, but only when mode === 'guest'. Authenticated mode must not mount this hook (or must pass `enabled: false`). The current code unconditionally mounts the hook inside `PreparationForm`; PR-49 makes the mount mode-aware.

**Drift:** structural. PreparationForm needs mode awareness; not a behavior change in the hook itself.

### 1.10 `getDraftMetadata` resume modal heuristic — reads local; dual-mode keeps for guest only

**Surfaces:**
- `hooks/usePreparationPersistence.ts:405` — `getDraftMetadata()` definition
- App.tsx `:780, :1220` — call sites inside reconciliation gate (the local-meaningful check); these will go away with the gate
- `components/PreparationForm.tsx:98` — call site for the resume-modal decision (this stays under guest mode)

**Invariant violated:** none directly. Flagged because two of the three call sites disappear with §1.3 reconciliation removal.

**Description:** `getDraftMetadata` itself is fine — it reads localStorage. Two of its three consumers (the reconciliation gate's local-meaningful check) retire. The PreparationForm consumer survives as the guest-mode resume-modal decision predicate.

**Drift:** harmless anchor — function survives, two consumers retire.

---

## Section 2 — Duplicates (similar logic in multiple places)

### 2.1 Local-draft hydration + reconciliation logic — two places, both retire under dual-mode

**Surfaces:**
- App.tsx hydration effect at `:1110–1290` — the `/api/drafts/list` fetch + Case A/B split + `setDraftRecord` + `writeDraftId` mirroring
- `components/PreparationForm.tsx:91–170` — `initialDraftRef = useRef(peekDraft())` + `getDraftMetadata` heuristic + `hydrationDeferred` gating
- `hooks/usePreparationPersistence.ts:272` — `peekDraft()` (the synchronous mount-time read)

**What it does:** App.tsx reconciles between local autosave and cloud draft at sign-in. PreparationForm decides between silent-restore / show-modal / start-empty on the local autosave alone. They overlap on local-meaningful heuristics.

**Required under dual-mode:** App.tsx's hydration effect collapses into mode-aware behavior:
- Guest: no cloud fetch. Local autosave is the only thing to consider; PreparationForm's existing resume-modal flow handles it.
- Authenticated: fetch `/api/draft` (singular, after the API rewrite) and apply directly. No reconciliation; no local consultation.

PreparationForm's path survives unchanged for guest mode. For authenticated mode, the form receives cloud-hydrated `data` from App.tsx and skips the resume-modal flow entirely (or shows a different "Resume from cloud?" affordance, TBD).

**Drift:** structural — the App.tsx side collapses substantially; PreparationForm side stays but becomes mode-conditional.

### 2.2 Two distinct save paths (local autosave vs cloud explicit save)

**Surfaces:**
- **Local autosave (guest-eligible):** `hooks/usePreparationPersistence.ts:286–297` — debounced write to localStorage on every `data`/`step` change.
- **Cloud explicit save (authenticated-eligible):** App.tsx `handleSaveAndContinueLater` at `:969–1100` → `saveDraft(input)` from `utils/saveDraft.ts:45` → `POST /api/drafts/save`.

**What it does:** Two completely different write paths to two completely different storage layers. Currently both can be active simultaneously (the debounce writes local while the user might also click Save). Under dual-mode they're mutually exclusive — guest only autosaves locally, authenticated only saves via explicit Save-and-Continue click.

**Required under dual-mode:** Each survives in its own mode, with no runtime conditional dispatch in shared code. PR-49 should NOT introduce a "mode-aware save dispatcher" function that branches; instead, mode-aware mounting at PreparationForm level chooses which path is alive.

**Drift:** structural — the consolidation is by not-coexisting, not by abstracting them behind a shared interface. The dual-mode proposal §I7 forbids "smart" persistence layers.

### 2.3 Two distinct "find/resume a draft" surfaces

**Surfaces:**
- **`DraftResumeModal`** at [`components/DraftResumeModal.tsx`](../../components/DraftResumeModal.tsx) — local-storage-based, surfaced by PreparationForm's `initialDecision === 'show-modal'`.
- **`MyLettersModal`** at [`components/MyLettersModal.tsx`](../../components/MyLettersModal.tsx) — cloud-based, calls `/api/letters/list` (SENT letters only; drafts are NOT currently surfaced in this modal).

**What it does:** Today these are non-overlapping: `DraftResumeModal` handles "you have a local in-progress draft on this device"; `MyLettersModal` handles "view your sent letters." There is no surface today for "list my saved cloud drafts to resume."

**Required under dual-mode:** §5.3 calls for a "drafts as a tab" addition to `MyLettersModal` (or a sibling modal) showing only authenticated-mode cloud drafts. Guests still get `DraftResumeModal` for local resume. The two are mode-segregated by construction.

**Drift:** structural addition (new tab/modal for cloud-drafts list); existing surfaces survive without overlap.

### 2.4 Two distinct localStorage-clear primitives

**Surfaces:**
- `clearPreparationDraft()` at `hooks/usePreparationPersistence.ts:363` — `localStorage.removeItem(STORAGE_KEY)`.
- Direct call sites:
  - `App.tsx:787, :804, :938, :2073` — used in Begin Again / Continue Dashboard handlers and at payment completion (`:2073` clears after seal per PR #16).
  - `components/PreparationForm.tsx:200` — used in legacy local-only Begin Again fallback.

**What it does:** Single primitive, multiple callers. Not a true duplicate — but every call site is currently inside a multi-path conditional that mixes local-clear with cloud-call. Mode-aware refactoring will simplify each call site.

**Drift:** harmless anchor.

### 2.5 `selectiveHydrate` consumers (informational)

**Surfaces:**
- `hooks/usePreparationPersistence.ts:85` — the helper itself
- `hooks/usePreparationPersistence.ts:224` — the only caller, inside `readDraft()`

**What it does:** Single helper, single caller. Listed here only because the proposal §5.3 hints at "selectiveHydrate allow-list may need adjustment." Confirmed: the helper has exactly one call site internal to the same file. Allow-list edits, if any, are local to `hooks/usePreparationPersistence.ts`.

**Drift:** harmless anchor.

---

## Section 3 — Code that gets deleted under dual-mode

### 3.1 Reconciliation-modal components (3 files)

| File | LOC | Reason | Consumers | Clean? |
|---|---|---|---|---|
| `components/SignInReconciliationModal.tsx` | 170 | Violates I3, I5, A3 | App.tsx import `:83`, render `:2202–2218` | After consumer migration ✓ |
| `components/StaleRevisionModal.tsx` | 109 | Violates I5, A3 (CAS retires per §1.8) | App.tsx import `:81`, render `:2186–2191` | After consumer migration ✓ |
| `components/BeginNewPromptModal.tsx` | 110 | Mixes local-clear and cloud-call semantics; dual-mode splits Begin Again by mode | App.tsx import `:82`, render `:2193–2199` | After consumer migration ✓ |

### 3.2 Lifecycle endpoints (3 files)

| File | LOC | Reason | Consumers at HEAD |
|---|---|---|---|
| `api/drafts/pause.js` | 162 | No PAUSED state under dual-mode | `utils/lifecycleDraft.ts:125` (`pauseDraft` wrapper); App.tsx call sites: `:860` (inside `handleBeginNewSaveAndStartNew` — also retires) |
| `api/drafts/resume.js` | 232 | Authenticated mode loads from cloud directly, no resume-promote semantics | **Zero client consumers at HEAD.** `grep -rn "fetch.*api/drafts/resume"` returns no results. Already dead. |
| `api/drafts/discard.js` | 144 | Discard semantics live in Begin Again per mode | `utils/lifecycleDraft.ts:129` (`discardDraft` wrapper); App.tsx call site: `:898` (inside `handleBeginNewDiscardAndStartNew` — also retires) |

Clean after the Begin Again handler retirement (§1.6).

### 3.3 Orphan endpoint already dead-but-not-deleted

| File | LOC | Reason | Consumers at HEAD |
|---|---|---|---|
| `api/drafts/transition.js` | 197 | Only caller was `useDraftStateObserver` (removed in Commit 1). Zero client callers at HEAD. | Zero. Confirmed by prior verification audit. |

Clean. Pure deletion.

### 3.4 Lifecycle client helper

| File | LOC | Reason | Consumers at HEAD |
|---|---|---|---|
| `utils/lifecycleDraft.ts` | 130 | Exports `pauseDraft`, `discardDraft` only. With both endpoints deleted and consumer handlers retired, the file has no purpose. | App.tsx imports `:80`; call sites at `:860`, `:898` (both inside retiring Begin Again handlers) |

Clean after consumer migration.

### 3.5 App.tsx state + handler removal (no file deletion; large in-file removals)

| Construct | Location | Reason |
|---|---|---|
| `ReconciliationState` union + `reconciliation` state | `:106`, `:641` | §1.2 |
| `HydrationResolutionState` + `hydrationResolutionState` state | `:137`, `:511–512` | §1.3 |
| `pendingActionRef`, `pendingCancelRef`, `commitPendingAction`, deferred-action watcher effect | `:454–457`, `:528–584` | §1.3, §1.5 |
| `runOrPromptSignIn` + 3 call sites | `:514–528`, `:1093`, `:1667`, `:2057` | §1.5 |
| `applyCloudActiveToState` | `:936` | §1.1 |
| `handleSignInContinueDashboardDraft`, `handleSignInDiscardLocalDraft` | `:955`, `:962` | §1.1 |
| `handleStaleRevisionReloadLatest`, `KeepLocalForNow`, `Cancel` | `:673`, `:742`, `:749` | §1.4 |
| `handleBeginAgainRequest`, `finalizeBeginNewLocalReset`, `handleBeginNewSaveAndStartNew`, `handleBeginNewDiscardAndStartNew`, `handleBeginNewCancel` | `:776–922` | §1.6 (rewrite, not pure delete — mode-aware replacements) |
| `beginNewInFlightRef`, `prepFormResetKey` | `:772`, `:774` | Tied to retiring handlers; `prepFormResetKey` may survive if remount-on-clear pattern stays useful under dual-mode |
| `CloudDraftSnapshot`, `LocalDraftSnapshot` interfaces | `:91`, `:99` | §1.1 |
| Hydration effect's Case A/B split + `'sign_in_case_b'` write | `:1218–1252` | §1.1, §1.3 |
| Switch case `'stale_revision'` in `handleSaveAndContinueLater` | `:1057–1075` | §1.4 |
| Switch case `'active_draft_exists'` in `handleSaveAndContinueLater` | `:1078–1083` | §1.7 — single-ACTIVE invariant retires |
| `draftRecord.persistenceStatus` references in App.tsx | `:698, :710, :1176, :1177` | §1.7 |
| Import of `pauseDraft`, `discardDraft` | `:80` | §1.6 |
| Import of `SignInReconciliationModal`, `StaleRevisionModal`, `BeginNewPromptModal` | `:81–83` | §1.1, §1.4, §1.6 |

### 3.6 Type narrowing in `types/draft.ts`

| Construct | Line | Reason |
|---|---|---|
| `export type PersistenceStatus = ...` | `:24` | §1.7 |
| `isPersistenceStatus` typeguard | `:48` | §1.7 |
| `persistenceStatus` field on `DraftDocument` | `:58` | §1.7 |
| `revision`, `expectedRevision` (CAS) — see §1.8 — `revision` may stay as audit counter; `expectedRevision` and the CAS comparison retire | `:65` | §1.8 |

### 3.7 Server-side endpoint trims

| File | Removal | Reason |
|---|---|---|
| `api/drafts/save.js:228–245` | Single-ACTIVE invariant block (the `existingActive` check) | §1.7 — record-or-no-record replaces the state-machine invariant |
| `api/drafts/save.js:151–185` | UPDATE-path revision check (STALE_REVISION / INVALID_REVISION abort) | §1.8 — CAS retires |
| `api/lib/draftValidation.js:138` | `persistenceStatus` enum validation branch | §1.7 |
| `api/lib/draftValidation.js:151+` | `validateExpectedRevision` helper | §1.8 |
| `api/drafts/list.js` — entire endpoint may retire | If dual-mode renames to `GET /api/draft` (singular, single record), the list endpoint becomes vestigial | §5.3 of proposal hints at API surface change but doesn't lock it |

### 3.8 `utils/saveDraft.ts` narrowing (~131 LOC; partial retirement)

`SaveDraftResult` variants that retire under dual-mode:
- `stale_revision` (§1.8 — CAS retires)
- `active_draft_exists` (§1.7 — single-ACTIVE retires)

Surviving variants: `ok`, `unauthorized`, `rate_limited`, `bad_request`, `network_error`, `unknown_error`. The helper itself survives but with a narrower error surface.

### 3.9 Doc moves to `docs/archived/`

| File | Reason |
|---|---|
| `docs/contracts/active-paused-state-machine.md` | Already flagged in README. PR-49 archives it. |
| `docs/diagnostics/2026-05-12-multi-draft-cloud-sync.md` | Pre-pivot multi-draft diagnostic; preserved for institutional learning per single-draft-pivot §10.4. |

### 3.10 Doctrine doc rewrite (not delete)

`docs/doctrine/local-persistence-contract.md §6.5` — currently describes the multi-draft state machine with ACTIVE/PAUSED ≤ 3 invariant (lines 85–136). Under dual-mode it rewrites to describe guest-mode-only local persistence per proposal §9.

---

## Section 4 — Code that gets modified under dual-mode

### 4.1 App.tsx hydration effect — large rewrite

**Location:** `App.tsx:1110–1290`.

**Current behavior:** Gated on `authUser?.uid` + `serverSessionReady`. Fetches `/api/drafts/list`, finds chronologically-oldest ACTIVE, evaluates local-meaningful via `getDraftMetadata`, branches to Case A (silent hydrate cloud over local) or Case B (open reconciliation modal). Manages `hydrationResolutionState` machine.

**Required new behavior:** Mode-aware. When the app loads:
- If `mode === 'authenticated'`: fetch the user's single cloud draft (`GET /api/draft` or similar). If present, hydrate `data`. No reconciliation; no local consultation.
- If `mode === 'guest'`: no cloud fetch. PreparationForm's existing local-resume flow handles draft restoration.
- Before mode is chosen (cold mount, no entry-gate decision yet): no hydration. The mode-selection gate is the user's first interaction with persistence.

The `hydrationResolutionState` machine + `pendingActionRef` plumbing retire (§1.3).

**Complexity:** Large — the effect is currently ~180 LOC; the rewrite cuts most of it.

### 4.2 App.tsx save handler — medium rewrite

**Location:** `App.tsx:969–1100` (`handleSaveAndContinueLater`).

**Current behavior:** Wraps the save in `runOrPromptSignIn` (which fires a sign-in modal for guests). Switches on `saveDraft` result kinds including `stale_revision` (opens modal), `cap_exceeded` (already removed), `active_draft_exists`. Manages `saveInFlightRef`, `lastSaveSuccessAt`, `lastSaveError`.

**Required new behavior:** Mode-aware. Under dual-mode:
- **Guest mode:** no `handleSaveAndContinueLater` — guests have implicit autosave only; their "save and continue" is the autosave debounce. The Save Draft affordance in RefineStage / MainExperience disappears for guests (the proposal §2.2 says guest mode has no Save affordance — persistence is implicit).
- **Authenticated mode:** "Save and Continue" button on every step. Calls `POST /api/draft`. On success, advances. On error (network / 5xx / 401), surfaces an inline error and does not advance.

The current handler structurally inverts under dual-mode: it becomes the authenticated-mode step-advance handler, not a "Save and Continue Later" floating affordance.

**Complexity:** Medium. Most of the body retires; what remains is a thinner happy-path save.

### 4.3 PreparationForm step buttons — small label change + mode prop

**Location:** `components/PreparationForm.tsx` — step navigation buttons at `:492, :497, :500, :908, :913, :916, :1167`.

**Current behavior:** All step buttons read "Continue" or "Generate Draft" (the final step). No mode awareness.

**Required new behavior:** Mode-aware labels per proposal §4:
- Guest: "Continue"
- Authenticated: "Save and Continue"

PreparationForm receives a new prop `mode: 'guest' | 'authenticated'` and renders the label conditionally. The click handler also branches: guest calls `next()` (local autosave already wrote on debounce); authenticated calls a new save-and-advance handler.

**Complexity:** Small — labels + one click-handler branch per button.

### 4.4 RefineStage save plumbing — small refactor

**Location:** [`components/RefineStage.tsx`](../../components/RefineStage.tsx):17, :28, :327, :350.

**Current behavior:** Exposes optional `onSaveAndContinueLater` prop; renders the save button conditionally.

**Required new behavior:** Same mode-aware split as PreparationForm. Guest mode renders no save affordance; authenticated mode shows "Save and Continue."

**Complexity:** Small.

### 4.5 MainExperience save plumbing — small refactor

**Location:** [`components/MainExperience.tsx`](../../components/MainExperience.tsx):38, :99, :829.

**Current behavior:** Same shape as RefineStage — optional `onSaveAndContinueLater`.

**Required new behavior:** Per proposal §2.2 and §2.3, the Preview Experience screen has no save affordance in either mode (it's read-only). So this prop and the button retire entirely from this component.

**Complexity:** Small (pure removal).

### 4.6 PaymentStage guest-email field — small addition

**Location:** [`components/PaymentStage.tsx`](../../components/PaymentStage.tsx). Currently receives optional `guestEmail` prop at `:13, :48`; uses it at `:100, :194, :213`. The guest email is currently captured by `SignInPromptModal` (variant `'persistence'` or `'payment'`) and passed in as a prop.

**Required new behavior:** Under dual-mode the guest email is captured directly on the PaymentStage form (no sign-in prompt fires beforehand — proposal §I3). PaymentStage gets a new email input field (with validation), used only when `mode === 'guest'`.

**Complexity:** Small — new field, validation, conditional rendering by mode.

### 4.7 `api/verify-payment.js` anonymous-letter record path — medium addition

**Location:** [`api/verify-payment.js:317–746`](../../api/verify-payment.js:317) (Razorpay path) and `:380–432` (founder path).

**Current behavior:** Resolves `senderUid` from `getSessionUser(req)` at `:317`. If present, writes `users/${senderUid}/letters/${sessionKey}` for dashboard listing. If absent, the letter is written to `shared/${sessionKey}` only (no per-user record).

**Required new behavior:** This is mostly already structured correctly! The anonymous case (no `senderUid`) already skips the per-user index. PR-49's work:
- Guarantee the guest's `recipientEmail` (from PaymentStage) reaches `sendLetterSealedEmail` so the receiver URL is emailed.
- Consider whether `shared/${sessionKey}` needs an explicit `mode: 'anonymous' | 'authenticated'` field for downstream filtering (e.g., admin queries).
- Lock the §6.Q3 question on whether anonymous letters use a separate `anonymousLetters/{paymentId}` collection or stay in `shared/` with a flag. Currently they stay in `shared/`.

**Complexity:** Medium — mostly a path that already exists, with email-delivery contract tightening.

### 4.8 `api/letters/list.js` — small constraint (dashboard for authenticated mode only)

**Location:** [`api/letters/list.js`](../../api/letters/list.js).

**Current behavior:** Auth-required (`getSessionUser` returns 401 if absent). Reads `users/${user.uid}/letters` and joins with `shared/${sessionKey}`. Returns all letters the user has sent.

**Required new behavior:** Unchanged. The endpoint is already auth-gated and per-user. Anonymous letters by design have no `users/${uid}/letters/{key}` entry so they don't appear here. **No code change needed** — the proposal's intent is satisfied by the existing structure.

**Complexity:** Zero. Flagged only for completeness; confirms the proposal's §2.2 "no dashboard for guests" works correctly without changes here.

### 4.9 MyLettersModal — large addition (Drafts tab)

**Location:** [`components/MyLettersModal.tsx`](../../components/MyLettersModal.tsx).

**Current behavior:** Single-tab view of sent letters only.

**Required new behavior:** Add a "Drafts" tab (or sibling component) that lists the authenticated user's cloud draft (singular, under dual-mode). Click → load draft into editor with `data` hydrated from cloud. Empty state: "Start a new letter" CTA.

**Complexity:** Large — new tab UI, new fetch surface (whichever endpoint replaces `/api/drafts/list`), new click-to-resume handler.

### 4.10 `utils/saveDraft.ts` — small narrowing

See §3.8 above. The helper survives with a narrower error surface (drops `stale_revision`, `active_draft_exists`).

### 4.11 `hooks/usePreparationPersistence.ts` — small scope change

**Current behavior:** Mounted unconditionally inside PreparationForm. Writes to localStorage on debounce.

**Required new behavior:** Mounted only when `mode === 'guest'` (or pass `enabled: false` when `mode === 'authenticated'`). The hook's internals don't change; the call site does.

**Complexity:** Small.

### 4.12 `utils/routing.ts` — small or none

**Location:** [`utils/routing.ts`](../../utils/routing.ts).

**Current behavior:** Resolves URL → flow type. No mode awareness.

**Required new behavior:** Likely no change. The mode-selection gate (§5.5) lives on the `LETTER_CREATE` route as a modal overlay; the router does not need to distinguish guest vs authenticated routes. **Verify during implementation** that anonymous-letter receiver URLs (per §5.7) don't require a new route type — they should be served from the existing `RECEIVER` short-code route.

**Complexity:** Zero (anticipated) — flag for verification.

### 4.13 LandingPage / UserMenu — small touch

**Location:** [`components/LandingPage.tsx:124–149`](../../components/LandingPage.tsx:124) — already hosts `MyLettersModal` and the `onOpenLetters` trigger. UserMenu hosts the sign-in / sign-out controls.

**Required new behavior:** "Create Your Letter" click triggers the new ModeSelectionModal before navigating. If user is already signed-in, skip the modal and go straight to authenticated mode (per proposal §6.Q6 recommendation). If signed-out, show the modal.

**Complexity:** Small.

---

## Section 5 — Code that gets added under dual-mode

### 5.1 ModeSelectionModal component — new file

**Location:** new `components/ModeSelectionModal.tsx`.

**Function:** Renders proposal §2.1 copy. Two buttons:
- "Continue with Google" → triggers `signInWithGoogle()` from `useAuth`; on success, sets `mode = 'authenticated'` and proceeds.
- "Continue as Guest" → sets `mode = 'guest'` and proceeds.

**Prerequisites:**
- `useAuth.signInWithGoogle()` already exists at `hooks/useAuth.ts:71`. ✓
- A mode-state hook or React context to propagate the choice — does NOT exist. See §5.2.

### 5.2 Mode state + propagation — new context provider

**Location:** new file or addition to existing App-level state.

**Function:** Store `mode: 'guest' | 'authenticated' | null` (null = not yet chosen). Provide it to consumers (PreparationForm, RefineStage, MainExperience, PaymentStage, MyLettersModal, save handlers).

**Prerequisites:**
- **No existing mode/persistence-authority indicator beyond `useAuth`.** Confirmed by grep: `mode: 'guest'` and `mode: 'authenticated'` return zero matches anywhere in source.
- Decision required: React context (provider in App.tsx, consumer hooks in children) vs prop drilling vs Zustand-style external store. The codebase currently uses neither React Context nor any external state library; everything is local `useState`/`useRef`. PR-49 introduces the first cross-component shared-state concept here. Founder lock needed on the mechanism.

### 5.3 Guest payment email field on PaymentStage — addition

**Location:** existing `components/PaymentStage.tsx` (modification, not new file). See §4.6.

**Prerequisites:** Email validation logic — `SignInPromptModal.tsx:21` already has `isValidEmailShape()`. Can be lifted to a shared util.

### 5.4 Anonymous letter record write — wire to existing `shared/` path

**Location:** `api/verify-payment.js`, both founder and Razorpay paths.

**Function:** When `senderUid === null` (no signed-in user), still write `shared/${sessionKey}` (already happens) — but ensure `recipientEmail` is captured for the seal-confirmation email.

**Prerequisites:** Confirmed at §6.Q3 below.

### 5.5 Receipt email delivery — already exists, just wire the guest path

**Location:** `api/verify-payment.js:181` already calls `sendLetterSealedEmail`. The email service is `lib/email/sendEmail.js` using Resend.

**Function:** Confirm the guest's email (from PaymentStage form) is passed through to `sendLetterSealedEmail`. Currently the email is read from `recipientEmail` at `:121` and merged with `authEmail` at `:122` as `effectiveEmail`. The plumbing exists.

**Prerequisites:** Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL` env vars). ✓ in `lib/email/sendEmail.js`.

### 5.6 Mode-aware Begin Again handler — new handler(s) in App.tsx

**Location:** replace the retiring §1.6 handler set with mode-specific handlers.

**Function:**
- Guest Begin Again: `clearPreparationDraft()` + reset App state + bump `prepFormResetKey`.
- Authenticated Begin Again: DELETE the cloud draft (new endpoint or extension of existing pattern) + reset App state.

**Prerequisites:**
- DELETE pattern for cloud drafts — currently there is no `DELETE /api/draft`. Closest existing analog is `api/drafts/discard.js` which sets `persistenceStatus: 'ABANDONED'`. Under dual-mode the state machine retires, so DELETE becomes a hard-remove. **New endpoint or RTDB direct write needed.**

### 5.7 Mode-aware resume — guest path unchanged; authenticated path is new

**Location:** App.tsx hydration effect (rewrite) + MyLettersModal Drafts tab.

**Function:** See §4.1 and §4.9.

### 5.8 Strategy doc — new file

**Location:** `docs/proposals/pr-49-dual-mode-implementation-strategy.md`.

**Function:** PR-49 implementation roadmap mirroring the discipline of PR-48.A's strategy doc but with the smaller dual-mode surface. **This is the next deliverable after this diagnostic.**

---

## Section 6 — Dependency verification (8 questions)

### Q1. Transactional email infrastructure

**Resend exists and is wired.** Evidence:
- [`lib/email/sendEmail.js`](../../lib/email/sendEmail.js) — Resend client + `sendEmail()` primitive + `buildLetterSealedEmail`/`sendLetterSealedEmail` template+send wrapper.
- Import in `api/verify-payment.js:21`: `import { sendLetterSealedEmail } from '../lib/email/sendEmail.js';`
- Call site: `api/verify-payment.js:181` — `sendResult = await sendLetterSealedEmail({...})`.
- Env vars expected: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (both must be set in Vercel + `.env.local`).
- Brand vocabulary protected: "seals" not "sends/delivers/secures" — guardrail in the email module's header comment.

**Status:** Production-ready. No new infrastructure required for guest receipt emails. The guest's `recipientEmail` (from PaymentStage form) just needs to flow into `sendLetterSealedEmail`.

### Q2. Current shape of `DraftRecord` / `DraftDocument`

**App-level `draftRecord` state** ([App.tsx:489–497](../../App.tsx:489)):
```ts
const [draftRecord, setDraftRecord] = useState<{
  draftId: string | null;
  seedDraftState: DraftState | null;
  revision: number | null;
}>(() => ({ draftId: peekDraft().draftId, seedDraftState: null, revision: null }));
```

**Server-side `DraftDocument`** ([types/draft.ts:52–68](../../types/draft.ts:52)):

| Field | Type | Purpose | Survives dual-mode? |
|---|---|---|---|
| `draftId` | string | RTDB push-key identity | ✓ Unchanged |
| `userId` | string | Owning user | ✓ Authenticated only |
| `data` | `Partial<CoupleData>` | Content payload | ✓ Unchanged |
| `step` | `1 \| 2 \| 3` (optional) | PREPARE sub-step | ✓ Unchanged |
| `draftState` | `DraftState` enum | Business milestone (IN_PROGRESS → COMPLETED) | ✓ Probably unchanged; verify whether `COMPLETED` transitions are still needed |
| `persistenceStatus` | `PersistenceStatus` enum | Operational lifecycle (ACTIVE/PAUSED/ABANDONED) | ✗ **Retires** (§1.7) |
| `revision` | number | Monotonic write counter, CAS token | ⚠ Audit counter survives; CAS retires (§1.8) |
| `createdAt`, `updatedAt` | number (server timestamp) | Audit | ✓ Unchanged |

### Q3. SentLetter / receiver-share record shape

**Location:** RTDB `shared/{sessionKey}`. Written in `api/verify-payment.js` at two sites:
- Founder path: `:397–410` (lines verified in pre-flight investigation).
- Razorpay path: `:690–706`.

**Shape (sanitized + decorated):**
```
shared/{sessionKey} = {
  ...sanitized,                           // CoupleData fields after validateCoupleData
  replyEnabled,
  status: 'paid',
  sealedAt,
  createdAt,
  paymentId,
  paymentMode: 'razorpay' | 'founder',    // founder path
  orderId,                                // razorpay path only
  paidAmount,                              // founder path: 0
  ...(senderUid ? { senderUid } : {}),    // OPTIONAL — anonymous letters have NO senderUid
  ...(requestId ? { requestId } : {}),
}
```

**Anonymous variant already supported.** The `senderUid` field is conditional. When the sender is signed out, the field is absent. The record itself lives in `shared/` regardless of mode.

**`users/${senderUid}/letters/${sessionKey}` index** is also conditional (`:420–423` founder path, `:713–716` Razorpay path). Anonymous letters are NOT indexed here, so they are correctly invisible to the authenticated-only dashboard at `/api/letters/list`.

**Conclusion for PR-49:** the existing `shared/` schema already supports the anonymous case. No new collection (`anonymousLetters/{paymentId}` per proposal §6.Q3) is required. PR-49 can either keep `senderUid?: optional` semantics or add an explicit `mode: 'anonymous' | 'authenticated'` discriminator for downstream queries.

### Q4. `mode` concept anywhere already?

**No.** Grep for `mode: 'guest'` / `mode: 'authenticated'`: zero matches across source files. The only proxy is `authUser` from `useAuth`, which is auth-state, not mode-state (auth state can change mid-session; mode in the proposal is locked at entry and cannot change).

**Implication:** PR-49 introduces the first explicit mode state in the codebase. Founder lock needed on mechanism (React Context vs explicit prop vs external store).

### Q5. Tests assuming reconciliation behavior

**No test runner exists.** Per `package.json`:

```json
"scripts": { "dev": "vite", "build": "tsc && vite build", "preview": "vite preview" }
```

No `vitest`, `jest`, `playwright`, `cypress`. The only enforced check is `tsc` as part of `build`.

**Hand-rolled smoke scripts** at [`scripts/`](../../scripts/):
- `test-draft-state-logic.mjs` — DraftState transition tests. **Not reconciliation-aware** (predates Phase 4). Likely still passes; verify during implementation.
- `test-draftid-hint-persistence.mjs` — Tests the localStorage `draftId` hint roundtrip. Doesn't touch reconciliation.

**Conclusion:** no automated test surface to update. Manual smoke tests per the PR-49 strategy doc will be the gate, mirroring the PR-48.A pattern.

### Q6. `vercel.json` / routing

**`vercel.json`** ([../../vercel.json](../../vercel.json)):
- SPA rewrites everything not under `/api/` to `/index.html`.
- Per-function `maxDuration` overrides for several endpoints.
- Daily cron at `/api/admin/reconcile-payments` (20:30 UTC).

**Affected by dual-mode routing additions?** No — the existing SPA rewrite already handles new client routes without `vercel.json` changes. Anonymous receiver URLs use the same short-code route (`^/[A-Za-z0-9_-]{5,}$`) as authenticated-receiver URLs.

### Q7. `/api/drafts/list` shape

**[../../api/drafts/list.js](../../api/drafts/list.js):**
- Auth-gated (`getSessionUser`, 401 if absent).
- Rate-limited (30/min).
- Reads `users/${user.uid}/drafts`, returns ALL drafts (ACTIVE/PAUSED/ABANDONED), sorted by `updatedAt` desc.
- **No persistenceStatus filter** — deliberate per PR-48 design intent (clients filter).

**Under dual-mode:**
- Endpoint becomes "list the single cloud draft for this user" (or "return null if none"). With the state machine retired, there's no list — there's one draft or zero.
- Likely renamed to `GET /api/draft` (singular) per proposal §5.3.
- The existing `/api/drafts/list` can either be deprecated or kept temporarily; the dual-mode strategy doc will lock it.

**Current consumers:**
- `App.tsx:681` (inside `handleStaleRevisionReloadLatest` — retiring)
- `App.tsx:1161` (inside hydration effect — rewriting)

Both consumers retire/rewrite. Endpoint becomes orphan candidate.

### Q8. Founder-code redemption flow

**Location:** `api/create-order.js` + `api/verify-payment.js` (founder path).

**Founder-code application** (`api/create-order.js:92–125`):
- Client sends `{ founderCode }` to `/api/create-order`.
- Server validates via RTDB transaction (`founderTransaction(code)` at `:21–42`).
- On success, server mints a `founderToken` (cryptographic nonce) and stores at `founderTokens/${tokenBytes}` with TTL.
- Returns `{ founderToken }` to client.

**Founder-code consumption** (`api/verify-payment.js:317–432`, Path A):
- Client sends `{ founderToken, coupleData }` to `/api/verify-payment`.
- Server consumes the token atomically and writes `shared/${sessionKey}` + `payments/${founderId}`.
- `senderUid` is read from `getSessionUser` and included **only if present** — founder redemption already supports anonymous redeemers.

**Under dual-mode:**
- The founder-code flow already supports both modes (anonymous and authenticated redeemers). No structural change needed.
- PaymentStage's founder-code UI at `:55, :81, :98, :357` survives.
- **Verify during implementation:** PaymentStage's founder-code UI is currently in the PaymentStage component itself, which under dual-mode receives a `mode` prop. Confirm that the UI is rendered identically in both modes — there's no reason to gate founder codes by mode.

---

## Section 7 — Risks and unknowns

### 7.1 Eidi flow interaction (founder decision needed)

**Status of Eidi flag:** [`config/features.ts:10`](../../config/features.ts:10) — `eidiEnabled: false`. Eidi is off in production.

**Persistence integration:** Eidi has its own pages ([`pages/eidi/create.tsx`](../../pages/eidi/create.tsx), [`pages/eidi/receiver.tsx`](../../pages/eidi/receiver.tsx)) and its own form component ([`components/EidPreparationForm.tsx`](../../components/EidPreparationForm.tsx)). Grep confirms:
- Eidi pages and form do NOT use `usePreparationPersistence`, `saveDraft`, `persistenceStatus`, or `/api/drafts/*`.
- Eidi pages do not touch the reconciliation surface.
- Eidi uses its own API endpoints: `api/_create-eidi-backup.js`, `api/claim-eidi.js`, `api/load-eidi.js`, `api/generate-eid-letter.js`.
- App.tsx has Eidi early returns (`:1715–...`) that bypass the main stage engine entirely when `isEidFlow === true`.

**Risk:** Eidi's `onPayment` callback uses `runOrPromptSignIn` at App.tsx `:1667` — so the Eidi flow does fire a mid-flow sign-in prompt before payment. This needs the same treatment as the Vow flow's payment-stage prompt (§1.5).

**Founder decision:** Does Eidi participate in dual-mode (mode-selection gate at Eidi entry too), or is Eidi entirely separate? The proposal §5.4 says "the receiver-side experience is entirely unchanged" but says nothing about the Eidi creator flow specifically. Recommend founder lock before PR-49 implementation starts: either Eidi gets its own dual-mode treatment, or it's documented as out-of-scope for PR-49.

### 7.2 Receiver-side flow — confirmed clean

**Surface checked:** `components/MainExperience.tsx`, `components/PersonalIntro.tsx`, `components/InteractiveQuestion.tsx`, `components/SharePackage.tsx`, `hooks/usePathLinkLoader.ts`.

**Findings:** grep for `reconciliation`, `persistenceStatus`, `saveDraft`, `usePreparationPersistence`, `signInPrompt` against receiver-side components returns zero matches. The receiver flow reads `shared/${sessionKey}` via `/api/load-session` and renders. No persistence-mode logic.

**Risk:** none for the receiver-side. PR-49 changes are sender-side only.

### 7.3 Founder-code claim flow — works for guests

Confirmed in §6.Q8. No risk.

### 7.4 Razorpay webhook integration

**Location:** [`api/razorpay-webhook.js`](../../api/razorpay-webhook.js). Bodyparser disabled (raw HMAC verification). Does NOT go through `guardPost`. Does NOT use `getSessionUser`. Logs events to `webhookEvents/${eventId}` for the reconciliation cron.

**Risk:** the webhook makes no assumptions about user-context. Anonymous letters' webhook events will be logged identically. **No code change needed.** Flagged only because the prompt asked.

### 7.5 Bundle-size / lazy-loading implications

**Landing page bundle:** the landing page is the only non-lazy entry point. Adding ModeSelectionModal to the landing page bundle adds ~one component's worth of code (small modal).

**Pre-load timing:** the modal is triggered by "Create Your Letter" click. It can be lazy-loaded (matching the codebase's `lazy()` pattern for everything except the landing page itself). The mode-selection decision is the first user gesture; a small load-time delay between click and modal-render is acceptable.

**Risk:** minor — the gating modal sits on the critical entry path, so a code-split delay could feel sluggish. Recommend including ModeSelectionModal in the landing-page bundle (not lazy) since it's small and on the critical interaction.

### 7.6 Proposal items requiring founder lock before PR-49 code starts

Surfacing for explicit decision:

1. **§6.Q3 anonymous-letter record schema.** This diagnostic finds that `shared/{sessionKey}` already supports the anonymous case (`senderUid` conditional). The proposal suggested a separate `anonymousLetters/{paymentId}` collection. Recommend founder picks: keep existing `shared/` shape with `senderUid` optional vs. add explicit `mode` discriminator field vs. split into separate collection. The codebase strongly supports option 1.
2. **§6.Q9 receiver URL longevity.** Proposal raised TTL question for anonymous letters. Current schema has no TTL on `shared/*`. Recommend founder picks: no TTL (URLs permanent) vs. TTL with explicit expiry semantics.
3. **§5.2 mode-state mechanism.** First explicit cross-component shared state in the codebase. React Context vs prop drilling vs external store. No existing prior art.
4. **§7.1 Eidi participation.** Whether Eidi gets dual-mode treatment or is out-of-scope.

### 7.7 Items that look wrong in the proposal when checked against code

- **Proposal §5.2 lists `useDraftStateObserver`-related items under "What becomes obsolete."** That observer was already removed by Commit 1 (`14c1e9c`); the items the proposal lists (`lastSyncedSnapshot`, `dirtyBitRef`, `meaningfulContent` predicate, schema v3 fields) were planned for Commits 2–6 of PR-48.A and NEVER SHIPPED. They don't exist in the codebase to remove. The proposal's framing is correct in spirit (these planned-but-not-shipped items will not be built) but reads as if they need active removal. Strategy doc should clarify.
- **Proposal §5.3 item 10 says "Mode-aware Begin Again flow. Local clear (guest) or cloud delete (authenticated)."** There is currently NO `DELETE /api/draft` endpoint. The closest analog is `api/drafts/discard.js` which transitions `persistenceStatus: 'ABANDONED'`. Under dual-mode the state machine retires, so the discard semantic also retires. PR-49 needs to introduce a hard-DELETE endpoint or use direct Admin SDK RTDB removal in a new endpoint.
- **Proposal §11 closing note assumes that ChatGPT review will lock the proposal unchanged.** That review has not happened yet (proposal status: "Draft for cross-voice review (ChatGPT pass pending)"). The strategy doc should be written AFTER that lock, not before.

### 7.8 Hidden dependency the proposal has not accounted for

**`api/verify-payment.js:55` `markActiveDraftCompleted` helper.** This function is called from both founder and Razorpay paths to mark the user's ACTIVE draft as `draftState: 'COMPLETED'` after payment success. It queries `users/${senderUid}/drafts` filtered by `persistenceStatus === 'ACTIVE'`.

Under dual-mode `persistenceStatus` retires. The helper needs rewriting:
- Anonymous mode: skip entirely (no `senderUid`).
- Authenticated mode: find the user's one cloud draft (no filter needed) and either delete it or mark `draftState: 'COMPLETED'`.

This is a server-side touch the proposal's §5 doesn't explicitly enumerate. Adding to the modify list.

### 7.9 Hidden dependency — `markActiveDraftCompleted` requires `senderUid`

Same surface as §7.8 — flagged separately because it's the load-bearing server-side cleanup after payment. PR-49 must preserve the "completed-draft cleanup after payment" semantic in some form for the authenticated path. The guest path doesn't have this concern (no draft record on the user).

### 7.10 The proposal's "no autosave-to-cloud" rule (A2) and the current authenticated UX

Proposal §2.3 says authenticated users use "Save and Continue" — no debounced autosave. Current code has no debounced autosave-to-cloud either (the autosave hook only writes localStorage). **A2 is not currently violated by any active autosave-to-cloud path.** Flagging only because future engineers might read "no autosave to cloud" and try to add one — the doctrine doc PR-49 produces should call this out explicitly.

---

End of diagnostic.
