# State-Authority Hydration Conflict — Diagnostic Report

**Date:** 12 May 2026 (revised 13:08 IST after disproof of the incognito-isolation hypothesis)
**Mode:** Read-only investigation. No fixes proposed at the implementation level.
**Scope:** Sender-side creator flow (`/letter/create` → PREPARE → REFINE → PERSONAL_INTRO → MAIN_EXPERIENCE preview → PAYMENT). Receiver flow and PR-46.5 email path are NOT implicated.

**Classification:** P0 — creator-state authority corruption. Not a cache / cleanup / residue bug.

---

## 1. Executive summary

The sender-side preview renders **the previous letter's content** in place of the user's freshly-entered data. The visible overwrite is a single `useEffect` in `App.tsx` whose dependency array includes `stage` — meaning it re-fires on every stage transition — and which unconditionally re-reads from `localStorage['vday_data']` and calls `setData(persisted)` when `linkState === LoaderState.NO_LINK` (the creator flow).

The localStorage key is **not partitioned by user UID**, **not partitioned by letter identity**, and the read is **not gated by auth state** or by the presence of fresher in-memory data. Whatever the LAST RefineStage-completing session wrote to that key is what overwrites the fresh state on the NEXT letter attempt — regardless of which Google account is signed in.

### The corrected understanding (revised after disproof of incognito-isolation)

An earlier hypothesis held that incognito eliminated the issue. That hypothesis is **wrong**. Further testing showed:

- Fresh incognito sessions **initially mask** the issue because persistence buckets start empty.
- Once a creator session populates `localStorage` inside that **same** incognito session, subsequent new-letter attempts reproduce the corruption identically.
- Therefore the defect is NOT long-lived browser residue, cross-account leak, or stale cache.
- The defect is **deterministic overwrite logic that activates as soon as persistence buckets are populated**, regardless of session age or scope.

### Core architectural conclusion

The creator flow has **no stable source-of-truth hierarchy**. Multiple layers compete for authority over creator state simultaneously:

- PreparationForm's local `useState`
- `App.tsx`'s in-memory `data`
- `localStorage['vday_data']`
- `localStorage['vday_data_draft']`
- Cloud drafts (`users/{uid}/drafts`)
- Route hydration (`useLinkLoader` family)
- Auth hydration (`useAuth` + `serverSessionReady`)
- Stage-transition effects (the resolver effect itself)

The application currently allows **persistence-hydration layers to overwrite fresher transient creator state during ordinary stage transitions**. That is the disease.

`setData(persisted)` at [App.tsx:944](App.tsx:944) is only **where the symptom becomes visible** — the line where the unsafe authority decision materializes into a wrong user-visible value. Removing that single line in isolation would not cure the architecture; the same conflict would re-emerge at Path A (mount-time seeding) or any future layer that hydrates `data` from persistence without a precondition check.

### Severity

This is not cosmetic. Because `PaymentStage` constructs its seal payload from the live `data` prop, a stomped `data` becomes the **sealed** letter. Users can pay to seal the wrong content under their own name with someone else's photos. See §11.

---

## 2. The exact overwrite chain

### Trigger: PreparationForm complete → stage transition → resolver effect re-fires

1. User has previously completed a letter, including RefineStage. At that point, `writePersistedCoupleData(value)` ran ([App.tsx:171-185](App.tsx:171), invoked from [App.tsx:1475](App.tsx:1475) inside RefineStage's `onSave`), writing the full `CoupleData` to `localStorage['vday_data']` under the key declared at [App.tsx:94](App.tsx:94) (`STORAGE_KEY = 'vday_data'`).
2. User starts a NEW letter. They sign in (or were already signed in via cached Firebase session) and navigate to `/letter/create`.
3. On mount:
   - `peekDraft()` reads the *other* key, `localStorage['vday_data_draft']` (declared at [hooks/usePreparationPersistence.ts:4](hooks/usePreparationPersistence.ts:4)). This is the in-progress PreparationForm bucket.
   - If a prior draft exists there, [App.tsx:337-344](App.tsx:337) may restore `stage` and [App.tsx:345-355](App.tsx:345) may seed `data` from it. This is overwrite path **A** (see §3).
   - If no in-progress draft exists, `data` starts as `null` and `stage` starts at the route default (`PREPARE` for `/letter/create`).
4. User types fresh names, fresh body, uploads new photos. **None of this lives in `App.tsx`'s `data` state yet** — PreparationForm has its own local `useState` (see [components/PreparationForm.tsx:139](components/PreparationForm.tsx:139)). Form contents are debounced to `localStorage['vday_data_draft']` (the draft key) via `usePreparationPersistence`.
5. User clicks Complete. `PreparationForm.onComplete` fires at [App.tsx:1459](App.tsx:1459), calling `setData(hydrateCoupleData(d))` with the fresh form payload, and (immediately after) `safeSetStage(AppStage.REFINE)`.
6. **`stage` changes** from `PREPARE` to `REFINE`. The resolver effect at [App.tsx:914-977](App.tsx:914) re-runs because `stage` is in its dependency array ([App.tsx:976](App.tsx:976)).
7. Inside that effect, `linkState === LoaderState.NO_LINK` for any creator flow (no `/abc123` path, no `#p=` hash). Control reaches the NO_LINK branch at [App.tsx:941-945](App.tsx:941):

   ```ts
   } else if (linkState === LoaderState.NO_LINK) {
     const persisted = readPersistedCoupleData();   // App.tsx:942
     if (persisted) {
       setData(persisted);                          // App.tsx:944  ← STOMP
     }
   }
   ```

8. `readPersistedCoupleData()` ([App.tsx:148-165](App.tsx:148)) reads `localStorage['vday_data']` — the *post-RefineStage* key — and returns the **previous letter's content**. `setData(persisted)` overwrites the fresh data the user just submitted via `onComplete`.
9. Every subsequent stage transition (REFINE → PERSONAL_INTRO → MAIN_EXPERIENCE) re-fires the same effect and re-applies the same stomp. The user sees old names, old body, missing media.

### Exact overwrite point

| File | Line | Code |
|---|---|---|
| [App.tsx](App.tsx:942) | 942 | `const persisted = readPersistedCoupleData();` |
| [App.tsx](App.tsx:944) | 944 | `setData(persisted);` |
| [App.tsx](App.tsx:976) | 976 | `stage,` (dep that causes re-fire on every transition) |

The supporting read function:

| File | Line | Code |
|---|---|---|
| [App.tsx](App.tsx:94) | 94 | `const STORAGE_KEY = 'vday_data';` |
| [App.tsx](App.tsx:148) | 148–165 | `readPersistedCoupleData()` — unconditional read of `localStorage['vday_data']`, validated via Zod, returns hydrated CoupleData |

The supporting write site (how `vday_data` becomes populated in the first place):

| File | Line | Code |
|---|---|---|
| [App.tsx](App.tsx:171) | 171–185 | `writePersistedCoupleData(value)` — writes to `localStorage['vday_data']` |
| [App.tsx](App.tsx:1475) | 1475 | RefineStage's `onSave` callback invokes the writer |

---

## 3. Two overwrite paths exist — both originate in localStorage

### Path A — Mount-time seeding from the draft bucket

- **Storage key:** `localStorage['vday_data_draft']` ([hooks/usePreparationPersistence.ts:4](hooks/usePreparationPersistence.ts:4))
- **Reader:** `peekDraft()` called at [App.tsx:335](App.tsx:335) (`useMemo` initializer, runs once per mount) and again at [components/PreparationForm.tsx:81](components/PreparationForm.tsx:81) (form's own initializer ref).
- **What it seeds:**
  - `stage` initializer at [App.tsx:337-344](App.tsx:337) may restore a previously-saved stage.
  - `data` initializer at [App.tsx:345-355](App.tsx:345) may seed `data` from a previously-saved draft if `initialDraft.stage` is past PREPARE and `isStageValid(...)` ([App.tsx:139-146](App.tsx:139)) passes.
- **No auth gate.** The function checks route, stage validity, and field presence — but not which user owns the draft.
- **Effect on bug:** if the previous browser session left a post-PREPARE draft in localStorage, the new letter session starts already-stale at first paint.

### Path B — Resolver effect re-firing on stage transitions

- **Storage key:** `localStorage['vday_data']` ([App.tsx:94](App.tsx:94))
- **Reader:** `readPersistedCoupleData()` called from [App.tsx:942](App.tsx:942) inside the resolver effect.
- **Trigger:** **every** change to `demoData`, `isDemoMode`, `isEidFlow`, `isReceiverLink`, `linkError`, `linkState`, `routeType`, `sharedData`, or **`stage`** ([App.tsx:967-977](App.tsx:967)). Stage transitions are the dominant trigger in the creator flow.
- **No auth gate.** No check that the persisted blob belongs to the current user, no check that this is a fresh-letter intent vs. resume intent, no check that the in-memory `data` is already fresher than the persisted blob.
- **Effect on bug:** every stage transition re-stomps fresh state with whatever the last user wrote to `vday_data`.

Path A and Path B use **different storage keys** but share the same defect: the keys are global (not UID-namespaced) and the reads are unconditional with respect to user identity.

---

## 4. State-authority map

| Layer | Storage key / source | Auth gate? | Read site(s) | Write site(s) |
|---|---|---|---|---|
| **In-memory `data`** (creator state) | `App.tsx` `useState` at line 345 | — | Every preview/render component | `setData(...)` calls throughout `App.tsx` (line 944 is the stomp; line 1459 is the form-complete write) |
| **In-memory `sharedData`** (receiver) | `useLinkLoader` → `usePathLinkLoader` | — | [App.tsx:937-940](App.tsx:937) (only when `linkState === SUCCESS`) | n/a (loader-owned) |
| **`PreparationForm` local state** | Component-local `useState` | — | PreparationForm internal | Form `onChange` handlers; mirrored to `vday_data_draft` |
| **localStorage `'vday_data'`** | Browser localStorage, global | **NO** | [App.tsx:148-165](App.tsx:148) → invoked at [App.tsx:942](App.tsx:942) | [App.tsx:171-185](App.tsx:171) → invoked at [App.tsx:1475](App.tsx:1475) (RefineStage save) |
| **localStorage `'vday_data_draft'`** | Browser localStorage, global | **NO** | `peekDraft()` at [App.tsx:335](App.tsx:335), [PreparationForm.tsx:81](components/PreparationForm.tsx:81); `getDraftMetadata()` at [PreparationForm.tsx:88](components/PreparationForm.tsx:88) | Debounced writes in `usePreparationPersistence`; `writeStage`, `writeDraftId`, `writeDraftFromExternal`, `clearPreparationDraft` (all in [hooks/usePreparationPersistence.ts](hooks/usePreparationPersistence.ts)) |
| **sessionStorage `'sv_sess_cache_v1:{key}'`** | Receiver-side payload cache | n/a | [utils/sharePathHints.ts](utils/sharePathHints.ts) (via `usePathLinkLoader`) | Same |
| **sessionStorage `'eidDecodedData'`** | Eid bridge | — | [utils/eidDecoder.ts:30](utils/eidDecoder.ts:30) | [App.tsx:992](App.tsx:992) |
| **Firebase RTDB `users/{uid}/drafts`** | Cloud draft store | **YES** (`getSessionUser`) | `/api/drafts/list` → [App.tsx:721-784](App.tsx:721) | `/api/drafts/save` ([App.tsx:550-663](App.tsx:550)), `/api/drafts/transition` ([hooks/useDraftStateObserver.ts:94-112](hooks/useDraftStateObserver.ts:94)) |
| **Firebase RTDB `shared/{sessionKey}`** | Sealed letter | server-side | [api/load-session.js](api/load-session.js) | [api/verify-payment.js:689-699](api/verify-payment.js:689) (on paid seal) |

### Authority decision

When the resolver effect re-fires and `linkState === NO_LINK`, the localStorage read at [App.tsx:942](App.tsx:942) is treated as authoritative over the in-memory `data` that was just set by `PreparationForm.onComplete`. The code does not check whether `data` is non-null, whether it's fresher than the persisted blob, or whether the user even intended to resume.

**The wrong winner.** In-memory `data` (the user's just-typed fresh content) loses to localStorage `vday_data` (whatever the last RefineStage session wrote).

---

## 5. Race-condition analysis

The bug is partially a race, partially a deterministic overwrite. Distinguishing them matters:

### Deterministic component (always reproducible given residue)

Once `localStorage['vday_data']` is non-empty:

- Every transition out of PREPARE (REFINE, PERSONAL_INTRO, MAIN_EXPERIENCE, PAYMENT) re-runs the resolver effect.
- Each run calls `setData(persisted)` from line 944.
- The user's fresh `data` is overwritten on every transition.

This is **not** a race — it is a guaranteed stomp given residue in localStorage. The "sometimes works" framing in the report is explained by which key has residue: if `vday_data` is empty (e.g., the user previously cleared site data, or never completed RefineStage on this browser), the overwrite branch is a no-op and the fresh data survives.

### Race component (mount-time and auth-bind)

- **Auth-state flip race.** `useAuth` ([hooks/useAuth.ts:52-68](hooks/useAuth.ts:52)) starts with `user=null, loading=true, serverSessionReady=false`. Firebase's `onAuthStateChanged` fires asynchronously and flips loading→false. The hydration effect ([App.tsx:678-789](App.tsx:678)) waits for `serverSessionReady` before calling `/api/drafts/list`. The resolver effect does NOT wait — it reads localStorage immediately on mount and on every dep change. The auth-bound cloud hydration only writes to `draftRecord` state (not `data`), so it does not directly stomp `data` — but timing variability of auth hydration changes *when* the user is sitting on which stage, which alters which transitions fire the resolver and therefore the user-visible severity.
- **Mount-time first-paint race.** The `data` state initializer at [App.tsx:345-355](App.tsx:345) runs synchronously from `peekDraft()` (`vday_data_draft`). If the prior session left a post-PREPARE draft, `data` is seeded stale on the very first render. The user types into PreparationForm before the resolver effect has had a chance to run.

The net behavior: on a clean (empty) localStorage, the user's fresh state survives. On a populated localStorage from any prior session (any account), the user's fresh state is stomped — deterministically once they leave PREPARE.

---

## 6. Why incognito initially masks — but does not eliminate — the issue

An earlier hypothesis held that incognito browser sessions eliminated the bug. **That hypothesis is wrong.** Incognito only delays the trigger. Once a creator session populates the persistence buckets inside the same incognito window, the same overwrite reproduces identically.

### Phase 1 — Fresh incognito (initial masking)

A first-load incognito session starts with isolated, empty `localStorage` and `sessionStorage`:

1. `peekDraft()` returns `{ data: undefined, stage: undefined, step: undefined, ... }`. The `stage` initializer at [App.tsx:337-344](App.tsx:337) returns the route fallback (`PREPARE`). The `data` initializer at [App.tsx:345-355](App.tsx:345) returns `null`.
2. `readPersistedCoupleData()` at [App.tsx:148-165](App.tsx:148) reads `null` from `localStorage['vday_data']` and returns `null`.
3. In the resolver effect, the NO_LINK branch at [App.tsx:941-945](App.tsx:941) executes `if (persisted)` → falsy → `setData` is **not called**.
4. The user's fresh `data` (set by `PreparationForm.onComplete` at [App.tsx:1459](App.tsx:1459)) is never overwritten, because there is nothing in localStorage to overwrite it with.

This phase appears clean. It is what produced the false-positive "incognito works" reading in the earlier diagnostic.

### Phase 2 — Same incognito session, after first letter (bug reproduces)

The moment the user completes RefineStage on the FIRST letter in that same incognito window, [App.tsx:1475](App.tsx:1475) calls `writePersistedCoupleData(...)` and `localStorage['vday_data']` is populated for the lifetime of that incognito window. From that point on, every subsequent new-letter attempt in the same window reproduces the corruption:

1. User starts a second letter in the same incognito window.
2. Fresh names / body / media entered in PreparationForm.
3. PreparationForm completes → `setData(freshFormData)` at [App.tsx:1459](App.tsx:1459) → stage transitions PREPARE → REFINE.
4. Resolver effect re-fires (because `stage` is in its deps at [App.tsx:976](App.tsx:976)).
5. NO_LINK branch at [App.tsx:941-945](App.tsx:941) → `readPersistedCoupleData()` returns the FIRST letter's content → `setData(persisted)` stomps the fresh data.
6. The second letter's preview renders the first letter's content. Identical to the normal-browser symptom.

### What this proves

The bug is **not** caused by browser-level residue, cross-account contamination, or stale cache from prior sessions. The bug is caused by **deterministic overwrite logic** inside the application that activates as soon as `localStorage['vday_data']` becomes non-empty — by any mechanism, in any session, in any window, under any identity.

Incognito did not isolate the bug — it isolated the **trigger**. Once the trigger fires (any RefineStage completion), the defect surfaces in incognito just as it does in a normal browser.

---

## 7. Why old preview data survives across new-letter attempts

Three architectural choices compound to make stale data sticky across "new letter" attempts on the same browser:

1. **Storage keys are not user-scoped.** Both `vday_data` and `vday_data_draft` are global keys. Signing out, switching Google accounts, or starting a "new letter" does not change which bytes those keys hold. Whoever last completed RefineStage on this browser is the one whose content lives in `vday_data` indefinitely.
2. **Sign-out does not clear localStorage.** The sign-out path at [App.tsx:696-701](App.tsx:696) clears `draftRecord`, `lastSaveSuccessAt`, `lastSaveError`, and the localStorage `draftId` *hint* — but does NOT clear `vday_data` or the data portion of `vday_data_draft`. The next session inherits the residue.
3. **"New letter" is not a write event for the persisted bucket.** Visiting `/letter/create` for a fresh letter does not call `writePersistedCoupleData` and does not call any `removeItem`. The bucket simply persists from the previous letter's RefineStage save until the next RefineStage save overwrites it.

Result: every new-letter attempt on the same browser inherits the previous letter's post-Refine state — across accounts, across sessions, across days.

The cross-account flavor of the symptom ("different Google accounts sometimes restore different previous data") is explained by **whoever last touched RefineStage on this browser** — not by per-account cloud restoration. The cloud-hydration effect ([App.tsx:678-789](App.tsx:678)) only populates `draftRecord` metadata; it does not write to `data`. The cross-account variation observed is consistent with browser-residue inheritance, not Firebase cross-account leak.

---

## 8. Why photos / polaroids / songs disappear from sender-side preview

The previous `vday_data` blob in localStorage was written at the moment of the prior letter's RefineStage save. If that prior letter:

- had different media uploads (different photos, no polaroids, different song), the preview now shows the prior media set;
- was saved before media uploads completed (e.g., RefineStage was reached, persisted, then user backtracked and added media later in a separate session), the persisted blob can lack media URLs entirely.

When `setData(persisted)` fires at [App.tsx:944](App.tsx:944), it **replaces** `data` with the persisted blob — not merges. So:

- If the persisted blob has no `memoryBoard`, no `userImageUrl`, no `audio`, no `musicUrl`, those fields on the fresh `data` are wiped.
- The MainExperience preview at [components/MainExperience.tsx](components/MainExperience.tsx) reads media exclusively from the `data` prop (no internal refetch). Wiped fields render as missing.

Note also that `usePreparationPersistence`'s `MEDIA_FIELDS_RESTORED` ([hooks/usePreparationPersistence.ts:63-66](hooks/usePreparationPersistence.ts:63)) explicitly **excludes** `audio`, `video`, and `aiImageUrl` from selective hydration of the `vday_data_draft` key. That is a separate, deliberate choice for the *form* bucket — but it means that even if a draft is restored from `vday_data_draft`, audio/video are never re-populated, only `memoryBoard` and `userImageUrl` are. This compounds the appearance of "media missing" symptoms when Path A (mount-time draft seeding) fires.

---

## 9. Why the cloud-draft hydration effect is NOT the root cause

The hydration effect at [App.tsx:678-789](App.tsx:678) is correctly auth-gated (`authUser?.uid && serverSessionReady`) and correctly hits a per-UID cloud endpoint (`users/{uid}/drafts` via `/api/drafts/list`). Its observed behavior:

- writes to `draftRecord` state ([App.tsx:765-768](App.tsx:765))
- mirrors `draftId` to localStorage hint ([App.tsx:773](App.tsx:773))
- seeds `lastSaveSuccessAt` ([App.tsx:778](App.tsx:778))

It does NOT call `setData`. The cloud-draft data does NOT flow into `data` in this effect. So while this effect runs in parallel and adds timing complexity to the auth flow, it is not the direct overwrite path for the preview-stale symptom.

If, in future investigation, a UI surface is found that reads `draftRecord.data` (rather than just `draftRecord.draftId`) and feeds it back into `data`, the analysis would need to be revisited. The current code paths reviewed do not exhibit this.

---

## 10. Affected files and functions (canonical reference)

Primary:

- [App.tsx:94](App.tsx:94) — `STORAGE_KEY = 'vday_data'`
- [App.tsx:148-165](App.tsx:148) — `readPersistedCoupleData()` (the read)
- [App.tsx:171-185](App.tsx:171) — `writePersistedCoupleData()` (the write, called from RefineStage)
- [App.tsx:335](App.tsx:335) — `peekDraft()` mount-time read
- [App.tsx:337-344](App.tsx:337) — `stage` initializer (Path A — stage seed)
- [App.tsx:345-355](App.tsx:345) — `data` initializer (Path A — data seed)
- [App.tsx:914-977](App.tsx:914) — **the resolver effect (Path B — re-fire stomp)**
- [App.tsx:941-945](App.tsx:941) — **the NO_LINK branch (exact overwrite point)**
- [App.tsx:967-977](App.tsx:967) — dependency array including `stage`
- [App.tsx:1459](App.tsx:1459) — `PreparationForm.onComplete` → `setData(freshFormData)` (the value that gets stomped)
- [App.tsx:1475](App.tsx:1475) — RefineStage `onSave` → `writePersistedCoupleData` (how residue arrives)
- [App.tsx:696-701](App.tsx:696) — sign-out cleanup (does NOT clear `vday_data`)

Supporting:

- [hooks/usePreparationPersistence.ts:4](hooks/usePreparationPersistence.ts:4) — `STORAGE_KEY = 'vday_data_draft'` (the OTHER global key)
- [hooks/usePreparationPersistence.ts:63-66](hooks/usePreparationPersistence.ts:63) — `MEDIA_FIELDS_RESTORED` (audio/video deliberately excluded)
- [hooks/usePreparationPersistence.ts:113-150](hooks/usePreparationPersistence.ts:113) — `peekDraft()` / `readDraft()`
- [hooks/usePreparationPersistence.ts:366-385](hooks/usePreparationPersistence.ts:366) — `writeDraftFromExternal()` (read-merge pattern, additional residue surface)
- [hooks/useAuth.ts:52-68](hooks/useAuth.ts:52) — auth state machine and `serverSessionReady`
- [hooks/usePathLinkLoader.ts:13-50](hooks/usePathLinkLoader.ts:13) — `enabled=false` → returns `NO_LINK` synchronously for creator flow
- [components/PreparationForm.tsx:81-101](components/PreparationForm.tsx:81) — initial-draft decision, resume modal
- [components/PreparationForm.tsx:139-145](components/PreparationForm.tsx:139) — form local state and persistence wiring
- [components/MainExperience.tsx](components/MainExperience.tsx) — reads media exclusively from `data` prop (no internal refetch)
- [components/PaymentStage.tsx:93-102](components/PaymentStage.tsx:93) — sends `coupleData: data` to verify-payment (so a stomped `data` becomes the sealed letter)

---

## 11. Severity beyond the preview

This is not cosmetic. `PaymentStage` constructs its payload from the live `data` prop ([components/PaymentStage.tsx:93-102](components/PaymentStage.tsx:93)). If the resolver effect has stomped `data` with stale content from a prior letter, **the user will pay to seal the prior letter's content**. The verify-payment endpoint at [api/verify-payment.js:689-699](api/verify-payment.js:689) writes whatever `coupleData` arrives in the request body to `shared/{sessionKey}`. There is no server-side reconciliation against fresh form state — the client is the source of truth, and the client has just been stomped.

This means the bug is upstream of the email/share/seal artifacts and can produce a sealed letter with wrong content, wrong names, and missing media — even though the user typed correctly throughout.

---

## 12. Classification

| Question | Answer |
|---|---|
| Incorrect source-of-truth selection? | **YES — the disease.** The creator flow has no stable source-of-truth hierarchy. Persistence-hydration layers are treated as authoritative over fresher in-memory transient state during ordinary stage transitions, with no precondition checks. |
| Stale local persistence? | Surface-level symptom of the above. localStorage keys (`vday_data`, `vday_data_draft`) are global, non-UID-keyed, and read unconditionally — but those are the *vehicles* of the corruption, not the cause. UID-namespacing alone would not cure the authority conflict. |
| Multi-tab / multi-session / cross-account contamination? | **Not the cause.** Reproduces in a single-tab, single-account, same-session incognito window once persistence buckets are populated (see §6 Phase 2 and §15 steps 7–10). |
| Browser cache / residue / cleanup hygiene? | **Not the cause.** Disproved by same-incognito-window reproduction. Clearing storage delays the trigger but does not address the architecture. |
| Auth hydration conflict? | Secondary. Auth timing alters *when* stage transitions fire but does not directly write to `data`. The cloud-draft hydration effect ([App.tsx:678-789](App.tsx:678)) only populates `draftRecord`, not `data` (see §9). |
| latestDraft lookup collision? | Not the cause. Cloud `/api/drafts/list` is correctly UID-scoped and writes only to `draftRecord`, not `data`. |
| Delayed async restore race? | Partial — mount-time first-paint race (Path A) is real. But the dominant defect is deterministic, not race-conditioned (Path B). |
| Cosmetic preview-only bug? | **No.** The same stomped `data` is what `PaymentStage` sends to the seal endpoint (see §11). A user can pay to seal the wrong letter. |

---

## 13. Safest future fix direction (high-level only — NO IMPLEMENTATION)

The diagnostic deliberately omits patch-level code. Directional options, ranked by safety:

1. **Remove localStorage from the source-of-truth layer entirely for the creator flow.** The cloud draft system (`/api/drafts/*`) already provides per-user, server-authoritative draft persistence and is UID-scoped. The localStorage `vday_data` key duplicates that responsibility unsafely. Treating cloud as canonical and localStorage as at most a first-paint hint (read-only, with an explicit user-confirmed "resume?" gate) eliminates Path B by construction.
2. **Gate the resolver effect's NO_LINK branch on an explicit "no fresh data" precondition.** A minimal hardening: only call `setData(persisted)` when `data === null`. This preserves the first-paint hydration use case but stops the stomp on every stage transition. Risk: still vulnerable to Path A (mount seeding) and still cross-account-leaky.
3. **UID-namespace all persistence keys.** Replace `'vday_data'` and `'vday_data_draft'` with `'vday_data:{uid}'` and `'vday_data_draft:{uid}'`. Clear the un-namespaced legacy keys on first read. This solves cross-account residue but does not solve same-account stale residue across letters.
4. **Clear `vday_data` on entry to a NEW letter intent.** Define "new letter" explicitly (e.g., user clicked "Start new letter" rather than resumed), and clear both keys at that moment. Reduces residue persistence but requires the product to define the boundary unambiguously.
5. **Move the resolver's data-restoration responsibility out of an effect with `stage` in its deps.** The current effect conflates stage resolution and data restoration; splitting them so data restoration runs at most once per mount (not per stage) eliminates Path B without changing the persistence model.

Any combination of (1) + (3) addresses both root causes and both symptom families. (2) + (4) is a minimal, reversible mitigation if a deeper rework is undesirable.

**These are directions, not implementations.** Choose the path before writing code; do not patch line 944 in isolation without deciding which authority model the creator flow is meant to have.

---

## 14. Confirmed non-causes

To narrow future investigation and prevent wasted cycles:

- The PR-46.5 email path is NOT involved. The email is sent from `api/verify-payment.js` after the seal write completes; if `data` is stomped before seal, the email reflects the stomped content — but the email machinery itself is downstream and faithful.
- The Razorpay flow is NOT involved. Same reasoning.
- The Firebase cloud-draft system is NOT the leak surface. It is correctly UID-scoped.
- `firestore.rules` / `database.rules.json` are not implicated — client-side localStorage has no relationship to RTDB rules.
- IndexedDB, Service Workers, and Cache API are not used by this codebase.
- The receiver-side `usePathLinkLoader` cache (sessionStorage `sv_sess_cache_v1:*`) is per-share-link and is not read by creator flow.

---

## 15. Reproduction recipe (for verification — do NOT run as a fix)

### Normal-browser path

1. Open the app in a normal browser. Sign in with Account A. Complete a letter at least through RefineStage (so `localStorage['vday_data']` becomes populated). Do not seal/pay.
2. Without clearing site data, navigate to `/letter/create` for a new letter. (Optionally sign out and sign in as Account B first — the bug reproduces both ways.)
3. Enter new names, new body, upload new media in PreparationForm.
4. Click Complete to advance to REFINE.
5. Observe: `data` momentarily reflects the fresh content, then the resolver effect re-fires (because `stage` changed) and `setData(persisted)` from [App.tsx:944](App.tsx:944) overwrites with the prior letter's content. The MainExperience preview renders the prior letter's names, body, and media.
6. Compare with a **fresh** incognito window: same steps, no overwrite, preview renders correctly — because `localStorage['vday_data']` is empty.

### Same-incognito-window path (disproves the "incognito eliminates" hypothesis)

7. Without closing the SAME incognito window from step 6, navigate to `/letter/create` to start another new letter.
8. Enter completely different names, body, and media.
9. Advance through PreparationForm → REFINE → PERSONAL_INTRO / MAIN_EXPERIENCE preview.
10. Observe: the stale-overwrite now reproduces inside incognito too. The previous letter's content (the one from step 6) replaces the second letter's freshly-typed content at the exact same code path ([App.tsx:944](App.tsx:944)) — proving the defect is not browser residue but a session-scoped, deterministic overwrite triggered by populated persistence buckets.

### Verification without code changes

1. Open the live app in a normal browser. Reproduce per steps 1–5 above.
2. In DevTools → Application → Local Storage, inspect `vday_data` before and after the stage transition. Confirm a populated `vday_data` exists.
3. In DevTools → Sources, set a breakpoint at [App.tsx:944](App.tsx:944) (`setData(persisted)`). Confirm it fires on every stage transition once `vday_data` is non-empty, and that `persisted` contains the prior letter's content.
4. Repeat in a **fresh** incognito window without completing a first letter. Confirm the breakpoint does not fire (because `readPersistedCoupleData()` returns null).
5. In the same incognito window, complete one letter through RefineStage. Confirm `localStorage['vday_data']` is now populated and the breakpoint at [App.tsx:944](App.tsx:944) fires on the next letter's stage transitions — identical behavior to the normal-browser case.

No code changes required to verify — DevTools only.

---

End of diagnostic.
