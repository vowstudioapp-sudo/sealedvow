# Single-Draft Pivot v1.1 — Architecture Stress Test

**Date:** 13 May 2026
**Mode:** Read-only architecture review. No code modifications. No fix prompts.
**Scope:** `docs/proposals/single-draft-pivot.md` v1.1 (as supplied 13 May 2026).
**Method:** Trace each v1.1 section against the existing codebase to find hidden races, false transitions, hydration edges, destructive paths, and prose-vs-code ambiguity.

---

## 0. Disposition

The pivot direction is correct. v1.1's 8 tightenings over v1.0 closed real holes (especially the DELETE-CAS protection in §8.4 and the semantic-divergence doctrine in §4.4). This review surfaces **15 additional issues** that range from doctrine-clarification (easy patches into v1.2) to implementation-feasibility (lock-the-choice-in-PR-48.A).

None are blockers. None require a v2.0 redesign. Most resolve with single-sentence amendments or explicit "implementer-of-PR-48.A picks X" notes.

Categories used (from founder's request):

| # | Category | Issues |
|---|---|---|
| 1 | Hidden race conditions | #4, #14 |
| 2 | False dirty-state transitions | #2, #4, #13 |
| 3 | Hydration edge cases | #1, #10, #11, #15 |
| 4 | Stale-revision deletion risks | #3, #9 |
| 5 | Sign-out / sign-in loops | #6, #12 |
| 6 | Offline reopen flows | #7 |
| 7 | Local/cloud authority drift | #4, #5, #6 |
| 8 | Accidental destructive paths | #3, #8, #9 |
| 9 | Semantic contradictions | §5.3 vs §6.2, §4.2 vs §5.3, §11.4 phrasing |
| 10 | Implementation feasibility | #5, #13, #15 |

(Observations #1–#3 are the three from the disposition. The rest surfaced during this review.)

---

## Observation #1 — Autosave behavior while the Case B modal is open

**v1.1 reference:** §5.2 ("editor beneath the reconciliation modal is non-interactive").
**Codebase reference:** [`hooks/usePreparationPersistence.ts:284-300`](../../hooks/usePreparationPersistence.ts:284) — `usePreparationPersistence`'s autosave timer.

§5.2 locks that the editor's form inputs are blocked while the SignInReconciliationModal is open. It does NOT lock what `usePreparationPersistence` does during the modal's open window. The hook fires on every `data` or `step` change with a 1000ms debounce; it has no notion of "modal is open, pause." If `PreparationForm` is mounted underneath the modal (stage = PREPARE), the hook is alive and timing.

**Risk:** if any code path triggers a setState on `data` while the modal is open (e.g., a fast-firing media-upload completion callback, a focus-driven trim, or React 18 strict-mode double-effect), the autosave timer will fire and write to `vday_data_draft`. In v1.1's sync-confidence model, this would also flip `hasLocalChanges = true` against the pre-modal-open `lastSyncedSnapshot`. The user's Case B decision was framed around the local content as-of-modal-open; the autosave fired in the background could subtly diverge it.

**Why it matters for v1.1 specifically:** the proposal's "user explicitly chooses which version" promise depends on the two versions being stable while the user decides. If background autosave keeps mutating local, the local side the user is reasoning about isn't quite the local side that gets reconciled.

**Suggested amendment:** §5.2 add a sentence: *"While the modal is open, `usePreparationPersistence` is paused (`enabled=false`) — neither the form's `data` mutations nor focus/blur normalizations write to local persistence. Autosave resumes after the user makes a choice."*

Implementation hook: `enabled` option already exists on the hook (line 281); pass `enabled={reconciliation.kind !== 'sign_in_case_b'}` from PreparationForm with a prop or via App-level context.

---

## Observation #2 — Hydration ordering: `setData` vs `lastSyncedSnapshot`

**v1.1 reference:** §4.2 ("Successful hydration from cloud → `data = cloud.data`, `lastKnownCloudRevision = cloud.revision`, `hasLocalChanges = false`") combined with §4.4 (semantic-divergence doctrine).
**Codebase reference:** any place that calls `setData(cloud.data)` — e.g., the equivalent of today's [`App.tsx:944-961`](../../App.tsx:944) `applyCloudActiveToState`.

§4.2 requires three state writes on hydration: `data`, `lastKnownCloudRevision`, `hasLocalChanges = false`. §4.4 requires a fourth: `lastSyncedSnapshot = cloud.data` (so the next semantic-divergence check compares against the new baseline).

If these four writes are not in the same React commit, a window opens where `data` has been replaced with `cloud.data` but `lastSyncedSnapshot` still holds the prior baseline. `usePreparationPersistence`'s next debounce-fire writes `data` (now equal to `cloud.data`) to localStorage, and any code path that runs the semantic comparison during that window would see `data !== lastSyncedSnapshot` → `hasLocalChanges = true` falsely.

**Risk:** false dirty state immediately post-hydration. The user just had their cloud draft hydrated; the system would think they have unsynced edits.

**Suggested amendment:** §4.4 add an implementation requirement: *"`lastSyncedSnapshot` updates MUST be co-committed with `data` updates from hydration sources. If implemented via a ref (not React state), the ref write must precede the next debounced autosave fire. If implemented as React state, both setters must be called within the same event handler so React batches them."*

This is one sentence in the proposal; the PR-48.A implementer picks the mechanism.

---

## Observation #3 — Secondary STALE_REVISION-on-DELETE modal cancellation

**v1.1 reference:** §8.3 step 3 ("Another device just updated this draft. Are you sure you still want to start a new letter? …Buttons: 'Yes, Start New Letter' / 'Cancel'").
**Codebase reference:** No existing precedent for stacked confirmation modals in this branch; the closest is [`StaleRevisionModal.tsx`](../../components/StaleRevisionModal.tsx) which is single-level.

§8.3 step 3 specifies a secondary modal for the case where DELETE returns STALE_REVISION. It does NOT specify:

- Does Cancel close ONLY the secondary modal, leaving the primary Begin Again confirmation still open?
- Does Cancel close BOTH modals and return to the editor?
- After Cancel, does `lastKnownCloudRevision` get updated to the server-reported `currentRevision` (so the next save attempt has fresh CAS), or does it stay stale (so the next save would also fail)?
- Is the primary Begin Again's `expectedRevision` payload re-used on retry (stale), or refreshed?

**Risk:** ambiguous UX leading to either (a) user stuck in a modal stack they can't escape, or (b) user's local state silently advances to a revision they didn't consent to.

**Suggested amendment:** §8.3 lock the Cancel-on-secondary semantics. Recommend: *"Cancel on the secondary modal closes BOTH the secondary modal AND the original Begin Again confirmation. Local autosave is preserved. `lastKnownCloudRevision` is updated to `currentRevision` from the server's STALE_REVISION response so that future operations have fresh CAS — this is NOT a state change to the draft itself, only an update of what the client knows about cloud's progression."*

---

## Issue #4 — `selectiveHydrate` exclusions create false-dirty on first post-hydration mutation

**v1.1 reference:** §4.4 (`hasLocalChanges` = semantic divergence from `lastSyncedSnapshot`).
**Codebase reference:** [`hooks/usePreparationPersistence.ts:30-76`](../../hooks/usePreparationPersistence.ts:30) — `TEXT_SAFE_FIELDS`, `STRUCTURED_TEXT_FIELDS`, `MEDIA_FIELDS_RESTORED`; the `selectiveHydrate()` filter at line 78.

`selectiveHydrate` excludes server-set fields: `status`, `sealedAt`, `createdAt`, `updatedAt`, `previewExpiresAt`, `replyEnabled`, plus PII (`receiverPhoneNumber`) and security (`passcode*`). These fields are NOT roundtripped through local persistence.

If `lastSyncedSnapshot = cloud.data` is set as the FULL cloud payload (which may include `status`, `sealedAt`, etc.), and the autosave's `data` is the FILTERED version (those fields stripped), then:

```
deepEqual(data, lastSyncedSnapshot) === false   // status/sealedAt mismatch
→ hasLocalChanges = true   // FALSE: user didn't change anything
```

This fires on the first semantic-divergence check after hydration. The system would think the user has unsynced edits the moment hydration completes.

**Risk:** false-dirty state on every hydration. Cascade: Case B modal fires on next sign-in even when local is a pure cloud-mirror.

**Suggested amendment:** §4.4 lock the projection: *"`lastSyncedSnapshot` must hold the projection of cloud `data` that round-trips through the local persistence filter cleanly. Concretely: apply `selectiveHydrate` to `cloud.data` before storing as `lastSyncedSnapshot`. The semantic-divergence check then compares two projections in the same space."*

Alternative wording: §3 (meaningful content) and §4 (sync-confidence) operate on the **selectiveHydrate-projected** view of `data`, not the raw cloud payload. PR-48.A implementer enforces this at the helper boundary.

---

## Issue #5 — Two `data` sources: PreparationForm vs App.tsx

**v1.1 reference:** §4 ("The user's content is the `data` field"), §6.2 ("`data === cloud.data`").
**Codebase reference:** [`hooks/usePreparationState.ts:19`](../../hooks/usePreparationState.ts:19) (PreparationForm's `data`); [`App.tsx:490`](../../App.tsx:490) (App.tsx's `data`); [`components/PreparationForm.tsx:150`](../../components/PreparationForm.tsx:150) (where the two are nominally synced via `onComplete`).

The codebase has TWO `data` states:
1. `usePreparationState`'s `data` inside PreparationForm (the form's working copy during PREPARE).
2. App.tsx's `data` (used at REFINE and later stages).

They synchronize only at PreparationForm's `onComplete` (advance to REFINE — [App.tsx:2054](../../App.tsx:2054)) and via hydration's `setData` (App.tsx flowing down via prepFormResetKey remount).

During PREPARE, PreparationForm's `data` is the autosave source. App.tsx's `data` may be `null` (per PR-47.1 mount initializer) or stale (last `onComplete` payload). The `POST /api/draft` body in v1.1 §6.1 is built from… which?

If the save sends App.tsx's `data` (likely, since [`App.tsx:680`](../../App.tsx:680) `handleSaveAndContinueLater` reads `data ?? {}`), then during PREPARE the save would send an empty/stale snapshot — NOT the live PreparationForm content. The user's "1000 words I just typed" would not reach cloud.

**Risk:** save flow may upload incomplete data during PREPARE because the two data sources are unsynced until PREPARE → REFINE handoff.

(Note: in pre-PR-48 flows the save-and-continue link is only rendered in REFINE and post-REFINE stages, where App.tsx's data IS authoritative. So this risk is theoretical until a "Save Draft" button is added to PREPARE — which the single-draft pivot doesn't explicitly say it will, but the dashboard MVP in PR-48.C will require it.)

**Suggested amendment:** §6 add a clarifying paragraph: *"The save flow's `data` payload is App.tsx's `data` state — the post-`onComplete` snapshot. During PREPARE, before `onComplete` fires, App.tsx's `data` may not reflect in-progress form edits. PR-48.A's PreparationForm Save Draft surface (if introduced) must call PreparationForm's onComplete-equivalent BEFORE `POST /api/draft`. PR-48.C dashboard must respect the same boundary."*

---

## Issue #6 — Cross-user localStorage leak on sign-out + different sign-in

**v1.1 reference:** §4.2 ("Sign out → No change (sign-out is non-destructive)").
**Codebase reference:** [`App.tsx:1230-1235`](../../App.tsx:1230) — sign-out clears `draftRecord` + `writeDraftId(null)` but NOT `vday_data_draft.data`. Diagnostic-2 §7.1 documented this pre-existing PR-47.1 limitation.

User1 signs in, hydrates cloud, edits. Signs out. localStorage still has User1's `vday_data_draft.data`. User2 signs in on the same browser. Hydration fetches User2's cloud (or 404). The autosave's local state is still User1's content. v1.1 §5 reconciliation gate evaluates:
- Local meaningful = true (User1's writing is meaningful)
- Cloud meaningful = depends on User2's cloud
- If User2 has cloud → Case B modal fires showing **User1's local content** as one option and **User2's cloud content** as the other.

The user is shown a reconciliation between two strangers' drafts. The very framing implies cross-account contamination.

**Risk:** privacy + UX violation. User2 sees User1's writing in a "your local draft" card.

**Suggested amendment:** v1.1 should explicitly call out this pre-existing limitation in §11 (open questions) and reference Diagnostic-2 §8 options (B: UID-namespacing). Either:

- **(a)** sign-out clears `vday_data_draft.data` (one-line patch, but breaks the "sign-out is non-destructive" principle).
- **(b)** sign-in checks UID-vs-prior-UID, clears local if different.
- **(c)** UID-namespace the localStorage key (`vday_data_draft:{uid}`).

PR-48.A picks one or defers explicitly. v1.1 currently leaves it implicit.

---

## Issue #7 — Schema migration on existing pre-pivot `vday_data_draft` entries

**v1.1 reference:** §12 PR-48.A ("Migration: existing local autosave entries get `lastKnownCloudRevision: null, hasLocalChanges: true` so they're treated as needing reconciliation").

The migration policy is correct in principle but produces a one-time UX wart:

- A user who in pre-pivot times had their local autosave synced with cloud (PR-47.1 happy path) currently has local content that IS a cloud mirror.
- Post-migration, `hasLocalChanges = true` even though local is byte-equal to cloud.
- Next sign-in: Case B fires with two cards showing the same content.
- User picks "Continue Saved Draft" → no-op (functionally) but felt as confusion.

**Risk:** one-time false reconciliation modal during migration window.

**Suggested amendment:** §12 add: *"PR-48.A migration: in addition to setting `lastKnownCloudRevision: null` and `hasLocalChanges: true`, compute meaningful-content on the existing local data. If local is non-meaningful, treat as `hasLocalChanges: false` to skip the migration-driven false-positive Case B modal. (Acceptable: meaningful pre-pivot users may see one extra modal during the rollout window; this is documented and time-limited.)"*

Alternative: bump the StoredDraft schema version (`CURRENT_SCHEMA_VERSION` in [`usePreparationPersistence.ts:11`](../../hooks/usePreparationPersistence.ts:11)) so the readDraft path discards pre-pivot entries, forcing a fresh start. More aggressive, no migration wart.

---

## Issue #8 — Begin Again on empty editor destroys cloud draft

**v1.1 reference:** §8 (Begin Again signed-in copy: "permanently remove your saved draft from all devices"). §8.3 step 1 (DELETE fires).
**Codebase reference:** [`components/PreparationForm.tsx:178-195`](../../components/PreparationForm.tsx:178) — current Begin Again trigger lives in PreparationForm's `handleBeginAgain` delegating to App.tsx. The trigger surface is the DraftResumeModal's "Begin again" button.

Scenario: user opens app on a fresh device, signs in. Cloud has an ACTIVE draft. Hydration fires, draftRecord is populated, but App.tsx's `data` may be null (Case A silent path) or local autosave may be cleared (sign-in flow). The user clicks "CREATE YOUR LETTER" from landing, lands at PREPARE with empty form. They reflexively click "Begin again" (perhaps because they think they should start fresh) — confirmation modal fires. They confirm. **DELETE /api/draft destroys the cloud draft.**

The user destroyed work they never saw on this device because the editor was empty at the moment of the click.

**Risk:** accidental destruction. The confirmation modal's wording ("permanently remove your saved draft") describes the action but doesn't preview the artifact (recipient name, last-edited date, word count). The user has nothing to anchor "is this the right thing to destroy?"

**Suggested amendment:** §8.1 expand the modal body: *"Your saved draft for [recipientName] (last edited [relativeTime], [N] words) will be permanently removed from all devices."* When cloud metadata is available, surface it. If no recipientName yet, show "your unfinished draft" with the timestamp + word count.

Alternative defensive: gate the Begin Again trigger behind a "draft preview" view — the user can't click Begin Again until they've seen what's there. More invasive; flag for product judgment.

---

## Issue #9 — DELETE with `expectedRevision: null` semantics

**v1.1 reference:** §9.1 (DELETE body: `{expectedRevision}`); §9.2 ("On a brand-new draft creation (POST with no existing cloud draft), `expectedRevision` may be omitted or sent as null").
**Codebase reference:** No DELETE endpoint exists yet; the closest pattern is `api/drafts/discard.js` which requires `expectedRevision` (per Phase 3 contract).

§9.2 specifies the POST-null-revision semantics (create new draft) but says nothing about DELETE-null-revision. Three interpretations:

1. **Server requires `expectedRevision` on DELETE always.** Client without a revision cannot delete; must hydrate first. SAFE.
2. **Server accepts DELETE with `expectedRevision: null` and deletes regardless of cloud state.** UNGUARDED — the original v1.0 hole that v1.1 §8.4 closed.
3. **Server accepts `null` only when cloud has no draft (matching no-existing-record semantics on POST).** Coherent but easy to mis-implement.

Without explicit doctrine, an implementer might default to (2) — recreating the very race v1.1 §8.4 fixed.

**Risk:** doctrine gap; CAS protection on DELETE could be silently undone by an implementer reading the asymmetry between POST and DELETE in §9.2.

**Suggested amendment:** §9.2 add: *"DELETE `/api/draft` REQUIRES `expectedRevision`. A request with missing or null `expectedRevision` is rejected with 400. The 'null-allowed' clause for POST applies only to CREATE-new-record cases; DELETE always operates against an existing record and always requires CAS."*

---

## Issue #10 — Hydration GET failures (401/5xx/network)

**v1.1 reference:** §5 reconciliation gate assumes `GET /api/draft` returns `{data, revision, updatedAt}` or 404.
**Codebase reference:** [`App.tsx:1252-1296`](../../App.tsx:1252) current hydration uses a `.catch(() => {})` silent fallback (PR-21 + Phase 4).

§5 does not address what happens when:
- **401 Unauthorized** — session cookie not yet established (cookie-race window the user explicitly mentions in the v1.1 changelog).
- **5xx** — server unavailable.
- **Network error** — offline / fetch failure.

In each case, the client cannot determine whether cloud is meaningful. Default behavior should be specified: presumably "treat as Case C (local authoritative)" so the user can continue editing offline. But without explicit doctrine, the implementer might surface an error modal, retry indefinitely, or silently downgrade.

**Risk:** undefined behavior on hydration failures. The cookie-race scenario is the documented common case for this branch (referenced in v1.1's preamble).

**Suggested amendment:** §5 add a subsection 5.4 *"Hydration failure modes"*:

> **401:** retry with exponential backoff (e.g., 500ms, 1s, 2s, up to 3 attempts). If still 401 after retries, treat as signed-out — silent Case A/C path applies based on local content.
> **5xx / network:** silent retry once after 2s. If still failing, treat as Case C (local authoritative). Do NOT surface modal — user is not blocked, can keep editing. Background re-attempt on next user action (next save).
> **404:** cloud has no draft. Apply Case A/C silent path based on local content.

---

## Issue #11 — Hydration during stage > PREPARE

**v1.1 reference:** §5 reconciliation gate assumes the user is at PREPARE when hydration fires.
**Codebase reference:** PR-47/47.1 mount initializer can land the user at REFINE, PERSONAL_INTRO, QUESTION, MAIN_EXPERIENCE, or PAYMENT if `vday_data_draft.stage` is valid.

If user is in REFINE when sign-in completes (or hard refresh lands at REFINE), hydration's Case A (silent cloud hydrate) would call `setData(cloud.data)` — replacing the App.tsx `data` underneath the rendered RefineStage component. RefineStage re-renders with new data, potentially losing the AI-generated `finalLetter` the user was about to save. Worse: if cloud's draftState is `IN_PROGRESS` (no finalLetter) but local was at REFINE with finalLetter, the user is yanked backward in the flow.

**Risk:** mid-flow state replacement. The user is in the middle of refining; hydration replaces their content without warning.

**Suggested amendment:** §5 add a subsection 5.5 *"Stage-aware hydration"*:

> Hydration applies cleanly only at PREPARE stage. If the user is at REFINE or later when hydration fires:
> - **Local meaningful + cloud meaningful (Case B):** modal still fires, user resolves. Picking "Continue Recent Edits" preserves current stage; picking "Continue Saved Draft" resets to PREPARE (or to the stage encoded in cloud's `draftState`, if Phase 5 supports stage resumption).
> - **Local meaningful + cloud empty (Case A→C-like):** silent, no action. Local stays as-is.
> - **Local empty + cloud meaningful (Case A):** apply cloud, but DO NOT change stage. The downstream stage's rendering will re-evaluate; if cloud's data doesn't satisfy `isStageValid` for the current stage, the stage initializer's fallback path handles it.

This is the highest-stakes hydration-edge in the proposal.

---

## Issue #12 — STALE_REVISION → Continue Recent Edits loop

**v1.1 reference:** §5.2 "Continue Recent Edits" → next save is CAS-protected (§5.3 closing paragraph); §7.3 "What happens if user keeps editing after picking 'Keep Editing This Version'".

The Continue Recent Edits path commits local edits as authoritative, then attempts to save. If cloud has advanced AGAIN between hydration's revision read and the next save, the save returns STALE_REVISION. The user gets the StaleRevisionModal. They pick "Keep Editing This Version" (the §7's analog of "Continue Recent Edits"). They edit more. Save fails again. Loop.

§7.3 acknowledges the loop is "acceptable v1 behavior." Verify that this is true in practice — i.e., that consecutive Case B → STALE_REVISION cycles don't accidentally compound state.

**Risk:** state-machine cycle without explicit termination. A user with poor connectivity and a concurrent device editor could be in a permanent fail-to-save state.

**Suggested amendment:** §11.5 add: *"Continued STALE_REVISION rejections after multiple Continue Recent Edits / Keep Editing This Version choices are tolerated. The user retains local content indefinitely. If the situation persists, the user's recovery path is: (a) sign out + sign in to re-trigger reconciliation (which would now see the latest cloud at hydration time); or (b) manually copy text out, click 'Reload Latest Draft' to accept cloud, then re-paste. v1 documents these recovery paths in user-facing help if needed."*

---

## Issue #13 — Semantic divergence implementation cost at every keystroke

**v1.1 reference:** §4.4 implementation guidance ("maintain `lastSyncedSnapshot` reference… deep-equal" or hash or canonical-JSON).
**Codebase reference:** [`api/lib/draftValidation.js:30`](../../api/lib/draftValidation.js:30) — `MAX_DATA_BYTES = 100_000` (the upper bound on `data` payload size).

Semantic divergence check on every mutation. If implementation is deep-equal of two CoupleData objects up to 100KB each, the cost at every keystroke is non-trivial:

- Deep-equal traversal of nested object/arrays: O(N) on payload size.
- For 100KB payload, ~5–15ms per check on a mid-range mobile device.
- Triggered on every keystroke during composition (without debounce, since the dirty flag should reflect immediate state).

**Risk:** input-lag during composition on slow devices. The whole product positioning ("ceremonial, slow, weighted") is fragile to input-lag — a stutter during emotional writing is exactly the wrong UX moment.

**Suggested amendment:** §4.4 implementation guidance amendment: *"The semantic-divergence check should run on the same debounce as autosave (1000ms), NOT on every keystroke. Until the debounce fires, `hasLocalChanges` may be 'optimistically true' — i.e., flip to true on first mutation since last sync, stay true until next successful sync. Concretely: maintain an in-memory `dirtyBit` that flips true on any mutation (cheap) and is only reconciled to false on successful sync. The semantic-divergence check is the GATE for `hasLocalChanges = false` on sync, not a real-time predicate."*

This is a meaningful implementation guidance change. Doctrinally equivalent; performantally critical.

---

## Issue #14 — In-flight save during reconciliation modal open

**v1.1 reference:** §5.2 (modal opens during sign-in); §6 (save flow).
**Codebase reference:** [`App.tsx:570-572`](../../App.tsx:570) — `saveInFlightRef` guards against overlapping saves; [PR-48 Phase 4](../../App.tsx) — modal can open while a save is mid-fetch.

Scenario: user clicks Save Draft. Save's POST is in flight (network round-trip ~200ms). During that window, sign-in completes and triggers hydration. Hydration detects Case B and opens modal. Save's response arrives — depending on outcome:

- **200 OK:** save succeeded. The Case B modal is irrelevant now (cloud just got the user's local content). But the modal is open, asking the user to pick between local and cloud — both of which are now cloud-equal. UX confusion.
- **409 STALE_REVISION:** stale-revision modal would normally fire. Now there are TWO modals stacked (Case B + StaleRevision). UX collision.
- **5xx / network:** save failed silently. User picks Case B option. State updates ambiguous.

**Risk:** modal stacking + state collision during the cookie-race window.

**Suggested amendment:** §5 add a subsection 5.6 *"Hydration during in-flight save"*:

> If a save is in flight (`saveInFlightRef.current === true`) when hydration would open the Case B modal:
> - Defer opening the modal. Set a pending-reconciliation flag.
> - When the save resolves (success, stale-revision, or failure):
>   - **Save succeeded:** discard pending reconciliation; hydration is now stale; trigger a fresh `/api/draft` GET to re-evaluate.
>   - **Save STALE_REVISION:** open StaleRevisionModal as designed; skip the pending Case B (it would have been the same conflict).
>   - **Save failed (network):** open the pending Case B modal; user resolves.
> - This serializes save-resolution before modal-display so they never stack.

---

## Issue #15 — DraftStateObserver fate after multi-state revert

**v1.1 reference:** §10.3 ("`3b5dc88` useDraftStateObserver multi-state logic — keep revision tracking, remove state-machine logic").
**Codebase reference:** [`hooks/useDraftStateObserver.ts`](../../hooks/useDraftStateObserver.ts) — entire 167-line hook.

§10.3 says to "keep revision tracking, remove state-machine logic." But the observer's reason for existing is the state machine (firing `/api/drafts/transition` on UIStage milestone boundaries). If state-machine logic is removed, what's left of the observer?

Two interpretations:
1. **Observer is fully removed.** Revision tracking moves into App.tsx's main hydration handler. Simpler, more honest.
2. **Observer is kept as a "revision sync watchdog"** that periodically refreshes revision from cloud. Useful for cross-device staleness detection — but the proposal doesn't describe this anywhere.

If (1), say so. If (2), describe the new responsibility.

**Risk:** ambiguous fate of a 167-line file with race-protection patterns documented as "load-bearing." An implementer might preserve the observer for safety, ending up with dead code in the new model.

**Suggested amendment:** §10.3 clarify: *"`hooks/useDraftStateObserver.ts` is fully removed in PR-48.A. The revision tracking it provided (capturing `revision` from `/api/drafts/transition` responses) is no longer needed because draft-state transitions are not part of the single-draft model — the hook's purpose evaporates with the state machine. Any remaining places App.tsx reads `draftRecord.revision` get their value from `GET /api/draft` (hydration) or `POST /api/draft` (save response)."*

---

## Semantic-contradictions audit (Category 9)

Three places where prose in different sections doesn't quite match:

### S1 — §6.2 "Local remains populated. It is NOT cleared" vs §5.3 "Continue Saved Draft: Local autosave replaced with cloud's data"

§6.2 (happy path) says local is preserved post-save. §5.3 (Case B "Continue Saved Draft") says local is replaced with cloud's content. These are not contradictory but the word "remains populated" in §6.2 might read as "left alone" — whereas §5.3's "replaced" overwrites the existing content with cloud's content (which is now also the post-save cloud content, so semantically equivalent).

**Suggested amendment:** §6.2 reword *"Local mirrors cloud. data === cloud.data… Local remains populated."* to *"Local mirrors cloud. The autosave entry's `data` now equals cloud's saved data; it is not cleared."*

### S2 — §4.2 "Successful hydration from cloud → hasLocalChanges = false" vs §5.3 "Continue Recent Edits: Local autosave retained, lastKnownCloudRevision updated, hasLocalChanges = true"

§4.2 transition rule says hydration sets `hasLocalChanges = false`. §5.3 (Continue Recent Edits) says hydration of revision sets `hasLocalChanges = true`. Are these contradictory?

Resolution: §4.2's "hydration" is the full cloud-overwrites-local hydration. §5.3's "Continue Recent Edits" is NOT full hydration — it only updates `lastKnownCloudRevision` (the revision-tracking part), leaves `data` as local. So `hasLocalChanges = true` is correct.

But §4.2's table conflates the two with a single row. An engineer reading §4.2 in isolation could miss the §5.3 carve-out.

**Suggested amendment:** §4.2 split the "Successful hydration from cloud" row into two:
> - **Full hydration (Case A silent / Case B 'Continue Saved Draft'):** `data = cloud.data, lastKnownCloudRevision = cloud.revision, hasLocalChanges = false, lastSyncedSnapshot = cloud.data`.
> - **Revision-only hydration (Case B 'Continue Recent Edits'):** `lastKnownCloudRevision = cloud.revision, hasLocalChanges = true` (data and lastSyncedSnapshot intentionally untouched).

### S3 — §11.4 "If cloud has moved (which it has — that's why save failed), the DELETE also fails with STALE_REVISION"

§11.4 says cloud has moved if save failed. But save's STALE_REVISION fires because client's `lastKnownCloudRevision < cloud.revision`. The DELETE that follows uses the SAME `lastKnownCloudRevision` (the client hasn't updated it after the failed save). So DELETE would also CAS-fail with the same STALE_REVISION. §8.3 step 3's secondary modal handles this.

§11.4's phrasing is technically correct but reads as if the STALE_REVISION pattern is the user's fault. Soften and align with §8.3.

**Suggested amendment:** §11.4 reword: *"The DELETE would fail with STALE_REVISION for the same reason the save did — the client's `lastKnownCloudRevision` predates cloud's actual state. §8.3's secondary confirmation modal handles this gracefully."*

---

## Recommended v1.1 → v1.2 patch summary

Compact list of one-sentence amendments. Each item maps to an issue above.

1. **§5.2 add:** "While the modal is open, `usePreparationPersistence` is paused (`enabled=false`)."
2. **§4.4 add:** "`lastSyncedSnapshot` updates MUST be co-committed with `data` updates."
3. **§8.3 add:** "Cancel on the secondary modal closes both modals; `lastKnownCloudRevision` updates to `currentRevision`."
4. **§4.4 lock:** "`lastSyncedSnapshot` holds the `selectiveHydrate`-projected view of cloud data."
5. **§6 clarify:** "Save flow uses App.tsx's `data`; PreparationForm onComplete must fire first if save is triggered from PREPARE."
6. **§11 add:** "Cross-user localStorage leak on sign-out + different-user sign-in is a pre-existing limitation. PR-48.A picks resolution: clear-on-sign-out / clear-on-uid-change / UID-namespace."
7. **§12 add to PR-48.A migration:** "Compute meaningful-content on existing local during migration; mark `hasLocalChanges: false` if non-meaningful."
8. **§8.1 expand modal body:** Surface cloud metadata (recipient, last-edited, word count) in Begin Again confirmation.
9. **§9.2 add:** "DELETE REQUIRES `expectedRevision`; null is rejected with 400."
10. **§5 add §5.4:** Hydration failure modes (401, 5xx, network).
11. **§5 add §5.5:** Stage-aware hydration semantics.
12. **§11.5 add:** Consecutive STALE_REVISION cycles documented as v1-acceptable; recovery via sign-out+in or manual copy-paste.
13. **§4.4 implementation note:** Semantic-divergence check runs on debounce, not per-keystroke. `hasLocalChanges` is optimistically true between mutations; reconciled to false only on successful sync.
14. **§5 add §5.6:** In-flight save handling — defer modal until save resolves; never stack.
15. **§10.3 clarify:** `useDraftStateObserver` is fully removed in PR-48.A.

Plus three semantic-clarification edits:
- **S1:** §6.2 reword "remains populated" to "is not cleared; autosave entry now mirrors cloud."
- **S2:** §4.2 split the hydration row into Full Hydration vs Revision-only Hydration.
- **S3:** §11.4 soften phrasing and link to §8.3.

**Estimated v1.2 diff:** ~15 single-sentence additions, 3 section-splits, no structural changes. The proposal is structurally sound; v1.2 is the surface polish before PR-48.A begins.

---

## Closing

v1.1 is a substantial improvement over v1.0. The pivot direction is correct; the doctrine sentences are largely well-placed; the CAS-on-DELETE addition is the right safety call. The remaining 15 issues surfaced here are clarifications, edge-case locks, and one performance note (issue #13). None block PR-48.A from beginning, but issues #4, #5, #6, #10, #11, and #14 would be hard to retrofit later — they're better closed in v1.2 before code starts.

The most important single addition is **issue #4** — the `selectiveHydrate`-projection rule for `lastSyncedSnapshot`. Without it, hydration creates a false-dirty state on the first mutation cycle, which would silently degrade the reconciliation gate's reliability. Lock that one explicitly in v1.2 doctrine.

---

End of stress test. No code modified. No fix prompts. Awaiting v1.2 or founder lock.
