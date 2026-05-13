# Dual-Mode Persistence — Architecture Proposal

**Date:** 13 May 2026
**Status:** Draft for cross-voice review (ChatGPT pass pending).
**Supersedes:** [`single-draft-pivot.md`](./single-draft-pivot.md) v1.2 in its entirety; the remaining (unmerged) commits of [`pr-48a-implementation-strategy.md`](./pr-48a-implementation-strategy.md).
**Owner:** Ajmal Fahad
**Lock gate:** Founder + ChatGPT cross-voice review before any implementation work begins.

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

The following planned commits / work products are abandoned:

- **Commit 2–6 of PR-48.A** as currently locked in `pr-48a-implementation-strategy.md` — not merged, not shipped. The remaining work in those commits is not done.
- **UID-namespacing infrastructure** (planned for Commit 4). Not needed — local and cloud never share keys with each other; namespacing by user makes sense only in a reconciliation world.
- **`lastSyncedSnapshot` + `dirtyBitRef` + `settledHasLocalChangesRef`** (planned for Commit 5). No divergence to detect.
- **`meaningfulContent()` reconciliation predicate** (planned for Commit 4). No reconciliation gate.
- **Migration logic** for legacy `vday_data_draft` → namespaced keys (planned for Commit 4). No namespacing.
- **Hook self-seeding invariant** (Patch 2 from Commit 5). No `lastSyncedSnapshotRef` to seed.
- **Schema v3** with `lastKnownCloudRevision` + `hasLocalChanges` fields (planned for Commit 4). Cloud drafts don't need these fields in the new model.
- **Sync-confidence doctrine** (planned for Commit 6). Replaced by the much simpler dual-mode doctrine.

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

---

## 6. Open implementation questions

These need answers before the implementation strategy doc is locked. ChatGPT review should specifically challenge each.

**Q1. Mode-selection UI placement.** Modal overlay vs full-page route vs in-line affordance on the landing page? Recommendation: modal overlay triggered by "Create Your Letter" click — preserves landing-page identity while making the choice explicit.

**Q2. Mode-selection copy.** The framing matters. "Continue as Guest" should not feel inferior or rushed. "Continue with Google" should not feel like account-friction. The two should feel like real choices, not a forced funnel toward sign-in.

**Q3. Anonymous letter record schema.** How does the server represent a letter with no user account? Suggested approach: a separate `anonymousLetters/{paymentId}` collection in Firebase, with the same content shape as account-linked letters but without `userId` or dashboard-visibility fields.

**Q4. Email delivery infrastructure.** Does SealedVow already have transactional email infrastructure? If yes, what service (SendGrid, Postmark, Resend, etc.)? If no, this is new work. Critical: email delivery is on the critical path for guest letters (the guest cannot recover the receiver URL without it).

**Q5. Abuse considerations.** Anonymous letters could be misused (spam, harassment, fraud). What controls? Rate-limit by payment ID? CAPTCHA at mode selection? Manual review for first-time email addresses? This deserves a separate threat-model pass before launch.

**Q6. Edge: a signed-in user clicks "Create Your Letter."** Do they get the mode-selection gate (with "Continue as Guest" as one option, which would be downgrading)? Or does signed-in state imply authenticated mode automatically? Recommendation: signed-in users skip the gate and go straight to authenticated path. They can sign out first if they really want guest mode.

**Q7. Edge: a user signs out mid-draft.** Authenticated user starts a draft, signs out from a header avatar menu. What happens to the in-progress draft? Recommendation: signing out closes the draft (the cloud copy persists; the user just can't see/edit it without signing back in). On next "Create Your Letter," they go through the mode-selection gate again.

**Q8. Edge: receipt email goes to spam.** Guest pays, never sees the receipt or receiver URL. Recovery? Recommendation: a "lookup by payment ID" support flow (guest provides their Razorpay payment ID or payment email, support team locates the record and resends).

**Q9. Receiver URL longevity.** Are receiver URLs permanent? Should anonymous letters expire after some period? Authenticated letters typically don't expire because users can re-access via dashboard. Anonymous letters have no such retrieval path — should they have a TTL?

**Q10. Mobile considerations.** Does the mode-selection gate work cleanly on mobile? Does the "Save and Continue" button pattern work for thumb-driven flows? These need design pass.

---

## 7. Migration path from current state

### 7.1 Branch state at proposal time

`pr48-cloud-draft-sync` HEAD = `14c1e9c` (Commit 1 of PR-48.A). Pushed to origin.

### 7.2 Path forward

1. **This proposal is reviewed and locked** (founder + ChatGPT).
2. **A new strategy doc** is written: `pr-49-dual-mode-implementation-strategy.md`. Same discipline as PR-48.A's strategy, but a different (and smaller) implementation surface.
3. **PR-48.A is formally abandoned** at Commit 1. The branch stays as-is until the dual-mode work is ready to merge or rebase.
4. **A new branch is created** for the dual-mode implementation: `pr49-dual-mode-persistence`. It branches from `pr48-cloud-draft-sync` (i.e., inherits Commit 1's deletions, which are still valid).
5. **Implementation proceeds** along the new strategy doc.
6. **Final merge** to `development` once the new flow is complete and tested.

### 7.3 What gets archived

The following documents are preserved as historical artifacts of the design exploration. They are NOT discarded — they capture genuine architectural insight and the cross-voice review discipline.

- `docs/proposals/single-draft-pivot.md` → archived with status note "Superseded 13 May 2026 by `dual-mode-persistence.md`."
- `docs/proposals/pr-48a-implementation-strategy.md` → archived with similar status note.
- `docs/diagnostics/2026-05-13-*.md` → kept in place; they remain useful as audit trail for why the single-draft pivot was attempted and what its limits were.

The archival is editorial only — no content is destroyed. Future engineers reading these docs should understand the architectural reasoning that led from multi-draft → single-draft → dual-mode.

---

## 8. Anti-patterns explicitly forbidden by this proposal

If implementation pressure ever surfaces any of the following, the answer is NO. Each one reintroduces the complexity this proposal exists to eliminate.

**A1.** Mid-flow mode switching. Even with "smart" migration. Even "just this once for this one edge case." The mode is locked at entry.

**A2.** Auto-save-to-cloud during anonymous flow. Even with "we won't reconcile, we'll just keep a backup." This is local↔cloud coexistence by another name.

**A3.** Reconciliation modals. In any form. Even "just for one specific edge case." The whole point is that reconciliation doesn't exist.

**A4.** Migration of guest state to cloud account on later sign-in. Even with user consent. Even as an opt-in toggle.

**A5.** Cross-mode hydration. Authenticated user's dashboard listing guest-mode drafts because "they were created in the same browser." Modes do not communicate.

**A6.** A "smart" persistence layer that decides which mode to use based on auth state at write time. The mode is set explicitly by user choice, not inferred.

**A7.** Inventory thinking imported into emotional architecture. The user is not "managing drafts." They are writing a letter. Each session has one draft. Each draft has one mode. Each mode has one persistence layer. Anything beyond this is over-engineering for a product whose Charter explicitly rejects productivity-software framing.

---

## 9. Doctrine to codify (after lock)

Once this proposal is approved, the following doctrine documents should be created/updated:

- **`docs/doctrine/dual-mode-persistence.md`** — the codified version of §3 invariants and §8 anti-patterns. Active doctrine. Reviewed quarterly per the Product Charter governance rhythm.
- **`docs/doctrine/local-persistence-contract.md`** — rewritten to describe guest-mode-only local persistence (the cross-namespace, reconciliation-aware framing is removed).
- **`docs/archived/2026-05-13-active-paused-state-machine.md`** — already planned in PR-48.A Phase D; this work still happens.

---

## 10. Cross-voice review record

This section tracks the cross-voice review trail. To be filled in as review proceeds.

| Reviewer | Date | Outcome |
|---|---|---|
| Claude (author) | 13 May 2026 | First draft. |
| ChatGPT | _pending_ | _pending_ |
| Founder lock | _pending_ | _pending_ |

---

## 11. Closing note

This proposal exists because three rounds of cross-voice review and an implementation-grade strategy doc could not eliminate the bugs produced by local↔cloud reconciliation. The work that surfaced this realization (the v1.2 single-draft pivot, the diagnostic, the patches, the tightenings) was not wasted — it was the path by which the realization became clear. Without seeing the reconciliation model fail in runtime testing, the dual-mode model would have felt like an unmotivated simplification.

The dual-mode model is not simpler because it's lazier or less rigorous. It is simpler because the problem it solves is smaller. The Product Charter rejects productivity-software framing; the dual-mode architecture honors that rejection at the persistence layer. The user is not managing drafts. The user is writing a letter, and the act of writing has a beginning (mode choice), a middle (the form + AI + refine), and an end (payment + send). Each of those has exactly one persistence semantics. Nothing reconciles, because nothing needs to reconcile.

If this proposal survives ChatGPT review unchanged, the implementation that follows will be the shortest, cleanest piece of work this codebase has shipped. If ChatGPT surfaces holes, this document gets revised. Either way, the path from here is: review, lock, implement.

— End of proposal —
