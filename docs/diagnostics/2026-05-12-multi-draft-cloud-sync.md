# Diagnostic — Multi-Draft Cloud Sync Architecture (PR-48)

**Date:** 12 May 2026
**Mode:** Read-only architectural audit. No implementation.
**Branch:** `pr48-cloud-draft-sync` (off `main` at `a57572f`, includes PR-47 + PR-47.1).
**Doctrine context:** [docs/doctrine/local-persistence-contract.md](../doctrine/local-persistence-contract.md). `localStorage['vday_data_draft']` is the sole local creator-state authority. Cloud drafts live in Firebase RTDB at `users/{uid}/drafts/{draftId}`.
**Architectural rule:** *"Persistence observes composition; it does not govern composition."*

---

## 1. Existing architecture map

The cloud-draft system is **substantially built out**. This is not a greenfield. PR-48 is an additive feature on top of an architecture that already supports authenticated per-user draft persistence, monotonic state observation, optimistic draftId hints, and cloud-wins reconciliation on sign-in.

### 1.1 Server-side surface (RTDB + Vercel functions)

| File | Lines | Purpose |
|---|---|---|
| [api/drafts/save.js](../../api/drafts/save.js) | 1–115 | POST. Authenticated. Validates payload, enforces **single-ACTIVE invariant per uid (409 `ACTIVE_DRAFT_EXISTS`)**, writes to `users/{uid}/drafts/{draftId}`. DraftId from Firebase push key on create. Rate limit 30/60s. |
| [api/drafts/list.js](../../api/drafts/list.js) | 1–40 | POST. Authenticated. Returns ALL drafts (ACTIVE/PAUSED/ABANDONED) for the uid, sorted by `updatedAt desc`. No filtering server-side — client filters. Rate limit 30/60s. |
| [api/drafts/transition.js](../../api/drafts/transition.js) | 1–95 | POST. Authenticated. Updates `draftState` on a specific draftId. **Server-enforces monotonicity** (409 `NON_MONOTONIC`). No-op on same-state writes (avoids spurious `updatedAt` bumps). Rate limit 60/60s. |
| [api/lib/draftValidation.js](../../api/lib/draftValidation.js) | full | Permissive validators for `data`, `draftState`, `persistenceStatus`, `step`. Mirrors the `DRAFT_STATE_ORDER` constant from `types/draft.ts`. 100KB payload cap, prototype-pollution guard. |
| [api/lib/middleware.js](../../api/lib/middleware.js) | 14–37, 100–126 | Admin SDK init (adminDb, adminAuth). `rateLimit(...)` helper backed by Upstash Redis with **intentional soft-fail** on Redis outage. |
| [api/lib/auth.js](../../api/lib/auth.js) | 31–39 | `getSessionUser(req)` — verifies `__session` cookie via `adminAuth.verifySessionCookie(token, true)` with **revocation checking enabled on every request**. |
| [api/auth/session.js](../../api/auth/session.js) | 1–75 | POST. Verifies fresh Firebase ID token (must be < 5 min old), mints session cookie via `createSessionCookie` with 5-day expiry. HttpOnly, SameSite=Lax, Secure in production. Rate limit 5/60s. |
| [api/auth/logout.js](../../api/auth/logout.js) | 1–40 | POST. Clears `__session` cookie via `Max-Age=0`. |
| [database.rules.json](../../database.rules.json) | 1–15 | **Client-side RTDB access denied at root.** `users/{uid}/drafts` has client read permission for the matching uid, but client write denied (Admin SDK only). Index on `persistenceStatus`. |
| [firestore.rules](../../firestore.rules) | 1–12 | Deny-all. Firestore not used. |
| [storage.rules](../../storage.rules) | 1–27 | `/sessions/*` write-only for authenticated users, 20MB cap, image/video/audio MIME types. |

### 1.2 Type system

[types/draft.ts](../../types/draft.ts):

- `DraftState = 'IN_PROGRESS' | 'GENERATED' | 'REFINED' | 'PREVIEWED' | 'READY_FOR_PAYMENT' | 'COMPLETED'` (6-state monotonic enum).
- `DRAFT_STATE_ORDER: Record<DraftState, number>` — forward-index 0..5 for monotonicity checks. Mirrored server-side in `api/lib/draftValidation.js` (must stay in sync).
- `PersistenceStatus = 'ACTIVE' | 'PAUSED' | 'ABANDONED'`. **This enum was designed for multi-draft semantics from day one** — only ACTIVE is currently used; PAUSED and ABANDONED are dormant.
- Type guards `isDraftState`, `isPersistenceStatus`.

### 1.3 Client orchestration ([App.tsx](../../App.tsx))

| State / function | Lines | Purpose |
|---|---|---|
| `draftRecord` state | 415–422 | `{ draftId: string \| null, seedDraftState: DraftState \| null }`. Lazy initializer reads optimistic `draftId` hint from `localStorage['vday_data_draft']` via `peekDraft().draftId`. |
| `handleSaveAndContinueLater` | 522–635 | Explicit user-triggered cloud save. Gated by `runOrPromptSignIn(..., 'persistence')`. Computes `draftStateToSend` with defense-in-depth monotonicity. POSTs to `/api/drafts/save`. On success, updates `draftRecord`, mirrors draftId via `writeDraftId`, sets `lastSaveSuccessAt`. |
| Cross-device hydration effect | 650–761 | Dependency: `[authUser?.uid, authLoading, serverSessionReady]`. On sign-in, fetches `/api/drafts/list`, filters for `ACTIVE`, picks chronologically oldest (insertion order), populates `draftRecord`, mirrors draftId via `writeDraftId`, seeds `lastSaveSuccessAt`. Stale-response guard via `capturedUid`. |
| `useDraftStateObserver` activation | 764–776 | Wires the observer to fire `/api/drafts/transition` on monotonic stage boundaries. Activated by `enabled = !!authUser && !!draftRecord.draftId`. Seeded by `draftRecord.seedDraftState` to prevent duplicate transition on activation tick. |
| `runOrPromptSignIn` | 428–441 | Defers an action behind sign-in. Variant `'payment'` (default) shows guest button; variant `'persistence'` hides it (forbids guest cloud drafts). |
| `writeDraftId` call sites | 611, 672, 739, 746 | Sync draftId hint into localStorage at: post-save success, sign-out, post-/list (no ACTIVE), post-/list (ACTIVE found). |

### 1.4 Observer ([hooks/useDraftStateObserver.ts](../../hooks/useDraftStateObserver.ts))

- Activation gated by `enabled && !!draftId`.
- Seeding on first activation tick reads `seedDraftState` into `lastPersistedDraftStateRef` to avoid firing a duplicate `/transition` for the current `uiStage`.
- `decideTransition(uiStage, lastPersisted)` from `lib/draftStateLogic.ts` returns `{ kind: 'write', candidate }` or `{ kind: 'noop', reason }`. Only writes are dispatched.
- Race protection: `pendingRequestIdRef` increment + post-response identity check guards against stale-rollback regressions.

### 1.5 UI surfaces ([components/](../../components/) + [styles/](../../styles/))

| Component | Path | Purpose |
|---|---|---|
| [RefineStage.tsx](../../components/RefineStage.tsx) | 322–379 | The **primary** "Save and continue later" affordance. Three states: default (gold/70 link), settled (gold/50 "Saved {relative time}" + gold/40 continuity line), errored (gold/70 link + gold/60 dismissible error). Settled-state anchor uses `lastSaveSuccessAt` + `formatRelativeTime`. |
| [MainExperience.tsx](../../components/MainExperience.tsx) | 817–850 | The **secondary** save affordance, top-right fixed during creator preview only (`isPreview && (onPayment \|\| onEdit)`). One opacity tier quieter than RefineStage. No continuity line (Shape B per LETTERS doctrine). |
| [DraftResumeModal.tsx](../../components/DraftResumeModal.tsx) | full | The **local** resume modal — knows nothing about cloud drafts. Reads metadata from `getDraftMetadata()` (localStorage only). Two actions: Continue / Begin Again. |
| [SignInPromptModal.tsx](../../components/SignInPromptModal.tsx) | full | Sign-in modal with `'payment'` vs `'persistence'` variant. Persistence variant hides the guest option entirely. |
| [MyLettersModal.tsx](../../components/MyLettersModal.tsx) | full | The **sent-letters** dashboard. Fetches `/api/letters/list`. **NOT a drafts dashboard** — shows only finalized/paid letters with sent/opened/replied status. |
| [UserMenu.tsx](../../components/UserMenu.tsx) | full | Account dropdown — sign-in / sign-out + entry to MyLettersModal. |
| [components/PreparationForm.tsx](../../components/PreparationForm.tsx) | 81, 87–101, 145, 163–181 | Mounts `usePreparationPersistence` (debounced autosave to `vday_data_draft`), reads `peekDraft()` for resume metadata, hosts `DraftResumeModal`. **No explicit Save Draft button.** |

---

## 2. Existing unfinished implementation remnants

The audit found **minimal explicit unfinished work**, but several signals that PR-48 was foreseen by the previous architects:

| Signal | Source | Implication |
|---|---|---|
| Comment in [api/drafts/list.js:6](../../api/drafts/list.js) | "18c filters / surfaces selectively. 18a deliberately does no filtering so the conflict picker (18c) and reminder enumeration (18d) have everything." | Future work labelled "18c" (conflict picker UI for ACTIVE_DRAFT_EXISTS) and "18d" (reminder enumeration over PAUSED drafts) was anticipated. **Neither is implemented.** |
| Comment in [api/drafts/save.js:15](../../api/drafts/save.js) | "Multiple non-ACTIVE drafts (PAUSED, ABANDONED) per uid are allowed and expected over time" | The schema is intentionally designed to permit multi-state drafts; the limiting invariant is "at most one ACTIVE." |
| `PersistenceStatus` enum | types/draft.ts:21 | All three values exist; only `ACTIVE` is reachable through current code paths. **PAUSED and ABANDONED transitions are not wired anywhere.** |
| 409 `ACTIVE_DRAFT_EXISTS` response | api/drafts/save.js:66–74 | Server returns `existingDraftId` in the conflict response for client-side picker UI, but client treats all non-2xx as generic error ([App.tsx:572–576](../../App.tsx:572)). The picker UX hook is left dangling. |
| TODO grep | `api/lib/middleware.js:52` | One TODO comment: "Make env-driven once staging/preview environments are set up". Unrelated to drafts. |
| "Stub / not implemented / wip" greps | All zero results in `api/`, `hooks/`, `services/`, `components/` | No abandoned stub files. The infrastructure that exists is production code, not scaffolding. |

**Net read:** the previous architecture anticipated multi-draft work (PR labels "18c"/"18d") and laid the schema groundwork (PersistenceStatus enum, single-ACTIVE-only invariant, conflict response shape). The UI layer and the lifecycle wiring for the second and third drafts were left for PR-48.

---

## 3. Existing UI surfaces — full inventory

### 3.1 Save affordances

- **RefineStage footer save link** ([components/RefineStage.tsx:322–379](../../components/RefineStage.tsx:322)) — primary surface. Three states (default / settled / errored). Visible at REFINE stage when `onSaveAndContinueLater` is wired.
- **MainExperience preview corner save link** ([components/MainExperience.tsx:817–850](../../components/MainExperience.tsx:817)) — secondary, fixed top-right during creator preview only. Same handler.
- **No save affordances elsewhere.** PreparationForm has no explicit Save Draft button — only the debounced autosave-to-localStorage via `usePreparationPersistence`. PERSONAL_INTRO, QUESTION, MAIN_EXPERIENCE (non-preview), PAYMENT, SHARE — none have save UI.

### 3.2 Resume affordances

- **[DraftResumeModal.tsx](../../components/DraftResumeModal.tsx)** — pops up at PreparationForm mount when local draft is meaningful and either (a) the user clicked an intentional-entry CTA (landing or occasion selector) or (b) the local draft is older than 10 min. Two actions: "Continue your letter" (calls `onContinue` → applies local hydration) or "Begin again" (calls `onBeginAgain` → `clearPreparationDraft`).
- **No cloud-aware resume UI.** The modal reads exclusively from local. Cloud reconciliation runs in parallel (App.tsx:650–761) but does not surface in any modal — it only flows into `draftRecord`.

### 3.3 Dashboard / list surfaces

- **[MyLettersModal.tsx](../../components/MyLettersModal.tsx)** — the **only** existing list-of-letters dashboard. Fetches `/api/letters/list` (sent letters only). Renders cards with recipient/occasion/createdAt/status. **No draft listing.**
- **No drafts dashboard exists.** PR-48 introduces this.

### 3.4 Account / auth surfaces

- **[SignInPromptModal.tsx](../../components/SignInPromptModal.tsx)** — sign-in with `'payment'` or `'persistence'` variant. Persistence variant: subtitle "Sign in to save your letter and pick it back up on any device.", no guest button.
- **[UserMenu.tsx](../../components/UserMenu.tsx)** — sign-in / sign-out / entry to MyLettersModal. Likely the host of any future "My Drafts" entry point.

### 3.5 Feedback surfaces

- **Inline text-based receipt** at RefineStage and MainExperience (no toast/popup library).
- **Inline dismissible error** at the same locations.
- **No conflict-resolution modal** for 409 `ACTIVE_DRAFT_EXISTS` — currently a generic error.

---

## 4. Existing draftId flow

### 4.1 Generation

- **Server-side**, at [api/drafts/save.js:78–81](../../api/drafts/save.js:78):
  ```javascript
  const draftRef = incomingDraftId
    ? adminDb.ref(`users/${user.uid}/drafts/${incomingDraftId}`)
    : adminDb.ref(`users/${user.uid}/drafts`).push();
  const draftId = draftRef.key;
  ```
- **Firebase RTDB push key** — lexicographically sortable, chronologically ordered, globally unique. No UUID/nanoid alternative.
- **Client never generates draftIds.** Even for "first save" of a brand-new draft, the client sends no `draftId` and the server assigns one.

### 4.2 Persistence

| Layer | Where | Reader/writer |
|---|---|---|
| **In-memory** | `draftRecord.draftId` state in App.tsx | Set by lazy init (from localStorage hint), by `handleSaveAndContinueLater` (from `/api/drafts/save` response), by hydration effect (from `/api/drafts/list` ACTIVE filter). Read by `useDraftStateObserver` activation and by save payload construction. |
| **Local hint** | `localStorage['vday_data_draft'].draftId` field | Written by `writeDraftId(...)` ([hooks/usePreparationPersistence.ts:334–366](../../hooks/usePreparationPersistence.ts:334)). Read at mount by `peekDraft().draftId` (App.tsx:419). |
| **Cloud canonical** | RTDB `users/{uid}/drafts/{draftId}/draftId` | Written by `/api/drafts/save` (mirrored from the path key). Read by `/api/drafts/list` response. |

### 4.3 Reconciliation

Cloud is canonical. The localStorage hint exists **only** to close the post-mount race window where a save can fire before the asynchronous `/list` hydration completes. On hydration:

- If cloud has no ACTIVE → clear local hint via `writeDraftId(null)` (App.tsx:739).
- If cloud has an ACTIVE → mirror cloud's draftId into the local hint (App.tsx:746). Hint and cloud now match.
- If `capturedUid` no longer matches current `authUser?.uid` mid-flight → discard response (App.tsx:704).

### 4.4 Begin Again cleanup — **the gap**

[components/PreparationForm.tsx:168–181](../../components/PreparationForm.tsx:168) clears `localStorage['vday_data_draft']` entirely (including draftId hint), but **does not**:

- Clear `draftRecord` state in App.tsx
- Transition the cloud draft to `PAUSED` or `ABANDONED`
- Delete the cloud draft

The cloud draft remains ACTIVE in RTDB indefinitely after Begin Again. Next save will attempt to create a new ACTIVE → server returns 409 `ACTIVE_DRAFT_EXISTS` → client surfaces a generic "Couldn't save just now" error. This is a P1 latent bug pre-existing PR-48; PR-48 must address it.

---

## 5. Existing Firebase / cloud structure

### 5.1 RTDB tree

```
users/
  {uid}/
    drafts/
      {draftId}/           ← Firebase push key
        draftId: <string>   ← mirrors path key
        userId: <uid>       ← redundant, for queries
        data: <CoupleData>  ← full payload (no schema versioning)
        draftState: <enum>  ← IN_PROGRESS | GENERATED | REFINED | PREVIEWED | READY_FOR_PAYMENT | COMPLETED
        persistenceStatus:  ← ACTIVE | PAUSED | ABANDONED
        step: <1|2|3>?      ← PREPARE sub-step (PREPARE only)
        createdAt: <ms>     ← server timestamp on create
        updatedAt: <ms>     ← server timestamp on every write
shared/
  {sessionKey}/             ← finalized/paid letters live here, NOT in drafts/
    ...
```

### 5.2 Access policy

| Path | Client read | Client write |
|---|---|---|
| Root (`/`) | denied | denied |
| `users/{uid}/drafts/*` | **allowed if `auth.uid == $uid`** | **denied** (Admin SDK only) |
| `shared/{sessionKey}/*` | not specified in extracted rules — relies on Admin SDK | denied |

The client read permission on `users/{uid}/drafts/*` is **not currently used** — the client never reads RTDB directly; it goes through `/api/drafts/list`. The permission is permitted by the rule but unconsumed.

### 5.3 Server access pattern

All writes go through Admin SDK via the three `/api/drafts/*` endpoints. No client write path exists.

---

## 6. Existing dashboard structure

There is **no drafts dashboard**. The closest existing surface is [MyLettersModal.tsx](../../components/MyLettersModal.tsx), which:

- Lists **sent** letters (i.e., past `shared/{sessionKey}` records) — fetches `/api/letters/list`.
- Renders cards with: recipient name + occasion, formatted date, status badge (`sent` / `opened` / `replied`), view button.
- Triggered from [components/LandingPage.tsx:124–128](../../components/LandingPage.tsx:124) and [components/UserMenu.tsx:73–82](../../components/UserMenu.tsx:73).

PR-48 needs an analogous **drafts dashboard** (e.g., `MyDraftsModal.tsx` or a new tab inside MyLettersModal):

- Fetches the existing `/api/drafts/list` endpoint (which already returns ALL drafts, sorted by `updatedAt desc`).
- Filters / displays at most 3 drafts.
- Each draft card surfaces: recipient name (from `data.recipientName`), occasion, `draftState`, `updatedAt`, two actions ("Resume" / "Delete"). No "View" since drafts have no shared URL yet.
- Resume action → routes to `/letter/create` with the chosen draftId hydrated into `draftRecord` and the corresponding draft's `data` loaded into `localStorage['vday_data_draft']` and App.tsx's `data`. This is the new flow.

Styling: existing `lp-modal lp-modal--letters` CSS in [styles/landing.effects.css:1790–1950](../../styles/landing.effects.css:1790) can be reused.

---

## 7. Risk and collision analysis

### 7.1 Doctrine-level risks

Per [docs/doctrine/local-persistence-contract.md](../doctrine/local-persistence-contract.md), the following patterns are **forbidden** and PR-48 must not introduce them:

- ❌ New localStorage keys for partial composition state (e.g., per-draft buckets keyed `vday_data_draft:<draftId>`).
- ❌ "Quick restore" or "refined preview" snapshot caches.
- ❌ Session mirror buckets.
- ❌ Any read of local persistence during composition (post-mount).

**Implication for PR-48:** when the user resumes draft #2 from the dashboard, the local working copy at `vday_data_draft` **becomes** draft #2's working copy. There is no "draft 1 stays in a side bucket while draft 2 is in the main bucket" pattern. The single local authority means **only one draft is ever locally active at a time**, even though the cloud holds up to 3.

### 7.2 Single-ACTIVE vs 3-draft cap — fundamental tension

The current schema enforces "at most one `ACTIVE` draft per uid" at the server. The product requirement is "up to 3 drafts per user." These can be reconciled in two ways:

| Model | Semantics | Compatibility |
|---|---|---|
| **(M1)** Allow up to 3 `ACTIVE` drafts. | Relax the single-ACTIVE invariant. Allow multiple ACTIVEs. | **Breaks the existing 409 logic**; hydration's "pick chronologically oldest ACTIVE" becomes ambiguous; observer monotonicity is per-draftId so this might still work, but the "what's the current draft?" question becomes unanswerable without explicit user choice. |
| **(M2)** Keep single-ACTIVE = "the one currently being composed." Cap PAUSED at 2. Total cap = 3 (1 ACTIVE + 2 PAUSED). | "Active" means *currently in the editor*. The other up-to-2 are "paused" — still accessible from the dashboard, but not the working copy. | **Aligns with the existing PersistenceStatus enum.** The `PAUSED` value was designed for exactly this. The hydration effect already filters for ACTIVE — only need to teach it to NOT auto-resume into the local working copy when a paused draft exists but no ACTIVE does. Dashboard becomes the explicit-choice surface. |

**Recommendation: M2.** It preserves the existing invariant, uses dormant schema, and aligns with the doctrine ("intentional draft persistence" — switching drafts via dashboard is intentional). M1 would require rewriting the hydration and conflict logic.

### 7.3 Cross-letter contamination risk (Diagnostic-1 / Diagnostic-2 carry-forward)

PR-47/47.1 closed Path A and Path B for the **single-draft** case. PR-48 reintroduces a multi-draft semantic and must not re-open the wound:

| Sub-case | Risk | Mitigation requirement |
|---|---|---|
| User edits draft A → switches to draft B from dashboard. | If `vday_data_draft` is not cleared before draft B's data is hydrated, draft A's residue could merge in. | The dashboard "Resume" action must call `clearPreparationDraft()` BEFORE seeding `vday_data_draft` with draft B's payload. |
| User clicks "Begin New" → new ACTIVE draft created. | Current code clears localStorage but does NOT transition the previous ACTIVE to PAUSED. Server returns 409 on save. | Begin New must, server-side or client-side, transition the prior ACTIVE → PAUSED. Choices: (a) add a `/api/drafts/transition` POST with `persistenceStatus: 'PAUSED'` (requires endpoint extension to support persistenceStatus changes), or (b) extend `/api/drafts/save` to accept an optional `pausePriorActive: true` flag that atomically demotes the prior ACTIVE in the same write batch. |
| User in mid-Refine on draft A, signs out, signs back in. | Hydration runs, picks the chronologically oldest ACTIVE (which may be A or may be another draft). If two ACTIVEs exist (shouldn't, but if), behavior is implicit. | In M2, single-ACTIVE remains invariant; this risk is eliminated by construction. |
| Account-switch (User A signs out → User B signs in mid-/list). | Existing `capturedUid` guard at App.tsx:704 already handles this. | No new mitigation needed. |
| Two browser tabs both signed-in as the same user, both editing different drafts. | Both write to `vday_data_draft`. Same-tab semantic of "single local authority" doesn't constrain cross-tab. localStorage writes from tab B can stomp tab A's mid-edit working copy. | Out of scope for PR-48 — pre-existing limitation of any localStorage-backed persistence. Document explicitly as a known boundary. |

### 7.4 409 `ACTIVE_DRAFT_EXISTS` currently mishandled

[App.tsx:572–576](../../App.tsx:572) treats all non-ok responses identically:

```javascript
if (!res.ok) {
  setLastSaveError("Couldn't save just now. Your work is still here.");
  saveInFlightRef.current = false;
  return;
}
```

A 409 with `{ error: 'ACTIVE_DRAFT_EXISTS', existingDraftId: '...' }` surfaces the same way as a 500. **This works today only because the system enforces single-ACTIVE — there's only ever one possible conflict.** PR-48's multi-draft semantics must handle this branch explicitly: when saving with no draftId AND the user already has an active draft, either auto-attach to that draft OR prompt for choice OR fail visibly.

### 7.5 Hidden persistence authorities — confirmed absent

Cross-checked all of `App.tsx`, `hooks/`, `components/`, `services/`, `utils/`. No hidden state mirrors. The single local authority is intact. PR-48 must not introduce any.

### 7.6 Guest behavior — must remain unchanged

Per the doctrine and the product spec, guest users:

- Continue to have `localStorage['vday_data_draft']` as their only persistence.
- Are not allowed to use cloud drafts.
- Don't see the dashboard.
- Sign-in prompt with `'persistence'` variant already enforces this (hides guest button at save context).

PR-48 must not change anything about the guest flow. The dashboard, "Save Draft" canonical function, 3-draft cap — all are gated on `authUser`.

### 7.7 PR-46.5 guest email continuity — must remain unchanged

`guestEmail` state and its lifecycle (App.tsx:362, 1101, 1552, and the cleanup effect at lines 370–380) are untouched by any of the changes PR-48 contemplates. Verifying this explicitly because PR-46.5 is doctrine-protected.

---

## 8. Proposed architecture

### 8.1 Core principle (binding)

> **There is one local working copy at all times.** The cloud holds up to three named drafts. Switching the local working copy from one cloud draft to another is an **explicit, intentional act** (dashboard click). The local authority remains `vday_data_draft`; only its **contents** change when the user explicitly chooses a different draft.

### 8.2 Canonical save function

Introduce one client-side function:

```typescript
saveDraft(snapshot: CoupleData, options?: { draftId?: string }): Promise<SaveResult>
```

- Wraps the existing `/api/drafts/save` POST.
- Replaces every existing "Save Draft" / "Save and continue later" handler with a single call.
- Lives in [hooks/useDraftPersistence.ts](../../hooks/useDraftPersistence.ts) (new) or directly in App.tsx.
- Full-snapshot overwrite per the product rule. No field-level merge. No partial patch.
- Returns `{ ok: true, draftId, updatedAt } | { ok: false, error: 'ACTIVE_DRAFT_EXISTS' | 'DRAFT_LIMIT_REACHED' | 'UNAUTHORIZED' | 'OTHER' }`.

All existing call sites — RefineStage and MainExperience-preview — call this function via the prop drilling that already exists (`onSaveAndContinueLater`).

### 8.3 3-draft cap

Server-enforced at [api/drafts/save.js](../../api/drafts/save.js): before creating a new draft (no `incomingDraftId`), query `users/{uid}/drafts` and count drafts with `persistenceStatus IN ('ACTIVE', 'PAUSED')`. If `>= 3`, return 409 `DRAFT_LIMIT_REACHED`. ABANDONED drafts don't count toward the cap (they're archival).

### 8.4 Single-ACTIVE invariant — preserved, with PAUSED semantics

- One `ACTIVE` draft per uid at any time (existing invariant preserved).
- Up to two `PAUSED` drafts (cap minus the active one).
- ABANDONED drafts are tombstones — not surfaced, not counted, not deletable by user (server may reap after N days; out of scope for PR-48).
- Transitions:
  - On explicit `saveDraft(snapshot)` with no draftId → creates new ACTIVE. If a prior ACTIVE existed, server transitions it to PAUSED atomically (this is the new server logic).
  - On dashboard "Resume draft B" while draft A is ACTIVE → server transitions A → PAUSED, B → ACTIVE atomically. Client clears `vday_data_draft`, then seeds it with B's `data`.
  - On dashboard "Delete draft" → server transitions chosen draft → ABANDONED.

### 8.5 New endpoint shape

Two options:

**(O1)** Extend `/api/drafts/save` with a `pausePriorActive: boolean` flag and atomically demote the prior ACTIVE in the same transaction.

**(O2)** Extend `/api/drafts/transition` to accept `persistenceStatus` changes (currently only handles `draftState`), and have the client call it explicitly before saving a new draft.

**Recommendation: O1.** Atomic at the server, fewer round trips, fewer race windows. The client just calls `saveDraft({ ..., pausePriorActive: true })`; the server handles the prior-ACTIVE demotion.

A separate small endpoint `/api/drafts/delete` may be needed for the dashboard delete action (transitions to ABANDONED). Alternatively, `/api/drafts/transition` extended with `persistenceStatus`.

### 8.6 Dashboard surface

New component `components/MyDraftsModal.tsx` (or new tab inside MyLettersModal):

- Fetches `/api/drafts/list`, filters `persistenceStatus IN ('ACTIVE', 'PAUSED')`.
- Renders up to 3 draft cards, sorted by `updatedAt desc`.
- Each card shows: recipient name, occasion, "Last edited {relative time}", current `draftState` (e.g., "Refined"), Resume action, Delete action.
- Reuses [styles/landing.effects.css:1790–1950](../../styles/landing.effects.css:1790) modal styles.
- Empty state: "No drafts yet. Save your letter to come back to it on any device."
- Entry point: UserMenu → "My Drafts" item.

### 8.7 Begin New flow — cloud-aware

[components/PreparationForm.tsx:168–181](../../components/PreparationForm.tsx:168) `handleBeginAgain()` is extended:

- Continues to call `clearPreparationDraft()` for the local copy.
- Continues to reset PreparationForm's local state.
- **New:** if `authUser` is signed in AND `draftRecord.draftId` is set, call a new client helper to transition the prior ACTIVE → PAUSED (atomic via the extended save endpoint OR explicit transition call). Clear `draftRecord` in App.tsx.

The cloud draft is preserved as PAUSED in the dashboard. The user can resume it later. No silent overwrite.

### 8.8 Resume flow — explicit cloud authority

Dashboard "Resume" handler:

1. Server-side: atomic transition (prior ACTIVE → PAUSED, chosen draft → ACTIVE). New endpoint or extended `/api/drafts/transition` with both `draftId` and `persistenceStatus`.
2. Client-side, on success:
   - Call `clearPreparationDraft()` to wipe the local working copy.
   - Write the chosen draft's `data` into `localStorage['vday_data_draft']` via a new helper `seedLocalDraft(coupleData, stage, step, draftId)`.
   - Update `draftRecord` in App.tsx to the chosen `{ draftId, seedDraftState }`.
   - Navigate to `/letter/create`. The data initializer at App.tsx:339–352 reads the freshly-seeded local copy and hydrates.

The `seedLocalDraft` helper is a new write site for `vday_data_draft` and must be added to [hooks/usePreparationPersistence.ts](../../hooks/usePreparationPersistence.ts) alongside the existing writers. **It is not a new persistence authority — it is a new writer to the existing authority.** The doctrine permits this.

### 8.9 Auth flow — unchanged

`useAuth`, `runOrPromptSignIn`, `SignInPromptModal` all unchanged. Cloud-draft save continues to require `runOrPromptSignIn(action, 'persistence')`.

---

## 9. Proposed doctrine amendment

The current doctrine at [docs/doctrine/local-persistence-contract.md](../doctrine/local-persistence-contract.md) is **additively** amended. No existing rule is rescinded. Insert a new section between current §6 and current §7:

```markdown
## 6.5 Cloud draft authority (PR-48)

Authenticated users may explicitly own up to three named drafts in Firebase
RTDB at `users/{uid}/drafts/{draftId}`. The cloud is the authority for
*which named draft is currently the local working copy*; the local
`vday_data_draft` bucket is the authority for *the contents of whatever
draft is currently being composed*.

The relationship between the two layers is governed by the following rules:

1. **One local working copy at all times.** `vday_data_draft` always
   represents the single draft the user is currently composing. There is
   never a "shadow" local copy of another draft.

2. **Intentional cloud saves only.** A draft moves from local to cloud
   only by explicit user action (the canonical `saveDraft` function,
   triggered by the user clicking a Save Draft affordance). There is no
   autosave to cloud. There is no debounce of cloud writes. There is no
   background sync. The cloud is touched only when the user asks for it.

3. **Full-snapshot overwrite per draftId.** Each cloud save replaces the
   entire `data` payload for that draftId. No partial patches. No
   field-level merges. No incremental overwrite trees. The local
   `vday_data_draft` at save time is the canonical snapshot for that
   draftId.

4. **3-draft cap (server-enforced).** A user may hold at most three
   non-ABANDONED drafts. Attempting to create a fourth returns
   `DRAFT_LIMIT_REACHED`. The user must explicitly delete (ABANDON) one
   before saving a new draft.

5. **Single ACTIVE = current working copy.** At any moment, exactly one
   of the user's up-to-3 drafts is `ACTIVE` (the one whose contents are
   in `vday_data_draft` and being composed). The others (up to 2) are
   `PAUSED` — preserved on the dashboard, not currently local.

6. **Begin New is explicit.** When the user clicks "Begin New" with an
   ACTIVE cloud draft outstanding, that ACTIVE draft is transitioned to
   PAUSED (preserved on the dashboard) atomically with the local
   `vday_data_draft` clear. Begin New must never silently overwrite or
   silently discard a cloud draft.

7. **Resume is explicit.** Switching the local working copy from one
   cloud draft to another happens only via the dashboard. The transition
   is atomic at the server (prior ACTIVE → PAUSED, chosen → ACTIVE) and
   on the client (`clearPreparationDraft` → seed `vday_data_draft` with
   the chosen draft's payload → update `draftRecord`).

8. **Guest behavior unchanged.** Unauthenticated users have only the
   local `vday_data_draft` working copy. No cloud drafts. No dashboard.
   No multi-draft cap. The doctrine of "Persistence observes composition;
   it does not govern composition" remains in effect for them exactly as
   before PR-48.

9. **No new local persistence buckets.** All cloud-draft state lives in
   RTDB. The local layer remains the single `vday_data_draft` bucket.
   `seedLocalDraft` (a new writer to that same bucket) is permitted
   because it writes to the existing authority, not a new one.

10. **§3 (forbidden patterns) still applies.** Multi-draft work does not
    license per-draft localStorage keys, side-cache mirrors, or any new
    independent persistence surface.
```

This amendment is **proposed only**; this PR does not write it. It is included here so it can be reviewed against the architecture before implementation begins.

---

## 10. Exact implementation phases

PR-48 is decomposed into four phases. Each phase is committed separately, runtime-verified, and gates the next.

### Phase 1 — Server: 3-draft cap + atomic ACTIVE→PAUSED demotion

| Surface | Change |
|---|---|
| [api/drafts/save.js](../../api/drafts/save.js) | Add `pausePriorActive: boolean` to request body. If a new draft is being created (no `incomingDraftId`) and the user already has 3+ non-ABANDONED drafts → 409 `DRAFT_LIMIT_REACHED`. If `pausePriorActive === true` and an ACTIVE exists with a different draftId → atomically transition prior ACTIVE → PAUSED in the same write batch. |
| [api/lib/draftValidation.js](../../api/lib/draftValidation.js) | Extend validator to accept the new flag. |
| [types/draft.ts](../../types/draft.ts) | No new types — `PersistenceStatus` already covers PAUSED. |
| [api/drafts/transition.js](../../api/drafts/transition.js) | Extend to accept `persistenceStatus` (in addition to `draftState`). Used by the delete action (transition to ABANDONED). |

**Commit:** `feat(drafts): server-side 3-draft cap + atomic ACTIVE→PAUSED demotion (PR-48 phase 1)`

**Runtime verification:** server-only; verified via curl/integration. Manual `curl -X POST /api/drafts/save` with various scenarios.

### Phase 2 — Client: canonical `saveDraft` + 409 handling + Begin New cloud transition

| Surface | Change |
|---|---|
| New: `hooks/useDraftPersistence.ts` (or inline in App.tsx) | The canonical `saveDraft(snapshot, { draftId?, pausePriorActive? })` function. Wraps `/api/drafts/save`. Returns a typed result. |
| [App.tsx:522–635](../../App.tsx:522) | Rewire `handleSaveAndContinueLater` to call `saveDraft`. Handle 409 `ACTIVE_DRAFT_EXISTS` (auto-retry with the existing draftId attached), 409 `DRAFT_LIMIT_REACHED` (surface error: "You already have 3 drafts. Resume or delete one to save another."). |
| [components/PreparationForm.tsx:168–181](../../components/PreparationForm.tsx:168) | Extend `handleBeginAgain`. If signed in AND `draftRecord.draftId` is set, call a server transition to demote the prior ACTIVE to PAUSED *before* clearing local. If transition fails, prompt the user (don't silently strand the cloud draft). |

**Commit:** `feat(drafts): canonical saveDraft + cloud-aware Begin Again (PR-48 phase 2)`

**Runtime verification:** A–G matrix from §11 below.

### Phase 3 — UI: drafts dashboard

| Surface | Change |
|---|---|
| New: `components/MyDraftsModal.tsx` | The drafts dashboard. Fetches `/api/drafts/list`, filters to `ACTIVE`/`PAUSED`, renders ≤3 cards. Resume and Delete actions per card. |
| [components/UserMenu.tsx](../../components/UserMenu.tsx) | Add "My Drafts" entry. |
| New: `hooks/useDraftResume.ts` (or inline in App.tsx) | The `resumeDraft(draftId)` flow: atomic server transition + `clearPreparationDraft` + `seedLocalDraft(coupleData, stage, step, draftId)` + update `draftRecord` + navigate. |
| New: `seedLocalDraft` in [hooks/usePreparationPersistence.ts](../../hooks/usePreparationPersistence.ts) | New writer to `vday_data_draft`. Writes the chosen draft's payload as a fresh local working copy. |
| [components/MyLettersModal.tsx](../../components/MyLettersModal.tsx) (optional) | If a tabbed surface is preferred, add a "Drafts" tab. Else MyDraftsModal stands alone. |

**Commit:** `feat(drafts): dashboard modal + resume flow (PR-48 phase 3)`

**Runtime verification:** dashboard rendering, resume, delete — full matrix.

### Phase 4 — Doctrine amendment

| Surface | Change |
|---|---|
| [docs/doctrine/local-persistence-contract.md](../doctrine/local-persistence-contract.md) | Apply the amendment text from §9 above. |

**Commit:** `docs(doctrine): amend local-persistence-contract for cloud-draft authority (PR-48 phase 4)`

**Runtime verification:** N/A (docs).

---

## 11. Runtime verification matrix

All scenarios run in a FRESH incognito window (matching the PR-47.1 discipline). Each row produces a screenshot or labeled console output. No reasoning-only verification.

| # | Scenario | Pre-condition | Expected post-condition |
|---|---|---|---|
| **G1** | Guest composition unchanged | Guest user, no cloud drafts | localStorage `vday_data_draft` persists. No `/api/drafts/*` calls fire. Sign-in modal `'persistence'` variant on Save Draft click. |
| **G2** | Guest declines sign-in | Guest user clicks Save Draft, dismisses modal | Local working copy preserved. No cloud write. No data lost. |
| **A1** | First cloud save | Signed in, no prior drafts | `/api/drafts/save` 200. `draftRecord` populated. `vday_data_draft.draftId` mirrors cloud's draftId. RefineStage shows "Saved {time} ago". |
| **A2** | Second save same draft | Signed in, mid-Refine on draft A | `/api/drafts/save` 200, same draftId. `updatedAt` advances. PAUSED list still empty. |
| **A3** | 3-draft cap enforcement | Signed in, 3 non-ABANDONED drafts already exist | `/api/drafts/save` (no draftId) returns 409 `DRAFT_LIMIT_REACHED`. UI surfaces explicit error: "You already have 3 drafts." |
| **B1** | Begin New cloud transition | Signed in, draft A is ACTIVE | Begin Again click → server transitions A → PAUSED. `draftRecord` cleared. `vday_data_draft` cleared. Draft A visible in dashboard under PAUSED. |
| **B2** | Begin New, then save new draft | After B1 | New `/api/drafts/save` (no draftId) creates draft B as ACTIVE. Draft A remains PAUSED. Both visible in dashboard. |
| **C1** | Dashboard renders ≤3 drafts | Signed in, drafts A (ACTIVE) + B (PAUSED) exist | MyDraftsModal shows 2 cards: A first (or by `updatedAt desc`), then B. Each card shows recipient/occasion/relative time/draftState. |
| **C2** | Resume from dashboard | Signed in, draft A ACTIVE, draft B PAUSED, dashboard open | Click Resume on B → server transitions A → PAUSED, B → ACTIVE atomically. Client clears local, seeds B's payload. Navigates to `/letter/create`. UI hydrates with B's content. |
| **C3** | Delete from dashboard | Signed in, draft A ACTIVE, draft B PAUSED | Click Delete on B → server transitions B → ABANDONED. Card disappears from dashboard. `/api/drafts/list` shows B as ABANDONED. |
| **D1** | Cross-device hydration | Sign in fresh on new device, user has 1 PAUSED draft | Hydration runs. `draftRecord` populated with… nothing initially (no ACTIVE). User opens dashboard, sees the PAUSED draft, clicks Resume to make it ACTIVE. |
| **D2** | Sign-out clears local + draftRecord | Signed in with ACTIVE draft | Sign-out → `draftRecord` null, `vday_data_draft.draftId` cleared (data portion retained per existing PR-47.1 behavior). |
| **E1** | Refine save with enriched data | Signed in, mid-Refine, click "Save and continue later" | `/api/drafts/save` with full `data` (incl. myth, sacredLocation, video, audio, aiImageUrl). Refresh reproduces full state. (Continuity of PR-47.1 §F handoff verified.) |
| **E2** | Refresh during Refine | Signed in, mid-Refine, refresh | Local hydration restores fully (per PR-47.1). draftRecord re-hydrates from `/api/drafts/list`. No collision. |
| **F1** | 409 ACTIVE_DRAFT_EXISTS handling | Signed in, local hint draftId is stale relative to cloud (synthetic test) | Server returns 409 with `existingDraftId`. Client auto-retries the save with `existingDraftId`. Success on retry. |
| **F2** | Account switch | User A signed in, draft A. User A signs out, User B signs in. | A's draftRecord cleared. B's hydration runs cleanly. No A residue. (Existing PR-47/47.1 stale-response guard preserved.) |
| **F3** | Two tabs same user | Tab 1 + Tab 2 both signed in same uid, both at `/letter/create` | Documented as out-of-scope. Last-write-wins on localStorage; both tabs may race. Pre-existing limitation. |

Per-phase: Phase 1 verifies A3, F1 (server-side). Phase 2 verifies A1, A2, B1, B2. Phase 3 verifies C1, C2, C3, D1, D2.

---

## 12. Recommendation: extend, not replace

The existing cloud-draft infrastructure is **mature, production code with intentional design margin for multi-draft work**. Specifically:

- The `PersistenceStatus` enum already encodes the three states needed (ACTIVE / PAUSED / ABANDONED).
- The `/api/drafts/list` endpoint already returns all states unfiltered, anticipating client-side filtering for different surfaces.
- The 409 `ACTIVE_DRAFT_EXISTS` response already includes `existingDraftId` for client-side picker logic.
- Comments in the code label the work explicitly: "18c filters / surfaces selectively"; "conflict picker (18c)"; "reminder enumeration (18d)".

There is no scaffolding to discard. There is no broken parallel system to replace. The path forward is **strictly additive**:

1. Activate the dormant `PAUSED` / `ABANDONED` transitions.
2. Add the 3-draft cap check at the existing save endpoint.
3. Build the dashboard UI that surfaces the multi-draft list.
4. Wire Begin New + Resume to the new transitions.

**Recommendation: EXTEND.** Do not introduce a new parallel persistence path. Do not redesign the schema. The existing system is the architecture; PR-48 finishes its UI and lifecycle wiring.

---

## Runtime user-flow maps (per the audit prompt)

### A. Guest composition

```
landing/occasion-selector → markIntentionalEntry → /letter/create
PreparationForm mounts → peekDraft() → empty or resume modal
User types → usePreparationPersistence debounces to vday_data_draft
→ Complete → REFINE → AI generates finalLetter → onUpdateLetter writes finalLetter to vday_data_draft
→ Save Draft click → runOrPromptSignIn(... 'persistence') → SignInPromptModal shown
  → User dismisses → no cloud write; local intact
→ Or → Preview Experience → MAIN_EXPERIENCE → PAYMENT (guest may proceed with guestEmail)
```

Cloud: never touched. dashboard: never seen.

### B. Signed-in composition

```
landing → User clicks sign-in (UserMenu or runOrPromptSignIn) → SignInPromptModal
→ signInWithGoogle → /api/auth/session → cookie set, serverSessionReady=true
→ Hydration effect fires → /api/drafts/list → if ACTIVE exists, populate draftRecord
→ User navigates to /letter/create → PreparationForm hydrates from vday_data_draft
→ Compose, Refine, Save Draft → saveDraft(snapshot) → /api/drafts/save
→ Server response: ok + draftId → draftRecord updated, hint mirrored
→ Continue or sign out and return later
```

### C. Local continuity (signed in or guest, single-tab refresh)

```
User refreshes mid-Refine
→ App mounts → data initializer reads peekDraft() from vday_data_draft
→ initialDraft.stage (e.g., REFINE) + initialDraft.data hydrates `data`
→ For signed in: hydration effect fetches /api/drafts/list, sets draftRecord
→ Observer activates (enabled = !!authUser && !!draftRecord.draftId)
→ UI re-renders correctly
```

### D. Existing cloud fetches

```
On sign-in or auth rehydration:
  [App.tsx:650–761] hydration effect
  → wait for authLoading=false + serverSessionReady=true
  → fetch /api/drafts/list (POST {} authenticated)
  → filter to persistenceStatus === 'ACTIVE'
  → pick chronologically oldest (createdAt asc)
  → setDraftRecord({ draftId, seedDraftState })
  → writeDraftId(draftId) — mirrors cloud's draftId into vday_data_draft.draftId
  → setLastSaveSuccessAt(updatedAt)
```

### E. Dashboard rendering (CURRENT — sent letters only)

```
UserMenu click "My Letters" → opens MyLettersModal
→ fetch /api/letters/list (POST {} authenticated)
→ render cards with recipient/occasion/status
→ No drafts shown here
```

(Future PR-48 dashboard: `MyDraftsModal` — same pattern, fetches `/api/drafts/list`, filters ACTIVE+PAUSED, ≤3 cards.)

### F. Resume flow (CURRENT — local-only)

```
User returns to /letter/create with vday_data_draft populated
→ PreparationForm checks getDraftMetadata()
→ Within 10-min window OR intentional-entry: DraftResumeModal shows
→ Click "Continue" → applies stored data
→ Click "Begin Again" → clearPreparationDraft() + reset
```

(Future PR-48 cloud-aware resume: dashboard "Resume" → atomic server transition + local seed.)

### G. Begin New flow (CURRENT — local-only)

```
User clicks Begin Again in DraftResumeModal
→ clearPreparationDraft() removes vday_data_draft entirely
→ PreparationForm state reset
→ For signed in user: cloud draft REMAINS ACTIVE (gap — see §4.4)
```

(Future PR-48: cloud-aware Begin New transitions prior ACTIVE → PAUSED.)

### H. Refine flow interactions

```
PREPARE → user clicks complete → setData(formPayload) + safeSetStage(REFINE)
REFINE:
  mount → if writingMode='assisted' and !finalLetter, fetchDraft()
  → generateLoveLetter(data) → AI returns draft → onUpdateLetter(draft) → writeDraftFromExternal({finalLetter})
  → User edits in textarea → onBlur → onUpdateLetter(edited) → writeDraftFromExternal({finalLetter})
  → User clicks "Save and continue later" → onSaveAndContinueLater → handleSaveAndContinueLater
    → runOrPromptSignIn('persistence') → if signed in: saveDraft directly
    → /api/drafts/save with full data + draftState='GENERATED' (since stage=REFINE)
    → success: draftRecord updated, lastSaveSuccessAt set
    → settled-state UI renders "Saved {relative time}"
  → User clicks "Preview Experience" → handleFinalize
    → enrichedData = { myth, sacredLocation?, video? } produced by AI
    → onSave(letter, enrichedData) → App.tsx onSave handler
    → setData(hydrated{...data, ...enrichedData, finalLetter})
    → safeSetStage(PERSONAL_INTRO) → writeStage updates vday_data_draft.stage
    → writeDraftFromExternal({...enrichedData, finalLetter}) → merges into vday_data_draft.data
    → Observer fires /api/drafts/transition draftState=REFINED (if signed in)
```

PR-47.1 fidelity preserved throughout — no overwrite, no cross-bucket collision.

---

End of diagnostic. No implementation performed. Branch: `pr48-cloud-draft-sync`, parent commit `a57572f` (main).
