# Diagnostic-2 — Mount-Time Stale Authority Replay (Path A)

**Date:** 12 May 2026
**Mode:** Read-only investigation. No code changes.
**Branch state:** PR-47 (§13 option 5 of the canonical diagnostic) is applied to the working tree but not yet merged. This diagnostic examines the codebase *with PR-47 applied*.
**Canonical reference:** [docs/diagnostics/state-authority-hydration-conflict.md](state-authority-hydration-conflict.md). Path B is closed by PR-47; Path A is the subject of this diagnostic.
**Architectural rule:** *"Persistence should observe composition, not govern composition."*

---

## 1. Executive summary

PR-47 relocated the unsafe creator-state hydration out of the stage-keyed resolver effect and into the `data` `useState` initializer at [App.tsx:345-359](App.tsx:345). That closed Path B (re-fire on stage transitions). It did **not** change the mount-time precedence — `localStorage['vday_data']` still wins over `localStorage['vday_data_draft'].data` at mount, with no identity, no UID gate, no intent gate, no recency comparison.

The two buckets are written at **different lifecycle points** and cleared at **different lifecycle points**, so they can hold content from **different letters** when the user re-enters `/letter/create` at any post-PREPARE stage. When that happens, the data initializer at [App.tsx:354](App.tsx:354) (`readPersistedCoupleData()` → if found, return persisted) replays the OLDER letter's content over the in-progress letter's form-draft data.

This is the disease's second face. PR-47 made persistence passive *during* composition. Mount-time persistence is still *governing* — selecting what hydrates into `data` with no signal of user intent.

---

## 2. Context — what is closed and what is not

**Closed by PR-47 (do not revisit):**

- Resolver useEffect at [App.tsx:914-979](App.tsx:914) no longer reads or writes `data` on `NO_LINK` linkState. The branch that previously ran `setData(readPersistedCoupleData())` on every stage transition is now an explicit-by-design comment block at [App.tsx:948-950](App.tsx:948).
- In-memory `data` set by `PreparationForm.onComplete` at [App.tsx:1459](App.tsx:1459) and by `setData(prev => …)` callers throughout the file is no longer stomped during composition.

**Still open (Path A):**

- The `data` initializer at [App.tsx:345-359](App.tsx:345) preserves the prior mount-time precedence (`vday_data` > `vday_data_draft.data`). The diagnostic §3 documented this as a "known residual" of option 5. Empirically, this residual reproduces in the wild.

---

## 3. Mount-time authority decision tree (post-PR-47)

The following runs synchronously at App mount for any route. For `/letter/create` specifically:

### 3.1 Inputs read at mount

| Input | Source | When | Returns |
|---|---|---|---|
| `routeType` | `getRouteType()` ([utils/routing.ts:25-48](utils/routing.ts:25)) | sync, on first render | `'LETTER_CREATE'` for `/letter/create` |
| `initialDraft` | `peekDraft()` ([App.tsx:335](App.tsx:335)) | sync `useMemo` initializer | `{ data, step, stage, draftId }` from `localStorage['vday_data_draft']` ([hooks/usePreparationPersistence.ts:113-150](hooks/usePreparationPersistence.ts:113), exported at [:178-180](hooks/usePreparationPersistence.ts:178)) |
| `initialDraft.data` | same | same | `Partial<CoupleData>` after `selectiveHydrate` ([usePreparationPersistence.ts:68-103](hooks/usePreparationPersistence.ts:68)) — text-safe + structured-text + `memoryBoard` + `userImageUrl`; **`audio`, `video`, `aiImageUrl` are deliberately dropped** |
| `initialDraft.stage` | same | same | `AppStage \| null` from the persisted draft's stored stage |
| `initialDraft.draftId` | same | same | PR-21 optimistic cloud-draft hint, **never compared against `vday_data`** |
| `readPersistedCoupleData()` | [App.tsx:148-165](App.tsx:148) | sync, called inside the `data` initializer | full `CoupleData \| null` from `localStorage['vday_data']`, Zod-validated |
| `authUser`, `authLoading`, `serverSessionReady` | `useAuth()` ([App.tsx:415](App.tsx:415)) | initial values: `null, true, false`; flip async after `onAuthStateChanged` | NOT consulted at mount-time data restoration |

### 3.2 Decision logic — `stage` initializer ([App.tsx:337-344](App.tsx:337))

```
if routeType !== 'LETTER_CREATE'   → fallback = initialStageForRoute(routeType)   (LANDING for HOME)
if !initialDraft.stage              → fallback = PREPARE (LETTER_CREATE fallback)
if !isStageValid(stage, data)       → fallback
otherwise                            → initialDraft.stage
```

`isStageValid` ([App.tsx:139-146](App.tsx:139)): PREPARE is always valid; other persistable sender stages require `finalLetter` length > 0.

### 3.3 Decision logic — `data` initializer post-PR-47 ([App.tsx:345-359](App.tsx:345))

```
if routeType !== 'LETTER_CREATE'                              → null
if !initialDraft.stage OR initialDraft.stage === PREPARE       → null
otherwise:
  persistedRefined = readPersistedCoupleData()                 (reads vday_data)
  if persistedRefined !== null                                 → return persistedRefined   ← Path A surface
  if !initialDraft.data                                        → null
  if !isStageValid(initialDraft.stage, initialDraft.data)       → null
  otherwise                                                     → hydrateCoupleData(initialDraft.data)
```

### 3.4 Decision logic — `draftRecord` initializer ([App.tsx:447-453](App.tsx:447))

```
draftId = peekDraft().draftId      (the PR-21 hint, sync)
seedDraftState = null              (cloud /list populates this async)
```

### 3.5 Async cloud reconciliation ([App.tsx:682-793](App.tsx:682))

After mount, gated on `authUser?.uid && !authLoading && serverSessionReady`:

```
POST /api/drafts/list
  → drafts.filter(persistenceStatus === 'ACTIVE')
  → oldest by createdAt
  → setDraftRecord({ draftId, seedDraftState })   ← writes draftRecord
  → writeDraftId(draftId)                          ← mirrors to vday_data_draft hint
  → setLastSaveSuccessAt(updatedAt)
```

**Crucial:** cloud /list does **not** call `setData` and does **not** read `vday_data`. The cloud's CoupleData payload is held inside `users/{uid}/drafts/{draftId}.data` on RTDB but is never used to hydrate the client-side `data` state. The cloud and the local `data` state are not reconciled.

### 3.6 Decision table — combinations and the resulting `data` after mount

Pre-conditions before mount; `data` value after the initializer runs.

| `vday_data_draft.stage` | `vday_data_draft.data` | `vday_data` | post-mount `data` | correct? |
|---|---|---|---|---|
| absent / PREPARE | absent | absent | `null` (form owns state) | ✓ |
| absent / PREPARE | absent | letter A | `null` (PREPARE gate fires before vday_data read) | ✓ |
| post-PREPARE | letter B | absent | letter B (fallback to `initialDraft.data`) | ✓ |
| post-PREPARE | letter B | letter B | letter B (vday_data wins, they match) | ✓ |
| post-PREPARE | letter B | letter A | **letter A** (vday_data wins, but stale) | **✗ Path A** |
| post-PREPARE | absent | letter A | letter A (stage came from somewhere else, data fills from vday_data) | edge case — see §4.3 |
| post-PREPARE | letter A | letter A | letter A (matches) | ✓ legitimate resume |

Row 5 is the empirical reproduction. Row 6 should not arise in normal writes (`writeStage` no-ops if `existing.data` is absent — [hooks/usePreparationPersistence.ts:212-213](hooks/usePreparationPersistence.ts:212)), so it is mostly theoretical.

---

## 4. Exact authority collision

### 4.1 The defective line

[App.tsx:354](App.tsx:354):

```ts
const persistedRefined = readPersistedCoupleData();
if (persistedRefined) return persistedRefined;
```

### 4.2 The wrong logical assumption

That `vday_data`'s presence implies it is the **right** content for the letter currently described by `vday_data_draft.stage`. There is no such guarantee. The two buckets are written and cleared at independent lifecycle points (see §4.3), and the data initializer treats their relationship as a precedence question (vday_data wins) when it is actually an identity question (which letter is which?).

The disease frame: persistence is governing — selecting which content rides into composition — without any signal of which letter the user actually means to compose. PR-47 stopped persistence from governing during composition; mount-time persistence still governs.

### 4.3 The inputs that *should* have prevented the read but did not

Five signals exist in the codebase or in `CoupleData` itself that *could* have gated this read. None are consulted at mount-time data restoration:

1. `initialDraft.draftId` (the PR-21 optimistic hint at [hooks/usePreparationPersistence.ts:140-144](hooks/usePreparationPersistence.ts:140)). Present in `vday_data_draft`, **absent in `vday_data`**. No comparison possible.
2. Cloud `users/{uid}/drafts/{draftId}.data` — the authoritative per-user, per-letter draft. Fetched async at [App.tsx:725-784](App.tsx:725) but only populates `draftRecord` metadata, never `data`.
3. `CoupleData.status` / `CoupleData.sealedAt` ([types.ts:135-138](types.ts:135)). `writePersistedCoupleData` at [App.tsx:171-185](App.tsx:171) writes the whole `CoupleData`, so these fields *could* be set — but they are only set server-side by `api/verify-payment.js` (which writes to `shared/{sessionKey}`, **not** to local `vday_data`). Local `vday_data` therefore never carries a sealed marker.
4. `sv_intentional_entry` sessionStorage flag ([utils/intentionalEntry.ts:8-29](utils/intentionalEntry.ts:8)). Marks "user clicked Start New Letter" from [components/LandingPage.tsx:113](components/LandingPage.tsx:113) or [components/OccasionSelector.tsx:14](components/OccasionSelector.tsx:14). Consumed at [components/PreparationForm.tsx:93](components/PreparationForm.tsx:93) to decide the resume modal — **not consulted at the App-level `data` initializer**.
5. `authUser?.uid`. Async-resolved by `useAuth`. The `data` initializer is synchronous; auth state has not resolved yet. Even if it had, there is no UID stored in either localStorage bucket to compare against.

### 4.4 Why the two buckets get out of sync — the cleanup-boundary mismatch

| Bucket | Written by | Cleared by |
|---|---|---|
| `vday_data` | `writePersistedCoupleData` at [App.tsx:1477](App.tsx:1477) inside `RefineStage.onSave` only | **Nothing.** Only overwritten by the next `RefineStage.onSave`. No clear-on-payment, no clear-on-sign-out, no clear-on-new-letter, no clear-on-Begin-Again. |
| `vday_data_draft` | `writeDraft` (debounced, PreparationForm-keystrokes), `writeStage` (every `safeSetStage` in sender flow at [App.tsx:517](App.tsx:517)), `writeDraftFromExternal` (RefineStage AI updates at [App.tsx:1487](App.tsx:1487)), `writeDraftId` (cloud reconciliation) | `clearPreparationDraft` on Begin-Again ([PreparationForm.tsx:176](components/PreparationForm.tsx:176)) and on post-payment SHARE entry ([App.tsx:1605](App.tsx:1605)); `writeDraftId(null)` on confirmed sign-out ([App.tsx:704](App.tsx:704)) clears only the draftId hint |

`vday_data` is **write-once, overwrite-never-clear**. `vday_data_draft` has multiple clear sites. The buckets drift apart whenever:

- A letter reaches `RefineStage.onSave` (writes `vday_data`) but is later abandoned, or
- A new letter starts (clears `vday_data_draft`) without `vday_data` being touched, or
- A letter completes payment (clears `vday_data_draft`) but `vday_data` is left as a fossil of the *pre-payment* state of that same letter, and the next letter inherits that fossil.

---

## 5. Mount-time state-of-truth signals — full inventory

Auditing every signal currently captured that *could* distinguish intent at mount.

| Signal | Where it lives | Present at mount? | Currently consulted at data-restore? | Could distinguish: |
|---|---|---|---|---|
| `vday_data_draft.data` | localStorage | yes (sync) | yes (fallback at [App.tsx:356-358](App.tsx:356)) | the in-progress letter's known fields |
| `vday_data_draft.stage` | localStorage | yes (sync) | gates whether restore runs ([App.tsx:353](App.tsx:353)) | post-PREPARE vs PREPARE only |
| `vday_data_draft.draftId` | localStorage, PR-21 hint | yes (sync) | **no** at data-init; consumed only for cloud-save coordination at [App.tsx:447-453](App.tsx:447) | which cloud draft the local form-draft is associated with |
| `vday_data_draft.savedAt` | localStorage | yes (sync) | **no** at data-init; consumed by `getDraftMetadata` at [hooks/usePreparationPersistence.ts:352](hooks/usePreparationPersistence.ts:352) for the resume modal | recency of the form-draft |
| `vday_data` | localStorage | yes (sync) | yes — **prefers it over `vday_data_draft.data`** at [App.tsx:354-355](App.tsx:354) | nothing (anonymous blob) |
| `vday_data.status` / `.sealedAt` | localStorage (via `CoupleData` shape) | structurally possible, **never populated locally** (only `api/verify-payment.js` sets these server-side, into `shared/{sessionKey}`) | no | would distinguish sealed vs in-progress IF populated |
| Cloud `users/{uid}/drafts/{draftId}` | RTDB | resolved async after mount | data field **never** copied into local `data`; only `draftId`/`seedDraftState` reach `draftRecord` | authoritative per-user, per-letter content + state |
| Cloud `users/{uid}/drafts.persistenceStatus` | RTDB | async | gates which cloud draft becomes the active one ([App.tsx:739-742](App.tsx:739)) | `ACTIVE` vs other; canonical letter identity for signed-in users |
| `sv_intentional_entry` sessionStorage | per-tab, set by entry CTAs | yes (sync) | consumed only inside PreparationForm ([components/PreparationForm.tsx:93](components/PreparationForm.tsx:93)) | "user clicked Start New Letter" vs accidental re-mount |
| `authUser?.uid` | React state, async via Firebase | **no** at sync init (initial `null`) | not consulted at data-init | who the user is, on signed-in flows |
| URL query / hash | `window.location` | yes (sync) | only `?preview=`, `?occasion=`, `?role=`, `#p=` consulted; no `?draft=` / `?new=` / `?letter=` patterns | nothing about letter identity in the URL |
| Route history / referrer | not tracked | n/a | n/a | n/a |
| Sign-out cleanup | clears `draftRecord` + `writeDraftId(null)` at [App.tsx:701-704](App.tsx:701) | runs async post-auth | does **not** clear `vday_data` or `vday_data_draft.data` | nothing to gate residue carrying across users |

### 5.1 Named gaps

- **No identity field in `vday_data`.** The bucket is an anonymous CoupleData blob with no `draftId`, no `uid`, no `letterId`, no provenance marker. There is no way to ask "is this the right letter?" of `vday_data` at read time.
- **No seal marker locally.** `verify-payment.js:689-699` writes the sealed payload to `shared/{sessionKey}` server-side; the client never updates local `vday_data` after a seal. So even if a check were added, there is no local signal that says "this letter is done — don't replay it."
- **No clear-on-payment for `vday_data`.** [App.tsx:1605](App.tsx:1605) `clearPreparationDraft()` clears the draft bucket on entering SHARE but does **not** clear `vday_data`.
- **No clear-on-begin-again for `vday_data`.** [PreparationForm.tsx:176](components/PreparationForm.tsx:176) `clearPreparationDraft()` clears the draft bucket on the resume modal's "Begin Again" but does **not** clear `vday_data`.
- **No mount-time consumption of `sv_intentional_entry` at the App level.** The flag is consumed inside PreparationForm to control the modal; the App-level `data` initializer never sees it. (And `consumeIntentionalEntry` clears-on-read, so even if it were read at the App level, it would race with PreparationForm.)
- **No client-side use of cloud draft data.** The async `/api/drafts/list` fetch returns the full per-letter draft document, but only its `draftId` and `draftState` are read. The actual `data` field on each cloud draft document is ignored by the client.

These gaps are noted, not designed against.

---

## 6. Why PR-47 was necessary but not sufficient

PR-47 implemented §13 option 5 of the canonical diagnostic: "move data restoration out of an effect with `stage` in its deps; eliminates Path B without changing the persistence model."

It was **necessary** because the resolver effect re-fired on every transition, re-reading `vday_data` and calling `setData(persisted)` continuously — turning a single mount-time decision into a per-transition decision and stomping every in-memory edit the user made along the way.

It was **not sufficient** because option 5 explicitly preserves the persistence *model*, which includes the precedence at mount. The disease — "persistence governs composition" — has two faces:

| Face | When | Mechanism | Status post-PR-47 |
|---|---|---|---|
| **Path B** | Every stage transition during composition | Resolver effect re-reads `vday_data` and overwrites `data` | **Closed.** Read removed from the effect. |
| **Path A** | Mount-time hydration | `data` initializer reads `vday_data` and treats it as authoritative over `vday_data_draft.data` | **Open.** PR-47 relocated the read from the effect into the initializer, preserving its precedence verbatim. |

The architectural rule is: persistence should observe composition, not govern it. PR-47 made persistence passive *during* composition (Path B). At mount, persistence is still *governing* composition (Path A) — selecting which content hydrates into the in-memory creator state, with zero signal of user intent, identity, or letter boundary.

Mount is not exempt from the rule. The first composition step happens immediately after mount. If persistence speaks first and chooses the wrong letter, the user opens their session inside the wrong letter — and from PR-47 onward the wrong letter is sticky (no longer stomped by transitions, but also no longer corrected by anything).

---

## 7. Reproduction recipe — Path A specific

This recipe is distinct from §15 of the canonical diagnostic, which reproduces Path B. Run on a build with PR-47 applied.

### 7.1 Pre-conditions

`localStorage` after step 4 below must contain:

- `vday_data` = letter A's content (populated by `RefineStage.onSave` for letter A)
- `vday_data_draft.data` = letter B's content
- `vday_data_draft.stage` = any post-PREPARE persistable stage (`REFINE`, `PERSONAL_INTRO`, `QUESTION`, `MAIN_EXPERIENCE`, `PAYMENT`)

The two buckets must hold **different letters**. This is the explicit failure mode Path A addresses.

### 7.2 Steps (fresh incognito window)

1. Open the app at `/`. Sign in if desired (the bug reproduces signed-out too).
2. Start a new letter (`Start` from landing, choose an occasion, reach `/letter/create`).
3. Complete PREPARE for **letter A** — type sender/recipient/body, advance to REFINE.
4. In REFINE, click Save (the action wired to `RefineStage.onSave` at [App.tsx:1466-1477](App.tsx:1466)). This is the step that writes `vday_data = letter A's content`. Confirm in DevTools → Application → Local Storage that `vday_data` is now populated.
5. *Do not* complete payment. Navigate back to the landing page or to `/create` and start a new letter — the "begin again" / occasion-selector path that calls `markIntentionalEntry` ([components/LandingPage.tsx:113](components/LandingPage.tsx:113) or [components/OccasionSelector.tsx:14](components/OccasionSelector.tsx:14)).
6. At `/letter/create`, the resume modal appears (PreparationForm sees the intentional-entry flag). Click **Begin Again**. This calls `clearPreparationDraft()` at [PreparationForm.tsx:176](components/PreparationForm.tsx:176) — `vday_data_draft` is cleared, but **`vday_data` is left alone** (still letter A).
7. Compose **letter B** in PreparationForm. Different names, different body, different media. Complete PREPARE → advance to REFINE.
8. At this moment `vday_data_draft.data` is letter B (from `usePreparationPersistence`'s debounced writes), `vday_data_draft.stage` is `REFINE` (from `writeStage` triggered by `safeSetStage`), and `vday_data` is still letter A.
9. **Refresh the browser tab.**
10. Observe: the data initializer at [App.tsx:345-359](App.tsx:345) sees stage `REFINE` (post-PREPARE, passes the gate at line 353), calls `readPersistedCoupleData()` at line 354, gets letter A, returns letter A. The user is now sitting in REFINE looking at **letter A's content** instead of the letter B they were just composing.
11. RefineStage renders with letter A. If the user clicks Save again, `writePersistedCoupleData(updated)` at [App.tsx:1477](App.tsx:1477) writes letter A (possibly with a minor edit) back to `vday_data` — letter B is now lost from both buckets.

### 7.3 Expected observation (current behavior — bug)

- Step 10: preview at PERSONAL_INTRO or MAIN_EXPERIENCE renders letter A's names, body, and media. Specifically the *sender-side receiver preview* (where `isCreatorPreview === true`) shows the wrong letter.
- DevTools breakpoint at [App.tsx:354](App.tsx:354) confirms `persistedRefined !== null` and is letter A's content.

### 7.4 Expected post-fix observation

After whichever directional fix from §8 is adopted, step 10 should render letter B's content (or, depending on which direction, prompt the user explicitly about which letter to restore). The diagnostic does not prescribe the exact post-fix UX.

### 7.5 Variant — payment-completed prior letter

Same effect via a slightly different path:

1. Compose letter A end-to-end through payment. SHARE stage fires `clearPreparationDraft()` at [App.tsx:1605](App.tsx:1605) — `vday_data_draft` cleared, **`vday_data` left as letter A** (write-once, never-cleared).
2. Start letter B from a fresh entry. Reach REFINE (writes `vday_data_draft.stage = REFINE` and `.data = letter B`).
3. Refresh.
4. Same outcome: data initializer returns letter A.

This variant is more pernicious because the user believes letter A is "done and gone" — the receiver has it, the sender's UI has moved on. The local fossil betrays that mental model.

---

## 8. Directional fix options for Path A

Re-evaluating canonical §13 in the Path A context, and adding new directions visible after PR-47.

Each option is described in terms of:

- **Scope** — files touched, contracts affected
- **Risk** — what could break
- **Preserves** — crash recovery, intentional resume, autosave, anonymous flow
- **Changes** — storage semantics, mount behavior, UX

### 8.1 Option F — collapse `vday_data` into `vday_data_draft`; eliminate the second bucket

The cross-bucket identity collision cannot occur if there is only one bucket.

- **Scope:** delete `STORAGE_KEY = 'vday_data'` and the helpers `readPersistedCoupleData` / `writePersistedCoupleData` at [App.tsx:94](App.tsx:94), [App.tsx:148-185](App.tsx:148). Remove the call site at [App.tsx:1477](App.tsx:1477). Extend `RefineStage.onSave`'s persistence handoff so the enriched payload (`{ ...enrichedData, finalLetter }`) is written into `vday_data_draft` via `writeDraftFromExternal` (which currently only carries `finalLetter` at [App.tsx:1487](App.tsx:1487)). The `data` initializer then reads only `vday_data_draft.data`. Persistence model collapses to one bucket.
- **Risk:** any field RefineStage's `onSave` produces beyond `finalLetter` must be threaded through `writeDraftFromExternal`. The `MEDIA_FIELDS_RESTORED` allowlist in [hooks/usePreparationPersistence.ts:63-66](hooks/usePreparationPersistence.ts:63) (which excludes `audio`, `video`, `aiImageUrl`) needs review — some enrichment fields may need to be added to the safe list. Crash recovery for refined-letter content depends on the form-draft bucket now carrying everything.
- **Preserves:** crash recovery (single bucket), intentional resume via existing modal flow, autosave debounce.
- **Changes:** persistence contract (one fewer bucket); the App-level `data` initializer no longer needs `readPersistedCoupleData`.
- **Resolves Path A:** by construction.

### 8.2 Option E — identity-linked persistence; require `draftId` match to hydrate

Carry a `draftId` on `vday_data` and require it match `vday_data_draft.draftId` before the data initializer prefers `vday_data`.

- **Scope:** add `draftId: string | null` to whatever payload `writePersistedCoupleData` stores. At write time ([App.tsx:1477](App.tsx:1477)), pass the current `draftRecord.draftId`. At read time inside the data initializer, require the persisted `draftId` to equal `initialDraft.draftId`; if mismatch, fall through to `vday_data_draft.data`.
- **Risk:** anonymous users (no cloud draftId yet) need a fallback identity. Two options: (a) generate a local UUID on first PREPARE entry and store it in both buckets; (b) skip vday_data entirely for anonymous users. Either way, write-site discipline matters — every writer must propagate the id.
- **Preserves:** both buckets, both write semantics, crash recovery, anonymous flow with care.
- **Changes:** `vday_data` payload shape (now carries identity); precondition added to the data initializer.
- **Resolves Path A:** yes when ids match; falls through to `vday_data_draft.data` (whose content is now correctly the active letter's) when they don't.

### 8.3 Option C — completed-letter marker

Mark `vday_data` "complete" on payment (and possibly on RefineStage.onSave); the data initializer skips it if marked complete.

- **Scope:** add a `status` or `completedAt` field at write time. Update at payment completion (this is a new write to `vday_data` from the SHARE-entry path at [App.tsx:1605](App.tsx:1605), which currently only clears `vday_data_draft`). At read time, if the marker is set, treat `vday_data` as inert.
- **Risk:** does **not** resolve the abandoned-before-payment variant in §7.5. Letter A is never marked complete if the user abandons after `RefineStage.onSave` but before payment — yet `vday_data` still holds letter A. The trigger for setting the marker (RefineStage.onSave vs payment success vs SHARE entry) determines coverage; any choice leaves a window.
- **Preserves:** current persistence model.
- **Changes:** payload shape + a clear/mark write at the SHARE boundary.
- **Resolves Path A:** only the seal-then-restart variant. The abandon-then-restart variant remains open.

### 8.4 Option B — UID + draftId namespace

Replace global keys with per-user, per-letter keys.

- **Scope:** rewrite all read/write sites. `vday_data` becomes `vday_data:{uid}:{draftId}`; same for the form-draft bucket. Sign-out clears anything keyed to that uid. Anonymous flow needs a sentinel uid.
- **Risk:** large rewrite. Legacy keys need migration. Anonymous-user flow becomes lossy unless a sentinel scheme is designed. Reads need to know which uid/draftId to consult at mount — uid is async, so this implies awaiting auth before hydrating.
- **Preserves:** crash recovery for signed-in users.
- **Changes:** every storage key in the creator flow; mount-time hydration becomes auth-gated.
- **Resolves Path A:** cross-user collision is fixed; **same-user cross-letter collision is fixed only if `draftId` is included** — and that essentially reduces to a variant of option E with a heavier storage rewrite.

### 8.5 Option D — explicit composition intent gate

Require an explicit signal of "this is a resume of the same letter" before allowing `vday_data` to hydrate.

- **Scope:** thread the `sv_intentional_entry` sessionStorage flag (or a successor of it) into the App-level `data` initializer. On intentional-entry, suppress the `readPersistedCoupleData` call. On accidental re-mount, allow it.
- **Risk:** semantic clash with PreparationForm's existing `consumeIntentionalEntry` (clear-on-read, single consumer assumed). Two consumers create ordering bugs. The flag also doesn't cover refresh during composition — a refresh has no intentional-entry signal, so the gate either fires (and loses legitimate resume) or doesn't (and Path A reproduces on refresh, which is exactly the §7.2 scenario).
- **Preserves:** the entry-CTA UX surface.
- **Changes:** App-level initializer gains a precondition.
- **Resolves Path A:** partially. Resolves the entry-CTA reproduction; does not resolve the refresh reproduction (§7.2 step 9).

### 8.6 Option A — cloud-canonical (signed-in flow)

Make cloud-draft the authority; localStorage demoted to a write-through buffer.

- **Scope:** large. The async `/api/drafts/list` fetch ([App.tsx:725-784](App.tsx:725)) must feed into `data` (currently it only feeds `draftRecord`). Cloud draft `users/{uid}/drafts/{draftId}.data` becomes the source of truth at mount for signed-in users; localStorage is for crash-only recovery between server flushes. Anonymous flow needs separate handling (still localStorage-canonical, but ideally constrained to a single in-flight draft).
- **Risk:** anonymous-user flow continues to face Path A. Boot UX changes — sync-hydration becomes async, with a flash-then-load. Race with auth-state-resolution: the data initializer can't return cloud content synchronously.
- **Preserves:** nothing about current local persistence semantics.
- **Changes:** mount-time hydration becomes async + auth-gated; persistence contract substantially rewritten.
- **Resolves Path A:** completely for signed-in users; deferred for anonymous users.

### 8.7 Combinations

- **F alone** is the smallest surface that fully resolves Path A by construction. The collision cannot exist if there is no second bucket.
- **E + (anonymous-uuid fallback)** resolves Path A without collapsing buckets. Two writes get a precondition; no removals.
- **F + A** (collapse local to one bucket, treat cloud as canonical for signed-in users): defensible long-term shape, but stacks both surfaces.

### 8.8 Ranking by minimum-surface-that-resolves-Path-A

1. **F** — collapse to one bucket. Removes the collision domain. Requires care threading enriched-data through `writeDraftFromExternal`, but smallest read-site surface.
2. **E** — identity-linked write+read. Two payload-shape changes, two read-site preconditions. Resolves by precondition rather than by removal.
3. **C** — seal-completion marker. Resolves the seal-then-restart variant only; abandon-then-restart still reproduces.
4. **B** — UID + draftId namespacing. Heavy storage-key rewrite; resolves Path A only if draftId is part of the namespace (then equivalent to E + key rewrite).
5. **D** — explicit composition intent gate. Resolves the entry-CTA flow; does not resolve refresh.
6. **A** — cloud-canonical. Heaviest scope; resolves signed-in users; anonymous remains.

The ranking is by **surface area required to resolve Path A**, not by overall architectural goodness. Other criteria (anonymous-user UX, refactor blast radius, alignment with the PR-48 multi-draft direction) may shuffle the order under implementation review.

---

## 9. Out of scope (explicit non-goals for this diagnostic)

- **Path B.** Closed by PR-47. Not re-litigated here.
- **Receiver-side hydration paths.** `usePathLinkLoader`, `sv_sess_cache_v1:*` sessionStorage cache, `/api/load-session`. None implicated in Path A.
- **PR-46.5 email path.** Untouched. The seal email reflects whatever the seal payload was; Path A corrupts the payload upstream, but the email machinery itself is not the subject.
- **PR-48 multi-draft system design.** Some directional fix options here (F, E, B) overlap conceptually with multi-draft work, but full design of that system is out of scope; this diagnostic only describes minimum-surface fixes for Path A.
- **Architecture roadmap revisions.** No revisions proposed.
- **Code modifications.** This is a read-only diagnostic.

---

## 10. Drift observations

Canonical diagnostic §10 (file:line references) verified against current branch state (with PR-47 applied):

| Canonical §10 reference | Current state | Drift |
|---|---|---|
| `App.tsx:94` `STORAGE_KEY = 'vday_data'` | unchanged | none |
| `App.tsx:148-165` `readPersistedCoupleData()` | unchanged | none |
| `App.tsx:171-185` `writePersistedCoupleData()` | unchanged | none |
| `App.tsx:335` `peekDraft()` mount-time read | unchanged | none |
| `App.tsx:337-344` `stage` initializer | unchanged | none |
| `App.tsx:345-355` `data` initializer | **now `App.tsx:345-359`** (PR-47 extended the initializer to include the `readPersistedCoupleData` call at line 354; range grew by 4 lines including comment) | expected (PR-47 artifact) |
| `App.tsx:914-977` resolver effect | **now `App.tsx:914-979`** (NO_LINK branch removed, 3-line comment added at lines 948-950) | expected (PR-47 artifact) |
| `App.tsx:941-945` NO_LINK overwrite branch | **removed**; the contents `setData(persisted)` no longer exist; replaced by comment block at [App.tsx:948-950](App.tsx:948) | expected (PR-47 was precisely this removal) |
| `App.tsx:967-977` deps array | **now `App.tsx:969-979`** (shifted by 2 due to comment lines) | expected |
| `App.tsx:1459` `PreparationForm.onComplete` | unchanged | none |
| `App.tsx:1475` `writePersistedCoupleData` call site | **now `App.tsx:1477`** (shifted by 2) | expected |
| `App.tsx:696-701` sign-out cleanup | **now `App.tsx:700-705`** (small shift) | within expected PR-47 line-numbering drift |
| `hooks/usePreparationPersistence.ts:4` `STORAGE_KEY = 'vday_data_draft'` | unchanged | none |
| `hooks/usePreparationPersistence.ts:63-66` `MEDIA_FIELDS_RESTORED` | unchanged | none |
| `hooks/usePreparationPersistence.ts:113-150` `peekDraft()` | unchanged | none |
| `hooks/usePreparationPersistence.ts:366-385` `writeDraftFromExternal()` | unchanged | none |
| `hooks/useAuth.ts:52-68` auth state machine | not re-read for this diagnostic; assumed stable | not investigated this turn |

No **unexpected** drift. All deltas from canonical §10 are PR-47 artifacts and were anticipated. The diagnostic remains the authoritative reference; this diagnostic-2 supplements it without superseding it.

The note added to the canonical diagnostic's audit summary ("the diagnostic §10 line-number references will drift slightly after this fix lands") has now drifted as predicted. If the canonical doc is to remain a living reference, a one-line correction noting the PR-47 deltas is overdue — but that is documentation hygiene, not a substantive change to the diagnostic's conclusions.

---

## 11. Confidence

**High** for §1–§7, §10. Every claim is grounded in file:line; the decision tree in §3 was traced through both initializers and the cloud-hydration effect; the reproduction in §7 follows directly from the cleanup-boundary mismatch in §4.4.

**Medium** for §8. The directional options are accurate in scope and risk as described, but choosing among them depends on factors outside this diagnostic's read-only mandate — notably (a) whether anonymous-user composition is a supported V1 surface, (b) what enriched-data fields `RefineStage.onSave` actually emits beyond `finalLetter`, and (c) how PR-48 multi-draft work intends to model letter identity. The ranking by minimum-surface-to-resolve-Path-A is independent of those factors and is high-confidence.

**Not investigated this turn:** auth lifecycle interactions with cloud-canonical (option A) under flaky-network conditions; the exact content of `enrichedData` produced by RefineStage's AI pipeline (relevant to option F's threading question). Both are flagged as scope expansions that would require further read effort beyond this diagnostic.

---

End of diagnostic-2.
