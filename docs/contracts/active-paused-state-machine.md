# ACTIVE / PAUSED State Machine Contract — PR-48

**Status:** Active contract. Binding on PR-48 Phase 2 and all subsequent implementation phases.
**Established:** 12 May 2026, with PR-48 Phase 1.
**Authority:** [docs/doctrine/local-persistence-contract.md §6.5](../doctrine/local-persistence-contract.md). This contract is the implementation specification that §6.5 references.
**Cross-references:** [docs/diagnostics/2026-05-12-multi-draft-cloud-sync.md](../diagnostics/2026-05-12-multi-draft-cloud-sync.md) (PR-48 architectural audit).

This document is the load-bearing reference for any code that touches cloud-draft state transitions, reconciliation flows, or the relationship between local autosave and cloud drafts. Amendments require explicit doctrine review.

---

## 1. Canonical framing

> PR-48 is not multi-draft editing. It is single-active emotional composition with resumable preserved states.

The user composes one letter at a time. The cloud preserves up to two additional prior compositions in a "paused" state so the user can return to them. There is never more than one composition actively under the user's editorial pen at any moment.

---

## 2. The five canonical invariants + authority resolution principle

### 2.1 Canonical invariants

1. At most ONE cloud ACTIVE draft per user globally, server-enforced.
2. Local autosave NEVER independently creates cloud drafts.
3. Cloud draft CONTENT changes only at intentional user boundaries, never at session or identity events. Metadata such as revision counters, heartbeat timestamps, and session identifiers may update outside explicit saves.
4. During live editing, in-memory local composition remains sovereign.
5. Every conflict UX surface ends with exactly one explicit surviving composition authority. No ambiguous parallel states.

### 2.2 Authority resolution principle

> Local autosave may contain unsaved work newer than cloud ACTIVE. This does NOT make local authoritative until the user explicitly chooses a reconciliation path. Authority is explicitly resolved, never chronologically inferred.

This principle is load-bearing. Any future engineer who infers "local timestamp is newer than cloud `updatedAt`, therefore local wins" is reading the doctrine wrong. Newness does not confer authority. The user does.

---

## 3. The Continue Locally clause

> "Continue Locally" reconciliation does NOT reserve cloud ACTIVE ownership. The first subsequent Save Draft attempt must still pass cap and revision validation against current server state at that moment.

A user who chooses "Continue Locally" at sign-in receives no implicit promise from the cloud. Another device may create or modify cloud drafts in the interim. The next save is unconditional — it negotiates with the cloud from scratch.

---

## 4. Transition table

Each row identifies the event, the cloud-side outcome, the local-side outcome, the revision behavior, and the current implementation status (WIRED / PARTIALLY WIRED / NOT WIRED). "WIRED" means the code already exists and matches this contract exactly. "PARTIALLY WIRED" means code exists for some aspect but not all. "NOT WIRED" means no implementation exists.

| # | Event | Cloud transition | Local state | Revision | Status | Current surface |
|---|---|---|---|---|---|---|
| T1 | User starts composing (any auth state) | None — no cloud draft created | Local autosave begins | n/a | **WIRED** | `usePreparationPersistence(data, step)` at [components/PreparationForm.tsx:145](../../components/PreparationForm.tsx:145) |
| T2 | First Save Draft click | Cloud draft created, status = ACTIVE | Local mirrors same draftId | revision = 1 | **PARTIALLY WIRED** — creates ACTIVE, no `revision` field on schema, no `expectedRevision` validation | `handleSaveAndContinueLater` at [App.tsx:522](../../App.tsx:522) → POST [api/drafts/save.js](../../api/drafts/save.js) |
| T3 | Subsequent Save Draft on ACTIVE | ACTIVE snapshot overwritten | Local continues | revision += 1 | **PARTIALLY WIRED** — overwrite works, no `revision` increment | Same path as T2 |
| T4 | Begin New (ACTIVE exists, unsaved local) | UX prompt: Save & Start New / Discard & Start New / Cancel | Per choice | If Save: revision += 1 then demote | **NOT WIRED** — no UX prompt exists; current handler clears local only | `handleBeginAgain` at [components/PreparationForm.tsx:168](../../components/PreparationForm.tsx:168) clears local, does not touch cloud |
| T5 | Begin New (ACTIVE exists, no unsaved changes) | ACTIVE → PAUSED atomically | Local cleared, new draftId begins | revision += 1 on demoted draft | **NOT WIRED** — no cloud transition; no PAUSED transitions exist anywhere in the codebase | Same handler as T4 |
| T6 | Resume PAUSED from dashboard | ATOMIC transaction: prior ACTIVE → PAUSED + selected PAUSED → ACTIVE | Local cleared, then seeded from newly-ACTIVE snapshot | revision += 1 on both affected drafts | **NOT WIRED** — no drafts dashboard exists; no Resume flow exists; [api/drafts/transition.js](../../api/drafts/transition.js) handles only `draftState`, not `persistenceStatus` | n/a |
| T7 | Delete draft | status → ABANDONED | If ACTIVE deleted: local cleared | revision += 1 | **NOT WIRED** — no delete endpoint; no UX | n/a |
| T8 | Sign out | None (cloud unchanged) | Local cleared (`draftRecord`, `writeDraftId(null)`); `vday_data_draft.data` retained per PR-47.1 | n/a | **WIRED** | [App.tsx:668–673](../../App.tsx:668) (`!capturedUid` branch in hydration effect) |
| T9 | Sign in with local, no cloud ACTIVE | UX prompt (Case A) | Per choice | per choice | **NOT WIRED** — current hydration auto-resolves without prompt | [App.tsx:693](../../App.tsx:693) (`fetch('/api/drafts/list')` in hydration effect) — fetch happens, prompt does not |
| T10 | Sign in with local + cloud ACTIVE | UX prompt (Case B) | Per choice | per choice | **NOT WIRED** — same as T9 | Same as T9 |
| T11 | Browser close / crash | None | Local preserved (PR-47.1) | n/a | **WIRED** (by browser; no application code needed) | localStorage browser semantics |
| T12 | Cross-device reclaim via Resume | Atomic on server (see R3) | Other device becomes stale | revision incremented | **NOT WIRED** — depends on T6 + revision field + heartbeat infrastructure | n/a |
| T13 | Heartbeat tick from ACTIVE session | None (metadata only) | None | unchanged — `lastSeenAt` and `sessionId` updated | **NOT WIRED** — no heartbeat endpoint, no client ping, no `sessionId`/`deviceLabel`/`lastSeenAt` fields on the schema | n/a |

### 4.1 Phase 2+ unwired surfaces (summary)

The following surfaces remain unwired after Phase 1 and constitute the Phase 2+ work plan:

- T4–T7: Begin New cloud-aware flow, Resume from dashboard, Delete draft. Requires extension to `/api/drafts/transition.js` (accept `persistenceStatus`), new atomic-transaction logic at `/api/drafts/save.js`, and the dashboard UI itself.
- T9–T10: Reconciliation prompts at sign-in. Requires Case A and Case B UX surfaces; the hydration effect needs to defer to user choice instead of auto-applying cloud state.
- T12: Cross-device reclaim. Composite — depends on T6 + revision + heartbeat.
- T13: Heartbeat infrastructure. New endpoint, new client ping loop, schema extension for `sessionId` / `deviceLabel` / `lastSeenAt`.
- T2–T3: revision counter does not yet exist on the schema; Phase 2 must add it and validate `expectedRevision` on every mutating request.

---

## 5. Atomic server transaction rules

Doctrine rule (verbatim from §6.5): *"Validation occurs INSIDE the transaction boundary, not before. The transaction itself re-queries authoritative state at commit time. Pre-transaction validation is not sufficient because of concurrent lambdas, retries, and eventual consistency."*

The following operations MUST execute as single server transactions:

### 5.1 Resume transition (ATR-1)

Single transaction:

1. Verify `expectedRevision` on selected draft inside transaction.
2. Update previous ACTIVE.`status` = PAUSED, increment its `revision`.
3. Update selected.`status` = ACTIVE, increment its `revision`.

Both updates succeed or both fail. Client never observes intermediate state. No race window where two drafts are simultaneously ACTIVE or both PAUSED.

### 5.2 Begin New when ACTIVE exists (ATR-2)

Single transaction:

1. Verify `expectedRevision` on existing ACTIVE.
2. Update existing ACTIVE.`status` = PAUSED, increment `revision`.

No new draft is created yet. The first subsequent Save Draft of the new compose creates the new draft (and goes through ATR-3).

### 5.3 Save Draft (creating new) (ATR-3)

Single transaction:

1. Re-query authoritative count of `ACTIVE` + `PAUSED` drafts for the uid inside transaction.
2. If count >= 3: reject with `CAP_EXCEEDED`.
3. If user already has any `ACTIVE`: reject with `ACTIVE_DRAFT_EXISTS` (this enforces the single-ACTIVE invariant at the storage layer).
4. Else: create draft, `status` = ACTIVE, `revision` = 1.

Step 3 ensures Invariant 1 holds even under concurrent Save attempts from two devices.

### 5.4 Save Draft (overwriting existing ACTIVE) (ATR-4)

Single transaction:

1. Verify `expectedRevision` matches stored.
2. If stale: reject with `STALE_REVISION`, return `{ currentRevision, yourRevision }`.
3. Else: overwrite content fields, increment `revision`.

### 5.5 Delete (ATR-5)

Single transaction:

1. Verify `expectedRevision`.
2. If stale: reject with `STALE_REVISION`.
3. Else: `status` = ABANDONED, increment `revision`.

### 5.6 Transaction primitive

These operations are specified abstractly. The implementation must use a primitive that provides serializable single-key-or-cross-key atomicity (Firebase RTDB `.transaction()`, multi-path `.update()` against a single ref tree, or — if migration becomes necessary — Firestore transactions). Phase 2 chooses the primitive; this contract specifies only that the operations must be atomic against concurrent writers.

---

## 6. Revision / epoch semantics

Every cloud draft carries a monotonic `revision` integer.

**Initial value:** `revision = 1` on draft creation.

**Increment events:**

- Save Draft (content overwrite)
- Resume transition (both donor and recipient draft increment)
- Begin New (the demoted draft increments)
- Delete (the abandoned draft increments)
- ACTIVE reclaim via cross-device resume

**Non-increment events:**

- Heartbeat update
- Any read
- `sessionId` / `lastSeenAt` / `deviceLabel` updates

**Every mutating client request MUST include:**

- `draftId`
- `expectedRevision`

**Server behavior:**

| Condition | Response |
|---|---|
| `expectedRevision === stored` | Apply mutation, increment revision, return new revision. |
| `expectedRevision < stored` | Reject: `{ error: "STALE_REVISION", currentRevision: N, yourRevision: M }`. |
| `expectedRevision > stored` | Reject: `{ error: "INVALID_REVISION", currentRevision: N, yourRevision: M }`. Indicates client bug (client claimed a revision the server has never issued). |

**Client behavior on `STALE_REVISION`:** show reconciliation UX Case C (see §8.3). Specific wording is Phase 2+ work. Phase 1 specifies only the contract.

**Client behavior on `INVALID_REVISION`:** treat as a hard bug. Log diagnostically. Do not attempt automatic retry — the client's state is incoherent and silent retry could corrupt the user's work. Surface the user toward sign-out / sign-in to restart from cloud authority.

---

## 7. Heartbeat metadata contract

Every cloud ACTIVE draft carries three metadata fields (in addition to its content fields and `revision`):

| Field | Type | Semantics |
|---|---|---|
| `sessionId` | string | Unique per browser session, generated client-side at session start. Distinguishes multiple tabs / multiple sessions from the same physical device. **Not unique per user** — unique per session. |
| `deviceLabel` | string | Human-readable device identifier (e.g., "MacBook Air", "iPhone 14"). Used for UX messaging only. **Not required to be unique.** |
| `lastSeenAt` | server timestamp | Updated on heartbeat ping. |

**Update events:**

- Active editing session pings heartbeat every ~30 seconds (Phase 2 decides exact interval).
- Server updates `lastSeenAt` + `sessionId` + `deviceLabel` as a metadata-only write.

### 7.1 Critical rules

- **Heartbeat updates DO NOT increment `revision`.**
- **Heartbeat updates DO NOT mutate state** (`status`, `draftState`, content).
- **Missed heartbeats MUST NEVER trigger automatic state transitions.**
- **ACTIVE remains ACTIVE until an explicit user-initiated event transitions it.**

### 7.2 What heartbeat IS for

- UX messaging: "Active 2 minutes ago on MacBook Air".
- Cross-device clarity: the user sees which device currently owns ACTIVE.
- Stale-session diagnostics (operator-facing logs).

### 7.3 What heartbeat is NOT for

- Authority transitions.
- Auto-demotion of stale sessions.
- Garbage collection.
- Any mutation of state beyond the three metadata fields above.

The heartbeat exists to inform the user, not to govern the system. The system is governed by explicit user actions.

---

## 8. Reconciliation semantics

Three reconciliation cases. Each ends with exactly one explicit surviving authority.

### 8.1 Case A — User signs in, local autosave exists, NO cloud ACTIVE exists

**UX prompt:**

> "You have an unsaved local draft on this device. Would you like to:
> - Save Local Draft as Cloud Draft
> - Continue Locally
> - Discard Local Draft"

**Behaviors:**

| Choice | Effect |
|---|---|
| Save Local Draft as Cloud Draft | Phase 2+ wires Save Draft flow, creating cloud draft (`revision` = 1, `status` = ACTIVE). |
| Continue Locally | Local autosave continues. NO cloud draft created. **Crucially:** Continue Locally does NOT reserve cloud ACTIVE ownership. The first subsequent Save Draft attempt must still pass cap and revision validation against current server state at that moment, including the possibility that another device created cloud ACTIVE in the interim. |
| Discard Local Draft | Clears `vday_data_draft` entirely. |

### 8.2 Case B — User signs in, local autosave exists, cloud ACTIVE exists

**UX prompt:**

> "You have:
> - an unsaved local draft on this device
> - an active draft in your Dashboard
>
> Which would you like to continue?
> - Continue Dashboard Draft
> - Save Local Draft as New
> - Discard Local Draft"

**Behaviors:**

| Choice | Effect |
|---|---|
| Continue Dashboard Draft | Discards local autosave, hydrates from cloud ACTIVE snapshot. |
| Save Local Draft as New | Atomically: cloud ACTIVE → PAUSED + local uploaded as new ACTIVE (`revision` = 1). Subject to cap; if at cap, show `CAP_EXCEEDED` reconciliation with delete prompt. |
| Discard Local Draft | Clears `vday_data_draft`, hydrates from cloud ACTIVE snapshot. |

### 8.3 Case C — Mid-editing, server returns STALE_REVISION on save

**UX prompt:**

> "This draft was resumed on another device. Your local version is no longer the active version.
> - Resume This Version Instead
> - Discard Local Changes
> - Cancel"

**Behaviors:**

| Choice | Effect |
|---|---|
| Resume This Version Instead | Atomically: current cloud ACTIVE → PAUSED + local promoted to new ACTIVE with fresh `revision`. Preserves single-ACTIVE invariant without forking. |
| Discard Local Changes | Clears local, hydrates from current cloud ACTIVE snapshot. |
| Cancel | No state change. User resumes consideration. Note: a subsequent Save attempt will again return STALE_REVISION until one of the resolving choices is taken. |

### 8.4 The unifying principle

> Every reconciliation flow ends with exactly one explicit surviving authority. No ambiguous parallel states. No duplicate forks.

This is non-negotiable. Any UX path that allows the user to leave a reconciliation prompt without an explicit choice is a doctrine violation.

---

## 9. Race-condition policy

Four named races. Each has a deterministic resolution.

### R1 — Two clients race to create new ACTIVE

- Both POST `/api/drafts/save` with no `draftId`.
- Cloud ACTIVE creation is serialized per-user. Inside the transaction, server re-queries authoritative state at commit time (validation INSIDE transaction boundary, not pre-transaction).
- First request: creates ACTIVE, `revision` = 1.
- Second request: detects existing ACTIVE inside its own transaction, rejects with `ACTIVE_DRAFT_EXISTS`.
- Client of second request shows: *"Another session created a draft. Refresh dashboard to see all drafts."*

The doctrine rule (verbatim): *"Cloud ACTIVE creation is serialized per-user. At ACTIVE creation time, server MUST re-query authoritative state inside the transaction before commit."*

### R2 — Two clients race to Resume different drafts

- Both POST `/api/drafts/transition` with selected `draftId` → ACTIVE.
- Server processes serially per user.
- First request: succeeds, previous ACTIVE demoted, selected promoted, revisions incremented on both affected drafts.
- Second request: arrives with stale `expectedRevision`. Server returns `STALE_REVISION`.
- Client of second request shows: *"Another session resumed a different draft. Refresh dashboard to see current state."*

### R3 — Cross-device Save while another device has been editing

- Device A held ACTIVE for hours, never saved.
- Device B opens dashboard, Resumes the same draft (or a different draft).
- Server atomically: `revision` N → N+1 on demotion. Device A's draft is the demoted side if Device B chose a different `draftId`; if Device B chose to Resume the same `draftId`, the atomic transition is a no-op on `status` but increments `revision` and updates `sessionId`.
- Device A now stale. Device A tries to Save → `STALE_REVISION`.
- Device A shows Case C prompt.

### R4 — Browser tab resurrects after days

- Device A's tab suspended for 3 days, comes back.
- Local `vday_data_draft` still has Device A's last state.
- Device A tries to interact with cloud (any mutating call).
- Server returns `STALE_REVISION` (Device B or even Device A's later session made changes).
- Device A shows Case C prompt — never silently corrupts state.

---

## 10. Cross-references to PR-47.1 doctrine

This contract extends, never rescinds, the PR-47.1 doctrine. Specific load-bearing inheritances:

| PR-47.1 section | Inheritance in this contract |
|---|---|
| [§1 Single authority](../doctrine/local-persistence-contract.md) | `vday_data_draft` remains the sole local persistence authority. Cloud is a second layer, never a second local bucket. The forbidden-pattern enumeration in §3 still applies. |
| [§2 Extension protocol](../doctrine/local-persistence-contract.md) | New fields requiring local-side restoration fidelity (e.g., a future field on `CoupleData` that needs to survive a Resume cycle) must extend `selectiveHydrate`'s allowlists, not bypass them. |
| [§3 Forbidden pattern](../doctrine/local-persistence-contract.md) | No per-draft localStorage keys. No "cloud cache" mirror. No side bucket for "preserved drafts that aren't the active one." There is one local bucket; it carries whichever draft the user has chosen as ACTIVE. |
| [§4 Server-set fields](../doctrine/local-persistence-contract.md) | `revision`, `sessionId`, `lastSeenAt`, `deviceLabel`, and `persistenceStatus` are server-set fields. Client never asserts their values; client only sends `expectedRevision` for validation and reads what the server returns. |
| [§5 Security / PII](../doctrine/local-persistence-contract.md) | The hygiene boundary at `selectiveHydrate` continues to gate which fields ever leave the cloud blob and enter the local working copy on Resume. Resume hydration must apply the same allowlist as mount hydration. |
| [§6 Architectural rule](../doctrine/local-persistence-contract.md) | "Persistence observes composition; it does not govern composition" extends to cloud persistence. Cloud mirrors composition at intentional save boundaries; it does not govern live editing. Live editing remains sovereign in local memory. |
| [§6.5 Cloud draft authority](../doctrine/local-persistence-contract.md) | The summary doctrine. This contract is its full specification. |
| [§7 What the contract does *not* cover](../doctrine/local-persistence-contract.md) | The cross-tab-same-user race is acknowledged as out of scope (pre-existing limitation of any localStorage-backed persistence). Receiver-side caches and schema migration remain separately governed. |

---

## 11. Phase 2+ implementation pointers

Each pointer is a Phase 2+ work item, mapped to the contract section it implements and the current unwired surface.

| Pointer | Contract section | Current state | Phase 2+ work |
|---|---|---|---|
| **P1** — Schema extension | §6 revision/epoch, §7 heartbeat | [types/draft.ts](../../types/draft.ts) lacks `revision`, `sessionId`, `deviceLabel`, `lastSeenAt`. [api/lib/draftValidation.js](../../api/lib/draftValidation.js) does not validate them. | Add the four fields to the schema. Add validators. Default `revision = 1` on creation. |
| **P2** — Atomic transition primitive | §5 ATR-1 through ATR-5 | [api/drafts/save.js](../../api/drafts/save.js) uses sequential `.once()` + `.update()` (not atomic). [api/drafts/transition.js](../../api/drafts/transition.js) handles only `draftState`. | Choose primitive (RTDB transaction vs multi-path update vs migrate to Firestore). Implement ATR-1–ATR-5 as single transactions with validation-inside-transaction. |
| **P3** — 3-draft cap enforcement | §5 ATR-3 | No cap exists. | Add `CAP_EXCEEDED` rejection inside ATR-3's re-query step. |
| **P4** — `expectedRevision` validation | §6 | No `expectedRevision` field on requests or responses. | Add to all mutating endpoints. Return `STALE_REVISION` / `INVALID_REVISION` per §6 table. |
| **P5** — Canonical client `saveDraft` | T2, T3 | [App.tsx:522](../../App.tsx:522) `handleSaveAndContinueLater` calls the existing endpoint directly. | Extract a canonical `saveDraft(snapshot, { draftId?, expectedRevision? })` helper. Wire every save affordance to this single function. |
| **P6** — Begin New cloud-aware flow | T4, T5 | [components/PreparationForm.tsx:168](../../components/PreparationForm.tsx:168) `handleBeginAgain` clears local only. | Extend with cloud transition (ATR-2). Surface unsaved-changes UX prompt (T4). |
| **P7** — Drafts dashboard UI | T6, T7 | No drafts dashboard exists. [components/MyLettersModal.tsx](../../components/MyLettersModal.tsx) shows sent letters only. | Build `MyDraftsModal.tsx` (or extend MyLettersModal with a Drafts tab). Wire Resume (T6) and Delete (T7) actions. |
| **P8** — Resume flow | T6, T12 | No Resume code path exists. | Wire dashboard "Resume" → ATR-1 server call → `clearPreparationDraft` → new `seedLocalDraft` writer → update `draftRecord` → navigate. |
| **P9** — Sign-in reconciliation UX | T9, T10, Cases A and B | [App.tsx:693](../../App.tsx:693) hydration effect auto-resolves cloud state without prompting. | Refactor to defer to user choice. Surface Case A or Case B prompt depending on whether cloud ACTIVE exists at sign-in. |
| **P10** — Mid-editing reconciliation UX | Case C | No `STALE_REVISION` handling exists; current client treats all errors generically at [App.tsx:572–576](../../App.tsx:572). | Detect `STALE_REVISION` response. Surface Case C prompt. Wire its three choices to ATR-1 / hydrate / no-op. |
| **P11** — Heartbeat infrastructure | §7 | No heartbeat endpoint, no client ping, no schema fields. | New endpoint (e.g., `/api/drafts/heartbeat.js`) that performs metadata-only write. Client ping loop ~30s. UX surface for "Active 2 minutes ago on MacBook Air" in dashboard cards. |
| **P12** — Race-policy UX messaging | R1, R2 | Generic error toast only. | Specific user-facing copy for R1 ("Another session created a draft. Refresh dashboard.") and R2 ("Another session resumed a different draft. Refresh dashboard."). |

### Phase ordering recommendation

Phase 1 (this PR): doctrine + contract only. ✓
Phase 2: P1, P2, P3, P4 (server-side foundation — schema, transactions, cap, revision). Verified via integration tests; no UI changes user-visible.
Phase 3: P5, P6, P10 (client-side core wiring — canonical save, cloud-aware Begin New, STALE_REVISION handling). Some UX surfaces (Begin New prompt, Case C prompt).
Phase 4: P7, P8 (drafts dashboard + Resume flow).
Phase 5: P9 (sign-in reconciliation — Cases A and B).
Phase 6: P11, P12 (heartbeat + race-policy copy).

The ordering is recommendation only; the contract holds regardless of ordering. Implementation phases choose what they wire when, but every wired surface must satisfy the contract as written here.

---

End of contract.
