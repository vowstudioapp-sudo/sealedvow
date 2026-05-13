# PR-49 Phase A — Test 6 (signed-in bypass) Failure Diagnostic

**Date:** 13 May 2026
**Branch:** `pr48-cloud-draft-sync` @ `6c1a0ba`
**Mode:** Read-only static analysis. No code changes; no commits; no patches.
**Failing test:** Smoke test 6 — signed-in user clicks "Create Your Letter"; expected `sessionStorage.vday_mode === 'authenticated'`; observed `null`.

---

## 1. Pre-flight verification

```
=== branch ===   pr48-cloud-draft-sync                                                ✓
=== HEAD ===     6c1a0ba feat(persistence): PR-49 Phase A — mode entry primitive (dormant)  ✓
=== status ===   clean                                                                ✓
=== files ===    LandingPage.tsx + activeMode.ts + useAuth.ts + ModeSelectionModal.tsx all exist  ✓
```

All four checks passed.

---

## 2. Task 1 — LandingPage signed-in bypass path inspection

**`handleEnter`** ([components/LandingPage.tsx:123-139](../../components/LandingPage.tsx:123)):

```tsx
const handleEnter = () => {
  // PR-49 Phase A — gate the Create flow on mode selection.
  // ...
  if (user) {
    setActiveMode('authenticated');
    proceedToCreate();
    return;
  }
  setShowModeSelection(true);
};
```

**`proceedToCreate`** ([components/LandingPage.tsx:115-121](../../components/LandingPage.tsx:115)):

```tsx
const proceedToCreate = () => {
  markIntentionalEntry();
  window.location.href = "/create";
};
```

**Inspection answers:**

| Question | Answer |
|---|---|
| Condition used to detect signed-in state | `if (user)` (truthy check at `:133`). |
| Source of `user` | Top-level destructure from `useAuth()` at [components/LandingPage.tsx:32](../../components/LandingPage.tsx:32): `const { user, signInWithGoogle, signOut } = useAuth();`. Closed over by `handleEnter` declared in the same render scope. |
| `useCallback` wrap? | NO. `handleEnter` is a plain function declared inside the component body. It is recreated on every render and captures the current render's `user` value. |
| `setActiveMode('authenticated')` order in the signed-in branch | Called synchronously BEFORE `proceedToCreate()`. The `setItem` lands on `sessionStorage` synchronously (per spec; setItem is synchronous in all major browsers); then `window.location.href` assignment kicks off navigation. **The order is structurally correct.** |
| Is the signed-in branch executing at click time? | **Cannot be executing in the founder's failing scenario.** If it were, `setActiveMode('authenticated')` would land in `sessionStorage` before navigation, and the test would pass. Either `user` is null at click time, OR the click does not reach `handleEnter` at all. |
| Stale-closure risk | `handleEnter` is recreated per render; the closed `user` is therefore the render's freshest value. Stale closure is not a credible cause here — every re-render rebinds. |

**Provisional Task 1 verdict:** `handleEnter`'s signed-in branch is structurally correct. If the test fails when `handleEnter` is called by a signed-in user, the failure mode would have to be a Firebase rehydration race (`user` was still null at the render the user clicked). Task 2 examines whether the click even reaches `handleEnter`.

---

## 3. Task 2 — Full CTA entry-point audit

`grep` against the entire codebase for all surfaces that initiate the letter-creation flow:

| # | Entry point | File:line | Handler invoked | Routes through Phase A logic? | Bypasses `setActiveMode`? |
|---|---|---|---|---|---|
| 1 | Navbar "Seal your letter" button | [components/LandingPage.tsx:191](../../components/LandingPage.tsx:191) | `handleEnter` | ✓ Yes | No |
| 2 | Hero "CREATE YOUR LETTER" button (lp-btn-begin) | [components/LandingPage.tsx:212](../../components/LandingPage.tsx:212) | `handleEnter` | ✓ Yes | No |
| 3 | Lower "CREATE YOUR LETTER" button (lp-btn-begin) | [components/LandingPage.tsx:377](../../components/LandingPage.tsx:377) | `handleEnter` | ✓ Yes | No |
| 4 | MyLettersModal `onCreateNew` prop | [components/LandingPage.tsx:168](../../components/LandingPage.tsx:168) | `handleEnter` | ✓ Yes | No |
| 5 | Navbar "Sign in" button (opens showLogin) | [components/LandingPage.tsx:202](../../components/LandingPage.tsx:202) | `setShowLogin(true)` only; no navigation | N/A — opens the showLogin modal | N/A |
| 6 | **showLogin modal "Continue with Google" success** | [components/LandingPage.tsx:529-548](../../components/LandingPage.tsx:529) | calls `onEnter()` directly (line 535) | ✗ **NO** | ✗ **YES — UNPATCHED** |
| 7 | **showLogin modal "Continue as Guest"** | [components/LandingPage.tsx:568](../../components/LandingPage.tsx:568) | calls `onEnter()` directly | ✗ **NO** | ✗ **YES — UNPATCHED** |
| 8 | Cinematic-progress timer | [components/LandingPage.tsx:92](../../components/LandingPage.tsx:92) | `setTimeout(onEnter, 600)` — only fires if `isEntering === true` | N/A — dead code; `setIsEntering` is never called (`grep -n "setIsEntering" components/LandingPage.tsx` returns the declaration only at `:19`) | N/A |

**`onEnter` is a prop** passed to LandingPage from App.tsx at [App.tsx:1927](../../App.tsx:1927):

```tsx
<LandingPage onEnter={handleEnterStudio} />
```

**`handleEnterStudio`** ([App.tsx:1800-1803](../../App.tsx:1800)):

```js
const handleEnterStudio = () => {
  window.location.href = "/create";
};
```

This is exactly the pre-Phase-A direct navigation. It does NOT call `setActiveMode`. It does NOT call `markIntentionalEntry`. It just navigates.

**Other Create-Letter navigation outside LandingPage (informational; not the bug surface):**

```
App.tsx:1801             handleEnterStudio (LandingPage's onEnter)
App.tsx:2038             demo-mode "Create Your Own" button
components/ClaimPage.tsx:80, :89, :252   founder-claim flow → /create
components/EidiEnvelope.tsx:393          Eidi receiver "create" link (FL-4 out of scope)
components/MainExperience.tsx:764        post-share "Create Your Own" CTA
components/OccasionSelector.tsx:14       occasion-selector advance (uses markIntentionalEntry only)
```

These are all OUTSIDE the landing page and outside Phase A scope. They will need separate treatment in later phases (or, for Eidi/Demo/ClaimPage, explicit FL-4-style preservation). They are NOT involved in the founder's failing Test 6.

**Task 2 verdict — root cause located:** The showLogin modal at [components/LandingPage.tsx:519-571](../../components/LandingPage.tsx:519) has TWO completion buttons (entry points #6 and #7 in the table) that both call `onEnter()` directly, bypassing `handleEnter`. Phase A patched the three landing-page CTAs that route through `handleEnter` but did NOT patch the showLogin modal's two completion buttons. The navbar "Sign in" → showLogin → "Continue with Google" flow is therefore unpatched.

---

## 4. Task 3 — Auth hydration timing analysis

**Source:** [hooks/useAuth.ts](../../hooks/useAuth.ts).

- `user` is React state ([hooks/useAuth.ts:42](../../hooks/useAuth.ts:42)).
- Updated by `setUser(u)` inside the `onAuthStateChanged` listener ([hooks/useAuth.ts:52-53](../../hooks/useAuth.ts:52)).
- `signInWithGoogle` ([hooks/useAuth.ts:71-84](../../hooks/useAuth.ts:71)) returns `Promise<User>`:
  1. Sets `signInInFlightRef.current = true`.
  2. Awaits `fbSignInWithGoogle()` (which awaits both the Google popup AND POST `/api/auth/session`).
  3. Sets `serverSessionReady = true`.
  4. Returns the `User` object.

**Sequencing during the navbar showLogin flow:**

1. User clicks navbar "Sign in" → opens showLogin modal.
2. User clicks "Continue with Google" inside showLogin (handler at [components/LandingPage.tsx:529-548](../../components/LandingPage.tsx:529)).
3. `signInWithGoogle()` runs → Firebase popup completes → `onAuthStateChanged` fires → `setUser(u)` schedules a React state update.
4. POST `/api/auth/session` completes.
5. `signInWithGoogle()` resolves with the `User`.
6. **`setShowLogin(false)` runs (line 534).**
7. **`onEnter()` runs (line 535) → `handleEnterStudio` → `window.location.href = "/create"`.**

Step 7 navigates the page away. It does NOT consult `useAuth().user`. It does NOT call `handleEnter`. It just leaves.

**Stale-closure / hydration-timing assessment:**

- For the three CTAs that route through `handleEnter` (entries #1-#4 in §3's table), `handleEnter` is recreated every render and closes over the current `user`. After Firebase rehydration completes and React re-renders, the next click correctly sees `user` truthy.
- A theoretical rehydration race exists (user clicks within the ~hundreds-of-ms window before Firebase resolves), but in that window `handleEnter` would see `user === null` and open the **ModeSelectionModal** — not silently bypass `setActiveMode`. The founder's observation (no modal, no `vday_mode`, normal navigation) does NOT match the rehydration-race signature.
- For entries #6 and #7 (the showLogin modal's completion buttons), auth state timing is irrelevant because the code path NEVER consults `user`. It just calls `onEnter()`.

**Task 3 verdict:** Auth hydration timing is NOT the root cause. The `user` value at click time is irrelevant in the failing flow because the failing flow doesn't read `user`.

---

## 5. Task 4 — `setActiveMode` implementation inspection

**Source:** [utils/activeMode.ts:28-37](../../utils/activeMode.ts:28).

```ts
export function setActiveMode(mode: ActiveMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // sessionStorage may be unavailable (private mode in some browsers,
    // quota errors). Mode write failure is non-fatal — Phase C dispatchers
    // treat absent mode as "show ModeSelectionModal at next Create click".
  }
}
```

**Inspection answers:**

| Question | Answer |
|---|---|
| SSR guard | `if (typeof window === 'undefined') return;` at line 29 — correct; only blocks on server-render, not browser. |
| Try/catch behavior | Silent swallow inside the catch block. No `console.warn`, no rethrow. |
| Could the write fail silently in a browser? | Only if `sessionStorage` is unavailable (e.g., Safari private mode pre-2017, quota exceeded, security policy block). In a standard signed-in user's browser session, `setItem` is synchronous and reliable. |
| Could browser navigation interrupt the write? | No. `sessionStorage.setItem` is synchronous. The write completes before the next JavaScript statement (`window.location.href = "/create"`) executes. By the time the navigation begins, the write has landed. |

**Task 4 verdict:** `setActiveMode` is structurally correct. The silent-swallow is intentional non-fatal behavior; it does not contribute to the failing test scenario because the failing scenario never CALLS `setActiveMode` in the first place.

---

## 6. Task 5 — Founder findings reconciliation + bug classification

| Founder observation | Code-evidence reconciliation |
|---|---|
| Guest flow works perfectly | ✓ Phase A's `handleEnter` correctly opens `ModeSelectionModal`. The modal's "Continue as Guest" calls `setActiveMode('guest')` then `onChosen('guest')` → `handleModeChosen` → `proceedToCreate()`. Mode write lands; navigation follows. |
| ModeSelectionModal-authenticated flow works perfectly | ✓ Same path; "Continue with Google" path in the modal awaits sign-in, calls `setActiveMode('authenticated')` then `onChosen('authenticated')`. Mode write lands. |
| Signed-in BYPASS path fails (the failing scenario) | ✗ The flow the founder describes is: navbar "Sign in" → showLogin modal → "Continue with Google" → navigation to /create. This flow uses entries #6/#7 in §3's table, which call `onEnter()` directly. `setActiveMode` is never called. `sessionStorage.vday_mode` remains null. **Match.** |
| Existing reconciliation system still works | ✓ Phase A added no consumers of `getActiveMode()`; downstream reconciliation logic is unchanged. |
| Existing refresh/recovery flow still works | ✓ No persistence-routing surfaces modified in Phase A. |
| Existing payment-stage refresh still works | ✓ Out of Phase A scope; unchanged. |

**Bug classification:** **unpatched CTA path.**

The showLogin modal's two completion buttons ([components/LandingPage.tsx:529-548 + :568](../../components/LandingPage.tsx:529)) navigate via `onEnter()` → `App.tsx:handleEnterStudio` → `window.location.href = "/create"`, bypassing `handleEnter` and therefore bypassing `setActiveMode`. The "Create Your Letter" the founder describes in step 3 of their bug report is in fact the COMPLETION of the navbar showLogin sign-in flow — the modal's own button initiates the navigation, not a subsequent click on a Create button.

This is not a logic bug (handleEnter is correct), not a timing bug (auth state irrelevant), not a stale-state bug (user closure is fresh), not a browser timing issue (setItem is synchronous), and not an incorrect founder interpretation (the bug is real).

---

## Diagnostic verdict

**1. Root-cause analysis:**

The navbar Sign-in flow has its OWN modal (`showLogin`, distinct from the Phase A `ModeSelectionModal`). Both of its completion buttons — "Continue with Google" and "Continue as Guest" — call `onEnter()` directly. `onEnter` is the prop passed down from App.tsx, where it is wired to `handleEnterStudio` — a function whose entire body is `window.location.href = "/create"`. This function does NOT call `setActiveMode`, does NOT call `markIntentionalEntry`, and does NOT consult `user` state.

Phase A's wiring correctly patched the three "CREATE YOUR LETTER" / "Seal your letter" CTAs that route through the LandingPage's local `handleEnter`. It did NOT patch the showLogin modal's completion buttons. A signed-in user whose sign-in happened via the navbar therefore arrives at /create with `sessionStorage.vday_mode === null`, exactly matching the founder's Test 6 observation. The mode write was never attempted.

**2. Exact failing code path:**

- [components/LandingPage.tsx:529-535](../../components/LandingPage.tsx:529) — showLogin modal's "Continue with Google" `onClick` handler, specifically the success branch:
  ```tsx
  await signInWithGoogle();
  setShowLogin(false);
  onEnter();   // ← navigates via App.tsx:handleEnterStudio; never calls setActiveMode
  ```
- [components/LandingPage.tsx:568](../../components/LandingPage.tsx:568) — showLogin modal's "Continue as Guest" button:
  ```tsx
  <button className="lp-btn-guest" onClick={() => { setShowLogin(false); onEnter(); }}>
  ```
- [App.tsx:1800-1803](../../App.tsx:1800) — `handleEnterStudio` definition, which is `onEnter`'s implementation:
  ```js
  const handleEnterStudio = () => {
    window.location.href = "/create";
  };
  ```

**3. Bug classification:** **unpatched CTA path.**

**4. Architecture soundness:** **Yes, sound.** The dual-mode architecture is unaffected. The bug is a missed-call-site oversight in Phase A's wiring, not a flaw in the mode-state contract, the `setActiveMode`/`getActiveMode` helpers, the ModeSelectionModal design, or the `sessionStorage.vday_mode` mechanism. The same mode-state contract resolves the bug; the fix is to call `setActiveMode` at the two missed CTAs.

**5. Does this block Phase B?** **No, it does not block Phase B.**

Phase B is purely additive (new `GET /api/draft` + `DELETE /api/draft` endpoints). It has no dependency on the navbar showLogin flow being fixed. However, the bug DOES block correct Phase C behavior: Phase C makes authenticated hydration mode-aware via `getActiveMode()` reads. A signed-in user who entered via the navbar would have `vday_mode === null` and would be routed to the ModeSelectionModal again on the next Create click — not catastrophic, but a UX defect. **The fix should land before Phase C ships.** Phase B can land first, second, or in parallel with the fix.

**6. Recommended minimal fix:**

Patch the showLogin modal's two completion buttons to set the mode before calling `onEnter()`:

- [components/LandingPage.tsx:529-548](../../components/LandingPage.tsx:529) — "Continue with Google" success branch:
  After `await signInWithGoogle();` and BEFORE `onEnter();`, insert:
  ```ts
  setActiveMode('authenticated');
  ```
- [components/LandingPage.tsx:568](../../components/LandingPage.tsx:568) — "Continue as Guest" handler:
  Wrap the inline handler to call `setActiveMode('guest')` before `onEnter()`:
  ```tsx
  onClick={() => { setActiveMode('guest'); setShowLogin(false); onEnter(); }}
  ```

`setActiveMode` is already imported at the top of LandingPage from the Phase A commit; no new imports needed. No new state, no new effects, no architectural redesign. Both writes are synchronous `sessionStorage.setItem` calls that complete before `onEnter()`'s subsequent `window.location.href` navigation begins.

This fix is structurally consistent with Phase A's contract: every CTA path that initiates the create flow writes the mode immediately before navigating, with no shared dispatcher (per strategy §8 anti-patterns). Each call site reads "guest" or "authenticated" as a literal at the branch site — no mode parameter, no smart routing.

**Secondary observation (not blocking, flag-only):** The showLogin modal is functionally a legacy version of the Phase A ModeSelectionModal — it offers the same two choices ("Continue with Google" / "Continue as Guest") and reaches the same end state. After PR-49 Phase C ships, the showLogin modal may be a candidate for consolidation into ModeSelectionModal (or deletion in favor of routing the navbar Sign-in button to a sign-in-only modal that doesn't navigate). That's out of scope for this fix and out of scope for Phase A. Phase C / a future cleanup pass can decide.

**7. Fix layer:** **LandingPage only.**

Both patch points are in `components/LandingPage.tsx`. No changes needed to `utils/activeMode.ts`, `hooks/useAuth.ts`, `components/ModeSelectionModal.tsx`, `App.tsx`, or any other file.
