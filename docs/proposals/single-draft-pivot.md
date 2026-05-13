# Single-Draft Pivot — Design Proposal
**Document:** Design proposal for PR-48 architectural pivot
**Version:** v1.2
**Status:** Founder lock pending; awaiting final design-coherence review per §16
**Author:** Ajmal Fahad (with Claude + ChatGPT cross-voice review + Claude Code codebase-anchored stress test)
**Date:** 13 May 2026
**Supersedes:** v1.1 (same day) — see changelog below
**Target path in repo:** `docs/proposals/single-draft-pivot.md`
---
## Changelog v1.1 → v1.2
Eighteen amendments from Claude Code's codebase-anchored stress test (15 issues + 3 semantic-contradiction fixes), plus 3 founder design locks and 1 new meta-doctrine. All integrated.
**Founder locks for the three structural choices the stress test surfaced:**
- L1 — Cross-user localStorage isolation → **UID namespacing** with explicit no-auto-merge doctrine (§4.5)
- L2 — Semantic divergence timing → **debounced evaluation** with optimistic dirty bit; reconciliation reads only settled state (§4.4)
- L3 — `useDraftStateObserver` fate → **fully removed** (§10.3)
**New meta-doctrine introduced:**
- §4.6 — *"Synchronization occurs only at explicit synchronization boundaries"* — enumerates hydration, successful save, successful delete. Prevents future background-sync helper creep.
**Issue resolutions** (by stress-test issue number):
| # | Issue | Resolution in v1.2 |
|---|---|---|
| 1 | Autosave during modal | §5.2 — autosave hook paused (`enabled=false`) while reconciliation modal open |
| 2 | Hydration ordering | §4.2 — explicit batched-write ordering for data + lastSyncedSnapshot + revision + dirty flag |
| 3 | Secondary modal cancel flow | §8.3 step 3 — Cancel closes both modals; revision refresh from server response |
| 4 | `selectiveHydrate` projection (load-bearing) | §4.4 — `lastSyncedSnapshot` holds the projected view; semantic check operates in projected space |
| 5 | Two `data` sources | §6.1 — save flow uses App.tsx data; PREPARE save requires onComplete handoff first |
| 6 | Cross-user localStorage leak | §4.5 — UID namespacing per L1 |
| 7 | Migration false-positive Case B | §12 PR-48.A — meaningful-content check during migration |
| 8 | Begin Again metadata preview | §8.1 — surface recipient/timestamp/word count in confirmation |
| 9 | DELETE null-revision semantics | §9.2 — DELETE REQUIRES expectedRevision; null rejected with 400 |
| 10 | Hydration failure modes | §5.4 (new) — 401/5xx/network handling |
| 11 | Stage-aware hydration | §5.5 (new) — PREPARE / REFINE+ semantics |
| 12 | Continued STALE_REVISION loop | §11.5 — documented as acceptable v1; recovery paths named |
| 13 | Semantic check performance | §4.4 — debounced per L2 |
| 14 | In-flight save during modal | §5.6 (new) — defer modal until save resolves |
| 15 | DraftStateObserver fate | §10.3 — fully removed per L3 |
**Semantic contradictions resolved:**
- S1 — §6.2 reworded ("autosave entry mirrors cloud" not "remains populated")
- S2 — §4.2 split hydration row into Full Hydration vs Revision-only Hydration
- S3 — §11.4 phrasing softened, linked to §8.3
---
## 0. TL;DR
PR-48 attempted to support up to 3 cloud drafts per user with parallel parked states (ACTIVE/PAUSED), a three-button reconciliation modal, and orchestrated lifecycle transitions. Runtime testing of Phase 4 on 13 May 2026 surfaced not specific bugs but **architectural redundancy** — two of three reconciliation buttons did literally the same thing — and a documented limitation that required the Phase 5 dashboard to be usable.
Three independent reviews (Claude design pass, ChatGPT philosophy/UX pass, Claude Code codebase-anchored stress test) converged: the multi-draft model is **philosophically wrong** for SealedVow. It imports inventory-management thinking into an emotional product whose charter explicitly rejects productivity-software framing.
This proposal pivots to a **single-draft model**: one user, one evolving letter, multi-device by design, with revision CAS protecting both concurrent edits AND destructive operations, with UID-namespaced local persistence preventing cross-user contamination, and with an explicit emotional-trust contract around when and how the user's writing is destroyed.
The user-facing requirement (*"I want to retrieve my saved draft from any device"*) is fully met. The complexity surface drops by an estimated 60-70%. Three scoped PRs deliver the pivot.
---
## 1. Why we removed multi-draft
This section exists explicitly to prevent re-introduction of multi-draft six months from now by an engineer who doesn't remember why it was cut. **The cut was philosophical, not technical. Do not undo it without explicit user evidence.**
### 1.1 Product charter alignment
The SealedVow Product Charter (Section V — "What SealedVow Is Not") declares:
> SealedVow is not productivity software. The product does not optimize for speed, throughput, batch operations, templates as efficiency tools, or repeatable workflows.
> SealedVow is not relationship gamification. There are no badges, streaks, achievement counters, anniversary rewards, completion percentages, or any quantitative representation of relational depth.
Multi-draft is **inventory thinking**. It assumes the user is managing a queue of in-progress letters, parking one to start another, tracking parallel work-in-progress across multiple recipients. This is productivity-software thinking imported into a product whose charter explicitly rejects it.
The user a SealedVow draft serves is not managing a queue of letters. They are crafting ONE letter, for ONE person, for ONE occasion — slowly, ceremonially, with weight. The idea that they would be "parking" mid-letter to start a different letter for a different person is incompatible with the product's emotional positioning.
### 1.2 The diagnostic evidence
Runtime testing on 13 May 2026 (documented in `docs/diagnostics/2026-05-13-phase4-continue-dashboard-bug.md`) revealed that two of three reconciliation buttons in `SignInReconciliationModal` — "Continue Dashboard Draft" and "Discard Local Draft" — had **identical handler bodies**. Both called the same shared helper, both produced the same post-state, both ended up "cloud as authority, local discarded."
The architecture had imagined two distinct user mental models but the implementation could not find two distinct behaviors to implement. **That is the textbook signal that the abstraction is wrong.** When code can't differentiate two cases the design says are different, the design is overspecified.
The third button — "Save Local Draft as New" — was the only structurally distinct path. It was the multi-draft creation path. Removing it eliminates the entire premise that the system needs to coordinate parallel drafts.
### 1.3 Cross-voice convergence
Three independent reasoning processes — Claude (design level), ChatGPT (philosophy/UX level), Claude Code (codebase-anchored implementation level) — reviewed the same evidence and converged on the same recommendation: pivot to single-draft. None coordinated with the others. Each surfaced distinct findings; all agreed on direction. The convergence is documented in §15 of this proposal.
### 1.4 The future-conditional clause
If user research six months from now reveals that users genuinely want to manage parallel drafts — concrete evidence, not engineer speculation — multi-draft can be reintroduced as a deliberate v2 capability.
Until then, multi-draft is speculation cosplaying as foresight. Build for the user you have, not the user you imagine you might have.
---
## 2. Product principle: one emotional thread
The user's relationship with the product is:
> *"I am writing ONE letter, to ONE person, for ONE occasion."*
This frames every behavior:
- **Local autosave preserves unsynced work on the current device.** It does not synchronize across devices on its own; it is a per-device safety net against tab-close, browser-crash, accidental navigation.
- **Cloud synchronization makes the draft retrievable across devices once saved.** A successful save to cloud is what makes the user's work available on their other devices.
- **Sign-in on any device** brings them back to their one in-progress letter (the cloud version, or a reconciled merge of cloud + local per §5).
- **The dashboard** shows their one in-progress letter (or empty state if none).
- **Starting a new letter** explicitly ends the current one (destructive, cross-device, with confirmation).
There is no parking. There is no inventory. There is the letter they are working on, until they finish it (send it) or replace it (Begin Again).
---
## 3. Doctrine: meaningful content
The reconciliation gate (§5) depends on a precise definition of "meaningful content." This must be locked at doctrine level so future engineers don't drift the predicate without realizing they're changing reconciliation behavior.
**A draft has meaningful content if ANY of:**
- A recipient name is filled in (non-empty after trim)
- A sender name is filled in (non-empty after trim)
- The body text is ≥50 characters (after trim, excluding whitespace)
- At least one media upload (photo, song, audio, gift PDF) has been added
**A draft does NOT have meaningful content when:**
- All four conditions above are false
- Fields contain only whitespace
- Fields contain only default placeholders / auto-generated scaffold values the user hasn't touched
- Body text is <50 characters
**Why 50 characters?** Deliberately permissive. Counts a single committed sentence as meaningful ("I love you for who you are.") but ignores a user who typed "Dear" and walked away. Adjust if real usage shows the threshold is wrong; do not adjust without evidence.
**Implementation**: shared utility (e.g., `utils/meaningfulContent.ts`) imported by both client-side hydration logic and (if needed) server-side validation. Same predicate evaluated identically on local autosave's `data` (in projected space — see §4.4) and on cloud snapshot's `data` (in projected space).
---
## 4. The sync confidence model
The whole system collapses to **one question** at sign-in:
> Is the local autosave's view of the world still aligned with cloud's current state, or has local diverged?
This question is answered by **comparing revisions**, never by trusting a boolean alone. Booleans rot in distributed systems: local can claim `synced=true` while cloud has been updated from another device.
### 4.1 Local autosave schema
```ts
{
  data: CoupleData,                       // the user's content (projected per §4.4)
  lastKnownCloudRevision: number | null,  // cloud revision local last synced from (null if never synced)
  hasLocalChanges: boolean                // dirty flag: true if local has diverged from lastSyncedSnapshot (per §4.4 doctrine)
}
```
Stored under a UID-namespaced key per §4.5.
A separate in-memory ref holds `lastSyncedSnapshot` (the canonical baseline for semantic-divergence checks). The ref does not need to be persisted because the baseline is reconstructed from cloud on next hydration.
### 4.2 State transitions
| Trigger | Effect on local autosave |
|---|---|
| Successful save to cloud (`POST /api/draft` → 200) | `lastKnownCloudRevision = response.revision`, `hasLocalChanges = false`, `lastSyncedSnapshot = data` |
| **Full hydration from cloud** (Case A silent / Case B "Continue Saved Draft") | `data = projected(cloud.data)`, `lastSyncedSnapshot = projected(cloud.data)`, `lastKnownCloudRevision = cloud.revision`, `hasLocalChanges = false` — all four writes batched in same React commit |
| **Revision-only hydration** (Case B "Continue Recent Edits") | `lastKnownCloudRevision = cloud.revision`, `hasLocalChanges = true` — `data` and `lastSyncedSnapshot` intentionally unchanged (local diverges from cloud by design) |
| Semantic user edit (see §4.4) | optimistic `hasLocalChanges = true` immediately; settled on next debounce |
| Sign out | No change to user-namespaced entry; subsequent edits write to `vday_data_draft:anonymous` per §4.5 |
| Begin Again confirmed | All three fields cleared / reset |
**Hydration ordering contract (Issue #2 resolution):** the four writes for full hydration MUST be co-committed in a single React batch. If implemented via React state, both setters are called within the same synchronous event handler so React's automatic batching applies. If implemented via refs (e.g., for `lastSyncedSnapshot`), the ref write precedes any setState that would trigger autosave. The intent: `lastSyncedSnapshot` is always available as a comparison baseline at the moment `data` changes.
### 4.3 Reading the state at hydration
When the app loads (signed-in user):
1. Read user-namespaced local autosave (per §4.5) → `localData`, `localLastKnown`, `localDirty`
2. Fetch cloud → `GET /api/draft` returns either `{data, revision, updatedAt}` or 404
3. Compute `localMeaningful = meaningfulContent(localData)` and `cloudMeaningful = meaningfulContent(cloud.data || null)` — both evaluated on projected views
4. Apply the reconciliation gate (§5)
If `GET /api/draft` returns 401, 5xx, or network error, follow §5.4 (hydration failure modes).
### 4.4 Doctrine: what "dirty" actually means
> **`hasLocalChanges` reflects semantic divergence from the last successfully synchronized cloud snapshot, not mere field mutation.**
This is the most important sentence in this section. Without it, `hasLocalChanges` becomes unreliable over time.
**Why this matters**: autosave fires on every field update. Without semantic-divergence semantics, the following all incorrectly mark local as dirty:
- User types a character, then deletes it → no net change, but two field mutations
- Whitespace churn (trailing space added then removed)
- Focus/blur normalization (e.g., trimming whitespace on blur)
- Auto-formatting (e.g., title case)
- Hydration rewrite (cloud snapshot lands, autosave receives the new value, mutation fires)
Each of these is a syntactic mutation but not a semantic change.
**Projection rule (Issue #4 resolution — load-bearing):**
> `lastSyncedSnapshot` and the local `data` field operate on a **projected view** of cloud data. The projection strips fields that local persistence does not roundtrip cleanly — server-set status/timestamps, security tokens, PII not stored locally. Concretely: apply `selectiveHydrate(cloud.data)` before storing as `lastSyncedSnapshot`. The semantic-divergence check compares two projections in the same space.
Without this projection rule, every hydration creates an apparent semantic mismatch (cloud's `status`/`sealedAt`/etc. don't exist in local), the dirty flag flips to true on the first post-hydration mutation, and the reconciliation gate becomes unreliable. This was the single most important issue surfaced by Claude Code's stress test.
**Performance contract (L2 — debounced evaluation):**
The semantic-divergence check runs on the autosave debounce (currently 1000ms), NOT on every keystroke. Per-keystroke deep-equality of two CoupleData objects (up to 100KB) would create input-lag on mid-range mobile devices — exactly the wrong UX moment for an emotional writing product.
Concretely:
- Maintain an in-memory `dirtyBit` that flips `true` immediately on any field mutation (cheap; no comparison).
- Every 1000ms (debounce), the semantic-divergence check runs: deep-equal `data` against `lastSyncedSnapshot`. If equal, `hasLocalChanges = false` (correction). If different, `hasLocalChanges = true` (confirmation).
- The optimistic `dirtyBit` is the immediate signal for UI affordances ("unsaved changes" indicator if any). The settled `hasLocalChanges` is the reconciliation-grade signal.
**Critical rule:** reconciliation logic (§5) NEVER reads the transient optimistic `dirtyBit`. It reads only the settled `hasLocalChanges`. This is because reconciliation runs at sign-in time, after the debounce has long since fired and `hasLocalChanges` has settled.
Explicit doctrine: **reconciliation never evaluates against transient state.** Sign-in flow must wait for any in-progress debounce to complete before reading `hasLocalChanges`, OR must call the debounce flush synchronously before reading. PR-48.A picks the mechanism; the doctrine binds the requirement.
**Implementation guidance** (one of these; PR-48.A chooses):
- Maintain `lastSyncedSnapshot` as a ref/state. On debounce fire, compare `data` against `lastSyncedSnapshot` with structural deep-equal (in projected space).
- Alternative: content hash of `lastSyncedSnapshot`. On debounce, hash the current `data` and compare.
- Alternative: canonical-JSON serialize both sides and string-compare.
All three satisfy the doctrine.
### 4.5 Active-key resolution doctrine (UID namespacing — L1)
Local autosave is stored under a UID-namespaced key:
- **Signed-out user**: read/write `vday_data_draft:anonymous`
- **Signed-in user**: read/write `vday_data_draft:{uid}` where `{uid}` is the Firebase user ID
**Read/write resolution rules:**
- When the app is signed-in, ALL reads and writes resolve to `vday_data_draft:{uid}`.
- When the app is signed-out, ALL reads and writes resolve to `vday_data_draft:anonymous`.
- The hook (`usePreparationPersistence`) reads the current auth state and resolves the active key at each operation.
**Sign-in transition (anonymous → user namespace):**
When a signed-out user signs in:
- The user-namespaced entry (`vday_data_draft:{uid}`) is read.
- The cloud is fetched.
- The reconciliation gate (§5) evaluates user-namespaced local vs. cloud.
- **The anonymous-namespace entry is NOT silently merged into the user namespace, ever.** This protects against cross-authority ambiguity.
**Anonymous draft handling at sign-in:**
If the anonymous-namespace entry has meaningful content at sign-in, three explicit policies apply (PR-48.A implementer chooses ONE during implementation; document the choice in the doctrine doc):
- **(P1) Preserve only.** Anonymous entry stays in its namespace, untouched. If user signs out again, it reappears. No UI surface in the signed-in state.
- **(P2) Explicit import prompt.** A small one-time modal asks: "You wrote a draft while signed out. Import it to your account, discard it, or keep it for now?" User chooses. Modal does NOT auto-fire repeatedly; once decided, the anonymous entry is either imported (moved to user namespace) or marked as deferred.
- **(P3) Silent import-when-empty.** If user-namespaced is empty AND cloud is empty, anonymous content moves to user namespace as the user's "current" draft. This is technically not a merge (nothing to merge with) but represents the system making a choice on the user's behalf.
**Recommendation:** P1 for v1 (simplest, no new UX surface). If user feedback shows confusion, upgrade to P2. Avoid P3 — it makes a choice on the user's behalf which contradicts the §1 emotional-trust framing.
**Sign-out transition:**
- User-namespaced entry remains in localStorage (non-destructive per §4.2 transition rules).
- Subsequent edits write to `vday_data_draft:anonymous`.
- The user-namespaced entry is reachable again only when the user signs back in with the same UID.
**Migration from pre-pivot keys** — see §12 PR-48.A scope.
### 4.6 Synchronization boundaries doctrine
> **Synchronization between local and cloud occurs only at explicit synchronization boundaries. There are exactly three:**
>
> 1. **Hydration** — at sign-in or app mount when signed-in; cloud → local.
> 2. **Successful save** — local → cloud via `POST /api/draft`; on success, local updates to mirror.
> 3. **Successful delete reconciliation** — `DELETE /api/draft` (Begin Again); local + cloud cleared together.
There are no background sync helpers, periodic revision watchdogs, eventual-consistency reconciliation daemons, or hidden authority arbiters. Every state change crosses an explicit, user-traceable boundary.
This doctrine exists to prevent a class of architectural drift where engineers add "small helpers" for "edge cases" that quietly reintroduce the very complexity this pivot is removing. If a future change appears to require a sync helper, the change is wrong — revisit the design instead of adding the helper.
### 4.7 Why this beats a naked `isLocalSynced` boolean
A boolean stored only on local cannot know whether cloud has moved on. The boolean would lie the moment a different device saved.
Revision comparison (`localLastKnown` vs `cloud.revision`) is the actual truth on the cloud-axis. Combined with the semantically-evaluated `hasLocalChanges` flag, the system can distinguish:
- **Local clean and `lastKnown` matches cloud** → local is just a mirror of cloud, ignore local
- **Local clean and `lastKnown < cloud.revision`** → cloud has moved on (different device updated); trust cloud
- **Local dirty** → local has divergent edits, count as meaningful for reconciliation
This is the architectural center of the new system.
---
## 5. Reconciliation gate (sign-in)
When the user signs in, the system has two pieces of state to reconcile: user-namespaced local autosave (per §4.5) and cloud draft. Reconciliation is decided by **one rule**:
> If only one side has meaningful content → silent hydrate to that side.
> If both sides have meaningful content → 2-button modal.
That's the entire reconciliation surface. No timestamps. No thresholds. No state machines.
### 5.1 Case A — One side meaningful (silent)
| Local meaningful | Cloud meaningful | Action |
|---|---|---|
| No | No | No action. User sees fresh form. |
| Yes | No | Silent — keep local. (User typed while signed out; cloud is empty.) Local stays as-is. `hasLocalChanges` stays true; next save will create cloud draft. |
| No | Yes | Silent — hydrate from cloud (full hydration per §4.2). Local autosave is replaced with `projected(cloud.data)`. `lastKnownCloudRevision = cloud.revision`, `hasLocalChanges = false`. |
No modal in any of these cases. The user is not interrupted with a question that has only one reasonable answer.
### 5.2 Case B — Both meaningful (modal)
Both user-namespaced local has meaningful content AND cloud has meaningful content. The user must choose explicitly.
**SignInReconciliationModal:**
> **Title:** "You have two versions of this letter."
>
> **Body:** "One is saved on your account, one was written on this device. Which would you like to continue?"
>
> **Buttons:**
> - **Continue Saved Draft** (uses cloud, discards local)
> - **Continue Recent Edits** (uses local, becomes editing authority)
**Doctrine — internal meaning of "Continue Recent Edits":**
> The "Continue Recent Edits" button is NOT "trust local because it's newer" or "trust local because user just typed." It is **the user's explicit choice of local authority despite cloud divergence**.
>
> The button does not promise "your edits will win." It promises "we will keep your edits and attempt to save them; the save itself is CAS-protected and may fail if cloud has moved on again."
**No third option.** No "save both as separate drafts" — that path doesn't exist in single-draft architecture.
**No cancel/dismiss.** The user must choose. The modal blocks until resolved:
- Backdrop click is disabled
- No X close button
- Escape key disabled
- **Editor beneath the modal is non-interactive** — all form fields, buttons, and inputs are blocked while the modal is open
- **Local autosave is paused while the modal is open** — `usePreparationPersistence` runs with `enabled=false` for the modal's open duration. This prevents background mutations from drifting the local content during the user's decision (Issue #1 resolution)
Reasoning: deferring the decision or allowing background edits would create authority ambiguity that this whole architecture is designed to eliminate.
### 5.3 Post-choice behavior
**If user picks "Continue Saved Draft":**
- Local autosave replaced with `projected(cloud.data)` (full hydration per §4.2)
- `lastKnownCloudRevision = cloud.revision`, `hasLocalChanges = false`, `lastSyncedSnapshot = projected(cloud.data)`
- All four writes batched per §4.2 ordering contract
- Modal closes
- Autosave hook re-enabled (`enabled=true`)
- User sees cloud's content in the editor
**If user picks "Continue Recent Edits":**
- Local autosave retained (revision-only hydration per §4.2): `lastKnownCloudRevision = cloud.revision` updated; `data`, `lastSyncedSnapshot`, and `hasLocalChanges = true` preserved as-is
- Modal closes
- Autosave hook re-enabled (`enabled=true`)
- User sees local content in the editor
- **Next save attempt** fires `POST /api/draft` with `expectedRevision = cloud.revision` (the revision observed at hydration)
- If cloud has not advanced again: save succeeds, cloud now has local's content at revision N+1
- If cloud HAS advanced between modal-choice and next save: server returns 409 STALE_REVISION → StaleRevisionModal fires (§7), local edits still preserved per §7.2
The save is CAS-protected. The "Continue Recent Edits" choice does not bypass CAS. It cannot be described as "will overwrite cloud" without qualification.
### 5.4 Hydration failure modes (Issue #10 resolution)
`GET /api/draft` may fail. Behavior by error class:
- **401 Unauthorized** (cookie race / session not yet established): retry with exponential backoff (500ms, 1s, 2s — up to 3 attempts). If all retries fail with 401, treat as signed-out — fall back to anonymous-namespace local content and skip the reconciliation gate's cloud side.
- **5xx server error**: silent retry once after 2s. If still failing, treat as Case C (local authoritative). Do NOT surface a modal — user is not blocked. Background re-attempt on next user action (next save) will refresh.
- **Network error / fetch failure** (offline): treat as Case C (local authoritative). Local content rendered. Save attempts will fail; user sees normal save-error toast.
- **404**: cloud has no draft. Apply Case A / silent-keep-local based on local content.
No reconciliation modal fires on hydration failure. The user is never blocked by a "cannot reach cloud" state; they can continue editing locally. Cloud reconciliation re-attempts at the next sync boundary (§4.6).
### 5.5 Stage-aware hydration (Issue #11 resolution)
The reconciliation gate above assumes the user is at PREPARE when hydration fires. In practice, the app's mount initializer (PR-47/47.1 behavior) can land the user at REFINE, PERSONAL_INTRO, QUESTION, MAIN_EXPERIENCE, or PAYMENT if `vday_data_draft.stage` is valid.
Behavior matrix by stage:
| User stage | Case A silent (cloud only) | Case A silent (local only) | Case B (both) |
|---|---|---|---|
| PREPARE | Apply cloud; stage stays PREPARE | Keep local; stage stays PREPARE | Modal fires; user resolves |
| REFINE+ | **Do NOT apply cloud silently.** Hold cloud reference; fire Case B modal as if both meaningful (user must explicitly choose to leave their current REFINE work for cloud's potentially-older content) | Keep local; stage stays current | Modal fires; "Continue Saved Draft" resets to PREPARE (or to cloud's `draftState`-corresponding stage if Phase 5 supports stage resumption); "Continue Recent Edits" preserves current stage |
The asymmetry at REFINE+ is intentional: a user mid-flow at REFINE has done meaningful work the cloud may not reflect. Replacing their state silently would feel like a yank. Asking explicitly is the trust-preserving move.
### 5.6 In-flight save during reconciliation (Issue #14 resolution)
If a save is in flight (the equivalent of today's `saveInFlightRef.current === true`) when hydration would open the Case B modal:
- **Defer opening the modal.** Set a pending-reconciliation flag.
- When the save resolves:
  - **Save succeeded (200):** discard the pending reconciliation; trigger a fresh `GET /api/draft` to re-evaluate (cloud just got updated; reconciliation needs fresh inputs).
  - **Save returned STALE_REVISION (409):** open the StaleRevisionModal (§7) as designed. Skip the pending Case B — it would have been the same conflict, and presenting two modals in sequence is bad UX.
  - **Save failed (network / 5xx):** open the pending Case B modal; user resolves with whatever state is present.
The doctrine: **save-resolution serializes before modal-display.** Modals never stack.
---
## 6. Happy path: successful save
The conflict surfaces (§5 reconciliation, §7 STALE_REVISION, §8 Begin Again) describe edge cases. This section describes the common path: the user is signed in, they're editing their draft, they hit save (or autosave-to-cloud fires), and it succeeds.
**This is the most-traveled path through the system.**
### 6.1 The save flow
1. User edits a field. Optimistic `dirtyBit` flips to `true` immediately. On next debounce, semantic-divergence check confirms; `hasLocalChanges` flips to `true` (per §4.4).
2. Save fires (manual or autosave-to-cloud, depending on UX trigger).
3. **Save payload provenance** (Issue #5 resolution): the save's `data` payload is App.tsx's `data` state — the post-`onComplete` snapshot. During PREPARE, before PreparationForm's `onComplete` fires, App.tsx's `data` may not reflect in-progress form edits. **If a save is triggered from PREPARE (e.g., from a future Save Draft button), PreparationForm's `onComplete`-equivalent must fire BEFORE the save POST.** PR-48.A's PREPARE-stage save surface must respect this; PR-48.C dashboard navigation must respect this.
4. Client constructs request: `POST /api/draft` with body `{data: projectedLocalData, expectedRevision: localLastKnown}`.
5. Server validates session, runs CAS check, writes new revision.
6. Server returns 200 with `{revision: newRevision, updatedAt: ts}`.
7. Client updates local autosave (all four writes batched per §4.2):
   - `lastKnownCloudRevision = newRevision`
   - `hasLocalChanges = false`
   - `lastSyncedSnapshot = projected(localData)` (the data that just got saved is now the canonical sync baseline)
   - `data` unchanged (it was already what we just saved)
8. UI shows save-success feedback (existing toast/indicator from PR-46.5).
### 6.2 Post-save state contract
After a successful save:
- **Cloud is authority.** It contains the user's most recent committed work.
- **Local mirrors cloud.** `data === projected(cloud.data)`, `lastKnownCloudRevision === cloud.revision`, `hasLocalChanges === false`.
- **Autosave entry is NOT cleared; it now mirrors cloud.** The user can keep editing immediately without re-hydration. Local is the editor's working copy; cloud is the durable backup + cross-device source.
- **Dashboard and local point to the same draft identity.** When the user navigates to the dashboard, the draft card shows the just-saved state. When they return to the editor, local still has it.
- **No identity drift.** The draft has one identity (the cloud-side draftId, if exposed), one revision (the latest), and is consistently visible on local + cloud + dashboard.
### 6.3 Continuous editing after save
After a successful save, the user typically keeps editing. The cycle:
1. They edit → optimistic `dirtyBit = true`; settled `hasLocalChanges = true` after debounce
2. They edit more → no further state change (already dirty)
3. Save fires again → request includes `expectedRevision = lastKnownCloudRevision` (the revision from the most recent successful save)
4. Server CAS-validates, writes new revision
5. Local syncs to new revision; all four writes batched
6. Repeat
This is the steady-state editing loop. Edge cases (§5, §7, §8) are deviations from this baseline.
### 6.4 What does NOT happen on save
- Cloud does NOT get a new draft entity (the same draft is updated in place)
- Dashboard does NOT add a row (it's the same draft)
- Local does NOT get cleared
- The user's editor state does NOT reset
- No second draft is created, ever, under any save scenario
- No background helper fires to "sync" anything else (per §4.6 doctrine)
---
## 7. Cross-device concurrent edits (STALE_REVISION)
When two devices have edited the same draft and both try to save, the second device's save fails with `STALE_REVISION` (cloud's revision has advanced past the device's `lastKnownCloudRevision`).
### 7.1 StaleRevisionModal
> **Title:** "This draft was updated on another device."
>
> **Body:** "Your edits on this device haven't been saved. The version on your account is newer."
>
> **Buttons:**
> - **Reload Latest Draft** (discards local divergent edits, hydrates from cloud)
> - **Keep Editing This Version** (closes modal, retains local edits; next save attempt will also fail until user reloads)
### 7.2 Critical contract — local divergent edits always survive
**Local divergent edits ALWAYS survive STALE_REVISION rejection.** They are never silently cleared. They persist across:
- Page refresh
- Navigation away and back
- Browser close and re-open
- Sign-out and sign-in
They are cleared **only** when the user explicitly clicks "Reload Latest Draft" OR successfully resolves the conflict in a future merge mechanism (out of scope for v1).
This is the **emotional trust contract**: the system never silently destroys writing the user produced. A user who wrote a deeply personal paragraph on mobile while offline must find that paragraph still there when they reopen the app, even if the cloud has since moved on. The emotional cost of "the app lost my words" is asymmetric — it corrodes trust faster than any other failure mode.
### 7.3 What happens if user keeps editing after picking "Keep Editing This Version"
They continue to type. Every save attempt continues to fail with STALE_REVISION. The save error toast surfaces ("Couldn't save just now. Your work is still here."). Local autosave keeps the work.
The user must eventually choose to reload (discarding their offline edits) or manually copy their text out, reload, and re-paste. This is acceptable v1 behavior. Recovery paths documented in §11.5.
---
## 8. Begin Again (destructive replace)
Begin Again is the only path that destroys a draft in single-draft architecture. For signed-in users, it is **cross-device destructive** — every other device's view of this draft also goes away.
### 8.1 Confirmation modal — signed-in copy
> **Title:** "Start a new letter?"
>
> **Body:** "Your saved draft for [recipientName] (last edited [relativeTime], [N] words) will be permanently removed from all devices."
>
> **Buttons:**
> - **Start New Letter** (destructive primary action, red/crimson styling)
> - **Keep Current Draft** (cancel)
**Metadata preview rationale (Issue #8 resolution):** the user must have a concrete sense of what they are about to destroy. A user who just signed in on a fresh device may have empty local but a meaningful cloud draft they never saw — reflexively clicking Begin Again without seeing what's there is the failure case. Surfacing recipient name, last-edited timestamp, and word count anchors the decision in the actual artifact, not an abstraction.
If cloud metadata is unavailable (e.g., during a hydration failure), substitute: "Your unfinished draft (last edited [relativeTime])." If no timestamp is available either, fall back to: "Your current draft."
### 8.2 Confirmation modal — signed-out copy
For users not signed in, the copy must reflect that no cross-device draft exists:
> **Title:** "Start a new letter?"
>
> **Body:** "Starting a new letter will permanently remove your current draft from this device."
>
> **Buttons:**
> - **Start New Letter** (destructive primary action)
> - **Keep Current Draft** (cancel)
Two copy strings is the right cost for emotional-product accuracy.
### 8.3 Atomicity contract — signed-in
The destructive sequence for signed-in users must follow this order with proper failure handling:
1. **First:** call `DELETE /api/draft` with body `{expectedRevision: localLastKnown}` (CAS-protected — see §8.4).
2. **If DELETE succeeds (200):** clear user-namespaced local autosave (all three fields), reset UI to fresh form.
3. **If DELETE fails with STALE_REVISION (409):** another device just updated the cloud draft after the user clicked Begin Again. Show a secondary modal:
   > **Title:** "Wait — this draft was updated on another device."
   >
   > **Body:** "Someone made changes to this draft from another device. Are you sure you still want to start a new letter? This will remove the latest version too."
   >
   > **Buttons:** "Yes, Start New Letter" (retries DELETE with `expectedRevision = currentRevision` from the 409 response) / "Cancel"
   **Cancel on secondary modal behavior (Issue #3 resolution):**
   - Cancel closes BOTH the secondary modal AND the original Begin Again confirmation.
   - User returns to the editor.
   - Local autosave is preserved exactly as it was.
   - `lastKnownCloudRevision` is updated to the `currentRevision` reported in the 409 response. This is NOT a state change to the draft itself — it is the client refreshing its knowledge of cloud's progression so future operations have fresh CAS.
4. **If DELETE fails with network error / 5xx:**
   - DO NOT clear local autosave
   - DO NOT reset UI
   - Surface error toast: "Couldn't start new letter. Please check your connection and try again."
   - The original confirmation modal closes (do not leave it in indeterminate state); user can retry from a clean Begin Again click.
**Why this order matters**: if DELETE failed silently and we cleared local first, the user would be left in a "local cleared but cloud retains" state — they think they started fresh, but their old draft is still on every other device. That is a trust violation. Server must be the source of truth for "the draft is gone"; local cleanup follows server confirmation.
### 8.4 Why DELETE needs CAS protection
Without CAS protection, this race is possible:
1. Device A: user opens app, sees draft at revision 8
2. Device B (concurrent session): user edits and saves to revision 9 (cloud is now at 9, Device A's local still thinks 8)
3. Device A: user clicks Begin Again, confirms
4. Device A sends unguarded `DELETE /api/draft`
5. Server deletes draft (revision 9 — the recent emotional writing from Device B)
6. Device B's user has no idea their work was just destroyed
CAS protection prevents this. Device A's DELETE includes `expectedRevision: 8`. Server sees current revision is 9, rejects with STALE_REVISION, returns `currentRevision`. Device A then asks the user via §8.3 step 3's secondary modal — explicit, informed consent before destroying newer work.
### 8.5 Signed-out Begin Again
For signed-out users, Begin Again is local-only:
- No DELETE call (no cloud draft to delete)
- No CAS check (no revision to validate against)
- Anonymous-namespace local autosave cleared
- UI reset to fresh form
- Uses §8.2 copy
---
## 9. API surface
### 9.1 New endpoints
**Singular noun, singular mental model:**
| Method | Path | Body | Returns | Purpose |
|---|---|---|---|---|
| `GET` | `/api/draft` | — | `{data, revision, updatedAt}` or 404 | Fetch the user's one draft |
| `POST` | `/api/draft` | `{data, expectedRevision?}` | `{revision, updatedAt}` on 200; `{error: 'STALE_REVISION', currentRevision}` on 409 | Atomic save with CAS protection |
| `DELETE` | `/api/draft` | `{expectedRevision}` (REQUIRED) | `{deleted: true}` on 200; `{error: 'STALE_REVISION', currentRevision}` on 409; `{error: 'MISSING_REVISION'}` on 400 | Destructive replace (Begin Again), CAS-protected |
**Auth:** session cookie (unchanged from PR-48).
**Errors:** JSON `{error: 'CODE', ...details}` (unchanged from PR-48).
### 9.2 expectedRevision semantics across endpoints (Issue #9 resolution)
**POST `/api/draft`:**
- `expectedRevision` is REQUIRED for updates to an existing draft.
- `expectedRevision` may be omitted (or sent as `null`) ONLY when creating a brand-new draft (cloud has no record for this user). Server detects "no existing record" and creates revision 1.
- For a client that has any prior `lastKnownCloudRevision !== null`, sending `null` is incorrect and may be rejected with 400 `INVALID_REVISION` at the implementer's discretion.
**DELETE `/api/draft`:**
- `expectedRevision` is REQUIRED. A request with missing or `null` `expectedRevision` is rejected with 400 `MISSING_REVISION`.
- The "null-allowed for new records" exemption that applies to POST does NOT apply to DELETE. DELETE always operates against an existing record; if the record does not exist, server returns 404 (which client treats as effective success — nothing to delete).
This asymmetry is intentional. POST has a legitimate create-new path; DELETE never does. Documenting it prevents an implementer from reading §9.2 and applying POST's null-tolerance to DELETE.
### 9.3 Why singular `/api/draft` not `/api/drafts/current`
`/api/drafts/current` quietly implies "maybe there are others later." It leaves a hook for the old inventory mental model to creep back in.
`/api/draft` is honest. The user has a draft (singular), or they don't. The naming locks the mental model at the API surface.
### 9.4 Retired endpoints
All of these go away in this pivot:
- `/api/drafts/list` → replaced by `GET /api/draft`
- `/api/drafts/save` → replaced by `POST /api/draft` (logic mostly preserved, just renamed; CAS behavior unchanged)
- `/api/drafts/pause` → concept doesn't exist anymore
- `/api/drafts/resume` → concept doesn't exist anymore
- `/api/drafts/discard` → replaced by `DELETE /api/draft`
- `/api/drafts/transition` → **needs evaluation** during implementation; SAVED state transitions may still be needed for "letter sent" recording (see §11.1)
---
## 10. PR-48 commits: kept / simplified / reverted
Inventory of every PR-48 commit and its fate in the pivot.
### 10.1 Kept as-is
| Commit | Description | Why kept |
|---|---|---|
| `9d88920` | §6.5 doctrine addition to local-persistence-contract | Concept still relevant; reframe locally |
| `16c125a` | Diagnostic-3 (multi-draft cloud sync) | Historical artifact; preserve for context |
| `8787786` | Atomic save with CAS via RTDB `.transaction()` | The CAS plumbing is the foundation; remove only the cap-enforcement portion (MAX_DRAFTS=3) |
| `c6e39fd` | Phase 2.2 Admin SDK null-first-call fix | **CRITICAL bug fix unrelated to multi-draft.** Keep unchanged. |
| `b7f6a02` | Wire expectedRevision through save caller | CAS plumbing; keep |
### 10.2 Simplified
| Commit | Description | Simplification |
|---|---|---|
| `cae4cd7` | utils/saveDraft.ts + utils/lifecycleDraft.ts | saveDraft kept and renamed/refactored; lifecycleDraft removed (no pause/resume) |
| `a3416d5` | handleSaveAndContinueLater migration | Kept, simplified — no transition orchestration |
| `4ef9ccb` | StaleRevisionModal + ReconciliationState union | StaleRevisionModal kept with updated copy (§7); ReconciliationState union simplifies to fewer cases |
| `d5c8990` | BeginNewPromptModal + cloud-aware Begin Again | Replaced with BeginAgainConfirmationModal (signed-in/out copy per §8.1, §8.2; CAS-protected DELETE per §8.3; secondary modal for STALE_REVISION) |
| `71af5d5` | SignInReconciliationModal + hydration gating | Modal kept, simplified to 2 buttons; autosave-pause-while-modal-open enforced per §5.2; HydrationResolutionState simplified |
### 10.3 Reverted
| Commit | Description |
|---|---|
| `fb8e145` | pause.js / discard.js / resume.js endpoints — entire endpoint set retires |
| `0980824` | transition.js refactor — concept retires for now; revisit if SAVED transition needed |
| `3b5dc88` | useDraftStateObserver — **fully removed (L3)** |
**useDraftStateObserver fate (L3 — Issue #15 resolution):** the entire 167-line hook is removed in PR-48.A. Its purpose was the state machine (firing `/api/drafts/transition` on UIStage milestone boundaries). With the state machine gone, the hook has no remaining responsibility. Any places App.tsx reads `draftRecord.revision` get their value from `GET /api/draft` (hydration) or `POST /api/draft` (save response). No "revision watchdog" replaces it — per §4.6 doctrine, there are no background sync helpers.
### 10.4 Doctrine doc fate
`208bdb7` added `docs/contracts/active-paused-state-machine.md`. Move this file to `docs/archived/2026-05-12-active-paused-state-machine.md` with a header note explaining it was superseded by the single-draft pivot. Don't delete — it's part of the institutional learning record.
Replace with new `docs/doctrine/sync-confidence.md` written as part of PR-48.A's deliverables.
### 10.5 Branch strategy
Continue work on `pr48-cloud-draft-sync`. Add new commits that revert/simplify multi-draft work. Squash before merging to `development`. The history of what was tried (and learned from) is preserved in the branch; the merge commit ships a clean diff.
---
## 11. Open questions / scope edges
Deliberately deferred. None block the pivot.
### 11.1 SAVED state transition
The existing draft state machine has `DRAFT → COMPLETED → SAVED` (or similar). The `transition.js` endpoint handled state transitions. Question: in single-draft architecture, does SAVED state still need a dedicated endpoint, or can it fold into `POST /api/draft` with a `state` field?
**Decision deferred to implementation.** If transition is purely server-side state recording (e.g., when user sends a letter and the draft becomes a sent-letter artifact), it likely remains a separate endpoint with simplified logic.
### 11.2 Phase 5 dashboard MVP
What does the dashboard surface look like in single-draft world?
**Likely:** One card in MyLettersModal's "Drafts" tab. Card shows recipient name, last edited timestamp, "Continue your saved letter" CTA. Click → load draft into editor (respecting §6.1 onComplete-handoff rule). Empty state: "Start a new letter" CTA leading to occasion selector.
**Out of scope for this proposal.** Design separately as PR-48.C scope.
### 11.3 Migration concern
Anyone with multiple drafts on cloud right now? **No.** PR-48 hasn't shipped to production. Only test data exists in dev Firebase. No migration scripts needed for cloud.
Local migration (UID namespacing + meaningful-content check) is handled in PR-48.A scope per §12.
### 11.4 STALE_REVISION + Begin Again interaction
What if a user has divergent local edits, hits STALE_REVISION on save, then tries Begin Again before resolving the conflict?
The DELETE would fail with STALE_REVISION for the same reason the save did — the client's `lastKnownCloudRevision` predates cloud's actual state. §8.3's secondary confirmation modal handles this gracefully.
### 11.5 Continued STALE_REVISION cycles
A user with poor connectivity and a concurrent device editor could be in a permanent fail-to-save state (each "Keep Editing This Version" → next save also STALE_REVISION → modal again).
**Acceptable v1 behavior.** The user retains local content indefinitely. Recovery paths:
- (a) Sign out + sign in to re-trigger reconciliation (the gate at sign-in will see the latest cloud at hydration time and apply Case A/B fresh).
- (b) Manually copy text out, click "Reload Latest Draft" to accept cloud, then re-paste.
Document these in user-facing help if needed. A future merge mechanism may improve the experience, but not in v1.
### 11.6 Anonymous-namespace draft handling at sign-in
PR-48.A implementer picks one of P1 / P2 / P3 per §4.5. Recommendation: P1 (preserve only). Lock the choice in `docs/doctrine/sync-confidence.md`.
### 11.7 Offline-first save queue
If user edits offline and the save button is pressed while offline, does the save retry when connection returns?
**Not required for v1.** Local autosave preserves the work. User can manually retry save when reconnected. Future enhancement if real usage shows this is needed.
### 11.8 Schema migration UX wart
Pre-pivot users may have had local autosave that was already a cloud-mirror. Post-migration, `hasLocalChanges = true` flags it as needing reconciliation even though it's byte-equal.
**Resolution (Issue #7):** PR-48.A migration step computes meaningful-content on the existing local data. If local is non-meaningful, set `hasLocalChanges = false` to skip the migration-driven false-positive Case B modal. Meaningful pre-pivot users may see one extra modal during the rollout window; this is documented and time-limited.
Alternative: bump `CURRENT_SCHEMA_VERSION` so the readDraft path discards pre-pivot entries entirely. More aggressive; PR-48.A implementer chooses.
### 11.9 Auto-merge of divergent edits
Could the system attempt to auto-merge local changes onto a newer cloud version (e.g., 3-way merge)?
**Never in v1.** Auto-merge of emotional writing risks producing text neither party wrote. The 2-button modal puts the user in control.
---
## 12. Implementation phases
Three scoped PRs. Each lands on `pr48-cloud-draft-sync`, audited and smoke-tested before next.
### PR-48.A — Multi-draft revert + sync-confidence foundation
**Scope:**
- Add `lastKnownCloudRevision` and `hasLocalChanges` to local autosave schema (`hooks/usePreparationPersistence.ts`)
- Add `lastSyncedSnapshot` (in-memory ref, projected per §4.4)
- Implement `hasLocalChanges` via debounced semantic-divergence check (§4.4 L2)
- Implement UID-namespaced storage key resolution (§4.5 L1) with active-key resolution doctrine
- **Migration script:**
  - Existing `vday_data_draft` entries → move to `vday_data_draft:anonymous` (signed-out users) OR `vday_data_draft:{currentUid}` (signed-in users at migration time)
  - Compute meaningful-content on migrated entry; if non-meaningful, set `hasLocalChanges: false` to skip false-positive Case B
  - Pre-pivot entries that are not in the new schema get `lastKnownCloudRevision: null`
- Add `utils/meaningfulContent.ts` with the predicate from §3 (operates on projected view)
- Remove `api/drafts/pause.js`, `api/drafts/resume.js`, `api/drafts/discard.js`, `api/drafts/transition.js` (or simplify transition per §11.1)
- Remove "Save Local Draft as New" button and `handleSignInSaveLocalDraftAsNew` handler from App.tsx
- Remove cap enforcement (MAX_DRAFTS=3) from `api/lib/draftValidation.js`
- **Fully remove `hooks/useDraftStateObserver.ts`** (L3)
- Keep all Phase 2 atomic save + CAS work
- Keep Phase 2.2 Admin SDK fix unchanged
- Move `docs/contracts/active-paused-state-machine.md` to `docs/archived/`
- Add `docs/doctrine/sync-confidence.md` (covering §4 + §4.5 + §4.6)
**Estimated:** ~600 LOC removed, ~250 LOC added.
**Exit:** Audit pass, smoke test (existing flows still work, UID namespacing functional, dirty-flag behaves correctly across mutation/sync cycles), merge to `pr48-cloud-draft-sync`.
### PR-48.B — Simplified reconciliation + new API surface
**Scope:**
- New endpoints: `GET /api/draft`, `POST /api/draft`, `DELETE /api/draft` (DELETE with CAS per §8.3, §9.2)
- Old `/api/drafts/*` endpoints deleted
- `SignInReconciliationModal` simplified to 2 buttons with new copy (§5.2); editor-beneath blocked; autosave hook paused while open
- `StaleRevisionModal` copy updated per §7.1
- `BeginNewPromptModal` replaced with `BeginAgainConfirmationModal`:
  - Signed-in copy per §8.1 with metadata preview
  - Signed-out copy per §8.2
  - Atomicity contract per §8.3 (DELETE first with CAS, then local clear; STALE_REVISION → secondary modal with cancellation handling)
- App.tsx hydration logic simplified:
  - `HydrationResolutionState` collapses to `idle` / `hydrating` / `resolved`
  - Hydration failure modes per §5.4
  - Stage-aware hydration per §5.5
  - In-flight save serialization per §5.6
- `ReconciliationState` union simplifies to Case A (silent) / Case B (modal)
- Happy-path save flow per §6 verified end-to-end (including PreparationForm onComplete handoff for PREPARE-stage saves per §6.1 Issue #5)
- Cross-device CAS behavior unchanged for POST; newly added for DELETE
**Estimated:** ~400 LOC modified.
**Exit:** Audit pass, multi-device smoke test (including DELETE-CAS path, in-flight-save modal serialization, stage-aware hydration at REFINE), merge.
### PR-48.C — Phase 5 dashboard MVP
**Scope:**
- "Drafts" tab in `MyLettersModal` renders single draft card or empty state
- Click card → load draft into editor with cloud-as-authority (full hydration per §4.2)
- Card UI shows recipient name, last edited timestamp, word count (data for §8.1 Begin Again preview also)
- Empty state CTA links to occasion selector
- No multi-draft UI, no draft picker, no list view
**Estimated:** ~200 LOC added.
**Exit:** Audit pass, smoke test, merge.
### Final merge
After all three lands on `pr48-cloud-draft-sync`:
1. Squash-merge `pr48-cloud-draft-sync` → `development`
2. Audit on `development`, smoke test
3. Fast-forward `main` from `development`
4. Production ships single-draft cloud sync + dashboard retrieval
**Total estimated effort:** 2-3 days focused work, depending on audit cycles and cross-voice review timing between PRs.
---
## 13. What we are NOT building
Explicit non-goals, to prevent scope drift mid-implementation:
❌ Multiple drafts per user (the entire premise of this pivot)
❌ ACTIVE / PAUSED / ABANDONED state machine (collapses to "exists" / "deleted")
❌ Draft inventory management or list views
❌ Cross-draft branching, forking, merging
❌ "Save as new" duplicate-and-edit pattern
❌ Multi-device offline-first sync queue (v2 maybe, with evidence)
❌ Real-time collaborative editing (out of product scope; never)
❌ Draft sharing between users (charter forbids; never)
❌ Auto-merge of divergent edits (manual reconciliation only)
❌ Time-based silent reconciliation thresholds
❌ Hidden authority arbitration (every decision is explicit or silent-via-clear-rule)
❌ "Save Local as New" / "Save Both" reconciliation options
❌ Unguarded destructive operations (DELETE must be CAS-protected)
❌ Syntactic-mutation-based dirty flag (must be semantic divergence, debounced)
❌ **Background sync helpers / periodic revision watchdogs / sync daemons** (per §4.6)
❌ **Auto-merge of anonymous local → signed-in user namespace** (per §4.5)
❌ **Per-keystroke deep-equality** (use debounced semantic check)
❌ Reconciliation logic reading transient optimistic dirty state (per §4.4)
If any of these starts feeling necessary mid-implementation, **stop**. Either it's evidence the design needs revision (in which case revise the proposal first, not the code), or it's scope creep (in which case decline).
---
## 14. Doctrine to codify after merge
After PR-48.C merges, codify the institutional learning:
### 14.1 New doctrine doc
`docs/doctrine/single-draft-product-fit.md` — covers:
- Why multi-draft is philosophically wrong for SealedVow
- Reference to product charter sections
- Cross-voice convergence (Claude + ChatGPT + Claude Code) as evidence
- Explicit instruction: do not reintroduce multi-draft without user evidence
- Future-conditional clause: when (if ever) to revisit
### 14.2 New doctrine doc
`docs/doctrine/sync-confidence.md` — covers:
- The revision comparison model (not naked booleans)
- The `lastKnownCloudRevision` + `hasLocalChanges` schema
- The semantic-divergence definition of `hasLocalChanges` (with debounced evaluation)
- The `selectiveHydrate` projection rule for `lastSyncedSnapshot`
- The meaningful-content predicate
- The emotional trust contract (never silently destroy user writing)
- The atomicity rule for destructive operations (DELETE before clear)
- CAS protection on both POST and DELETE
- **The synchronization-boundaries doctrine** (§4.6): only three boundaries — hydration, save, delete
- **The active-key resolution doctrine** (§4.5): UID-namespaced keys; no auto-merge of anonymous
### 14.3 Update existing roadmap doc
`docs/architecture/PostLaunch_Architecture_Roadmap_v2.md` — add:
- Note about the PR-48 multi-draft pivot
- Add to Anti-Patterns appendix:
  - **"Inventory thinking imported into emotional-product architecture."** Concrete example: PR-48 multi-draft model where two of three reconciliation buttons turned out to be operationally identical.
  - **"Unguarded destructive operations in cross-device systems."** Concrete example: v1.0 of this proposal had unprotected DELETE; v1.1 corrected.
  - **"Syntactic mutation as dirty signal."** Concrete example: v1.0 hasLocalChanges = true on every field mutation; v1.2 corrected to semantic divergence in projected space.
  - **"Background sync helpers in explicit-boundary systems."** Concrete example: useDraftStateObserver evolved into a state-machine observer; removed entirely in single-draft pivot per §4.6.
  - **"Cross-user localStorage leakage."** Concrete example: pre-pivot key was non-namespaced; UID-namespacing introduced in PR-48.A.
---
## 15. Cross-voice review record
This proposal incorporates feedback from three independent review passes by Claude, ChatGPT, and Claude Code, throughout 12-13 May 2026.
### 15.1 Design evolution
**Initial Claude proposal (10:30 AM IST):** "Option A — silent latest-wins (no modal)."
**Founder rejection:** Underweighted emotional-product context.
**Claude revision (Option C — smart modal with 5-min ambiguity threshold):**
**ChatGPT rejection:** Threshold is arbitrary and brittle.
**Locked design (Modified Option C — binary meaningful-content gate):** Co-developed across Claude + ChatGPT + founder.
### 15.2 v1.0 → v1.1 review pass (ChatGPT, 10:18 AM IST) — 8 tightenings
Incorporated in v1.1. See v1.1's §15 for the table.
### 15.3 v1.1 → v1.2 review pass (Claude Code, 11:00 AM IST) — 15 issues + 3 semantic contradictions
Claude Code performed a codebase-anchored architecture stress test against v1.1, producing `docs/diagnostics/2026-05-13-single-draft-pivot-stress-test.md`. All 18 findings integrated into v1.2; see changelog above.
The most important single addition was **Issue #4** (selectiveHydrate projection for `lastSyncedSnapshot`) — without this rule, every hydration creates a false-dirty state on the first post-hydration mutation, silently degrading the reconciliation gate's reliability over time.
Three structural design choices (L1, L2, L3) were resolved by founder lock per §0.
### 15.4 Final cross-voice status
- Claude (design level) ✓
- ChatGPT (philosophy / UX level) ✓
- Claude Code (codebase-anchored implementation level) ✓
Three independent reasoning processes, three converging conclusions, three rounds of refinement. v1.2 is the lockable artifact.
---
## 16. Approval checklist
This proposal requires before any code moves:
- [ ] Founder review (Ajmal) — read this v1.2 document end-to-end
- [ ] Final design-coherence review (optional ChatGPT pass on v1.2 to confirm no new contradictions introduced by the integrations)
- [ ] Founder lock — sign off on §12 implementation phasing
- [ ] Branch state confirmed — `pr48-cloud-draft-sync` is the working branch; `main` and `development` are not touched until final merge
Once all four checked: PR-48.A diagnostic prompt drafted, sent to Claude Code in plan mode (read-only), audited, then implemented.
---
## 17. Closing note
The pivot from multi-draft to single-draft is not a feature reduction. It is a recognition that **the product was wearing architecture that didn't fit it**.
Multi-draft was inventory management. SealedVow is emotional staging. The two are categorically different, and trying to build the first inside the second produces redundancy (two buttons that do the same thing) and confusion (cloud content invisible to UI after reconciliation).
The v1.0 → v1.1 → v1.2 refinements show a pattern: the right abstraction makes safety-critical details (CAS on DELETE, semantic vs syntactic dirty flag, happy-path explicitness, projection rules, UID namespacing) easier to notice and harder to skip. When v1.0 felt "good enough" it was hiding eight tightenings. When v1.1 felt "good enough" it was hiding fifteen more issues. The same architecture, examined with progressively more rigor, kept surfacing real concerns — none of which broke the design, all of which made it more honest.
v1.2 is implementable. It is not "the final form" because no architecture document is. But it is the form ready for PR-48.A to begin.
The new design has fewer features and more clarity. The user gets exactly what they actually need: one letter, retrievable from any device, with their work never silently destroyed, with destructive operations protected against concurrent races, with a dirty flag that reflects what the user actually changed, and with sync confidence resting on explicit boundaries rather than ambient background helpers.
That's the product. This is the architecture for it.
---
*End of proposal v1.2. Awaiting final design-coherence review + founder lock.*