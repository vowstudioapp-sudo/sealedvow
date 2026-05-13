# Dual-Mode Persistence — Architecture Proposal

**Date:** 13 May 2026
**Status:** Locked. Aligned with diagnostic + implementation strategy as of `a0c515f`.
**Supersedes:** [`single-draft-pivot.md`](./single-draft-pivot.md) v1.2 in its entirety; the remaining (unmerged) commits of [`pr-48a-implementation-strategy.md`](./pr-48a-implementation-strategy.md).
**Owner:** Ajmal Fahad
**Lock gate:** Cleared. All founder-locks resolved (FL-1 through FL-4). Implementation may proceed.

---

## Authoritative-source policy

This proposal is part of a three-document implementation contract. Each document has a distinct role:

- **This proposal** — architectural philosophy, invariants (§3), forbidden patterns (§8), end-state model. Defines what dual-mode IS.
- **[`docs/diagnostics/2026-05-13-pr49-dual-mode-diagnostic.md`](../diagnostics/2026-05-13-pr49-dual-mode-diagnostic.md)** — authoritative codebase findings, founder-lock resolutions, anti-pattern enumeration. Defines what dual-mode means against the current code.
- **[`pr-49-dual-mode-implementation-strategy.md`](./pr-49-dual-mode-implementation-strategy.md)** — implementation sequencing, phase boundaries, deletion/rewrite/addition lists, verification checklists. Defines HOW dual-mode ships.

**Where this proposal diverges from the diagnostic or strategy, the diagnostic and strategy WIN.** Those artifacts have been cross-reviewed, founder-locked, and aligned through multiple patch rounds. This proposal is the philosophical anchor; the diagnostic + strategy are the operational contract.

This document has been patched (commit `a0c515f`'s successor) to remove unresolved-question framing and align with the locked artifacts.

---

## 0. Reading note

This document specifies a different architecture from the one PR-48.A was implementing. PR-48.A's Commit 1 (subtractive removals shipped earlier today) remains valid and unchanged. Commits 2–6 of PR-48.A are abandoned; their planned work is replaced by the architecture below.

The reason for the change is not engineering preference. It is that the local↔cloud reconciliation architecture, despite three rounds of cross-voice review and a sophisticated patch sequence, produced demonstrable bugs in basic user flows during runtime testing — bugs whose root cause is the architectural complexity itself rather than implementation defects. This proposal eliminates the root cause.

---

## 1. Context

### 1.1 The problem this replaces

Prior architecture (current and v1.2 pivot variants both): every user's session has *both* a local autosave (browser `localStorage`) and a cloud draft (Firebase RTDB). The system continuously reconciles them through:

- A meaningful-content predicate
- A semantic-divergence flag (`hasLocalChanges`)
- A revision-based CAS (last-known-cloud-revision)
- A sign-in reconciliation modal with 2–3 buttons offering "continue dashboard / discard local / save local as new"
- A debounced autosave to local + an explicit save to cloud
- A migration layer for legacy non-namespaced keys
- UID-namespacing to separate users on the same browser
- A `lastSyncedSnapshot` ref to detect what "diverged" actually means

Runtime testing on 13 May 2026 confirmed the architecture is producing user-facing bugs in basic flows: reconciliation modal buttons that don't behave as their labels suggest, "Continue Dashboard Draft" silently redirecting to landing, drafts saved-to-local-only after cloud save failures, the dashboard not reflecting drafts at all. Each of these has a documented planned fix in PR-48.A or PR-48.B. The fixes are real. The total amount of complexity required to make local↔cloud reconciliation work correctly, however, is not justified by the product's actual requirements.

### 1.2 What this proposal does

It eliminates reconciliation entirely by removing the case where both local and cloud exist for the same user's draft. Each session uses exactly one persistence authority, chosen explicitly at session start. The two authorities never reconcile because they never coexist within a session.

### 1.3 What this proposal does not do

- It does not eliminate local storage as a category. Guests still use local storage.
- It does not eliminate cloud storage. Authenticated users still use cloud storage.
- It does not eliminate anonymous-trial UX. Guests get the full emotional journey.
- It does not require authenticated users to sign in mid-flow. Once chosen, never switched.

---

## 2. The Model

### 2.1 Entry-point gate

The user clicks "Create Your Letter" (e.g., from the landing page or "+ Create" button in the dashboard).

Before the form is rendered, a mode selection appears:

> **How would you like to create this letter?**
>
> **Continue with Google** — Save your progress to your account. Resume on any device. View your sent letters in your dashboard.
>
> **Continue as Guest** — Start writing right away, no account needed. Your draft stays on this device only.

The user chooses one. The choice is recorded and binding for the entire lifetime of this draft.

### 2.2 Guest path (mode = `guest`)

Persistence authority: **local storage only.**

| Stage | Behavior |
|---|---|
| Form (sender + receiver + photo + memories + occasion + etc.) | Local autosave (debounced). Step navigation buttons read "Continue." No "Save" affordance — persistence is implicit. |
| AI draft generation | Generated content saved to local storage along with form state. |
| Refine | Local autosave. "Continue" button. |
| Preview Your Message | Local autosave. "Continue" button (or "Continue to Preview"). |
| Preview Experience (seal break + main experience) | No save affordance. This screen is read-only; it reflects what's already in local storage. |
| Payment screen | Email field + payment fields. Email is captured for receipt + receiver URL delivery; it is NOT a sign-in. Payment completes. |
| Post-payment | Server creates an anonymous letter record (keyed by payment ID, not user ID). Receiver URL is minted. Receipt email is sent to the guest's provided email with both the receipt and the receiver URL. Local draft can be cleared (it has served its purpose). |

Returning to the site as a guest: local storage's resume modal restores the in-progress draft. Same continue-or-begin-again flow as today.

No dashboard. No cross-device. No record retrievable after browser data is cleared.

### 2.3 Authenticated path (mode = `authenticated`)

Persistence authority: **cloud storage only.**

| Stage | Behavior |
|---|---|
| Form | "Save and Continue" button at each step. Click saves form state to cloud, then advances. No local autosave; if user refreshes mid-step (between clicks), in-step typing is lost but last-saved state is intact in cloud. |
| AI draft generation | Saved to cloud along with form state at the next "Save and Continue." |
| Refine | "Save and Continue." |
| Preview Your Message | "Save and Preview" button. Saves any final edits, then navigates to preview. |
| Preview Experience | No save affordance. Read-only. |
| Payment screen | Already signed in — pay directly. No email field needed (Google account email is known). |
| Post-payment | Letter is sealed and recorded under the user's account. Appears in dashboard as a SENT letter. |

Returning to the site as a signed-in user: Firebase Auth persists; the user is automatically signed in. The dashboard shows their drafts and sent letters. Resume by clicking a draft.

### 2.4 What's explicitly NOT in either path

- No mid-flow sign-in prompt. The mode is chosen once.
- No local↔cloud reconciliation modal.
- No "save local draft as new" button.
- No silent migration of guest state to cloud account.
- No autosave-to-cloud at every keystroke.
- No `lastSyncedSnapshot`, `hasLocalChanges`, or revision-CAS for autosave.

---

## 3. The Invariants

These are load-bearing. Violating any of them reintroduces the complexity this proposal is designed to eliminate.

**I1.** The persistence mode is chosen exactly once, at "Create Your Letter" click, and is binding for the entire session/draft lifetime.

**I2.** The mode cannot change mid-flow. A guest cannot upgrade to authenticated without starting a new draft. An authenticated user cannot downgrade to guest.

**I3.** No sign-in prompt fires after the entry-point gate. The payment flow never asks the user to sign in. The guest's email-at-payment is a contact field, not an account.

**I4.** Local storage is touched only by the guest path. Cloud storage is touched only by the authenticated path. Neither path reads or writes the other's storage layer.

**I5.** There is no reconciliation logic in the codebase. No predicate compares local state to cloud state. No modal asks the user to choose between them.

**I6.** There is no migration logic from guest to authenticated. If implementation pressure ever surfaces a "let's just migrate guest content to cloud on sign-in" suggestion, this is forbidden — it reintroduces the entire reconciliation surface this proposal eliminates.

**I7.** Each session has exactly one persistence authority. The authority is determined by the mode, not by some inference from auth state or local content.

---

## 4. End-to-end comparison

| Stage | Guest mode | Authenticated mode |
|---|---|---|
| Entry | Click "Continue as Guest" | Click "Continue with Google" → Google sign-in |
| Form steps | Local autosave (debounced). "Continue" buttons. | Cloud save on each click. "Save and Continue" buttons. |
| AI draft | Saved to local. | Saved to cloud (next click). |
| Refine | Local. | Cloud. |
| Preview Your Message | "Continue." | "Save and Preview." |
| Preview Experience | Read-only. | Read-only. |
| Payment | Email field + payment. | Pay directly. |
| Letter sealing | Anonymous record. Receiver URL emailed. | Account-linked record. Dashboard-visible. |
| Cross-device | No. | Yes (any device with the Google account). |
| Returning user | Local-storage resume modal restores draft. | Auto-signed-in; dashboard shows drafts. |
| Failure modes | Browser data cleared → draft lost. | Network failure during save → in-step typing lost; last-saved state intact. |

---

## 5. Implications for current work

### 5.1 What survives from PR-48.A

**Commit 1 (already shipped — `14c1e9c`):** subtractive removals — `useDraftStateObserver`, `MAX_DRAFTS` cap, "Save Local Draft as New" button + handler. All three removals are valid in the dual-mode architecture (none of these constructs exist in the new model), so Commit 1 stays in place.

**The strategic insight:** PR-48.A's diagnostic + cross-voice review process surfaced that local↔cloud reconciliation is over-engineered for this product's requirements. That insight is preserved here.

### 5.2 What becomes obsolete

The diagnostic established the actual state of PR-48.A surfaces at the time this proposal locked. Distinguish three categories:

**(a) Already removed by PR-48.A Commit 1 (`14c1e9c`).** PR-49 does NOT need to delete code that no longer exists:
- `useDraftStateObserver` hook — file deleted in Commit 1.
- `MAX_DRAFTS` cap — removed in Commit 1.
- `decideTransition` + `TransitionDecision` type — removed in Commit 1.
- `handleSignInSaveLocalDraftAsNew` + its modal-button wiring — removed in Commit 1.
- `cap_exceeded` variant on `SaveDraftResult` — removed in Commit 1.

**(b) Planned for PR-48.A Commits 2–6 but NEVER SHIPPED.** These existed only on paper. PR-49 has nothing to delete here:
- UID-namespacing infrastructure (planned Commit 4) — never authored.
- `lastSyncedSnapshot` + `dirtyBitRef` + `settledHasLocalChangesRef` (planned Commit 5) — never authored.
- `meaningfulContent()` reconciliation predicate (planned Commit 4) — never authored.
- Migration logic for legacy `vday_data_draft` → UID-namespaced keys (planned Commit 4) — never authored.
- Hook self-seeding invariant (Patch 2 of Commit 5) — never authored.
- Schema v3 with `lastKnownCloudRevision` + `hasLocalChanges` fields (planned Commit 4) — never authored.
- Sync-confidence doctrine doc (planned Commit 6) — never authored.

PR-48.A Commits 2–6 are formally abandoned; the strategy doc that locked them ([`pr-48a-implementation-strategy.md`](./pr-48a-implementation-strategy.md)) survives as the historical record of the abandoned plan.

**(c) Still live in the repo from PR-48 Phase 1–4 work.** These surfaces PR-49 DOES delete or modify per the diagnostic + strategy:
- The reconciliation modal trio (`SignInReconciliationModal`, `StaleRevisionModal`, `BeginNewPromptModal`) — present at HEAD, deleted in Phase C.
- `SignInPromptModal` + the `runOrPromptSignIn` mid-flow prompt machinery — present; non-Eidi callers deleted in Phase C, function preserved per FL-4 bounded exemption (§5.5).
- `ReconciliationState` union + `HydrationResolutionState` + their associated handlers and state — present, retired in Phase C.
- `PersistenceStatus` enum (ACTIVE/PAUSED/ABANDONED) + all consumers across 11 files — present, retired in Phase D.
- Lifecycle endpoints (`api/drafts/pause.js`, `resume.js`, `discard.js`, `transition.js`) + `utils/lifecycleDraft.ts` — present, retired in Phase D.
- CAS plumbing (`expectedRevision`, STALE_REVISION branches) — present, retired in Phase D.
- Cross-mode contamination in `hooks/usePreparationPersistence.ts` (`draftId` field on `StoredDraft`/`DraftPeek`, `writeDraftId` helper) — present, removed in Phase C.

Strategy §3 + §7 + §8 enumerate the exact file:line surfaces and the phase boundaries for each category-(c) deletion.

### 5.3 What needs new work

1. **Mode selection gate** at "Create Your Letter" entry. UI + state plumbing to record the chosen mode and propagate it through the session.
2. **Mode-aware persistence routing.** The form components read `mode` from context/prop and behave accordingly: guest mode uses the existing `usePreparationPersistence` (local), authenticated mode uses a new cloud-direct save flow.
3. **"Save and Continue" UI** for authenticated path. Replace the local autosave debounce with explicit save-on-click. Each click POSTs to cloud and waits for success before advancing.
4. **"Save and Preview" button** on Preview Your Message screen (authenticated path).
5. **Removal of save affordances** from Preview Experience screen (both paths).
6. **Guest payment email field** on payment screen. New form field; not a sign-in.
7. **Anonymous server-side letter record** support. Server creates a record keyed by payment ID, not user ID. Receiver URL points to the anonymous record.
8. **Receipt email** to guest's provided email with the receiver URL.
9. **Dashboard filtering** so only authenticated-mode letters appear. Anonymous records are not associated with any account.
10. **Mode-aware Begin Again** flow. Local clear (guest) or cloud delete (authenticated).
11. **Mode-aware resume.** Local-storage resume modal (guest) OR dashboard draft-resume (authenticated).
12. **Strategy doc** for the implementation work, similar in discipline to PR-48.A's strategy but much shorter (the surface is smaller).

### 5.4 What can stay

- The receiver-side experience is entirely unchanged. Receivers don't know or care whether a letter was sent by a guest or an authenticated user.
- The AI generation flow is unchanged.
- The preview experience (seal break, letter pages, memory board, vows, gift, closing) is unchanged.
- The payment integration (Razorpay) is unchanged conceptually; only the post-payment record-creation logic differs by mode.

### 5.5 Eidi flow — out of scope (FL-4) with one bounded carve-out

The Eidi flow (`pages/eidi/*`, Eidi-specific components, Eidi receiver and creator paths) remains entirely outside PR-49 scope per FL-4. Eidi is currently disabled via `config/features.ts`; when it is re-enabled for Eid 2027, dual-mode alignment becomes a separate follow-up PR.

**Bounded FL-4 exemption (one item only):** the `runOrPromptSignIn` helper in `App.tsx` SURVIVES PR-49 in its current form. Its only surviving caller after PR-49 is the Eidi mid-flow sign-in prompt at `App.tsx:1667`. PR-49 removes the two non-Eidi callers (the save-flow call site and the Vow-payment call site); the helper itself is preserved because deleting it would break the untouched Eidi flow.

This is an explicit doctrinal preservation, not forgotten cleanup. Cleanup is deferred to the 2027 Eidi alignment PR, when the function and its Eidi caller are retired together with full FL discipline. Full enforcement contract lives in strategy §7.1, §13, and §16; this proposal records the architectural rationale for the carve-out.

---

## 6. Resolved implementation locks

The questions raised here during initial drafting were resolved during cross-voice review. Founder-locks FL-1 through FL-4 were established in the diagnostic (§7.6) and the implementation strategy operationalizes them in §5 and §8. The list below records the resolutions and the locking source for each.

**Mode-selection UI placement (was Q1) — RESOLVED.** Modal overlay triggered by "Create Your Letter" click. Ships in the landing-page bundle (not lazy) because it sits on the critical entry interaction. See strategy §5.3 (write site) and §9.1 (additions).

**Mode-selection copy (was Q2) — RESOLVED at the doctrinal level.** Both options must feel like real choices, not a forced funnel. Final copy locked at implementation time per strategy §9.1.

**Anonymous letter record schema (was Q3) — LOCKED by FL-3.** Separate `anonymousLetters/{paymentId}` collection. The receiver flow uses a two-stage lookup contract:

```
shared/{slug}                                      // authenticated letter record
anonymousSlugs/{slug} -> { paymentId, createdAt }  // slug→paymentId index
anonymousLetters/{paymentId}                       // anonymous letter record
```

Receiver resolution order (binding — no alternative architectures permitted):
1. Check `shared/{slug}`.
2. If null, check `anonymousSlugs/{slug}`.
3. Resolve to `paymentId`.
4. Load `anonymousLetters/{paymentId}`.
5. Return 404 only after both stages fail.

Full contract in strategy §8.1. `MyLettersModal` reads only `shared/`; anonymous letters never surface in any dashboard.

**Email delivery infrastructure (was Q4) — RESOLVED.** Resend is wired and production-ready via [`lib/email/sendEmail.js`](../../lib/email/sendEmail.js). Required env vars `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Guest receipt emails reuse the existing `sendLetterSealedEmail` template. No new infrastructure required.

**Abuse considerations (was Q5) — DEFERRED.** Threat-model pass scoped as a separate workstream, not blocking PR-49. Existing Razorpay payment-id rate-limit + Upstash IP-rate-limit are baseline controls. Revisit if real-world abuse emerges.

**Signed-in user clicks "Create Your Letter" (was Q6) — RESOLVED.** Signed-in users bypass the ModeSelectionModal. The entry-point handler writes `setActiveMode('authenticated')` synchronously and proceeds. Guest mode requires signing out first. See strategy §5.6.

**Authenticated user signs out mid-draft (was Q7) — RESOLVED via mode-locking under FL-1.** Mode is bound at entry. Signing out does NOT downgrade an authenticated session to guest. The user remains in authenticated mode for the current draft; if their session expires, the next mode-aware hydration re-prompts sign-in (mode is already locked; no fallback to guest). Per strategy §5.5 enforcement rules 2 + 3.

**Receipt email goes to spam (was Q8) — RESOLVED via guest payment recovery doctrine.** Recovery channels are email and Razorpay payment ID (support-routed). Diagnostic §6.Q9 enumerates explicit guarantees and non-guarantees. Strategy §16 marks the loss of both channels as intentional ("anonymous purchases are anonymous"); no in-app dashboard for guests.

**Receiver URL longevity (was Q9) — DEFERRED (not blocking PR-49).** Anonymous and authenticated letters keep the same TTL semantics (none). Revisit if real-world abuse or storage cost demands it. Strategy §4 + §16 both flag this as deferred.

**Mode-state mechanism — LOCKED by FL-2.** `sessionStorage.vday_mode` written exactly once by the ModeSelectionModal handler. Mode is routing-decision metadata, NOT persistence state — it does not store draft content. Single write site, read-only thereafter. Survives refresh within the same tab; auto-cleans on tab close. Auth state changes after mode is set do NOT change persistence path. Full contract in strategy §5.

**Guest→authenticated upgrade — FORBIDDEN by FL-1.** No mid-flow upgrade. No post-payment claim. No retroactive account attachment. No "temporary bridge" helpers. Anti-pattern A4 below is binding doctrine. Zero migration code in PR-49.

**Authenticated autosave — REJECTED.** Authenticated mode has no autosave by design. Unsaved-loss between explicit "Save and Continue" clicks is the accepted trade-off; reintroducing autosave reintroduces reconciliation pressure. No cloud autosave. No reconciliation helper. Permitted UX mitigations: unsaved-changes indicator, `onbeforeunload` warning, disable advance during save-in-flight. Forbidden mitigations: any second storage authority (local backup of in-memory state, `sessionStorage` mirror of form state, periodic server pings capturing partial state). Diagnostic §7.11 carries the binding future-proofing language.

**Mobile considerations (was Q10) — DEFERRED to design pass.** Not blocking PR-49 implementation; design review continues in parallel.

---

## 7. Migration path from current state

### 7.1 Branch state at proposal time

`pr48-cloud-draft-sync` HEAD = `14c1e9c` (Commit 1 of PR-48.A). Pushed to origin.

### 7.2 Path forward

1. **This proposal is locked** (founder review + cross-voice review complete; FL-1 through FL-4 resolved; aligned with diagnostic and strategy).
2. **The strategy doc is locked** at [`pr-49-dual-mode-implementation-strategy.md`](./pr-49-dual-mode-implementation-strategy.md) (commits `d2b95e7` → `3fc5c06` → `a0c515f`). It carries the binding implementation contract: phase boundaries, deletion lists, rewrite plans, verification checklists.
3. **PR-48.A is formally abandoned** at Commit 1 (`14c1e9c`). The Commit 1 subtractive removals survive; Commits 2–6 are not done and never will be in their original form.
4. **Implementation proceeds** along the strategy doc's five phases (A → B → C → D → E).
5. **Final merge** to `development` once the strategy doc's exit criteria pass for all phases.

### 7.2.1 Phase atomicity + rollback discipline (aligned with strategy §12 + §14)

Implementation atomicity rules — concise restatement of strategy §12 + §14 for the philosophical record. The strategy doc is the binding source:

- **Phase C is architecturally atomic.** Its four internal execution buckets (C1 persistence routing, C2 form-stage, C3 anonymous-letter infrastructure, C4 reconciliation-surface destruction) are implementation-order subdivisions only — NOT independently shippable deploy phases.
- **Intermediate commits inside Phase C buckets are NOT rollback-safe.** The codebase may be temporarily unstable between buckets during in-branch implementation work. `git revert` of a bucket-internal commit is undefined behavior.
- **Runnable guarantees apply only at completed phase boundaries.** End of Phase A, end of Phase B, end of FULL Phase C, end of Phase D, end of Phase E. Each phase boundary requires `npm run build` to pass and the manual verification checklist (strategy §13) to clear.
- **Revert at phase boundaries only.** Phase C rollback uses the squashed Phase C commit (or the merge commit enclosing all four buckets), never a bucket-internal commit.

### 7.3 What gets archived

The following documents are preserved as historical artifacts of the design exploration. They are NOT discarded — they capture genuine architectural insight and the cross-voice review discipline.

- `docs/proposals/single-draft-pivot.md` → archived with status note "Superseded 13 May 2026 by `dual-mode-persistence.md`."
- `docs/proposals/pr-48a-implementation-strategy.md` → archived with similar status note.
- `docs/diagnostics/2026-05-13-*.md` → kept in place; they remain useful as audit trail for why the single-draft pivot was attempted and what its limits were.

The archival is editorial only — no content is destroyed. Future engineers reading these docs should understand the architectural reasoning that led from multi-draft → single-draft → dual-mode.

---

## 8. Anti-patterns explicitly forbidden by this proposal

If implementation pressure ever surfaces any of the following, the answer is NO. Each one reintroduces the complexity this proposal exists to eliminate. The full reviewer-grade enumeration lives in the strategy doc §8 + diagnostic §8; this section is the philosophical anchor.

**A1.** Mid-flow mode switching. Even with "smart" migration. Even "just this once for this one edge case." The mode is locked at entry.

**A2.** Auto-save-to-cloud during anonymous flow. Even with "we won't reconcile, we'll just keep a backup." This is local↔cloud coexistence by another name. The same prohibition extends to authenticated mode: there is no autosave to cloud in either mode (see §6 — Authenticated autosave REJECTED).

**A3.** Reconciliation modals. In any form. Even "just for one specific edge case." The whole point is that reconciliation doesn't exist.

**A4.** Migration of guest state to cloud account on later sign-in. Even with user consent. Even as an opt-in toggle. Locked by FL-1. No "temporary bridge" helpers. No post-payment claim flow. No retroactive attachment. Zero migration code in PR-49.

**A5.** Cross-mode hydration. Authenticated user's dashboard listing guest-mode drafts because "they were created in the same browser." Modes do not communicate.

**A6.** A "smart" persistence layer that decides which mode to use based on auth state at write time. The mode is set explicitly by user choice, not inferred. Specifically forbidden: any condition of the form `user ? 'authenticated' : 'guest'` outside the ModeSelectionModal handler. Mode is read from `sessionStorage.vday_mode`, never derived from auth state.

**A7.** Inventory thinking imported into emotional architecture. The user is not "managing drafts." They are writing a letter. Each session has one draft. Each draft has one mode. Each mode has one persistence layer. Anything beyond this is over-engineering for a product whose Charter explicitly rejects productivity-software framing.

**A8.** Generic persistence managers. Any class, hook, or helper that abstracts over both local and cloud persistence behind a unified interface — e.g., `usePersistence(mode)` that returns the right backend based on mode — is forbidden. The pattern looks like good DRY but it concentrates complexity at the abstraction boundary and becomes the natural home for cross-mode migration code. **Instead:** separate hooks (`useGuestPersistence`, `useAuthenticatedPersistence`) that don't share code.

**A9.** Smart dispatchers. Any save handler that takes mode as a parameter and routes internally is forbidden. **Instead:** completely separate save flows, called from completely separate code paths. Mode is read once at the branch site, not threaded through shared utilities.

**A10.** Compatibility bridges. Helpers that convert between local and cloud draft representations are forbidden. Even one-way (guest → cloud) is forbidden per A4. Even with a "we only call this in one place" guardrail. The bridge's existence is what matters.

**A11.** "Temporary" migration helpers. Configuration flags like `ALLOW_GUEST_TO_AUTH_MIGRATION` or `ENABLE_LEGACY_RECONCILIATION` are forbidden. Any flag that gates a migration behavior is a reconciliation ghost regardless of its default value. The first deployment that flips it on instantiates the architecture this proposal eliminates.

**A12.** Cross-mode helper abstractions. If a utility takes `mode` as a parameter, it's a smart dispatcher (see A9). If a utility reads both local and cloud state in the same flow — even if it doesn't compare or merge them — it's a reconciliation ghost. **The mere co-presence is the smell.**

**Reviewer test (the gate for all anti-patterns above):**

> If a code reviewer sees a function/module/abstraction and cannot tell whether it is guest-only or authenticated-only from the import surface alone — without reading the implementation — the abstraction is likely a reconciliation ghost.

The reviewer should reject on sight. This test is the final defense against reintroducing reconciliation under a different name.

---

## 9. Doctrine to codify (after lock)

Once this proposal is approved, the following doctrine documents should be created/updated:

- **`docs/doctrine/dual-mode-persistence.md`** — the codified version of §3 invariants and §8 anti-patterns. Active doctrine. Reviewed quarterly per the Product Charter governance rhythm.
- **`docs/doctrine/local-persistence-contract.md`** — rewritten to describe guest-mode-only local persistence (the cross-namespace, reconciliation-aware framing is removed).
- **`docs/archived/2026-05-13-active-paused-state-machine.md`** — already planned in PR-48.A Phase D; this work still happens.

---

## 10. Cross-voice review record

| Reviewer | Date | Outcome |
|---|---|---|
| Claude (author) | 13 May 2026 | First draft. |
| ChatGPT | 13 May 2026 | Reviewed; gaps surfaced and resolved through the diagnostic + strategy alignment passes. |
| Founder lock | 13 May 2026 | All four founder-locks resolved (FL-1 through FL-4). Bounded FL-4 exemption documented (§5.5). Diagnostic commits `4800ae3` → `66719d8`. Strategy commits `d2b95e7` → `3fc5c06` → `a0c515f`. Implementation may proceed. |

---

## 11. Closing note

This proposal exists because three rounds of cross-voice review and an implementation-grade strategy doc could not eliminate the bugs produced by local↔cloud reconciliation. The work that surfaced this realization (the v1.2 single-draft pivot, the diagnostic, the patches, the tightenings) was not wasted — it was the path by which the realization became clear. Without seeing the reconciliation model fail in runtime testing, the dual-mode model would have felt like an unmotivated simplification.

The dual-mode model is not simpler because it's lazier or less rigorous. It is simpler because the problem it solves is smaller. The Product Charter rejects productivity-software framing; the dual-mode architecture honors that rejection at the persistence layer. The user is not managing drafts. The user is writing a letter, and the act of writing has a beginning (mode choice), a middle (the form + AI + refine), and an end (payment + send). Each of those has exactly one persistence semantics. Nothing reconciles, because nothing needs to reconcile.

If this proposal survives ChatGPT review unchanged, the implementation that follows will be the shortest, cleanest piece of work this codebase has shipped. If ChatGPT surfaces holes, this document gets revised. Either way, the path from here is: review, lock, implement.

---

## 12. Alignment footer

This proposal is now fully aligned with:

- **Diagnostic:** [`docs/diagnostics/2026-05-13-pr49-dual-mode-diagnostic.md`](../diagnostics/2026-05-13-pr49-dual-mode-diagnostic.md) (locked at commits `4800ae3` → `66719d8`).
- **Implementation strategy:** [`docs/proposals/pr-49-dual-mode-implementation-strategy.md`](./pr-49-dual-mode-implementation-strategy.md) (locked at commits `d2b95e7` → `3fc5c06` → `a0c515f`).

The three artifacts form a single implementation contract. Future architectural changes that touch persistence, mode semantics, or the guest/authenticated split must update all three artifacts together. Drift between them is the failure mode this footer exists to prevent.

— End of proposal —
