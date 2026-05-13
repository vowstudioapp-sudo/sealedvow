# Phase 4 "Continue Dashboard Draft" — Diagnostic Report

**Date:** 13 May 2026
**Mode:** Read-only investigation. No fixes proposed at the implementation level.
**Scope:** SignInReconciliationModal's "Continue Dashboard Draft" handler and its operationally-convergent siblings ("Discard Local Draft", "Save Local Draft as New").
**Branch state:** PR-48 Phase 4 fully landed (commits `cae4cd7` → `71af5d5`).

---

## 1. Executive summary

The Phase 4 "Continue Dashboard Draft" button — and its sibling "Discard Local Draft" — does correctly call the documented handler (`applyCloudActiveToState`), correctly clears `localStorage['vday_data_draft']`, correctly hydrates App.tsx's `data` state from the cloud snapshot, and correctly resets the reconciliation modal. **Three user-observed deviations** require separate explanations:

| Deviation | Status |
|---|---|
| URL changed to `/` after click | **Not reproducible from code inspection.** No code path in the Phase 4 reconciliation flow modifies `window.location` or `window.history`. See §5 for hypotheses. |
| localStorage "FULLY cleared" | **Mostly correct behavior, likely misinterpretation.** `clearPreparationDraft()` removes only `vday_data_draft`. In incognito mode, Firebase Auth defaults to IndexedDB persistence, so the absence of Firebase-keyed localStorage entries is normal. |
| Re-entering editor shows empty PREPARE form | **Working as designed (per Phase 4 audit Limitation #1).** Cloud content lives in App.tsx's in-memory `data` state but is NOT seeded into `vday_data_draft`. PreparationForm reads from `peekDraft()` on mount — empty after the clear — so the form renders blank. |

The "redirect to /" claim is the load-bearing unknown. The other two observations are explainable through documented Phase 4 behavior + Firebase-in-incognito storage semantics.

---

## 2. Handler call graph

### 2.1 What `onContinueDashboardDraft` invokes

[`components/SignInReconciliationModal.tsx:43`](../../components/SignInReconciliationModal.tsx:43) declares the prop; [line 148](../../components/SignInReconciliationModal.tsx:148) wires it to the button's `onClick`. No internal state, no navigation, no side effects in the component itself.

### 2.2 The App.tsx callback

[`App.tsx:2335`](../../App.tsx:2335) mounts the modal with `onContinueDashboardDraft={handleSignInContinueDashboardDraft}`.

[`App.tsx:963-968`](../../App.tsx:963):

```ts
const handleSignInContinueDashboardDraft = () => {
  if (reconciliation.kind !== 'sign_in_case_b') return;
  applyCloudActiveToState(reconciliation.cloudDraft);
  setReconciliation({ kind: 'none' });
  setHydrationResolutionState('resolved');
};
```

Three actions: invoke the shared helper, close the modal via reconciliation state, mark hydration resolved.

### 2.3 The shared helper

[`App.tsx:944-961`](../../App.tsx:944):

```ts
const applyCloudActiveToState = (cloud: CloudDraftSnapshot) => {
  clearPreparationDraft();
  writeDraftId(cloud.draftId);
  setData(hydrateCoupleData(cloud.data));
  setDraftRecord({
    draftId: cloud.draftId,
    seedDraftState: cloud.draftState,
    revision: cloud.revision,
  });
  setLastSaveError(null);
  if (typeof cloud.updatedAt === 'number') {
    setLastSaveSuccessAt(cloud.updatedAt);
  }
  setPrepFormResetKey((k) => k + 1);
};
```

This is the **single source of truth** for the cloud-wins reconciliation outcome. Reused by `handleSignInDiscardLocalDraft` at [`App.tsx:970-975`](../../App.tsx:970).

`clearPreparationDraft` from [`hooks/usePreparationPersistence.ts:360-367`](../../hooks/usePreparationPersistence.ts:360) calls `window.localStorage.removeItem(STORAGE_KEY)` where `STORAGE_KEY = 'vday_data_draft'`. **No other localStorage keys are touched.**

`writeDraftId(cloud.draftId)` at [`hooks/usePreparationPersistence.ts:336-358`](../../hooks/usePreparationPersistence.ts:336) no-ops if `readDraft()` returns null. Since `clearPreparationDraft()` ran one statement earlier, `readDraft()` returns null → `writeDraftId` is a no-op here.

`setData(hydrateCoupleData(cloud.data))` populates App.tsx's `data` state with cloud's content.

`setDraftRecord({...})` populates draftRecord with cloud's identity (draftId, seedDraftState, revision).

`setPrepFormResetKey((k) => k + 1)` increments the React key passed to PreparationForm at [`App.tsx:2053`](../../App.tsx:2053), forcing PreparationForm to remount cleanly when stage === PREPARE.

### 2.4 What does NOT happen

- No `safeSetStage` call. Stage is preserved exactly as it was when the modal opened.
- No `setStage` call. Same.
- No `window.location.*` assignment.
- No `window.history.pushState`/`replaceState`.
- No fetch to any API endpoint (matches user's observation: "No /list, /save, /pause, /discard API calls fired during the redirect").
- No `localStorage.clear()` call (matches code-wide grep returning zero hits).

---

## 3. The three observed deviations — analysis

### 3.1 "localStorage FULLY cleared (not just vday_data_draft)"

**Verdict: most likely a misinterpretation of incognito Firebase storage.**

Confirmed code behavior:
- `clearPreparationDraft()` removes only `vday_data_draft` via `localStorage.removeItem(STORAGE_KEY)`.
- No `localStorage.clear()` exists anywhere in the application code (grep across `*.ts`, `*.tsx`, `*.js` excluding `node_modules` returns zero matches).
- Firebase Auth SDK defaults to `IndexedDB` for session persistence in browsers that support it (which all modern browsers do, including incognito). Firebase auth state therefore does NOT live in `localStorage` in this app's incognito environment.

Most plausible reading of the user's observation: the user opened DevTools → Application → Local Storage → `http://localhost:3000` and saw zero rows after the click. This is consistent with:
- Before the click: `vday_data_draft` was the only key (Firebase auth in IndexedDB).
- After the click: that single key was removed by `clearPreparationDraft()`.
- Net: 0 keys remaining.

The user's "FULLY cleared" framing implies broader destruction, but the observed state matches the documented Phase 4 contract for `clearPreparationDraft()`. If Firebase auth were in localStorage and surviving, this would also be visible as a `firebase:authUser:...` row — which would NOT be cleared by Phase 4 code. The user's report that "Browser remained authenticated (AF avatar still visible after redirect)" is consistent with Firebase auth living in IndexedDB.

### 3.2 "Re-entering editor via 'CREATE YOUR LETTER' shows fresh empty PREPARE form"

**Verdict: working as designed per Phase 4 audit Limitation #1.**

Phase 4 audit (commit `71af5d5`) Final Delivery, "Known limitations" item #1:

> **Cloud-seeds-local missing.** When the user picks "Continue Dashboard Draft" or "Discard Local Draft" (Case B), App-level `data` state is populated from cloud, but the local `vday_data_draft` bucket is NOT seeded. If the user refreshes immediately, the next mount re-enters /list hydration; this time Case A fires (silent).

Subsequent navigation flow:
1. User clicks "CREATE YOUR LETTER" on landing → `handleEnterStudio` at [`App.tsx:1920-1922`](../../App.tsx:1920) → `window.location.href = '/create'`.
2. /create routes to OccasionSelector. User picks anniversary → navigates to `/letter/create?occasion=anniversary` (fresh page load).
3. App.tsx mounts fresh. `peekDraft()` returns nulls (vday_data_draft was cleared by the Continue Dashboard Draft handler and PreparationForm hadn't re-saved yet at that moment).
4. App `data` initializer at [`App.tsx:382-393`](../../App.tsx:382) returns null (no `initialDraft.stage` → falls to default).
5. App `stage` initializer at [`App.tsx:369-378`](../../App.tsx:369) falls back to `initialStageForRoute('LETTER_CREATE')` = PREPARE.
6. PreparationForm mounts. Its own `peekDraft()` at [line 81](../../components/PreparationForm.tsx:81) returns empty. Form renders blank defaults.

This matches the user's observation exactly. The blank form is the documented post-Limitation-#1 behavior.

Note: the cloud draft is still on the server and reachable via `/api/drafts/list`. Phase 4's `/list` hydration fires on the next mount, finds the cloud ACTIVE, finds no meaningful local content (form is empty / hasn't been autosaved yet), and silently hydrates `draftRecord` (Case A). App.tsx's `data` state stays null because Case A only updates `draftRecord` metadata, not `data`. So the cloud draft is "invisible to the UI" until a Phase 5 dashboard surfaces it.

### 3.3 "Redirected to landing page (URL: /)"

**Verdict: not traceable from code inspection alone.**

Exhaustive trace of post-`applyCloudActiveToState` state changes and effect dependencies:

| State change | Effect with that dep | Effect's body re: URL/stage |
|---|---|---|
| `clearPreparationDraft()` side effect | — | localStorage only; no URL/stage |
| `writeDraftId(cloud.draftId)` side effect | — | localStorage only (no-op here); no URL/stage |
| `setData(...)` | resolver effect (no `data` dep) | doesn't re-run |
| | background-color effect at [`App.tsx:1627-1692`](../../App.tsx:1627) (`stage, experienceData` deps) | re-runs; sets `document.body.style.backgroundColor`; no URL/stage |
| | observer-arming effect | re-arms; may fire /transition; no URL/stage |
| `setDraftRecord(...)` | observer-arming effect | (same as above) |
| `setLastSaveError(null)` | — | none with this dep |
| `setLastSaveSuccessAt(...)` | — | none with this dep |
| `setPrepFormResetKey(k => k+1)` | — | only affects PreparationForm remount (when stage === PREPARE) |
| `setReconciliation({kind: 'none'})` | — | only gates the exhaustive reconciliation render switch |
| `setHydrationResolutionState('resolved')` | watcher useEffect at [`App.tsx:565-573`](../../App.tsx:565) | fires pendingActionRef if present; pendingActionRef is null after hard refresh |

The resolver useEffect at [`App.tsx:1521-1583`](../../App.tsx:1521) has deps `[demoData, isDemoMode, isEidFlow, isReceiverLink, linkError, linkState, routeType, sharedData, stage]`. **None of these change in the Continue Dashboard Draft path.** Therefore the resolver effect does not re-run, and no `safeSetStage(...)` fires.

The `onPopState` handler at [`App.tsx:1413-1428`](../../App.tsx:1413) only fires when the browser emits a `popstate` event. Continue Dashboard Draft does not dispatch popstate.

`getRouteType()` is called every render ([App.tsx:337](../../App.tsx:337)). It reads `window.location.pathname`. **For routeType to become 'HOME' (the value that maps to `/`), `pathname` must have changed.** No code path in `applyCloudActiveToState` or its callers writes to `window.location.pathname` or to `window.history`.

**Conclusion:** the URL change is not traceable to any code path in the Phase 4 reconciliation flow. Possible non-code explanations:

1. **Observation timing artifact.** The user may have observed the URL bar at a moment where the browser was already at `/` (e.g., because the hard refresh in step 5 had landed at `/` somehow, before the modal opened). The modal would have opened over the landing page rather than over `/letter/create?occasion=anniversary`. Clicking Continue Dashboard Draft from a modal mounted over LandingPage would not change the URL (it's already `/`), and the underlying page would still be LandingPage. The user's experience would be: "modal closed, I see landing page, URL is /" — which matches the report.
2. **Browser back/forward navigation during sign-in popup close.** Firebase's `signInWithPopup` opens and closes a popup. If the popup-close fires history events on some browsers, history could have been mutated. Speculative; not reproducible from code.
3. **Browser extension or DevTools redirect.** Out of scope for code review.

Hypothesis (1) is the most plausible. **Recommended verification path: capture URL bar contents at three checkpoints during repro — immediately after step 5 hard refresh (before modal opens), at modal open, immediately after Continue Dashboard Draft click.** If URL is already `/` before the modal opens, this is a pre-existing hard-refresh redirect that the Continue Dashboard Draft handler did NOT cause.

---

## 4. Do the other two reconciliation buttons share the root cause?

### 4.1 "Discard Local Draft"

`handleSignInDiscardLocalDraft` at [`App.tsx:970-975`](../../App.tsx:970):

```ts
const handleSignInDiscardLocalDraft = () => {
  if (reconciliation.kind !== 'sign_in_case_b') return;
  applyCloudActiveToState(reconciliation.cloudDraft);
  setReconciliation({ kind: 'none' });
  setHydrationResolutionState('resolved');
};
```

**Identical body to `handleSignInContinueDashboardDraft`.** Same shared helper. Same three post-helper state updates. Same behavior in every respect — including the audit Limitation #1 (cloud-seeds-local missing) and the unresolved URL claim.

Phase 4 commit `71af5d5` explicitly documents the operational convergence: "Continue Dashboard Draft and Discard Local Draft are operationally convergent (both end up with local discarded + cloud as authority). Distinct labels preserved per locked spec…"

So **yes**, the same observed deviations would manifest for Discard Local Draft.

### 4.2 "Save Local Draft as New"

`handleSignInSaveLocalDraftAsNew` at [`App.tsx:977-1059`](../../App.tsx:977) — **different shape**. It runs a two-step orchestration:

1. `pauseDraft({ draftId: cloudDraft.draftId, expectedRevision: cloudDraft.revision })` — pauses the cloud's existing ACTIVE.
2. `saveDraft({ data, draftState, step })` — creates a new ACTIVE from local content.

Then on success: `clearPreparationDraft()`, `writeDraftId(saveResult.draftId)`, `setData(null)` (note: `null`, not cloud's data), `setDraftRecord(...)`, `setLastSaveSuccessAt(Date.now())`, `setPrepFormResetKey(k => k+1)`, `setReconciliation({ kind: 'none' })`, `setHydrationResolutionState('resolved')`.

Notable differences:
- Two API calls fire (pause, save). The user's "no /list, /save, /pause, /discard API calls fired" observation does NOT apply to this handler.
- `setData(null)` — clears App's data instead of hydrating with cloud. The user's specific bug report would not reproduce exactly.
- Phase 4 audit Known limitation #3 documents this `setData(null)` choice and flags it as a UX gap for Phase 5+.

**Conclusion:** "Save Local Draft as New" does NOT share the exact root cause family. It does share the cloud-seeds-local-missing limitation (different mechanism — `setData(null)` rather than `setData(cloud.data) + no local seed`). Its post-state is even more aggressive in clearing the editor.

---

## 5. Classification

### 5.1 Is the redirect to `/` intentional?

**No code path makes it intentional. No code path makes it explicitly happen, either.** If the URL is genuinely changing on click, the cause is outside this PR's code surface (browser, extension, prior-state artifact). If the URL was already `/` before the click (hypothesis 1 from §3.3), then the click is innocent and the redirect happened earlier — likely as part of the cookie-race hard-refresh workaround.

### 5.2 Is the localStorage clearing intentional?

**Partially.** `clearPreparationDraft()` clearing `vday_data_draft` IS intentional (Phase 4 spec for "Continue Dashboard Draft": "discard local, hydrate from cloud ACTIVE"). The user's framing of "FULLY cleared" reflects only that `vday_data_draft` was the single localStorage key present (Firebase auth was in IndexedDB), not that broader localStorage destruction occurred.

### 5.3 Is hydration re-fire blocked architecturally or by state?

**By state.** The /list hydration effect at [`App.tsx:984-1102`](../../App.tsx:984) has dependency array `[authUser?.uid, authLoading, serverSessionReady]`. After the Continue Dashboard Draft action completes:

- `authUser?.uid` is unchanged.
- `authLoading` is unchanged (false).
- `serverSessionReady` is unchanged (true).

So the effect does NOT re-fire on its own. `hydrationResolutionState` transitions to `'resolved'` (which gates pendingAction release, not re-fetch).

Hydration **would** re-fire on the next sign-out + sign-in cycle, or on a fresh App mount (e.g., navigating to `/create` via CREATE YOUR LETTER, which does a `window.location.href = '/create'` — a full page reload).

This is not a bug per se; it matches the design ("/list hydration is a one-shot per sign-in session"). But it means: **after the user picks Continue Dashboard Draft, there is no mechanism in Phase 4 to re-fetch cloud content into the editor.** The next interactive boundary that could expose the cloud draft is the Phase 5 dashboard.

### 5.4 Root cause classification

The user asks whether this is sequencing failure / missing-state-restoration / route-guard collapse / overly-broad reset helper / combination. Mapping each observation:

| Observation | Classification |
|---|---|
| URL change to `/` | **Inconclusive from code review.** Most plausibly: NOT caused by Continue Dashboard Draft. Likely pre-existing hard-refresh artifact (a separate known issue per user's own framing). If reproducible with checkpointed URL captures, would need a deeper trace. |
| localStorage emptiness | **Misinterpretation.** Single-key clear of `vday_data_draft` is intentional. Firebase auth lives in IndexedDB. No bug. |
| Empty form on re-entry + cloud draft "invisible to UI" | **Missing-state-restoration.** Cloud content lands in App.tsx in-memory `data` but is never written to local persistence; on next mount, `data` initializer reads from local (empty) and re-renders blank. The cloud `draftRecord.draftId` does survive into the next session but `data` does not. **This is the audit-documented Limitation #1.** Phase 4 chose not to seed local with cloud content; Phase 5 dashboard is the planned remediation. |
| Other two buttons | Discard Local Draft: **same root cause** (shared helper). Save Local Draft as New: **different mechanism** (`setData(null)` post-success) but shares the cloud-not-seeded-to-local family. |

If the URL = `/` claim turns out to be reproducible AND traceable to this PR's code, the classification would become **route-guard collapse** — but I cannot find such a code path in the current implementation. The user's "(cookie race workaround — separate known issue)" framing for the hard refresh suggests pre-Phase-4 instability may be in play.

---

## 6. Recommended verification before any fix is proposed

These are diagnostic steps, not fixes:

1. **Capture URL bar contents at three checkpoints** during repro:
   a. Immediately after step 5 hard refresh (before any modal opens).
   b. At the moment the SignInReconciliationModal appears.
   c. Immediately after clicking Continue Dashboard Draft (before any further interaction).
   This will determine whether the redirect occurs at the click, or earlier.

2. **Capture localStorage rows** at the same three checkpoints. If row count is `1` (vday_data_draft only) before the click and `0` immediately after, the localStorage observation is fully explained.

3. **Capture `document.location.pathname`** programmatically (via DevTools console) at the same three checkpoints. URL bar rendering can sometimes lag behind pathname; explicit pathname read is authoritative.

4. **Capture the contents of App.tsx's `data` state** at checkpoint (c) via React DevTools. If `data` is non-null with cloud content, the handler succeeded internally — the UI is rendering a different stage's component.

5. **Capture App.tsx's `stage` state** at checkpoint (c). If `stage === AppStage.LANDING`, then something IS setting stage to LANDING (not visible in my code review); if `stage === AppStage.PREPARE` or `AppStage.REFINE`, the user is in the editor and the URL claim is the discrepancy to focus on.

These five captures would pin down the actual failure mode and either confirm hypothesis (1) from §3.3 (pre-existing redirect) or reveal a code path my review missed.

---

End of diagnostic. No fix code proposed. No application behavior modified.
