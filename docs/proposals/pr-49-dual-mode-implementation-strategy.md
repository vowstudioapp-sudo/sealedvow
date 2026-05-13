# PR-49 — Dual-Mode Persistence Implementation Strategy

**Date:** 13 May 2026
**Status:** Implementation contract. Founder-locked.
**Sources of truth (in priority order):**
1. [`docs/diagnostics/2026-05-13-pr49-dual-mode-diagnostic.md`](../diagnostics/2026-05-13-pr49-dual-mode-diagnostic.md) — authoritative for technical findings, founder-lock resolutions, and anti-patterns.
2. [`docs/proposals/dual-mode-persistence.md`](./dual-mode-persistence.md) — authoritative for the architectural model (§2), invariants (§3), and forbidden patterns (§8). NOT authoritative for "open-question status" — all founder-locks are resolved per the diagnostic.

Where the proposal and diagnostic diverge, **the diagnostic wins**. The diagnostic has been cross-reviewed and patched (commit `66719d8`); the proposal may not yet be.

This document is the binding implementation contract for PR-49. Every commit on the PR-49 branch references this document. Phase boundaries, deletion lists, and verification checklists are non-negotiable. Cross-voice review (founder + ChatGPT + Claude Code) has locked the architecture; this document operationalizes it.

---

## 1. Objective

PR-49 collapses the local↔cloud reconciliation architecture introduced by PR-48 into a dual-mode persistence model. The user chooses **guest** or **authenticated** at the entry-point gate; the choice is binding for the draft lifetime. Guests use local autosave only; authenticated users use cloud-only with explicit "Save and Continue" clicks. Reconciliation, in any form, ceases to exist in the codebase. The two paths share no persistence code, no abstractions, no smart dispatchers, no compatibility helpers. This is enforced architecturally (§8 anti-patterns from the diagnostic) and structurally (separate hooks, separate handlers, separate endpoints, separate types).

---

## 2. Architectural Principles

These six principles are binding doctrine. Every line of code in PR-49 must be defensible against all six.

**P1 — Aggressively prefer deletion over adaptation.** When in doubt, delete and rewrite from scratch. Adaptation preserves complexity under a new name; deletion eliminates it. Reconciliation code does not get refactored — it gets removed.

**P2 — No reconciliation abstractions, ever — even "temporarily."** Per diagnostic §8: no generic persistence managers, no smart dispatchers, no mode-aware utilities, no compatibility APIs, no transitional flags. If a function/module/abstraction cannot be classified as guest-only or authenticated-only without reading its implementation, it is a reconciliation ghost. The reviewer test in diagnostic §8 is the gate.

**P3 — Unsaved-loss in authenticated mode is ACCEPTED behavior.** Per diagnostic §7.11. Do NOT introduce autosave-to-cloud as a mitigation. The future-proofing language must appear verbatim in the doctrine doc:

> In authenticated mode, the user is responsible for explicit Save and Continue clicks. Work between saves is in-memory only. If the tab crashes, the network fails, or the user closes the tab without saving, the in-memory work is lost. **This is the design.** Do not "fix" this by adding autosave. The trade-off was made to keep the architecture free of reconciliation, which has higher cost than occasional unsaved-loss.

**P4 — Guest recovery guarantees are explicit and limited.** Per diagnostic §6.Q9. Guests CAN recover via email delivery and Razorpay payment ID fallback. Guests CANNOT recover via in-app dashboard, multi-device, or post-tab-close in-memory state. These limits are intentional — anonymous purchases are anonymous.

**P5 — Mode determines persistence authority, not auth state.** Per FL-2 enforcement rule 3 (diagnostic §5.9). Any code path that infers mode from `user` alone — e.g., `user ? 'authenticated' : 'guest'` outside the ModeSelectionModal handler — is a doctrine violation. The reviewer must reject it on sight.

**P6 — Each phase must end in a compilable, runnable state.** No phase may leave the codebase in hybrid-authority territory mid-migration. `npm run build` must pass at every phase exit. Manual smoke tests per the verification checklist must pass at every phase exit.

### 2.1 Why reconciliation must not survive in abstraction form

The reconciliation modal is the visible failure of PR-48's multi-draft architecture. But the real danger to PR-49 is not reintroducing the modal — it's reintroducing reconciliation under a different abstraction. PR-49 succeeds only if guest and authenticated paths are brutally simple and barely know each other exists.

Diagnostic §8 enumerates eight forbidden patterns. The shared property: **they offer a single API surface that internally branches by mode.** This pattern feels reasonable to engineers raised on DRY, but it is the exact architectural shape that PR-48 collapsed under. The intuition that a single `usePersistence()` hook is "cleaner" than two separate hooks is wrong here — it concentrates the complexity at the abstraction boundary instead of eliminating it.

Concretely: a `usePersistence(mode)` hook that dispatches to local or cloud is a reconciliation ghost because:
- Future engineers will add cross-mode logic at the dispatcher boundary ("what if we just kept a backup...").
- The hook becomes the natural home for cross-mode migration code ("just one helper to claim guest content on sign-in...").
- The abstraction obscures whether a given consumer is guest-only or authenticated-only.

The cure is structural separation: `useGuestPersistence` and `useAuthenticatedPersistence` are two different hooks in two different files with no shared parent type. A reader can tell which is which at the import line. The reviewer test in diagnostic §8 enforces this at code-review time.

### 2.2 Accepted UX tradeoffs

The dual-mode architecture accepts specific UX costs in exchange for architectural simplicity. These are not bugs to be fixed in PR-49.A or PR-50 — they are the design.

**Authenticated mode:**
- Unsaved-loss between explicit Save clicks. Per P3 + diagnostic §7.11.
- The user is responsible for clicking Save and Continue. The system does not autosave to cloud.
- Permitted UX mitigations (per diagnostic §7.11): inline "unsaved changes" indicator (read-only signal), `window.onbeforeunload` warning, disabling step-advance while save is in-flight. No second storage authority.

**Guest mode:**
- No cross-device access. The draft is bound to the browser session's localStorage.
- No retrievable draft after browser data is cleared.
- No retrievable letter after the receipt email is lost AND the Razorpay payment ID is lost. Per P4 + diagnostic §6.Q9.

**Both modes:**
- No mid-flow mode switching. Per FL-1.
- A guest cannot become an authenticated user mid-draft, even on sign-in. The current draft stays guest-bound for its lifetime.

These tradeoffs are reaffirmed in §16 (Deferred Work / Explicitly Rejected Ideas) for traceability.

---

## 3. Locked Invariants

The proposal's seven invariants (I1–I7) and the four founder-locks (FL-1 through FL-4) are binding. Restated here so the strategy doc is self-contained.

### 3.1 Proposal invariants (proposal §3)

- **I1 —** The persistence mode is chosen exactly once, at "Create Your Letter" click, and is binding for the entire session/draft lifetime.
- **I2 —** The mode cannot change mid-flow. A guest cannot upgrade to authenticated without starting a new draft. An authenticated user cannot downgrade to guest.
- **I3 —** No sign-in prompt fires after the entry-point gate. The payment flow never asks the user to sign in. The guest's email-at-payment is a contact field, not an account.
- **I4 —** Local storage is touched only by the guest path. Cloud storage is touched only by the authenticated path. Neither path reads or writes the other's storage layer.
- **I5 —** There is no reconciliation logic in the codebase. No predicate compares local state to cloud state. No modal asks the user to choose between them.
- **I6 —** There is no migration logic from guest to authenticated. If implementation pressure ever surfaces a "let's just migrate guest content to cloud on sign-in" suggestion, this is forbidden.
- **I7 —** Each session has exactly one persistence authority. The authority is determined by the mode, not by some inference from auth state or local content.

### 3.2 Founder-locks (diagnostic §7.6)

- **FL-1 — Guest→authenticated upgrade is FORBIDDEN.** No mid-flow upgrade, no post-payment claim, no retroactive account attachment. Zero migration code in PR-49.
- **FL-2 — Mode-state mechanism is `sessionStorage`.** Single write site (ModeSelectionModal handler), read-only thereafter, survives refresh, auto-cleans on tab close. Full contract in §5 below.
- **FL-3 — Anonymous letter schema is a separate `anonymousLetters/` RTDB collection.** Keyed by Razorpay payment ID. Receiver flow looks up letters from BOTH `shared/` and `anonymousLetters/` via slug-to-record mapping. `MyLettersModal` only reads `shared/`.
- **FL-4 — Eidi is OUT OF SCOPE for PR-49.** Do not touch any Eidi code. The Eidi mid-flow sign-in prompt at `App.tsx:1667` stays untouched.

### 3.3 Why guest→authenticated migration is forbidden

The case for migration is intuitively strong: "the guest already typed a letter; they signed in afterward; let's just put their letter under their account." Every engineer who reads this for the first time wants to add it. Founder-lock FL-1 says no, and the reasoning is load-bearing.

**Migration reintroduces reconciliation.** The moment a code path reads guest local storage and writes authenticated cloud storage, you have two authorities in one flow. Even if the migration is "one-shot" and "irreversible," its existence:
- Creates the abstraction surface for "smart" routing decisions (which version do we keep if both exist?).
- Establishes a precedent that local↔cloud flow is possible "in special cases."
- Invites future engineers to extend the migration to cover edge cases (post-payment claim, multi-device merge, "lost work" recovery).

PR-48's multi-draft model collapsed for exactly this reason — every reconciliation modal was originally proposed as a "small helper for one specific edge case." The lock against migration is what prevents PR-49 from re-collapsing along the same trajectory.

**The accepted cost is real but small.** A guest who types a letter and then signs in mid-flow loses their typing — IF they don't complete the current draft as a guest first. The mode is locked at entry, so a user who knows they want an account signs in at entry. A user who started as a guest and changes their mind has two choices: (a) finish the current draft as a guest (the in-memory work continues), or (b) abandon the current draft and start over as authenticated. Neither option is migration. Both are honest.

**The structural alternative is unavailable.** "Just save the guest content to a transient collection and link it on sign-in" is migration. "Just keep the guest content in memory and offer to save it after sign-in" is migration. Every variant of "make it easier for the user who changed their mind" reintroduces the reconciliation surface that PR-49 exists to eliminate.

The lock is doctrinal, not pragmatic. It cannot be relaxed in a follow-up PR without re-litigating the architecture from first principles.

---

## 4. Explicit Non-Goals

PR-49 explicitly does NOT do the following. These are out of scope and the implementation phases must not touch them.

- **Eidi flow.** Per FL-4. Files at `pages/eidi/create.tsx`, `pages/eidi/receiver.tsx`, `components/EidPreparationForm.tsx`, `components/EidOrbitSelector.tsx`, `components/EidExperience.tsx`, `components/EidCountdown.tsx`, `components/EidiEnvelope.tsx`, `components/EidiShareCard.tsx`, and all `api/*-eidi.js` / `api/generate-eid-letter.js` / `api/claim-eidi.js` / `api/load-eidi.js` / `api/_create-eidi-backup.js` endpoints remain untouched. The Eidi mid-flow sign-in prompt at [`App.tsx:1667`](../../App.tsx:1667) stays untouched. `config/features.ts` Eidi gating remains as-is. **When Eidi is re-enabled for Eid 2027, dual-mode alignment becomes a separate follow-up PR.**
- **Receiver-side flow.** Diagnostic §7.2 confirmed it's clean. Files at `components/MainExperience.tsx`, `components/PersonalIntro.tsx`, `components/InteractiveQuestion.tsx`, `components/SharePackage.tsx`, `components/SoulmateSync.tsx`, `hooks/usePathLinkLoader.ts`, `hooks/useLinkLoader.ts`, `api/load-session.js`, `api/save-reply.js`, `api/letters/mark-opened.js` are receiver-side only. PR-49 modifies receiver-side ONLY for the dual-collection slug lookup in `api/load-session.js` (per FL-3); no other receiver-side change.
- **Razorpay webhook integration.** Per diagnostic §7.4. `api/razorpay-webhook.js` makes no user-context assumptions; anonymous letters work for it as-is.
- **Receiver URL TTL.** Deferred (not blocking PR-49). Existing permanence behavior survives unchanged. Anonymous and authenticated letters keep the same TTL semantics (none).
- **Test infrastructure.** No test runner exists; PR-49 does not introduce one. Smoke tests are manual per §13 below.
- **Bundle-size optimization.** ModeSelectionModal goes in the landing-page bundle (not lazy) per diagnostic §7.5. No other bundle changes.
- **`/api/admin/*` endpoints.** Admin tooling is unaffected.
- **`api/upload-media.js`.** Media flow is unchanged per proposal §5.4.
- **Founder-code redemption mechanics.** Already supports both modes per diagnostic §6.Q8. The UI is rendered identically in both modes; no mode-gating on the founder-code input.
- **CLAUDE.md content drift.** The pre-PR-47.1 stale reference at line 36 stays; out of scope (separate hygiene task).

Files NOT to modify (explicit out-of-scope perimeter):

```
pages/eidi/create.tsx
pages/eidi/receiver.tsx
components/EidPreparationForm.tsx
components/EidOrbitSelector.tsx
components/EidExperience.tsx
components/EidCountdown.tsx
components/EidiEnvelope.tsx
components/EidiShareCard.tsx
api/claim-eidi.js
api/load-eidi.js
api/generate-eid-letter.js
api/_create-eidi-backup.js
api/razorpay-webhook.js
api/upload-media.js
api/letters/mark-opened.js
api/save-reply.js
api/admin/*
components/PersonalIntro.tsx
components/InteractiveQuestion.tsx
components/SoulmateSync.tsx
hooks/usePathLinkLoader.ts
hooks/useLinkLoader.ts
config/features.ts
```

**`App.tsx` and `components/MainExperience.tsx` are partially modified — not in the NOT-to-modify perimeter.** Specifically:
- **`components/MainExperience.tsx`** — sender-side prop removal (`onSaveAndContinueLater` and its button) IS modified during PR-49 Phase C (per §8.1 Phase C rewrites). The receiver-side render path inside this same file (the read-only letter-presentation surface that receivers see) remains untouched.
- **`App.tsx`** — substantially rewritten in PR-49 Phase C (hydration effect, save handlers, Begin Again, reconciliation removal). The Eidi early-return block and its associated JSX (including the Eidi mid-flow sign-in prompt at the existing call site) remain untouched per FL-4.

Implementation phases must call out which lines they touch within these files to avoid spillover into the untouchable regions.

---

## 5. Final Mode Semantics

Per FL-2 (diagnostic §5.9), mode state lives in `sessionStorage`. This section is the binding contract for the mechanism.

### 5.1 Storage

`sessionStorage.setItem('vday_mode', 'guest' | 'authenticated')`.

No other key. No other storage layer for mode. Not localStorage (would survive across sessions and reintroduce migration questions). Not React Context (would diffuse the write surface).

### 5.2 Justification against I4

Proposal invariant I4 states: "Local storage is touched only by the guest path. Cloud storage is touched only by the authenticated path. Neither path reads or writes the other's storage layer."

`sessionStorage` is technically client-side storage. A strict reading of I4 might reject `sessionStorage` as a "violation" of guest-mode boundaries. This subsection makes the distinction explicit so future engineers do not re-litigate:

**`sessionStorage.vday_mode` is routing-decision metadata, not persistence state.**

- It does not store any draft content. It stores exactly one of two enum values: `'guest'` or `'authenticated'`.
- It is consulted to decide which persistence authority owns the current session. It is not itself a persistence authority.
- It is read by BOTH guest and authenticated paths (to dispatch the right code), which is exactly the kind of cross-path interaction I4 was designed to forbid for persistence — but mode dispatch is not persistence.
- It is the entry-point gate's output, not a state machine.

The distinction matters: I4 forbids storing draft content in two places. Mode metadata is not draft content. Refusing `sessionStorage` here on I4 grounds would force mode to be inferred from auth state, which violates P5.

If a future engineer reads `vday_mode` and adds another field next to it (e.g., `vday_mode_draftId`), that engineer is violating I4 — `sessionStorage` is not a draft-content store. The lock is on the schema: `vday_mode` is the only key, and its value is one of two enums.

### 5.3 Write site (exactly one)

ModeSelectionModal's "user chose this mode" handler. Concretely, the handler is triggered by exactly one of two buttons:
- "Continue with Google" — initiates `signInWithGoogle()` from `hooks/useAuth.ts`. On success, calls `setActiveMode('authenticated')` and dismisses the modal.
- "Continue as Guest" — calls `setActiveMode('guest')` and dismisses the modal.

No other code path writes `vday_mode`. This is enforced by code review per the reviewer test (§8 of the diagnostic). The setter helper `setActiveMode` lives in `utils/activeMode.ts` (new file, see §9).

### 5.4 Read sites (many)

All persistence-routing code reads `vday_mode` via `getActiveMode()` (new helper in `utils/activeMode.ts`). Concrete read sites:
- `App.tsx` hydration effect — reads mode FIRST, then dispatches.
- `App.tsx` Begin Again handlers — dispatches to mode-specific handler.
- `components/PreparationForm.tsx` mount — chooses whether to mount `usePreparationPersistence` (guest only).
- `components/PreparationForm.tsx` step buttons — chooses label ("Continue" vs "Save and Continue") and click handler.
- `components/RefineStage.tsx` — same as PreparationForm.
- `components/PaymentStage.tsx` — chooses whether to render the guest email field.
- `MyLettersModal` or successor — chooses whether to render the Drafts tab (authenticated only).

Each read site is a deliberate branch, not a shared dispatcher. The reviewer test applies: a reader of the code should be able to tell, at the branch site, which side is guest and which is authenticated.

### 5.5 Enforcement rules (the five rules from FL-2)

1. **Hydration reads mode FIRST.** The hydration effect's first action is `getActiveMode()`. Branching:
   - `mode === 'authenticated'` AND `user` signed in → load cloud draft via new `GET /api/draft` endpoint.
   - `mode === 'authenticated'` AND `user` NOT signed in → re-prompt sign-in (cloud draft unreachable without auth; mode is already locked; no fallback to guest).
   - `mode === 'guest'` → ignore `user` auth state entirely; defer to PreparationForm's local-resume flow.
   - `mode === undefined` → user has not entered the create flow yet; ModeSelectionModal will fire on Create click.

2. **Auth state changes after mode is set DO NOT change persistence path.** A guest who signs in mid-flow stays in guest mode for the current draft. The auth state can change; the persistence authority cannot.

3. **Forbidden pattern.** No code path may infer mode from `user` alone. Any condition of the form `user ? 'authenticated' : 'guest'` outside the ModeSelectionModal handler is a doctrine violation (per P5).

4. **Refresh behavior.** On refresh, mode survives in sessionStorage. Authenticated users get re-routed through their cloud draft (if still signed in) or sign-in re-prompt (if session expired). Guests resume from local storage.

5. **Tab close.** sessionStorage clears. A new tab requires a new mode decision at the entry-point gate. This matches the "session lifetime" semantics in invariant I1.

### 5.6 Signed-in user clicking "Create Your Letter"

Per proposal §6.Q6 recommendation (founder-confirmed): signed-in users SKIP the mode-selection gate and proceed directly to authenticated mode. The entry-point gate writes `setActiveMode('authenticated')` synchronously and proceeds to the form. If they really want guest mode, they sign out first.

This means the ModeSelectionModal renders ONLY when `useAuth.user === null` at "Create Your Letter" click time.

---

## 6. Draft Ontology Decisions

Per diagnostic §3.11 and §3.12.

### 6.1 `DraftState` — SURVIVES as business state

`DraftState` ('IN_PROGRESS' / 'GENERATED' / 'REFINED' / 'PREVIEWED' / 'READY_FOR_PAYMENT' / 'COMPLETED') describes the user's progress through the ceremonial flow. It is NOT persistence-lifecycle state; it is business state.

Under dual-mode all values survive for BOTH guest and authenticated paths. The semantics of `COMPLETED` get clarified: "letter has been sealed; ceremony complete; sender cannot edit." For authenticated users, this removes the letter from the Drafts tab. For guests, this just means the receiver URL is live.

`DraftState` type stays in [`types/draft.ts:16-22`](../../types/draft.ts:16). `DRAFT_STATE_ORDER` stays at `:30-37`. `isDraftState` typeguard stays at `:44-46`. `UI_STAGE_TO_DRAFT_STATE` map in [`hooks/draftStateLogic.ts`](../../hooks/draftStateLogic.ts) stays (already preserved by Commit 1 / L6 of PR-48.A).

### 6.2 `PersistenceStatus` — RETIRES entirely

Per diagnostic §1.7. The ACTIVE/PAUSED/ABANDONED state machine has no purpose under dual-mode. Each authenticated user has at most one cloud draft (it exists or doesn't); guests have no cloud draft.

Retires from: `types/draft.ts:24` (type), `:42` (`PERSISTENCE_STATUS_VALUES` set), `:48-50` (`isPersistenceStatus` typeguard), `:58` (`persistenceStatus` field on `DraftDocument`). Plus every consumer across `api/lib/draftValidation.js`, `api/verify-payment.js`, `api/drafts/save.js`, `App.tsx`, `utils/lifecycleDraft.ts`, `utils/saveDraft.ts`.

### 6.3 `draftId` — mode-specific, no cross-mode continuity

Per diagnostic §3.12.

- **Authenticated:** Firebase RTDB push key, cloud-assigned at first save. Same `draftId` for every save thereafter. At most one active `draftId` per user (I7).
- **Guest:** NO `draftId` concept. Local storage uses the fixed key `vday_data_draft` (no namespacing per FL-1). At most one local draft per browser session. No client-side ID generation.

The `StoredDraft.draftId` field, the `DraftPeek.draftId` field, and the `writeDraftId` helper in [`hooks/usePreparationPersistence.ts`](../../hooks/usePreparationPersistence.ts) RETIRE — they are cross-mode contamination per Focus 1 below.

### 6.4 `revision` — survives as audit counter; CAS plumbing retires

Per diagnostic §1.8.

- `revision` field on `DraftDocument` (types/draft.ts:65) — keep as monotonic write counter for server-side audit/debugging. Server still increments on each write.
- `expectedRevision` request validation in `api/drafts/save.js`, `api/lib/draftValidation.js`, `utils/saveDraft.ts` — RETIRES. No CAS check at write time. No `STALE_REVISION` response branch.
- `stale_revision` variant on `SaveDraftResult` — RETIRES.

Justification: CAS exists because two devices might concurrently edit the same cloud draft. Under dual-mode authenticated path, the user clicks "Save and Continue" — server overwrites. There is no concurrent-edit scenario to reconcile. The audit counter is a useful artifact; the CAS gate is not.

### 6.5 `expectedRevision` — RETIRES with CAS

See §6.4.

---

## 7. Deletion Plan

Organized by phase. All file:line anchors cite current HEAD (`66719d8`); line numbers are verified against the diagnostic.

### 7.1 Deletion targets (Phase C — atomic cutover)

**Reconciliation-modal components (3 files, ~389 LOC):**
- [`components/SignInReconciliationModal.tsx`](../../components/SignInReconciliationModal.tsx) — entire file (170 LOC). Per diagnostic §1.1, §3.1.
- [`components/StaleRevisionModal.tsx`](../../components/StaleRevisionModal.tsx) — entire file (109 LOC). Per diagnostic §1.4, §3.1.
- [`components/BeginNewPromptModal.tsx`](../../components/BeginNewPromptModal.tsx) — entire file (110 LOC). Per diagnostic §1.6, §3.1.

**Sign-in prompt modal:**
- [`components/SignInPromptModal.tsx`](../../components/SignInPromptModal.tsx) — entire file. Per diagnostic §1.5. The variants `'payment'` and `'persistence'` both retire. Mid-flow prompts disappear; guest email field moves to PaymentStage.

**App.tsx in-file deletions:**
- `App.tsx:81-83` — imports of `StaleRevisionModal`, `BeginNewPromptModal`, `SignInReconciliationModal`.
- `App.tsx:9` — import of `SignInPromptModal`.
- `App.tsx:80` — import of `pauseDraft`, `discardDraft` from `utils/lifecycleDraft`.
- `App.tsx:91-99` — `CloudDraftSnapshot`, `LocalDraftSnapshot` interfaces (diagnostic §3.5).
- `App.tsx:106` — `type ReconciliationState` union (diagnostic §3.5).
- `App.tsx:137` — `type HydrationResolutionState` (diagnostic §3.5).
- `App.tsx:450-457` — `showSignInPrompt` state, `pendingActionRef`, `pendingCancelRef` (diagnostic §3.5).
- `App.tsx:511-512` — `hydrationResolutionState` state (diagnostic §3.5).
- `App.tsx:514-528` — `runOrPromptSignIn` function (diagnostic §1.5).
- `App.tsx:528-571` — `commitPendingAction` function (diagnostic §3.5).
- `App.tsx:576-584` — deferred-action watcher useEffect (diagnostic §3.5).
- `App.tsx:587-592` — `cancelPendingAction` function.
- `App.tsx:641` — `reconciliation` state (diagnostic §3.5).
- `App.tsx:673-755` — `handleStaleRevisionReloadLatest`, `handleStaleRevisionKeepLocalForNow`, `handleStaleRevisionCancel` (diagnostic §1.4, §3.5).
- `App.tsx:772-922` — `prepFormResetKey` declaration + `beginNewInFlightRef` + `handleBeginAgainRequest` + `finalizeBeginNewLocalReset` + `handleBeginNewSaveAndStartNew` + `handleBeginNewDiscardAndStartNew` + `handleBeginNewCancel` (diagnostic §1.6, §3.5). `prepFormResetKey` may survive if remount-on-clear pattern stays useful; verify during implementation.
- `App.tsx:936` — `applyCloudActiveToState` function (diagnostic §1.1, §3.5).
- `App.tsx:955-967` — `handleSignInContinueDashboardDraft` + `handleSignInDiscardLocalDraft` (diagnostic §1.1, §3.5).
- `App.tsx:969-1100` — `handleSaveAndContinueLater` function (diagnostic §4.2). Replaced by mode-aware step-click save handlers.
- `App.tsx:1057-1075` — switch case `'stale_revision'` (diagnostic §1.4).
- `App.tsx:1078-1083` — switch case `'active_draft_exists'` (diagnostic §1.7).
- `App.tsx:1218-1252` — Case A/B split in hydration effect (diagnostic §1.1, §1.3, §3.5).
- `App.tsx:2175-2218` — render switch for `SignInPromptModal`, `BeginNewPromptModal`, `StaleRevisionModal`, `SignInReconciliationModal` (diagnostic §3.5).
- `App.tsx:1093` — `runOrPromptSignIn(action, 'persistence', ...)` call site in save flow.
- `App.tsx:2057` — `runOrPromptSignIn(() => safeSetStage(AppStage.PAYMENT))` call site in MainExperience `onPayment`. **NOTE:** the Eidi flow's call at `App.tsx:1667` is OUT OF SCOPE per FL-4 — that call site stays.

**Cross-mode contamination in `usePreparationPersistence.ts` (Focus 1):**
- `:23-28` — `draftId` field on `StoredDraft` interface (cross-mode contamination per diagnostic §3.12).
- `:204` — `draftId` field on `DraftPeek` type (diagnostic §3.12).
- `:235-238` — `readDraft()` parsing of `draftId` (diagnostic §3.12).
- `:259, :314, :351, :473` — every read-merge write that preserves `draftId` through localStorage round-trip.
- `:323-358` — entire `writeDraftId` exported helper (diagnostic §3.12).
- `:273` — `peekDraft()` return value's `draftId: null` field.

**Cross-mode contamination call sites in App.tsx:**
- `App.tsx:494` — `draftRecord` lazy initializer reads `peekDraft().draftId` (diagnostic §3.12).
- All `writeDraftId(...)` call sites in App.tsx (typically `:730`, `:789`, `:806`, etc.).

### 7.2 Deletion targets (Phase D — cleanup sweep)

**Lifecycle endpoint files (4 files, ~735 LOC):**
- [`api/drafts/pause.js`](../../api/drafts/pause.js) (162 LOC) — diagnostic §3.2.
- [`api/drafts/resume.js`](../../api/drafts/resume.js) (232 LOC) — diagnostic §3.2. Already zero-caller.
- [`api/drafts/discard.js`](../../api/drafts/discard.js) (144 LOC) — diagnostic §3.2.
- [`api/drafts/transition.js`](../../api/drafts/transition.js) (197 LOC) — diagnostic §3.3. Already zero-caller after Commit 1 of PR-48.A.

**Client lifecycle helper:**
- [`utils/lifecycleDraft.ts`](../../utils/lifecycleDraft.ts) (130 LOC) — diagnostic §3.4.

**`/api/drafts/list.js`:**
- Becomes orphan after Phase C wires authenticated hydration to `GET /api/draft`. Delete in Phase D.

**`types/draft.ts` retirement of PersistenceStatus:**
- `:24` — `export type PersistenceStatus = ...`
- `:42` — `PERSISTENCE_STATUS_VALUES` set
- `:48-50` — `isPersistenceStatus` typeguard
- `:58` — `persistenceStatus` field on `DraftDocument`

**`api/lib/draftValidation.js`:**
- `:77` — `PERSISTENCE_STATUS_VALUES` set (server-side mirror)
- `:138` — `persistenceStatus` enum validation branch in `validateDraftWrite`
- `:151+` — `validateExpectedRevision` helper (CAS retires)
- `:79-81` — `isPersistenceStatus` helper (if present)

**`api/drafts/save.js` trims:**
- `:151-185` — UPDATE-path revision check (`STALE_REVISION` / `INVALID_REVISION` abort blocks)
- `:228-238` — single-ACTIVE invariant block (`existingActive` check), since `persistenceStatus` retires
- `:245, :260` — any other `persistenceStatus` reads/writes
- All `expectedRevision` parameter handling

**`utils/saveDraft.ts` narrowing:**
- `:23, :55` — `expectedRevision` field on `SaveDraftInput`
- `:111-118` — `stale_revision` result variant + 409 branch
- The `active_draft_exists` variant (single-ACTIVE check retires)

**`api/verify-payment.js`:**
- `:55-87` `markActiveDraftCompleted` helper — REWRITE per Focus 5, not delete. See §8 below.

### 7.3 Doc archival (Phase E)

- [`docs/contracts/active-paused-state-machine.md`](../../docs/contracts/active-paused-state-machine.md) → `docs/archived/2026-05-12-active-paused-state-machine.md`. Per diagnostic §3.9.
- [`docs/diagnostics/2026-05-12-multi-draft-cloud-sync.md`](../../docs/diagnostics/2026-05-12-multi-draft-cloud-sync.md) → `docs/archived/2026-05-12-multi-draft-cloud-sync.md`. Per diagnostic §3.9.

---

## 8. Rewrite Plan

Per diagnostic §4. Organized by phase.

### 8.1 Rewrites (Phase C — atomic cutover)

**`App.tsx` hydration effect (~180 LOC rewrite):**
- Current: `App.tsx:1110-1290` reads `getDraftMetadata`, fetches `/api/drafts/list`, branches into Case A/B reconciliation.
- New: read `getActiveMode()` first; branch by mode per §5.5. Authenticated → fetch `GET /api/draft` (new endpoint). Guest → no cloud fetch; PreparationForm's local-resume flow handles it. No mode → defer; ModeSelectionModal fires on Create click.
- Per diagnostic §4.1.

**`App.tsx` save handler (rewrite of `handleSaveAndContinueLater`):**
- Current: `App.tsx:969-1100` wraps the save in `runOrPromptSignIn`, switches on multiple result kinds.
- New: NOT a "Save and Continue Later" floating affordance. Becomes the authenticated-mode step-advance handler. Each step button click in authenticated mode calls a new handler that saves to cloud, awaits success, then advances. On error: inline error, no advance. No modal. Guest mode has no save handler — `next()` from `usePreparationState` advances directly; autosave debounce writes localStorage.
- Per diagnostic §4.2.

**`App.tsx` Begin Again handlers (rewrite):**
- Current: `App.tsx:776-922` mixes local-clear and cloud-call semantics across multi-button modal flow.
- New: TWO separate functions — `handleGuestBeginAgain` (calls `clearPreparationDraft` + resets local state) and `handleAuthenticatedBeginAgain` (calls `DELETE /api/draft` then resets). The Begin Again trigger reads mode and dispatches. No modal between — confirmation can be inline (e.g., a confirm dialog via the existing DraftResumeModal's "Begin again" confirm pattern at `components/DraftResumeModal.tsx:111`).
- Per diagnostic §1.6, §4.

**`components/PreparationForm.tsx`:**
- Step button labels become mode-aware. `:492, :497, :500, :908, :913, :916, :1167` — render "Continue" for guest mode, "Save and Continue" for authenticated mode. The click handler branches.
- `:155` — `usePreparationPersistence(data, step)` mounts ONLY when `mode === 'guest'`. Authenticated mode does not call this hook (or passes `enabled: false`).
- Per diagnostic §4.3, §4.11.

**`components/RefineStage.tsx`:**
- `:8, :17, :28, :327, :350` — `onSaveAndContinueLater` prop and its rendering. For dual-mode: render "Save and Continue" button only for authenticated mode; click handler is the mode-specific save handler.
- Per diagnostic §4.4.

**`components/MainExperience.tsx`:**
- `:38, :99, :829` — REMOVE the `onSaveAndContinueLater` prop and its button entirely. Preview Experience is read-only in both modes per proposal §2.2 and §2.3.
- Per diagnostic §4.5.

**`components/PaymentStage.tsx`:**
- `:13, :48` — `guestEmail` prop changes from "optional, passed in from SignInPromptModal" to "captured inline as part of the form when mode === 'guest'."
- ADD email input field with validation, conditional on `mode === 'guest'`.
- Email validation logic — lift `isValidEmailShape()` from `components/SignInPromptModal.tsx:21` to a shared util (e.g., `utils/emailValidation.ts`) before deleting `SignInPromptModal`.
- Per diagnostic §4.6.

**`api/verify-payment.js`:**
- `:55-87` `markActiveDraftCompleted` rewrite per Focus 5. Drop the `persistenceStatus === 'ACTIVE'` filter; keep the `draftState: 'COMPLETED'` write semantic. Find the user's one cloud draft (no status filter) and mark it COMPLETED. If no draft found (e.g., authenticated user paid from a fresh cloud-draftless state — edge case), the function is a no-op.
- `:380-432` (founder path) and `:660-740` (Razorpay path) — branch on `mode` (sent from client in the payment-verify request, OR derived from presence/absence of `senderUid`). Write to `shared/${sessionKey}` for authenticated mode (existing behavior); write to `anonymousLetters/${paymentId}` for guest mode (new path). Capture guest email for `sendLetterSealedEmail`.
- Per diagnostic §4.7, §7.8, §7.9.

**`hooks/usePreparationPersistence.ts`:**
- Cross-mode contamination removal per §7.1 deletion list and Focus 1.
- The hook itself survives unchanged at the autosave-debounce level. Only the `draftId`/`writeDraftId` surface retires.
- Per diagnostic §3.12, §4.11.

**`components/LandingPage.tsx`:**
- `:124-149` — "Create Your Letter" click currently advances directly. New: opens ModeSelectionModal when `useAuth.user === null`; auto-sets `setActiveMode('authenticated')` and proceeds when signed in.
- Per diagnostic §4.13.

**`api/load-session.js` slug resolution (FL-3 dual-collection lookup, Focus 3) — LOCKED.**

Guest receiver URLs use the SAME outward URL shape as authenticated letters. The shape is `/v/<slug>` (or the existing equivalent — implementation preserves the current receiver-URL shape; this decision is about backend resolution, not URL surface).

The receiver flow resolves via a TWO-STAGE lookup:

**Authenticated path:**
1. Check `shared/{slug}`.
2. If found → return authenticated letter.

**Guest path fallback (only fires if stage 1 returns null):**
1. Check `anonymousSlugs/{slug}`.
2. Resolve `{ paymentId }` from the lookup record.
3. Load `anonymousLetters/{paymentId}`.
4. Return anonymous letter.

**Required RTDB structure:**

```
shared/{slug}                            // existing authenticated letter record
anonymousSlugs/{slug} -> { paymentId, createdAt }   // new slug→paymentId index
anonymousLetters/{paymentId}             // new anonymous letter record
```

**Doctrinal reasoning:**
- Maintains one canonical outward receiver URL shape across both modes.
- Prevents URL-shape leakage of anonymous vs authenticated origin (a receiver cannot tell from the URL whether the sender was a guest).
- Keeps guest records detached from user identity (no `senderUid` field; keyed only by `paymentId`).
- Makes receiver lookup deterministic (two-stage, both stages are constant-time RTDB reads).
- Preserves FL-3's separate-collection doctrine.
- Avoids hybrid key semantics (no per-record discriminator field; collection membership IS the discriminator).

**Implementation requirement.** `api/load-session.js` MUST:
1. Check `shared/{slug}` first.
2. Fall through to `anonymousSlugs/{slug}`.
3. Resolve to `anonymousLetters/{paymentId}`.
4. Return 404 only after BOTH lookups fail.

**No alternative slug architectures are permitted in implementation.** This is locked. Implementer judgment does not apply to the slug-resolution shape; only to incidental details (e.g., field naming conventions inside the records). If implementation pressure surfaces a variant ("just put a `mode` flag on `shared/`," "just use one collection with a discriminator"), the answer is NO — the doctrinal reasoning above applies.

**`api/letters/list.js`:**
- No changes per diagnostic §4.8. Already auth-gated and per-user. Anonymous letters do not appear here by design.

### 8.2 Rewrites (Phase E — doctrine)

- `docs/doctrine/local-persistence-contract.md §6.5` — rewrite to describe guest-mode-only local persistence. Remove multi-draft state machine references (lines 85-136). Per diagnostic §3.10.

---

## 9. Addition Plan

Per diagnostic §5. Organized by phase.

### 9.1 Additions (Phase A — mode entry primitive)

**New file: `utils/activeMode.ts`** (~25 LOC):
- Exports `type ActiveMode = 'guest' | 'authenticated';`
- Exports `getActiveMode(): ActiveMode | null` — reads `sessionStorage.vday_mode`, returns null if unset or invalid.
- Exports `setActiveMode(mode: ActiveMode): void` — writes `sessionStorage.vday_mode`.
- Per FL-2 + diagnostic §5.9.

**New file: `components/ModeSelectionModal.tsx`** (~80 LOC):
- Renders proposal §2.1 copy (the two-button modal).
- Props: `isOpen`, `onChosen: (mode: ActiveMode) => void`, `onSignIn: () => Promise<User>`.
- "Continue with Google" → calls `useAuth.signInWithGoogle()`, then `setActiveMode('authenticated')` + `onChosen('authenticated')`.
- "Continue as Guest" → `setActiveMode('guest')` + `onChosen('guest')`.
- Per diagnostic §5.1 + proposal §2.1.

**Modified: `components/LandingPage.tsx`:**
- "Create Your Letter" click: if `useAuth.user` is signed in, call `setActiveMode('authenticated')` and proceed; else open ModeSelectionModal.
- The ModeSelectionModal handles the rest.

**Bundle-size note (diagnostic §7.5):** ModeSelectionModal ships in the landing-page bundle (NOT lazy). The modal is on the critical interaction path; lazy-loading would add a code-split delay between Create click and modal render.

### 9.2 Additions (Phase B — new endpoints)

**New endpoint: `GET /api/draft`** (~50 LOC):
- New file: `api/draft.js` (singular noun per proposal §9.3).
- Auth-gated via `getSessionUser`.
- Reads `users/${user.uid}/drafts`; returns the user's one cloud draft (or 404 if none).
- Rate-limited per existing middleware.
- Response shape: `{ data, draftState, createdAt, updatedAt, draftId }` (no `persistenceStatus`, no `revision` in response — though `revision` may stay as audit field on the document).
- If multiple drafts exist (legacy data from PR-48 testing), return the chronologically newest by `updatedAt`. Log a warn for triage; do not 500.

**New endpoint: `DELETE /api/draft`** (~40 LOC):
- New file: same file as above OR new `api/draft.js` handling both verbs.
- Auth-gated.
- Deletes `users/${user.uid}/drafts/${draftId}` for the user's one cloud draft. If multiple exist, delete all (sweep). Idempotent: 200 OK even if no draft exists.
- NO `expectedRevision` parameter. NO CAS check. Single-writer model.

### 9.3 Additions (Phase C — atomic cutover)

**New helper: `utils/cloudDraftSave.ts`** (~60 LOC) — authenticated-mode-only save flow:
- Exports `saveAndContinue({ data, draftState, step? }): Promise<SaveResult>`.
- Wraps `POST /api/drafts/save` (existing endpoint, simplified after Phase D).
- Result shape: `{ kind: 'ok', draftId, updatedAt } | { kind: 'error', message }`.
- Authenticated-mode-only. NO mode parameter. NO branching.
- Per diagnostic §8 anti-patterns: this is a separate helper from guest persistence, NOT a shared dispatcher.

**Authenticated Begin Again handler:**
- New function in App.tsx: `handleAuthenticatedBeginAgain` — calls `DELETE /api/draft`, then resets App-level draft state.
- Per diagnostic §5.6.

**Guest Begin Again handler:**
- New function in App.tsx: `handleGuestBeginAgain` — calls `clearPreparationDraft()`, bumps `prepFormResetKey` (if preserved), resets local state.
- Per diagnostic §5.6.

**RTDB: `anonymousLetters/{paymentId}` schema** (FL-3, Focus 3):
- New collection. Same content shape as `shared/{sessionKey}` minus `senderUid` and any user-link fields.
- Server-side write in `api/verify-payment.js` when `mode === 'guest'` (or `senderUid === null`).
- Slug mapping mechanism per §8.1 above.

**Email validation utility:**
- New file: `utils/emailValidation.ts` (~10 LOC) — lifts `isValidEmailShape` from `SignInPromptModal.tsx:21` before that file is deleted.

### 9.4 Additions (Phase C addendum — MyLettersModal Drafts tab)

- New tab in `components/MyLettersModal.tsx` (or new sibling component): "Drafts" — shows the authenticated user's one cloud draft (or empty state).
- Fetches via new `GET /api/draft`.
- Click → resume the draft (load `data` into App, advance to PREPARE or whichever stage `draftState` indicates).
- Per diagnostic §4.9.

### 9.5 Additions (Phase E — doctrine)

**New file: `docs/doctrine/dual-mode-persistence.md`:**
- Codifies proposal §3 invariants + §8 anti-patterns + accepted UX tradeoffs (P3, P4).
- References this strategy doc for sequencing.
- Includes the verbatim future-proofing language from §2 (P3) of this doc.

**Update: `README.md`:**
- Reflect PR-49 completion. Update "Current architecture direction" section to mark dual-mode as shipped. Update Important Docs list (remove "(superseded)" markers on the now-historical PR-48.A docs; keep them as historical artifacts).

---

## 10. Implementation Phases

Five phases. Each ends in a compilable, runnable state. Each phase has explicit dependency justification.

### Phase A — Mode entry primitive (additive only)

**Why first:** Phase A introduces the new mode mechanism in DORMANT form. No existing persistence-routing code reads `getActiveMode()` yet. The new code can land, be reviewed, and be deployed without changing user behavior. This isolates the new primitive's correctness from the bigger cutover in Phase C.

**Files deleted:** none.

**Files rewritten:**
- `components/LandingPage.tsx` — "Create Your Letter" click branches by `useAuth.user`; opens ModeSelectionModal for signed-out users, calls `setActiveMode('authenticated')` for signed-in users.

**Files added:**
- `utils/activeMode.ts`
- `components/ModeSelectionModal.tsx`

**Invariants protected:** I1 (mode chosen at entry), FL-2 (sessionStorage mechanism).

**Smoke tests required:**
1. Open landing as signed-out user, click "Create Your Letter" → ModeSelectionModal appears.
2. Choose "Continue as Guest" → `sessionStorage.vday_mode === 'guest'`. App proceeds to existing flow (no behavior change).
3. Choose "Continue with Google" → sign-in flow runs; on success, `sessionStorage.vday_mode === 'authenticated'`. App proceeds.
4. Open landing as signed-in user, click "Create Your Letter" → ModeSelectionModal does NOT appear. `sessionStorage.vday_mode === 'authenticated'`. App proceeds.
5. Refresh tab mid-session → `sessionStorage.vday_mode` survives.
6. Close tab, open new tab → `sessionStorage.vday_mode` is null. New mode-selection required.
7. `npm run build` passes.

**Exit criteria:**
- All smoke tests pass.
- No regression in existing reconciliation flow (it still runs; just no longer the only entry path).
- `npm run build` exits 0.

### Phase B — Add authenticated-mode endpoints (additive only)

**Why between A and C:** Phase B adds `GET /api/draft` and `DELETE /api/draft` endpoints in DORMANT form. They exist on the server but no client code calls them yet. This isolates the endpoint correctness from the Phase C client cutover. The endpoints can be manually tested (curl/Postman) before any client code depends on them.

**Files deleted:** none.

**Files added:**
- `api/draft.js` (handles both `GET /api/draft` and `DELETE /api/draft`).

**Files rewritten:** none.

**Invariants protected:** I7 (one persistence authority per session — these endpoints serve only the authenticated path).

**Smoke tests required:**
1. Signed-in user with a cloud draft → `curl -X GET /api/draft` returns the draft.
2. Signed-in user with no cloud draft → `curl -X GET /api/draft` returns 404.
3. Signed-out user → `curl -X GET /api/draft` returns 401.
4. Signed-in user with a cloud draft → `curl -X DELETE /api/draft` removes the draft; subsequent GET returns 404.
5. Signed-in user with multiple legacy drafts (PR-48 test data) → `DELETE /api/draft` removes all; warn logged for triage.
6. `npm run build` passes.

**Exit criteria:**
- All smoke tests pass.
- No client code references the new endpoints yet.
- `npm run build` exits 0.

### Phase C — Atomic cutover (the big phase)

**Why atomic:** The reconciliation surfaces are structurally coupled. Hydration depends on save; save depends on mid-flow sign-in prompts being gone; mid-flow prompt removal depends on PaymentStage email field being in place; PaymentStage email field depends on anonymous-letter record write; anonymous-letter write depends on slug-resolution. Splitting Phase C into sub-phases produces hybrid states that violate P6. Each sub-piece individually breaks the app. **Phase C is atomic by structural necessity, not by preference.**

**Why after Phase B:** Phase C wires authenticated hydration to `GET /api/draft` (added in Phase B) and authenticated Begin Again to `DELETE /api/draft` (added in Phase B). Without Phase B, Phase C would mix endpoint addition with client cutover — failure modes would conflate.

**Files deleted (entire files):**
- `components/SignInReconciliationModal.tsx`
- `components/StaleRevisionModal.tsx`
- `components/BeginNewPromptModal.tsx`
- `components/SignInPromptModal.tsx`

**Files rewritten (substantial):**
- `App.tsx` — large rewrite covering hydration, save handlers, Begin Again, reconciliation removal, mid-flow prompt removal, mode-aware dispatch. See §7.1 and §8.1 for the full line list.
- `components/PreparationForm.tsx` — mode-aware step button labels, mode-conditional `usePreparationPersistence` mount, mode-aware Begin Again wiring.
- `components/RefineStage.tsx` — mode-aware Save and Continue button (authenticated only).
- `components/MainExperience.tsx` — remove save button entirely (sender-side Preview Experience is read-only in both modes).
- `components/PaymentStage.tsx` — add inline guest email field, conditional on mode.
- `components/LandingPage.tsx` — no further changes from Phase A (already touched).
- `components/MyLettersModal.tsx` — add Drafts tab (authenticated only).
- `hooks/usePreparationPersistence.ts` — remove `draftId` field + `writeDraftId` helper (cross-mode contamination cleanup, Focus 1).
- `api/verify-payment.js` — rewrite `markActiveDraftCompleted` (Focus 5); branch payment-completion write on mode (write to `shared/` or `anonymousLetters/`); capture guest email for `sendLetterSealedEmail`.
- `api/load-session.js` — dual-collection slug resolution (Focus 3).

**Files added:**
- `utils/cloudDraftSave.ts`
- `utils/emailValidation.ts`

**Invariants protected:** I1, I2, I3, I4, I5, I6, I7 (all). FL-1, FL-2, FL-3 (all enforced). FL-4 (untouched — Eidi files not modified).

**Smoke tests required:** the full §13 checklist runs after Phase C. Critical subsets:
1. **Guest E2E:** open landing as guest, choose guest, type a letter, navigate through all stages, pay with email field, verify receiver URL email arrives.
2. **Authenticated E2E:** sign in, choose authenticated (auto), type a letter, click "Save and Continue" at each step, refresh mid-flow, verify cloud draft resumes, pay, verify letter appears in Sent dashboard.
3. **No reconciliation surfaces:** grep confirms zero matches for `SignInReconciliationModal`, `StaleRevisionModal`, `BeginNewPromptModal`, `SignInPromptModal`, `runOrPromptSignIn`, `ReconciliationState`, `HydrationResolutionState`, `applyCloudActiveToState`, `handleStaleRevisionReloadLatest`, etc.
4. **Cross-mode contamination removed:** grep confirms zero matches for `writeDraftId` and `draftId` in `hooks/usePreparationPersistence.ts`.
5. **Mid-flow sign-in prompts gone:** grep confirms zero matches for `runOrPromptSignIn` call sites in App.tsx EXCEPT the Eidi flow's call at `App.tsx:1667` (FL-4 untouched).
6. **`npm run build` passes.**

**Exit criteria:**
- All smoke tests pass.
- No reconciliation surface remains in the codebase (modal files, handlers, state machines, prompt machinery).
- Guest and authenticated paths run end-to-end via mode-aware dispatch.
- `npm run build` exits 0.

#### Internal execution buckets (non-deploy boundaries)

Phase C is too large for one uninterrupted reasoning block. Implementation proceeds through four execution buckets in the order C1 → C2 → C3 → C4. **These are NOT independently shippable phases. They are implementation-order buckets INSIDE the atomic cutover.** The codebase may be temporarily unstable between buckets during implementation work on the branch. Only the FULL completion of Phase C (all four buckets) restores the "compilable/runnable" guarantee.

Treating a bucket as a deploy boundary is a doctrine violation. The "each phase ends runnable" guarantee in §12 applies at phase boundaries only — not at bucket boundaries.

**C1 — Persistence routing rewrite**
- App.tsx hydration effect rewrite (mode-aware dispatch reading `getActiveMode()` first).
- App.tsx Begin Again rewrite (two separate handlers: `handleGuestBeginAgain`, `handleAuthenticatedBeginAgain`).
- Removal of `runOrPromptSignIn` flow + `pendingActionRef` + `commitPendingAction` + the deferred-action watcher effect.
- Removal of `HydrationResolutionState` machine and all its consumers.

**C2 — Form-stage rewrite**
- `components/PreparationForm.tsx` — mode-aware step button labels ("Continue" vs "Save and Continue"); mode-conditional `usePreparationPersistence` mount; mode-aware Begin Again wiring.
- `components/RefineStage.tsx` — mode-aware Save and Continue button (authenticated only).
- `components/MainExperience.tsx` — remove sender-side `onSaveAndContinueLater` prop and button.
- `components/PaymentStage.tsx` — add inline guest email field conditional on mode.
- Authenticated Save-and-Continue semantics: each step click commits to cloud, awaits success, advances.
- Guest autosave-only semantics: `next()` from `usePreparationState` advances; autosave debounce writes localStorage.

**C3 — Anonymous-letter infrastructure**
- `api/verify-payment.js` mode branching: write to `shared/{slug}` for authenticated, `anonymousLetters/{paymentId}` + `anonymousSlugs/{slug}` for guest. Per §8.1 locked architecture.
- New collections `anonymousLetters/` and `anonymousSlugs/` schema established at write time.
- `api/load-session.js` dual-collection lookup (two-stage per §8.1).
- Guest email captured at PaymentStage flows through to `sendLetterSealedEmail`.

**C4 — Reconciliation surface destruction**
- Delete `components/SignInReconciliationModal.tsx`, `components/StaleRevisionModal.tsx`, `components/BeginNewPromptModal.tsx`, `components/SignInPromptModal.tsx`.
- Delete the stale-revision flow (already in C1's removals, but `StaleRevisionModal.tsx` deletion lands here).
- Delete the BeginNew prompt flow (modal file deletion).
- Remove all App.tsx reconciliation state + types + handlers + render switch entries (`ReconciliationState` union, `reconciliation` state, `setReconciliation`, `applyCloudActiveToState`, `handleSignInContinueDashboardDraft`, `handleSignInDiscardLocalDraft`, `handleStaleRevision*` handlers, `handleBeginNew*` handlers, `finalizeBeginNewLocalReset`, `beginNewInFlightRef`, `CloudDraftSnapshot`, `LocalDraftSnapshot` interfaces).
- Remove App.tsx cross-mode contamination call sites (`writeDraftId` calls, `peekDraft().draftId` read in `draftRecord` lazy initializer).

**Bucket ordering rationale (not for re-ordering):**
- C1 first because the persistence-routing rewrite is the structural anchor everything else depends on. Without mode-aware dispatch, the form-stage rewrites have nothing to branch against.
- C2 next because step-click save handlers (added in C2) are the authenticated path's runtime payload of C1's dispatch.
- C3 next because guest payment depends on the inline email field (C2's PaymentStage change) and the anonymous-letter write path needs to be live before the guest E2E can complete.
- C4 last because the reconciliation surfaces are the last thing to delete — earlier buckets reduce them to zero callers; C4 removes the now-dead code. Reversing this order would leave call sites pointing at deleted files.

### Phase D — Cleanup sweep (orphan deletions + type narrowing)

**Why after Phase C:** Phase D deletes endpoints and types that became zero-caller in Phase C. Running Phase D before Phase C would 404 live flows. Running it after means each deletion has zero consumers — clean, mechanical.

**Files deleted:**
- `api/drafts/pause.js`
- `api/drafts/resume.js`
- `api/drafts/discard.js`
- `api/drafts/transition.js`
- `api/drafts/list.js` (orphan after Phase C)
- `utils/lifecycleDraft.ts`

**Files rewritten (small trims):**
- `types/draft.ts` — retire `PersistenceStatus` type, typeguard, and `persistenceStatus` field on `DraftDocument`.
- `api/lib/draftValidation.js` — retire `PERSISTENCE_STATUS_VALUES`, `isPersistenceStatus`, `persistenceStatus` validation branch, `validateExpectedRevision`.
- `api/drafts/save.js` — retire CAS plumbing (revision check, STALE_REVISION abort), retire single-ACTIVE invariant block.
- `utils/saveDraft.ts` — narrow `SaveDraftResult` (remove `stale_revision`, `active_draft_exists` variants), remove `expectedRevision` field from `SaveDraftInput`.

**Files added:** none.

**Invariants protected:** all (Phase C already established them; Phase D removes their unused predecessors).

**Smoke tests required:**
1. Re-run Phase C smoke tests 1–6. All still pass.
2. Grep confirms zero matches for `PersistenceStatus`, `pauseDraft`, `discardDraft`, `expectedRevision`, `STALE_REVISION`, `lifecycleDraft`, `api/drafts/pause`, `api/drafts/resume`, `api/drafts/discard`, `api/drafts/transition`, `api/drafts/list`.
3. `npm run build` passes.

**Exit criteria:**
- All smoke tests pass.
- Zero matches for the retired symbols.
- `npm run build` exits 0.

### Phase E — Doctrine + archival

**Why last:** Doctrine documents the architecture as shipped. Writing them before Phase D risks drift between doc and code if Phase C/D shape changes during implementation. Doctrine after code lock means the doctrine reflects reality.

**Files moved:**
- `docs/contracts/active-paused-state-machine.md` → `docs/archived/2026-05-12-active-paused-state-machine.md` with prepended status note.
- `docs/diagnostics/2026-05-12-multi-draft-cloud-sync.md` → `docs/archived/2026-05-12-multi-draft-cloud-sync.md` with prepended status note.

**Files rewritten:**
- `docs/doctrine/local-persistence-contract.md` — rewrite §6.5 (lines 85-136) to describe guest-mode-only local persistence under dual-mode. Per diagnostic §3.10.
- `README.md` — update "Current architecture direction" to mark dual-mode as shipped.

**Files added:**
- `docs/doctrine/dual-mode-persistence.md` — codified version of proposal §3 + §8 + this strategy's P1–P6. Includes verbatim future-proofing language from §2 (P3).

**Files deleted:** none.

**Invariants protected:** all (doctrine reaffirms them).

**Smoke tests required:**
1. All Phase D smoke tests still pass.
2. Doctrine doc cross-references resolve.
3. README "Current architecture direction" matches code reality.

**Exit criteria:**
- All smoke tests pass.
- Doctrine + README + archived docs reflect the new architecture.
- `npm run build` exits 0.

---

## 11. Sequencing Constraints

The five phases are strictly ordered. None are interchangeable. The dependency graph:

```
Phase A (mode entry primitive)
  ↓ Phase A's sessionStorage helpers are read by Phase C client code.
  ↓ Phase A's ModeSelectionModal is the user's entry to mode choice.
  ↓
Phase B (new endpoints, additive)
  ↓ Phase B's GET /api/draft is called by Phase C's hydration rewrite.
  ↓ Phase B's DELETE /api/draft is called by Phase C's Begin Again handler.
  ↓ Phase B can land independently because endpoints are dormant; no client deps yet.
  ↓
Phase C (atomic cutover)
  ↓ Phase C makes the new endpoints live and retires the old reconciliation surfaces.
  ↓ Phase C is atomic — cannot be split without producing hybrid states.
  ↓ After Phase C, lifecycle endpoints (pause/resume/discard) have zero callers.
  ↓
Phase D (cleanup sweep)
  ↓ Phase D deletes zero-caller endpoints and retires types.
  ↓ Mechanical; relies on Phase C having migrated all callers.
  ↓
Phase E (doctrine + archival)
  ↓ Phase E documents the shipped architecture.
  ↓ Last because doctrine should reflect locked code, not in-flight code.
```

**Parallelism possible within phases:** within Phase A, the two new files (`utils/activeMode.ts` and `components/ModeSelectionModal.tsx`) can be authored in parallel since they have no inter-dependency. Within Phase D, the four `api/drafts/*.js` deletions can be done in any order. Within Phase E, doctrine rewriting and archival can be done in parallel.

**Parallelism FORBIDDEN across phases:** no work on Phase D can begin before Phase C is complete. The temptation to "delete pause.js early" must be resisted — until Phase C migrates the `pauseDraft` callers, deleting `pause.js` breaks compile.

---

## 12. Migration Safety Rules

Per P6, every phase must end in a compilable, runnable state. This section makes the rule operational.

1. **`npm run build` passes at every phase exit.** Non-negotiable. If `tsc` reports an error, the phase is not done.
2. **No phase introduces transient hybrid persistence authority.** A user opening the app mid-deploy never sees a state where both local-cloud reconciliation and dual-mode coexist. (This is why Phase C is atomic.)
3. **No phase relies on a deferred-followup commit.** "We'll fix this in Phase D" is forbidden if it leaves Phase C broken. Each phase stands alone.
4. **Smoke tests run at every phase exit.** Per §13.
5. **No `--no-verify` or similar commit-hook bypass.** The standing repo discipline applies.
6. **Only COMPLETED phase boundaries are rollback-safe.** Intermediate commits INSIDE a phase — especially intermediate commits inside Phase C's internal execution buckets (C1, C2, C3, C4) — are NOT guaranteed to be compilable, runnable, deployable, or revert-safe in isolation. The "each phase ends runnable" guarantee applies ONLY at:
   - End of Phase A
   - End of Phase B
   - End of **full Phase C** (all four internal buckets complete)
   - End of Phase D
   - End of Phase E
   It does NOT apply between internal execution buckets within a phase. `git revert` of a bucket-internal commit is undefined behavior; revert ONLY at phase boundaries (or revert the squashed Phase C merge as a whole).
7. **Doc-only commits are separable.** Phase E commits do not touch application code; they can land independently of Phase D's cleanup if scheduling requires.
8. **No application-code changes inside doc commits.** And vice versa. Mixing the two confuses review and rollback.

---

## 13. Manual Verification Checklist

Founder runs these after each phase exit. Manual smoke tests are the only verification — no test runner exists.

### Phase A checklist
- [ ] Signed-out user, fresh tab → click "Create Your Letter" → ModeSelectionModal appears.
- [ ] "Continue as Guest" → modal dismisses; `sessionStorage.vday_mode === 'guest'`; app proceeds to existing PREPARE flow.
- [ ] "Continue with Google" → Google sign-in popup → on success, modal dismisses; `sessionStorage.vday_mode === 'authenticated'`; app proceeds.
- [ ] Signed-in user → click "Create Your Letter" → ModeSelectionModal does NOT appear; `sessionStorage.vday_mode === 'authenticated'` immediately.
- [ ] Tab refresh → `vday_mode` survives.
- [ ] Tab close → new tab does NOT have `vday_mode`.
- [ ] `npm run build` exits 0.

### Phase B checklist
- [ ] `GET /api/draft` with signed-in user + existing cloud draft → 200 with draft body.
- [ ] `GET /api/draft` with signed-in user + no draft → 404.
- [ ] `GET /api/draft` with signed-out user → 401.
- [ ] `DELETE /api/draft` with signed-in user + existing draft → 200; subsequent GET returns 404.
- [ ] `DELETE /api/draft` with signed-in user + no draft → 200 (idempotent).
- [ ] `npm run build` exits 0.

### Phase C checklist (the heavy phase)
- [ ] **Guest path E2E:** new tab → "Create Your Letter" → "Continue as Guest" → fill PREPARE form → step buttons say "Continue" → advance to REFINE → AI draft generates → continue to preview → no Save button in preview → continue to PAYMENT → email field is rendered and required → enter email → pay → receiver URL appears → check inbox: receipt + receiver URL email received from Resend.
- [ ] **Authenticated path E2E:** sign in → "Create Your Letter" (auto-authenticated) → fill PREPARE form → step buttons say "Save and Continue" → click; advance to REFINE → AI draft generates → "Save and Continue" → preview → no Save button → "Save and Preview" → preview → PAYMENT (no email field, no sign-in prompt) → pay → letter appears in MyLettersModal Sent tab.
- [ ] **Authenticated mid-flow refresh:** during step 2 of PREPARE, refresh tab → app reloads, hydration runs, mode is still 'authenticated', cloud draft is fetched, form populates with last-saved state.
- [ ] **Authenticated unsaved-loss:** type 3 new characters in step 2 between Save clicks; close tab; reopen → those 3 characters are gone (last saved state restored). This is the accepted P3 behavior; verify the indicator (per §2.2 permitted UX mitigations) showed "unsaved changes" before close.
- [ ] **Mode-locking on sign-in mid-flow:** start as guest, type 50 chars in PREPARE, sign in via UserMenu (or whatever surface) → mode stays 'guest' (verify `sessionStorage.vday_mode === 'guest'`); local autosave is the persistence path; cloud is untouched.
- [ ] **Begin Again, guest:** type 50 chars, click Begin Again → confirm → local cleared; fresh form.
- [ ] **Begin Again, authenticated:** save 50 chars to cloud, click Begin Again → confirm → cloud draft deleted (verify via `GET /api/draft` returns 404); fresh form.
- [ ] **Anonymous letter receiver URL:** open the URL from the guest E2E test → letter loads. (This exercises the dual-collection slug lookup in `api/load-session.js`.)
- [ ] **Authenticated letter receiver URL:** open the URL from the authenticated E2E test → letter loads.
- [ ] **No reconciliation surfaces in runtime/app code.** All grep verifications below SCOPE to runtime/app code only (`App.tsx`, `index.tsx`, `components/`, `hooks/`, `api/`, `utils/`, `services/`, `lib/`, `types/`). Doc directories (`docs/`, archived material, audit reports, this strategy doc itself) are EXCLUDED from grep verification — those references are historical record, not live code.
  - `grep -r "SignInReconciliationModal" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "StaleRevisionModal" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "BeginNewPromptModal" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "SignInPromptModal" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "ReconciliationState" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "HydrationResolutionState" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "applyCloudActiveToState" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "handleStaleRevision" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "handleBeginNew" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
  - `grep -r "runOrPromptSignIn" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → EXPECTED matches: ONLY the Eidi-flow call site at App.tsx (currently ~:1667; line number may shift after Phase C). The function definition's fate is documented in §7.1 — if preserved for Eidi (FL-4), expect 1 call site match plus the definition line; if deleted with the Eidi call site rewired, see §7.1 for the resolution. Verify the only surviving reference is Eidi-scoped.
- [ ] **Cross-mode contamination removed (runtime/app code only):**
  - `grep -n "writeDraftId\|draftId" hooks/usePreparationPersistence.ts` → 0 matches.
  - `grep -n "writeDraftId" App.tsx` → 0 matches.
- [ ] **Eidi untouched (FL-4):**
  - `git diff --name-only main HEAD -- pages/eidi/ components/Eid*` shows no files modified (or unmodified relative to dual-mode work).
  - Eidi flow's `runOrPromptSignIn` call at App.tsx:1667 region is preserved unchanged. (After Phase C this line number may have shifted; the call site itself stays.)
- [ ] `npm run build` exits 0.

### Phase D checklist
- [ ] Re-run all Phase C smoke tests. All still pass.
- [ ] **All Phase D grep verifications SCOPE to runtime/app code only.** Doc directories are EXCLUDED.
- [ ] `grep -r "PersistenceStatus" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
- [ ] `grep -r "pauseDraft\|discardDraft\|lifecycleDraft" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
- [ ] `grep -r "expectedRevision\|STALE_REVISION" App.tsx index.tsx components/ hooks/ api/ utils/ services/ lib/ types/` → 0 matches.
- [ ] `ls api/drafts/` shows only `save.js` (and `transition.js` if not yet deleted — verify intent).
- [ ] `ls utils/` shows `cloudDraftSave.ts`, `emailValidation.ts`, `activeMode.ts`, NOT `lifecycleDraft.ts`.
- [ ] `npm run build` exits 0.

### Phase E checklist
- [ ] `docs/archived/` exists with the two archived docs.
- [ ] `docs/doctrine/dual-mode-persistence.md` exists with the codified content.
- [ ] `docs/doctrine/local-persistence-contract.md §6.5` has been rewritten.
- [ ] `README.md` "Current architecture direction" reflects dual-mode as shipped.
- [ ] All cross-references resolve.

---

## 14. Rollback Philosophy

PR-49 is shipped as a series of phase commits squashed into a single merge to `development`. Rollback operates at **completed phase boundaries only**. Phase C's internal execution buckets (C1, C2, C3, C4) are NOT revert-safe in isolation — see §12 rule 6. Revert Phase C as a whole, never a bucket-internal commit.

**Pre-merge (in-branch rollback):**
- Phase A regression: `git revert` the Phase A commit. Returns to pre-PR-49 state. No user impact (Phase A is additive).
- Phase B regression: `git revert` the Phase B commit. New endpoints disappear. No client code references them yet, so no user impact.
- Phase C regression: `git revert` the FULL squashed Phase C commit (or the merge commit that encloses all four buckets). **Reverts to Phase B state** — additive endpoints exist but the reconciliation flow is intact. This is the same as pre-PR-49 user-visible behavior. The orphan endpoints from Phase B linger but cause no harm. **Do not attempt to revert an individual C1/C2/C3/C4 bucket commit; those commits may have intermediate broken states by design (per §10 Phase C bucket structure).**
- Phase D regression: `git revert` the Phase D commit. The retired endpoints/types come back. Phase C's dual-mode flow continues to work (the retired surfaces had no callers).
- Phase E regression: `git revert` the Phase E commit. Doctrine reverts. Code is unaffected.

**Post-merge to `development` (development-branch revert):**
- `git revert` of the merged PR-49 squash commit returns the branch to its pre-PR-49 state. Manual smoke test the reverted state before promoting to `main`.

**Post-merge to `main` (production rollback):**
- `git revert` on `development`, fast-forward `development` → `main` per the standing branch protocol. Database state is the concern — `anonymousLetters/{paymentId}` records would orphan in RTDB if PR-49 is reverted. The records remain valid; the receiver URLs continue to work because the client revert restores the old slug-lookup which only checks `shared/`. **Orphan-record cleanup is a follow-up task; no urgent production impact.**

**Database irreversibility:**
- Phase C introduces the `anonymousLetters/` collection. Any letter created during Phase C+ in guest mode lives in this collection. A revert does not delete these records. If PR-49 is reverted, guest letters created during the PR-49 window become unreachable through the receiver path (the old `api/load-session.js` only checks `shared/`).
- **Mitigation:** if a revert is required, surface a follow-up migration to move `anonymousLetters/{paymentId}` records to `shared/{sessionKey}` with synthetic sessionKeys, OR keep PR-49's `api/load-session.js` dual-lookup change in place after the revert (the dual-lookup is the cheap path; the rest of PR-49 is more expensive to revert).
- This irreversibility is the cost of FL-3's separate-collection decision. It is acceptable because the architecture lock is the higher priority.

---

## 15. Post-PR Expected Architecture

After PR-49 ships, the codebase has the following shape:

**Persistence:**
- Guest path: `localStorage['vday_data_draft']` only. Single hook (`hooks/usePreparationPersistence.ts`). Debounced autosave. No `draftId`. No cloud interaction.
- Authenticated path: Firebase RTDB `users/${uid}/drafts/${draftId}` only. Single endpoint (`POST /api/drafts/save`). Single helper (`utils/cloudDraftSave.ts`). Explicit Save and Continue per step. No local interaction.
- Mode: `sessionStorage.vday_mode` ∈ `{'guest', 'authenticated', null}`. Written once at entry. Read by routing code.

**Sender flow:**
- Entry: LandingPage → "Create Your Letter" → ModeSelectionModal (if signed-out) or direct (if signed-in).
- PREPARE → REFINE → MAIN_EXPERIENCE → PAYMENT → SHARE. Mode-locked throughout.
- Step buttons: "Continue" (guest) or "Save and Continue" (authenticated).
- Payment: email field rendered for guests; auth email used for authenticated.

**Letter records (locked per §8.1):**
- Authenticated: `shared/{slug}` with `senderUid` field. Indexed at `users/${uid}/letters/${slug}` for dashboard.
- Anonymous: `anonymousLetters/{paymentId}` keyed by Razorpay payment ID. Slug→paymentId index at `anonymousSlugs/{slug} -> { paymentId, createdAt }`.
- Receiver URL shape: identical across both modes (no URL-shape leakage of anonymous vs authenticated origin).
- Receiver resolution (`api/load-session.js`): two-stage lookup. Stage 1 checks `shared/{slug}`. Stage 2 (fallback) checks `anonymousSlugs/{slug}`, resolves to `paymentId`, loads `anonymousLetters/{paymentId}`. 404 only after both stages fail.

**Endpoints (sender-side):**
- `POST /api/drafts/save` — save authenticated draft (single record).
- `GET /api/draft` — read authenticated draft (singular).
- `DELETE /api/draft` — delete authenticated draft (Begin Again).
- `POST /api/create-order`, `POST /api/verify-payment` — payment flow; mode-aware in verify.
- (Existing) `POST /api/letters/list` — dashboard list.

**Endpoints deleted:** `pause.js`, `resume.js`, `discard.js`, `transition.js`, `list.js`. Plus their client helper `utils/lifecycleDraft.ts`.

**Components deleted:** `SignInReconciliationModal`, `StaleRevisionModal`, `BeginNewPromptModal`, `SignInPromptModal`.

**Types narrowed:** `PersistenceStatus` retired. `expectedRevision` retired.

**Doctrine:**
- `docs/doctrine/dual-mode-persistence.md` — active doctrine.
- `docs/doctrine/local-persistence-contract.md §6.5` — rewritten for guest-mode-only local persistence.
- `docs/archived/` — superseded contracts and diagnostics for institutional learning.

**Eidi:** untouched. The Eidi mid-flow sign-in prompt remains. Re-enabling Eidi for Eid 2027 will require its own dual-mode alignment PR.

---

## 16. Deferred Work / Explicitly Rejected Ideas

Catalog of ideas considered during PR-49 design and excluded from scope, with reasons. Future engineers reading this should resist the urge to reintroduce these without re-litigating the architecture.

**Rejected — Guest-to-authenticated migration (any form).**
Per FL-1 and §3.3. Every variant ("post-payment claim," "sign-in inheritance," "smart merge on first sign-in") reintroduces reconciliation. The architecture lock against migration is doctrinal, not pragmatic.

**Rejected — Autosave-to-cloud in authenticated mode.**
Per P3 and diagnostic §7.11. Reintroduces reconciliation pressure. The accepted cost is unsaved-loss between explicit saves; permitted UX mitigations (inline indicator, onbeforeunload warning, disabled advance during save-in-flight) do not introduce a second storage authority.

**Rejected — Generic persistence manager / smart dispatcher.**
Per P2 and diagnostic §8. Any abstraction that takes `mode` as a parameter is a reconciliation ghost. Separate hooks, separate handlers, separate endpoints. The reviewer test in diagnostic §8 is the gate.

**Rejected — Mode inference from auth state.**
Per P5 and FL-2 enforcement rule 3. `user ? 'authenticated' : 'guest'` outside the ModeSelectionModal handler is a doctrine violation. Mode is set explicitly at entry; auth state changes do not change mode.

**Rejected — Mid-flow mode switching.**
Per FL-1 + I2. A guest cannot upgrade to authenticated for the current draft. They must finish or abandon.

**Rejected — In-app guest dashboard / "my anonymous letters" surface.**
Per P4 and diagnostic §6.Q9. Guests are anonymous. They have email and Razorpay payment ID as recovery channels. No dashboard.

**Rejected — Receiver URL TTL.**
Receiver URL TTL remains deferred (not blocking PR-49). Anonymous and authenticated letters keep the same TTL semantics (none). Revisit if real-world abuse or storage cost demands it.

**Rejected — Eidi dual-mode alignment in PR-49.**
Per FL-4. Eidi is currently disabled (`config/features.ts`); when it re-enables for Eid 2027, a separate follow-up PR aligns it with dual-mode.

**Rejected — `revision` field full removal.**
Per §6.4. Revision is retained as a server-side audit counter even though CAS retires. The runtime semantics narrow; the field stays for forensic value.

**Rejected — Combining authenticated and guest paths under a "persistence interface" in `services/`.**
Per P1 and P2. Adaptation preserves complexity; the goal is structural separation. Two hooks, two files, no shared parent.

**Deferred — `api/drafts/list.js` cleanup.**
Phase D deletes this. Documented here for traceability — the endpoint is orphaned after Phase C wires authenticated hydration to `GET /api/draft`.

**Deferred — Bundle-size analysis after dual-mode lands.**
Bundle composition will shift (3+ deleted modal components, 2+ new components). No analysis is scoped into PR-49. Revisit if CWV regresses.

**Deferred — Doctrine for receiver URL longevity.**
Tied to receiver URL TTL deferral. Documented in the doctrine doc as "current default: permanent" with a note that revision may follow.

---

End of strategy.
