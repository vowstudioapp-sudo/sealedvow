// /utils/cloudDraftExpectation.ts — Cloud-draft existence hint for hydration UX.
//
// Tab-scoped sessionStorage flag recording whether the authenticated user is
// known to have a recoverable cloud draft. Used by App.tsx to decide whether
// to show the "Restoring your letter…" spinner at PREPARE mount.
//
// Pre-fix behavior: every authenticated mount showed the spinner speculatively,
// even for brand-new users with no draft. The spinner only cleared after a
// GET /api/draft round-trip returned 404, producing a wasteful flash for users
// who had nothing to restore.
//
// This flag carries the answer LandingPage already knew (it called GET /api/draft
// in handleEnter before navigating) forward into the next App.tsx mount. When
// the flag is absent, App.tsx skips the spinner and renders PreparationForm
// immediately with an empty form.
//
// This is NOT a persistence authority. Cloud remains the canonical source of
// truth for authenticated drafts. The flag is routing metadata in the same
// category as `vday_mode` (utils/activeMode.ts) and `sv_intentional_entry`
// (utils/intentionalEntry.ts) — pure hydration-UX hint.
//
// Set sites:
//   - LandingPage handleEnter: GET /api/draft returns 200 with non-COMPLETED draft.
//   - App.tsx successful authenticated save (first save for a session creates a
//     server-side draft; the flag ensures subsequent refreshes wait for hydration).
//
// Clear sites:
//   - LandingPage handleEnter: GET /api/draft returns 404 or COMPLETED.
//   - LandingPage handleResumeConfirmDiscard: DELETE /api/draft succeeded.
//   - App.tsx handleAuthenticatedBeginAgain: DELETE /api/draft succeeded.
//   - App.tsx hydration effect terminals (404 / non-resumable response).
//   - hooks/useAuth lifecycle invalidation: sign-out.

const STORAGE_KEY = 'sv_expect_cloud_draft';

export function markCloudDraftExpected(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // sessionStorage may be unavailable (private mode, quota). Non-fatal —
    // worst case the spinner shows when it didn't need to.
  }
}

export function clearCloudDraftExpected(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}

export function hasCloudDraftExpected(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
