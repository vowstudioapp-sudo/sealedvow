import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { LandingPage } from './components/LandingPage.tsx';
import { PreparationForm } from './components/PreparationForm';
import { PersonalIntro } from './components/PersonalIntro';
import { AtmosphericShell } from './components/AtmosphericShell';
import { InteractiveQuestion } from './components/InteractiveQuestion';
import AdminPanel from './components/AdminPanel';
import ClaimPage from './components/ClaimPage';
import { SignInPromptModal } from './components/SignInPromptModal.tsx';
import { ReceiverErrorBoundary } from './components/ReceiverErrorBoundary';
import { Analytics } from '@vercel/analytics/react';
import { getRouteType, initialStageForRoute, isEidiRoute, isReceiverLinkType } from './utils/routing';
import { decodeEidData } from './utils/eidDecoder';
import { useAuth } from './hooks/useAuth';

const RefineStage = lazy(() =>
  import('./components/RefineStage.tsx').then(m => ({ default: m.RefineStage }))
);

const MainExperience = lazy(() =>
  import('./components/MainExperience.tsx').then(m => ({ default: m.MainExperience }))
);

const SharePackage = lazy(() =>
  import('./components/SharePackage.tsx').then(m => ({ default: m.SharePackage }))
);

const SoulmateSync = lazy(() =>
  import('./components/SoulmateSync.tsx').then(m => ({ default: m.SoulmateSync }))
);

const PaymentStage = lazy(() =>
  import('./components/PaymentStage.tsx').then(m => ({ default: m.PaymentStage }))
);

const MasterControl = lazy(() =>
  import('./components/MasterControl.tsx').then(m => ({ default: m.MasterControl }))
);

const EidiCreatePage = lazy(() =>
  import('./pages/eidi/create.tsx').then(m => ({ default: m.EidiCreatePage }))
);

const EidiReceiverPage = lazy(() =>
  import('./pages/eidi/receiver.tsx').then(m => ({ default: m.EidiReceiverPage }))
);


const EidOrbitSelector = lazy(() =>
  import('./components/EidOrbitSelector.tsx').then(m => ({ default: m.EidOrbitSelector }))
)
const EidExperience = lazy(() =>
  import('./components/EidExperience.tsx').then(m => ({ default: m.EidExperience }))
);

const OccasionSelector = lazy(() =>
  import('./components/OccasionSelector.tsx').then(m => ({ default: m.OccasionSelector }))
);

const AboutPage = lazy(() =>
  import('./components/AboutPage.tsx').then(m => ({ default: m.AboutPage }))
);

const HowItWorksPage = lazy(() =>
  import('./components/HowItWorksPage.tsx').then(m => ({ default: m.HowItWorksPage }))
);

const FAQPage = lazy(() =>
  import('./components/FAQPage.tsx').then(m => ({ default: m.FAQPage }))
);

const EidPreparationForm = lazy(() =>
  import('./components/EidPreparationForm.tsx').then(m => ({ default: m.default }))
);
import { CoupleData, AppStage, Theme } from './types.ts';
import { useLinkLoader, LoaderState } from './hooks/useLinkLoader';
import { validateCoupleData } from './lib/coupleDataValidator.js';
import { writeDraftFromExternal, peekDraft, writeStage, writeDraftId, clearPreparationDraft } from './hooks/usePreparationPersistence';
import { saveDraft, type SaveDraftInput } from './utils/saveDraft';
import { pauseDraft, discardDraft } from './utils/lifecycleDraft';
import { StaleRevisionModal } from './components/StaleRevisionModal';
import { BeginNewPromptModal } from './components/BeginNewPromptModal';
import { SignInReconciliationModal } from './components/SignInReconciliationModal';
import { getDraftMetadata } from './hooks/usePreparationPersistence';

// PR-48 Phase 4 — Reconciliation authority is owned by App.tsx via this
// single discriminated union. Only ONE reconciliation modal renders at a
// time. DraftResumeModal and SignInPromptModal remain on their existing
// independent state systems; this union covers only the Phase 4 modals.
// Begin-New and Sign-in Case B cases are added in Commits 4 and 5.
interface CloudDraftSnapshot {
  draftId: string;
  data: CoupleData;
  draftState: DraftState;
  revision: number;
  updatedAt: number | null;
}

interface LocalDraftSnapshot {
  recipientName: string;
  wordCount: number;
  photoCount: number;
  savedAt: string;
}

type ReconciliationState =
  | { kind: 'none' }
  | {
      kind: 'stale_revision';
      source: 'save';
      currentRevision: number;
      pendingSavePayload: SaveDraftInput;
    }
  | {
      kind: 'begin_new';
      source: 'begin_new_button';
      hasCloudActive: boolean;
    }
  | {
      kind: 'sign_in_case_b';
      source: 'sign_in';
      cloudDraft: CloudDraftSnapshot;
      localMetadata: LocalDraftSnapshot;
    };

// PR-48 Phase 4 (Commit 5) — hydration resolution state machine.
// Sign-in pending actions (via commitPendingAction) are gated on this
// becoming 'resolved'. Transitions:
//   'idle'                  — initial; or post-sign-out.
//   'hydrating'             — /api/drafts/list in-flight.
//   'needs_reconciliation'  — Case B detected; modal open; user must choose.
//   'resolved'              — Case A silent hydration done, Case C silent
//                              local-authority confirmed, or Case B resolved
//                              by user choice.
// Guests never enter this machine — commitPendingAction short-circuits on
// !authUser per the integration rule.
type HydrationResolutionState =
  | 'idle'
  | 'hydrating'
  | 'needs_reconciliation'
  | 'resolved';
import type { DraftState, PersistenceStatus } from './types/draft';
import { DRAFT_STATE_ORDER } from './types/draft';
import { UI_STAGE_TO_DRAFT_STATE } from './hooks/draftStateLogic';
import { getDemoData } from './data/demoData.ts';

import { THEME_ORDER, THEME_SYSTEM } from './theme/themeSystem';

const THEME_BG_COLORS: Record<Theme, string> = Object.fromEntries(
  THEME_ORDER.map((id) => [id, THEME_SYSTEM[id].surfaceSolid]),
) as Record<Theme, string>;

const STUDIO_BG_COLOR = THEME_SYSTEM.obsidian.boardSurface;


const hydrateCoupleData = (value: CoupleData): CoupleData => ({
  ...value,
  theme: value.theme ?? 'obsidian',
});

const assertNever = (value: never): never => {
  throw new Error(`Unhandled AppStage: ${value}`);
};

const ensureExhaustiveStage = (stage: AppStage): void => {
  switch (stage) {
    case AppStage.LANDING:
    case AppStage.PREPARE:
    case AppStage.REFINE:
    case AppStage.PREVIEW:
    case AppStage.PAYMENT:
    case AppStage.SHARE:
    case AppStage.PERSONAL_INTRO:
    case AppStage.QUESTION:
    case AppStage.SOULMATE_SYNC:
    case AppStage.MAIN_EXPERIENCE:
    case AppStage.MASTER_CONTROL:
      return;
    default:
      assertNever(stage as never);
  }
};

// Refresh-resilience (PR #16): the sender stages we persist + restore. Other
// stages (LANDING, SOULMATE_SYNC, MASTER_CONTROL, SHARE) are not part of the
// authoring loop and are intentionally not persisted. PERSONAL_INTRO is
// included as of PR #17 — the unified canonical sender intro.
const PERSISTABLE_SENDER_STAGES: ReadonlySet<AppStage> = new Set([
  AppStage.PREPARE,
  AppStage.REFINE,
  AppStage.PERSONAL_INTRO,
  AppStage.QUESTION,
  AppStage.MAIN_EXPERIENCE,
  AppStage.PAYMENT,
]);

// Post-PREPARE stages need finalLetter to render anything meaningful; that's
// also the multi-tab + corrupt-storage backstop.
const isStageValid = (
  stage: AppStage,
  data: Partial<CoupleData> | null,
): boolean => {
  if (stage === AppStage.PREPARE) return true;
  if (!PERSISTABLE_SENDER_STAGES.has(stage)) return false;
  return typeof data?.finalLetter === 'string' && data.finalLetter.length > 0;
};

// PR-47.1 (Option F): readPersistedCoupleData / writePersistedCoupleData
// removed alongside the `vday_data` STORAGE_KEY. Refined-state recovery
// fidelity now lives entirely in vday_data_draft via the extended
// selectiveHydrate allowlist in hooks/usePreparationPersistence.ts. The
// Refine handoff writes the enriched payload through writeDraftFromExternal
// (see RefineStage.onSave below). See docs/diagnostics/2026-05-12-mount-
// authority-replay.md §8.1.

// Type for Eid form data (matches EidPreparationForm output)
type EidFormData = {
  recipient: string;
  senderName: string;
  relationship: string;
  subtype: string;
  mode: 'assist' | 'self';
  tone: string;
  blessing: string;
  eidiAmount: string;
  receiverPhoneNumber?: string;
};

type StageResolverState = {
  currentStage: AppStage;
  linkState: LoaderState;
  sharedData: CoupleData | null;
  isReceiverLink: boolean;
  isDemoMode: boolean;
  isEidFlow: boolean;
  isDevPreview: boolean;
  preview: string | null;
  role: string | null;
};

const resolveStage = (state: StageResolverState): AppStage => {
  const {
    currentStage,
    linkState,
    sharedData,
    isReceiverLink,
    isDemoMode,
    isEidFlow,
    isDevPreview,
    preview,
    role,
  } = state;

  if (isDevPreview && preview) {
    if (preview === 'intro' || preview === 'receiver') return AppStage.PERSONAL_INTRO;
    if (preview === 'letter' || preview === 'main') return AppStage.MAIN_EXPERIENCE;
    return AppStage.LANDING;
  }

  if (isDemoMode) {
    return currentStage === AppStage.LANDING
      ? AppStage.PERSONAL_INTRO
      : currentStage;
  }

  if (isEidFlow) {
    return AppStage.LANDING;
  }

  if (linkState === LoaderState.SUCCESS && sharedData) {
    if (role === 'master') return AppStage.MASTER_CONTROL;
    // Only transition into PERSONAL_INTRO from LANDING (initial entry). Once the
    // receiver has advanced to QUESTION/MAIN_EXPERIENCE/REPLY_COMPOSE,
    // preserve currentStage — otherwise this branch re-fires on every stage
    // change (stage is in Effect 411's deps) and yanks the user back to
    // PERSONAL_INTRO, producing the "name keeps flashing" loop.
    return currentStage === AppStage.LANDING
      ? AppStage.PERSONAL_INTRO
      : currentStage;
  }

  if (linkState === LoaderState.LOADING) {
    return isReceiverLink ? AppStage.PERSONAL_INTRO : currentStage;
  }

  if (linkState === LoaderState.IDLE) {
    return currentStage;
  }

  if (linkState === LoaderState.NO_LINK) {
    // Preserve the current stage. Creator flows (PREPARE/REFINE/PREVIEW/PAYMENT/SHARE)
    // legitimately run under NO_LINK — they don't involve a share link. Returning
    // LANDING unconditionally here was stomping the LETTER_CREATE → PREPARE
    // transition and causing a render oscillation.
    return currentStage;
  }

  if (linkState === LoaderState.ERROR) {
    return AppStage.LANDING;
  }

  if (!sharedData && !isReceiverLink) {
    return AppStage.LANDING;
  }

  return currentStage;
};

const App: React.FC = () => {
  // Legacy ?p=/#p= URLs are an obsolete client-side decode bypass. Redirect to /
  // synchronously before any hooks initialize so no intermediate render occurs.
  // window.location.replace tears down this render entirely — hooks below will
  // run on the fresh page load, preserving the rules of hooks.
  if (typeof window !== 'undefined') {
    const hasLegacyQuery = new URLSearchParams(window.location.search).has('p');
    const hasLegacyHash = /[#&]p=/.test(window.location.hash);
    if (hasLegacyQuery || hasLegacyHash) {
      window.location.replace('/');
      return null;
    }
  }

  // PR-47.1 (Option F): the H6 storage-quota banner was sourced exclusively
  // from writePersistedCoupleData's onQuotaError callback. With that writer
  // removed, the banner has no caller. vday_data_draft writes already swallow
  // quota errors with console.warn (see hooks/usePreparationPersistence.ts);
  // restoring symmetric, user-visible quota signaling across both writers is
  // queued as a Phase 1 stabilization item.

  const {
    state: linkState,
    data: sharedData,
    error: linkError,
    pathRecipientTitleHint,
  } = useLinkLoader();
  const routeType = getRouteType();
  const isEidiCreate = routeType === 'EIDI_CREATE';
  const isEidiReceiver = routeType === 'EIDI_RECEIVER';
  const isEidFlow = isEidiRoute(routeType);
  const isReceiverLink = isReceiverLinkType(routeType);
  const eidPreviewParams = new URLSearchParams(window.location.search);
  const hasEidPayload = !!eidPreviewParams.get('r');
  const isCreatorEidPreview =
    eidPreviewParams.get('preview') === '1' &&
    hasEidPayload &&
    window.location.pathname === '/eid';
  const demoData = useMemo(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/demo\/([a-z]+(?:\/[a-z-]+)?)$/);
    const slug = match ? match[1].replace('/', '-') : null;
    if (slug) return getDemoData(slug);
    return null;
  }, []);
  const isDemoMode = !!demoData;

  // PR #16: single-source dev-preview flag. Used by the persist-stage gate in
  // safeSetStage AND the resolver effect below — same value, computed once,
  // no risk of drift between two URL parses.
  const previewParam = useMemo(
    () => (import.meta.env.DEV ? new URLSearchParams(window.location.search).get('preview') : null),
    [],
  );
  const isDevPreview = !!previewParam;

  // Read once on mount; shared by the stage / data / isCreatorPreview initializers below.
  const initialDraft = useMemo(() => peekDraft(), []);

  const [stage, setStage] = useState<AppStage>(() => {
    const rt = getRouteType();
    const fallback = initialStageForRoute(rt);
    if (rt !== 'LETTER_CREATE') return fallback;
    if (!initialDraft.stage) return fallback;
    if (!isStageValid(initialDraft.stage, initialDraft.data)) return fallback;
    return initialDraft.stage;
  });
  const [data, setData] = useState<CoupleData | null>(() => {
    // Mount-only canonical creator-state restore. Single local authority is
    // vday_data_draft, read via peekDraft() into `initialDraft`. PR-47.1
    // (Option F) collapsed the prior dual-authority setup — there is no
    // second bucket to consult and therefore no cross-letter contamination
    // possible at mount. PREPARE is owned by PreparationForm's local state;
    // app-level data is null there. See
    // docs/diagnostics/2026-05-12-mount-authority-replay.md.
    if (getRouteType() !== 'LETTER_CREATE') return null;
    if (!initialDraft.stage || initialDraft.stage === AppStage.PREPARE) return null;
    if (!initialDraft.data) return null;
    if (!isStageValid(initialDraft.stage, initialDraft.data)) return null;
    return hydrateCoupleData(initialDraft.data as CoupleData);
  });

  const experienceData = useMemo(() => {
    if (isReceiverLink) {
      if (data) return data;
      if (linkState === LoaderState.SUCCESS && sharedData) {
        return hydrateCoupleData(sharedData);
      }
    }
    return data;
  }, [data, isReceiverLink, linkState, sharedData]);

  const [isBooting, setIsBooting] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (sessionStorage.getItem('hasSeenBoot') === '1') return false;
    } catch {}
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    // Full boot only on the landing root. Skip for /create and any in-app route.
    return path === '/';
  });
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  const [isCreatorPreview, setIsCreatorPreview] = useState(() => {
    // Any post-PREPARE sender stage we restore is by definition a creator-
    // preview surface — receiver flow lives at /{shareCode}, never on
    // /letter/create. The banner overlay on PERSONAL_INTRO and the theme dots
    // on QUESTION's ignite phase both gate on this flag; without restoring it,
    // a refresh mid-preview would render the receiver chrome on the sender.
    if (getRouteType() !== 'LETTER_CREATE') return false;
    if (!initialDraft.stage || initialDraft.stage === AppStage.PREPARE) return false;
    return PERSISTABLE_SENDER_STAGES.has(initialDraft.stage);
  });
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState<string | null>(null);
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [, forceLocationUpdate] = useState(0);

  const previousStageRef = useRef<AppStage | null>(null);
  const guestFlowCleanupPrevStageRef = useRef<AppStage>(AppStage.LANDING);
  const demoSeededRef = useRef(false);

  useEffect(() => {
    const prev = guestFlowCleanupPrevStageRef.current;
    if (stage === AppStage.PREPARE) {
      setGuestEmail(null);
      setEmailDelivered(false);
    } else if (prev === AppStage.SHARE && stage !== AppStage.SHARE) {
      setGuestEmail(null);
      setEmailDelivered(false);
    }
    guestFlowCleanupPrevStageRef.current = stage;
  }, [stage]);

  // ── Sign-in prompt at Preview → Payment transition ──
  // PR #18b — `serverSessionReady` is the deterministic gate for
  // authenticated fetches. It flips true only AFTER /api/auth/session has
  // minted the cookie; gating the hydration effect on `authUser?.uid`
  // alone races onAuthStateChanged ahead of the cookie-set.
  const { user: authUser, loading: authLoading, serverSessionReady } = useAuth();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  // PR #18b — variant of the sign-in modal. Default 'payment' preserves the
  // byte-identical UX for the existing payment-context call sites.
  const [signInVariant, setSignInVariant] = useState<'payment' | 'persistence'>('payment');
  const pendingActionRef = useRef<(() => void) | null>(null);
  // PR #18b — onCancel callback passed alongside the deferred action. Lets
  // the caller (e.g., handleSaveAndContinueLater) clean up its in-flight ref
  // when the user dismisses the modal without signing in.
  const pendingCancelRef = useRef<(() => void) | null>(null);

  // PR #18b — Cross-device draft persistence (activation of PR #18a's dormant
  // observer). draftId + seedDraftState live in a SINGLE state object so that
  // updates are atomic — the observer's activation seeding depends on both
  // values being available in the same render. Splitting these across two
  // useState hooks would risk an interleaved render where the observer
  // activates with draftId set but seedDraftState still null, producing a
  // redundant /transition write for the current UIStage.
  //
  // PR #21 — lazy initializer reads the optimistic draftId hint from
  // localStorage synchronously. This closes the post-mount race window where
  // the user could click save before /list hydration completed and trigger a
  // 409 ACTIVE_DRAFT_EXISTS. Cloud /list remains canonical; on hint vs cloud
  // mismatch, hydration overwrites the hint (cloud wins). seedDraftState
  // stays null until hydration populates it from cloud — the observer's
  // activation may fire one /transition with stale state in the brief
  // window before hydration completes (silent 409 if backward, accepted if
  // forward; not user-visible either way).
  // PR-48 Phase 2 (D1): `revision` is the monotonic content-revision counter
  // returned by the server. It is populated by /api/drafts/list hydration
  // and by /api/drafts/save success responses. It is required for every
  // UPDATE call (per contract §6); CREATE calls (no draftId) ignore it.
  //
  // The localStorage hint does NOT carry revision in Phase 2. If the user
  // clicks save in the narrow pre-hydration window (lazy init populated
  // draftId from hint, /list response not yet arrived), the save sends no
  // draftId — falling through to a CREATE attempt that the server may
  // reject as ACTIVE_DRAFT_EXISTS. The explicit-reconciliation rule from
  // doctrine §6.5 forbids chronological inference; the client must not
  // guess at a revision it has not been told.
  const [draftRecord, setDraftRecord] = useState<{
    draftId: string | null;
    seedDraftState: DraftState | null;
    revision: number | null;
  }>(() => ({
    draftId: peekDraft().draftId,
    seedDraftState: null,
    revision: null,
  }));

  // PR #18b — variant + onCancel are additive. Existing payment call sites
  // pass only `action` (variant defaults to 'payment', onCancel undefined),
  // preserving byte-identical UX. Persistence callers pass 'persistence' to
  // switch the modal copy/Guest-button visibility, and pass onCancel to be
  // notified when the user dismisses without signing in.
  // PR-48 Phase 4 (Commit 5) — Hydration gating layer integrated into the
  // existing pendingAction system. commitPendingAction below defers
  // signed-in pending actions until this state becomes 'resolved'. The
  // /list hydration effect drives all transitions. Guests bypass this gate.
  // Declared here (rather than alongside other state hooks below) so it
  // is in scope for commitPendingAction's closure reference and for the
  // watcher useEffect that releases deferred actions.
  const [hydrationResolutionState, setHydrationResolutionState] =
    useState<HydrationResolutionState>('idle');

  const runOrPromptSignIn = (
    action: () => void,
    variant: 'payment' | 'persistence' = 'payment',
    onCancel?: () => void,
  ) => {
    if (authUser) {
      action();
      return;
    }
    pendingActionRef.current = action;
    pendingCancelRef.current = onCancel ?? null;
    setSignInVariant(variant);
    setShowSignInPrompt(true);
  };

  const commitPendingAction = (guestCapturedEmail?: string) => {
    setShowSignInPrompt(false);
    if (guestCapturedEmail === undefined) {
      setGuestEmail(null);
    } else {
      const t = guestCapturedEmail.trim();
      setGuestEmail(t.length > 0 ? t : null);
    }

    // PR-48 Phase 4 (Commit 5) — hydration gating.
    //
    // Guest path (no authUser): preserve pre-Phase-4 behavior. Run the
    // action immediately. No cloud state to reconcile. PR-46.5 guest email
    // continuity is unaffected — guestCapturedEmail handling above is
    // identical to the prior commit.
    //
    // Signed-in path: hold the action until /list hydration resolves.
    // The action stays in pendingActionRef; the effect below watches
    // hydrationResolutionState and fires the action when it becomes
    // 'resolved' (Case A silent, Case C silent, or Case B post-user-choice).
    //
    // The hydrating effect is triggered by the same authUser?.uid change
    // that leads to commitPendingAction being called — so by the time this
    // function runs, hydration is already starting (state will be 'idle'
    // or 'hydrating'). We don't need to kick it off here.
    if (!authUser) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      pendingCancelRef.current = null;
      if (action) action();
      return;
    }

    if (hydrationResolutionState === 'resolved') {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      pendingCancelRef.current = null;
      if (action) action();
      return;
    }
    // Else: leave action in pendingActionRef. The effect watching
    // hydrationResolutionState below releases it once 'resolved'.
  };

  // PR-48 Phase 4 (Commit 5) — release deferred pending action when
  // hydration resolution completes. This fires for all three resolution
  // paths (silent Case A, silent Case C, user-resolved Case B).
  useEffect(() => {
    if (hydrationResolutionState !== 'resolved') return;
    const action = pendingActionRef.current;
    if (!action) return;
    pendingActionRef.current = null;
    pendingCancelRef.current = null;
    action();
  }, [hydrationResolutionState]);

  const cancelPendingAction = () => {
    const onCancel = pendingCancelRef.current;
    pendingActionRef.current = null;
    pendingCancelRef.current = null;
    setShowSignInPrompt(false);
    if (onCancel) onCancel();
  };

  const safeSetStage = (nextStage: AppStage) => {
    ensureExhaustiveStage(nextStage);
    setStage(prev => {
      if (prev === nextStage) {
        console.warn('[AppStage] Redundant transition', { from: prev, to: nextStage });
        return prev;
      }
      previousStageRef.current = prev;
      return nextStage;
    });
    // PR #16: refresh-resilience persistence. Gate to the standard sender
    // authoring flow only — receiver, demo, eid, and dev-preview surfaces all
    // own their own state-restoration paths and must not write to the draft.
    const inSenderFlow =
      linkState === LoaderState.NO_LINK &&
      !isDemoMode &&
      !isEidFlow &&
      !isDevPreview &&
      !isReceiverLink;
    if (inSenderFlow && PERSISTABLE_SENDER_STAGES.has(nextStage)) {
      writeStage(nextStage);
    }
  };

  const updateData = (patch: Partial<CoupleData>) => {
    setData(prev => (prev ? { ...prev, ...patch } : prev));
  };

  // ── PR #18b — Explicit "Save and continue later" handler ────────────────
  // User-triggered ONLY. There is no autosave path — the observer (above)
  // handles milestone /transition writes; this handler handles the explicit
  // full-payload /save. saveInFlightRef + mountedRef collectively guarantee
  // no overlapping saves and no setter-after-unmount.
  //
  // PR #18b CP3.5 — lastSaveSuccessAt is now a SETTLED-STATE anchor (not a
  // transient indicator). Once set, it remains until sign-out or hydration.
  // The 2.5s auto-dismiss timer from CP2 is removed; the affordance's
  // settled-receipt rendering communicates persistence on glance.
  const saveInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [lastSaveSuccessAt, setLastSaveSuccessAt] = useState<number | null>(null);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);

  // PR-48 Phase 4: single reconciliation authority. Exactly one of the
  // Phase 4 modals (StaleRevisionModal in this commit; BeginNewPromptModal
  // and SignInReconciliationModal in later commits) renders at a time,
  // gated by the kind discriminator. DraftResumeModal and SignInPromptModal
  // are NOT part of this union (they keep their pre-Phase-4 state systems).
  const [reconciliation, setReconciliation] = useState<ReconciliationState>({
    kind: 'none',
  });

  // Unmount guard for the in-flight save handler. App.tsx is the root and
  // rarely unmounts in production, but the pattern is correct for tests +
  // Strict Mode and protects against any future migration that remounts.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearLastSaveError = () => {
    setLastSaveError(null);
  };

  // PR-48 Phase 4 (Commit 3) — StaleRevisionModal handlers.
  //
  // Reload Latest: fetch the cloud's current ACTIVE for this draftId from
  // /api/drafts/list, replace local persistence with cloud data, update
  // draftRecord to the fresh revision. The user explicitly accepts losing
  // their local edits. lastSaveError is cleared because the user has
  // resolved the conflict.
  //
  // Keep Local for Now: preserve local exactly as-is. Cloud unchanged. The
  // lastSaveError stays visible — the conflict is unresolved but the user
  // has opted to defer.
  //
  // Cancel: close modal only. Same net effect as Keep Local for Now, but
  // framed as "I want to think about this," not "I'm choosing local."
  const handleStaleRevisionReloadLatest = async () => {
    if (reconciliation.kind !== 'stale_revision') return;
    const targetDraftId = reconciliation.pendingSavePayload.draftId;
    // Close modal optimistically; the fetch below either succeeds (we
    // hydrate state) or fails (we surface error and the user retries).
    setReconciliation({ kind: 'none' });

    try {
      const res = await fetch('/api/drafts/list', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        setLastSaveError("Couldn't reload. Try again in a moment.");
        return;
      }
      const json = (await res.json()) as {
        ok?: boolean;
        drafts?: Array<{
          draftId?: string;
          data?: CoupleData;
          draftState?: DraftState;
          persistenceStatus?: PersistenceStatus;
          revision?: number;
          updatedAt?: number;
        }>;
      };
      if (!mountedRef.current) return;
      // Find the cloud's current ACTIVE for the draftId we tried to save.
      // If targetDraftId is undefined (CREATE attempt that stale-revisioned
      // — unusual but possible if revision-CAS was added to creates),
      // we just pick any ACTIVE.
      const candidate = (json.drafts ?? []).find(
        (d) =>
          d.persistenceStatus === 'ACTIVE' &&
          (targetDraftId ? d.draftId === targetDraftId : true),
      );
      if (!candidate || !candidate.draftId || typeof candidate.revision !== 'number') {
        // Cloud's ACTIVE has moved on entirely (e.g., user discarded on
        // another device). Clear our error and let draftRecord re-hydrate
        // on the next /list cycle.
        setLastSaveError(null);
        return;
      }
      // Replace App.tsx data state with cloud's content; update draftRecord
      // to the fresh revision so future saves CAS correctly.
      if (candidate.data) {
        setData(hydrateCoupleData(candidate.data));
      }
      setDraftRecord({
        draftId: candidate.draftId,
        seedDraftState: candidate.draftState ?? null,
        revision: candidate.revision,
      });
      writeDraftId(candidate.draftId);
      setLastSaveError(null);
      setLastSaveSuccessAt(
        typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
      );
    } catch {
      if (mountedRef.current) {
        setLastSaveError("Couldn't reload. Try again in a moment.");
      }
    }
  };

  const handleStaleRevisionKeepLocalForNow = () => {
    if (reconciliation.kind !== 'stale_revision') return;
    setReconciliation({ kind: 'none' });
    // Intentionally preserve lastSaveError so the user sees the unresolved
    // conflict affordance and can retry later.
  };

  const handleStaleRevisionCancel = () => {
    if (reconciliation.kind !== 'stale_revision') return;
    setReconciliation({ kind: 'none' });
    // Same net effect as Keep Local for Now in this commit; distinct label
    // for UX clarity per the locked Phase 4 button copy.
  };

  // PR-48 Phase 4 (Commit 4) — Begin New cloud-aware orchestration.
  //
  // PreparationForm's resume modal "Begin again" button now delegates to
  // App.tsx via the onBeginAgainRequest callback (props change in this
  // commit). App.tsx inspects local meaningfulness + cloud-ACTIVE presence
  // and either:
  //   * Short-circuits (clear local immediately) if both are empty —
  //     preserves the pre-Phase-4 fast path for trivial Begin Again.
  //   * Opens BeginNewPromptModal otherwise — the user explicitly resolves.
  //
  // prepFormResetKey is the React-key mechanism for force-remounting
  // PreparationForm. Each "clear local + reset state" path bumps it,
  // which causes React to discard the existing PreparationForm instance
  // and mount a fresh one — picking up the (now-cleared) localStorage.
  // This avoids coupling App.tsx to PreparationForm's internal reset
  // hook (resetPreparationState is hook-internal).
  const [prepFormResetKey, setPrepFormResetKey] = useState(0);

  const beginNewInFlightRef = useRef(false);

  const handleBeginAgainRequest = () => {
    if (beginNewInFlightRef.current) return;
    if (reconciliation.kind !== 'none') return;

    const localMeta = getDraftMetadata();
    const localHasMeaningfulContent =
      !!localMeta && localMeta.hasMeaningfulContent;
    const hasCloudActive = !!draftRecord.draftId;

    if (!localHasMeaningfulContent && !hasCloudActive) {
      // Fast path: nothing to reconcile. Clear local + bump key.
      // Preserves pre-Phase-4 trivial-Begin-Again behavior.
      clearPreparationDraft();
      writeDraftId(null);
      setData(null);
      setLastSaveError(null);
      setLastSaveSuccessAt(null);
      setPrepFormResetKey((k) => k + 1);
      return;
    }

    setReconciliation({
      kind: 'begin_new',
      source: 'begin_new_button',
      hasCloudActive,
    });
  };

  const finalizeBeginNewLocalReset = () => {
    clearPreparationDraft();
    writeDraftId(null);
    setData(null);
    setDraftRecord({ draftId: null, seedDraftState: null, revision: null });
    setLastSaveError(null);
    setLastSaveSuccessAt(null);
    setReconciliation({ kind: 'none' });
    setPrepFormResetKey((k) => k + 1);
    beginNewInFlightRef.current = false;
  };

  const handleBeginNewSaveAndStartNew = async () => {
    if (reconciliation.kind !== 'begin_new') return;
    if (beginNewInFlightRef.current) return;
    beginNewInFlightRef.current = true;

    // Step 1: save current composition to cloud. This either UPDATEs the
    // existing cloud ACTIVE (if draftRecord.draftId present) or CREATEs
    // a new ACTIVE (if not). draftStateToSend mirrors the save flow's
    // monotonic computation.
    const candidate = UI_STAGE_TO_DRAFT_STATE[stage] ?? 'IN_PROGRESS';
    const seed = draftRecord.seedDraftState;
    const draftStateToSend: DraftState =
      seed !== null && DRAFT_STATE_ORDER[seed] > DRAFT_STATE_ORDER[candidate]
        ? seed
        : candidate;
    const localStep = peekDraft().step;
    const step = stage === AppStage.PREPARE ? (localStep ?? undefined) : undefined;

    const saveInput: SaveDraftInput = {
      data: data ?? {},
      draftState: draftStateToSend,
    };
    if (draftRecord.draftId && typeof draftRecord.revision === 'number') {
      saveInput.draftId = draftRecord.draftId;
      saveInput.expectedRevision = draftRecord.revision;
    }
    if (step !== undefined) saveInput.step = step;

    const saveResult = await saveDraft(saveInput);
    if (!mountedRef.current) {
      beginNewInFlightRef.current = false;
      return;
    }
    if (saveResult.kind !== 'ok') {
      // Save failed. Abort the multi-step. Local untouched, cloud may
      // have advanced revision but no demotion happened. Surface error.
      beginNewInFlightRef.current = false;
      setReconciliation({ kind: 'none' });
      setLastSaveError("Couldn't save just now. Your work is still here.");
      return;
    }

    // Step 2: pause the just-saved ACTIVE. The revision is the one we
    // just got back from save.
    const pauseResult = await pauseDraft({
      draftId: saveResult.draftId,
      expectedRevision: saveResult.revision,
    });
    if (!mountedRef.current) {
      beginNewInFlightRef.current = false;
      return;
    }
    if (pauseResult.kind !== 'ok') {
      // Pause failed. The cloud has an updated-content ACTIVE; local
      // is still intact. User can retry; the next save would be a same-
      // content UPDATE (revision bumped) and the next pause may succeed.
      // Update draftRecord to reflect the successful save before bailing.
      setDraftRecord({
        draftId: saveResult.draftId,
        seedDraftState: draftStateToSend,
        revision: saveResult.revision,
      });
      writeDraftId(saveResult.draftId);
      setLastSaveSuccessAt(Date.now());
      beginNewInFlightRef.current = false;
      setReconciliation({ kind: 'none' });
      setLastSaveError("Couldn't finish starting a new draft. Try again.");
      return;
    }

    // Step 3-5: clear local + reset draftRecord + remount PreparationForm.
    finalizeBeginNewLocalReset();
  };

  const handleBeginNewDiscardAndStartNew = async () => {
    if (reconciliation.kind !== 'begin_new') return;
    if (beginNewInFlightRef.current) return;
    beginNewInFlightRef.current = true;

    // If cloud has an ACTIVE, transition it to ABANDONED first.
    // If not, just clear local.
    if (draftRecord.draftId && typeof draftRecord.revision === 'number') {
      const discardResult = await discardDraft({
        draftId: draftRecord.draftId,
        expectedRevision: draftRecord.revision,
      });
      if (!mountedRef.current) {
        beginNewInFlightRef.current = false;
        return;
      }
      if (discardResult.kind !== 'ok') {
        // Discard failed. Don't risk clearing local if cloud state is
        // uncertain. Surface error; user can retry.
        beginNewInFlightRef.current = false;
        setReconciliation({ kind: 'none' });
        setLastSaveError("Couldn't discard the cloud draft. Try again.");
        return;
      }
    }

    finalizeBeginNewLocalReset();
  };

  const handleBeginNewCancel = () => {
    if (reconciliation.kind !== 'begin_new') return;
    setReconciliation({ kind: 'none' });
  };

  // PR-48 Phase 4 (Commit 5) — Sign-in Case B handlers.
  //
  // Continue Dashboard Draft: discard local, hydrate from cloud ACTIVE,
  // update draftRecord to cloud's identity. Operationally convergent
  // with Discard Local Draft (both clear local and trust cloud); distinct
  // label per locked Phase 4 spec.
  //
  // Discard Local Draft: same outcome as Continue Dashboard Draft.
  //
  // Both paths transition hydrationResolutionState → 'resolved',
  // which releases any deferred pending action via the effect above.

  const applyCloudActiveToState = (cloud: CloudDraftSnapshot) => {
    clearPreparationDraft();
    writeDraftId(cloud.draftId);
    // Replace App.tsx in-memory data with cloud's. PreparationForm will
    // remount cleanly via key bump; the App-level data flows to downstream
    // stages (REFINE/PERSONAL_INTRO/MAIN_EXPERIENCE) that read it directly.
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

  const handleSignInContinueDashboardDraft = () => {
    if (reconciliation.kind !== 'sign_in_case_b') return;
    applyCloudActiveToState(reconciliation.cloudDraft);
    setReconciliation({ kind: 'none' });
    setHydrationResolutionState('resolved');
  };

  const handleSignInDiscardLocalDraft = () => {
    if (reconciliation.kind !== 'sign_in_case_b') return;
    applyCloudActiveToState(reconciliation.cloudDraft);
    setReconciliation({ kind: 'none' });
    setHydrationResolutionState('resolved');
  };

  const handleSaveAndContinueLater = () => {
    // Concurrency guard — prevent overlapping saves from rapid re-clicks.
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;

    const action = async () => {
      // Compute the DraftState to record. Defense-in-depth monotonicity:
      // if seedDraftState (last persisted) is higher than the UIStage's
      // candidate, prefer the seed — never regress. Server enforces too.
      const candidate = UI_STAGE_TO_DRAFT_STATE[stage] ?? 'IN_PROGRESS';
      const seed = draftRecord.seedDraftState;
      const draftStateToSend: DraftState =
        seed !== null && DRAFT_STATE_ORDER[seed] > DRAFT_STATE_ORDER[candidate]
          ? seed
          : candidate;

      // Step is the PREPARE form sub-step (1|2|3). Peek the local draft —
      // it tracks the current sub-step authoritatively (PR #16 schema).
      // Outside PREPARE, step is meaningless and omitted.
      const localStep = peekDraft().step;
      const step = stage === AppStage.PREPARE ? (localStep ?? undefined) : undefined;

      // PR-48 Phase 4: migrated from inline fetch to canonical saveDraft
      // helper. The pairing rule for draftId + expectedRevision is preserved
      // (per Phase 2 doctrine: only send draftId when revision is known).
      const input: SaveDraftInput = {
        data: data ?? {},
        draftState: draftStateToSend,
      };
      if (draftRecord.draftId && typeof draftRecord.revision === 'number') {
        input.draftId = draftRecord.draftId;
        input.expectedRevision = draftRecord.revision;
      }
      if (step !== undefined) input.step = step;

      const result = await saveDraft(input);

      // Mount guard — abort silently if the component unmounted mid-flight.
      if (!mountedRef.current) {
        saveInFlightRef.current = false;
        return;
      }

      switch (result.kind) {
        case 'ok': {
          // DraftId identity invariant (Decision #14). If we already have a
          // draftId and the server returned a different one, refuse the swap.
          if (draftRecord.draftId && result.draftId !== draftRecord.draftId) {
            console.warn(
              `[18b] /save returned draftId=${result.draftId} but currentDraftId=${draftRecord.draftId}; refusing identity swap.`,
            );
            setLastSaveError("Couldn't save just now. Your work is still here.");
            saveInFlightRef.current = false;
            return;
          }

          // Success — update draftRecord atomically (single setter, all
          // fields together) so the observer's activation seeding sees the
          // matching values in the same render. seedDraftState carries the
          // state we just told the server about; the observer will treat
          // the next /transition for the same state as a noop (same_state).
          // PR-48 Phase 2 (D1): also capture revision from the response so
          // subsequent UPDATE saves can echo it back as expectedRevision.
          setDraftRecord({
            draftId: result.draftId,
            seedDraftState: draftStateToSend,
            revision: result.revision,
          });

          // PR #21 — mirror the just-confirmed draftId to localStorage as the
          // optimistic hint. On the next page reload, the lazy initializer for
          // draftRecord will read this and avoid the post-mount race window.
          writeDraftId(result.draftId);

          // PR #18b CP3.5 — set the settled-state anchor. No auto-dismiss
          // timer; the affordance now renders the receipt as long as the
          // session holds it. Re-saves refresh the timestamp; sign-out clears.
          setLastSaveError(null);
          setLastSaveSuccessAt(Date.now());

          saveInFlightRef.current = false;
          return;
        }

        case 'stale_revision':
          // PR-48 Phase 4 (Commit 3): route to StaleRevisionModal via the
          // reconciliation authority. The user explicitly resolves: Reload
          // Latest (replace local with cloud), Keep Local for Now (preserve
          // local, no save), or Cancel (close modal only).
          //
          // Stash the original save input so a future Phase-4 retry (not
          // shipped here) can replay if needed. lastSaveError remains set
          // so the inline affordance shows the user there's an unresolved
          // save attempt.
          setLastSaveError("Couldn't save just now. Your work is still here.");
          setReconciliation({
            kind: 'stale_revision',
            source: 'save',
            currentRevision: result.currentRevision,
            pendingSavePayload: input,
          });
          saveInFlightRef.current = false;
          return;

        case 'active_draft_exists':
          // Server enforces single-ACTIVE invariant. This branch fires when
          // the client tried to CREATE while a cloud ACTIVE already exists
          // (e.g., post-sign-in race before hydration completed).
          setLastSaveError("Couldn't save just now. Your work is still here.");
          saveInFlightRef.current = false;
          return;

        case 'unauthorized':
        case 'rate_limited':
        case 'bad_request':
        case 'network_error':
        case 'unknown_error':
        default:
          setLastSaveError("Couldn't save just now. Your work is still here.");
          saveInFlightRef.current = false;
          return;
      }
    };

    runOrPromptSignIn(action, 'persistence', () => {
      // Sign-in cancel path. Silent (Decision #10).
      saveInFlightRef.current = false;
    });
  };

  // PR #18b — Cross-device draft hydration. Gated on BOTH authUser?.uid AND
  // serverSessionReady. The serverSessionReady gate is load-bearing: without
  // it, this effect fires when Firebase's onAuthStateChanged updates the
  // user (which happens immediately when signInWithPopup resolves), but
  // BEFORE /api/auth/session has minted the session cookie. The fetch then
  // goes out without a Cookie header and 401s. With the gate, the effect
  // re-runs once serverSessionReady flips true, and the cookie is in the
  // jar by then.
  //
  // Stale-response protection via cancelled flag + uid-equality re-check
  // guards against account-switch races where user A's /list response
  // arrives after user B has signed in. RTDB writes happen exclusively
  // through the observer (transitions) and the explicit save handler.
  useEffect(() => {
    // PR #21 follow-up — Firebase still rehydrating its initial auth state.
    // `authLoading` is true on cold mount until onAuthStateChanged fires once.
    // Treating undefined-during-rehydration as a confirmed sign-out (the prior
    // behavior — gate was only `!capturedUid`) wiped the localStorage draftId
    // hint that the lazy initializer at draftRecord just loaded, reopening
    // the post-mount race window PR #21 was meant to close. Hold the effect
    // until Firebase has resolved one way or the other.
    if (authLoading) return;

    const capturedUid = authUser?.uid;

    // Confirmed sign-out: Firebase has resolved AND there is no user. Clear
    // EVERYTHING — draftRecord, settled-state anchor, pending error, and the
    // localStorage hint. Without the hint clear, a subsequent sign-in by a
    // different user would briefly populate draftRecord with the prior
    // user's stale draftId (cloud-wins reconciliation corrects it, but
    // starting clean is preferable).
    if (!capturedUid) {
      setDraftRecord({ draftId: null, seedDraftState: null, revision: null });
      setLastSaveSuccessAt(null);
      setLastSaveError(null);
      writeDraftId(null);
      // PR-48 Phase 4 (Commit 5) — sign-out resets the hydration gate.
      // Next sign-in re-enters the state machine from 'idle'.
      setHydrationResolutionState('idle');
      return;
    }

    // Mid-sign-in window (Firebase has the user, our session cookie is not
    // yet minted). Hold draftRecord as-is — the lazy initializer's hint
    // carries through. Clearing here would reopen the pre-PR-#21 race: a
    // save POST during this window would omit draftId and trip the single-
    // ACTIVE invariant on the server. If the user does click save in this
    // window, the optimistic draftId rides along and either succeeds once
    // the cookie lands or surfaces a 401 the user can retry.
    if (!serverSessionReady) return;

    // PR #21 follow-up — do NOT reset draftRecord before /list. The lazy
    // initializer populated it with the optimistic localStorage hint;
    // preserve that through the round-trip. Cloud-wins reconciliation
    // below either confirms (overwrites with same id), replaces (different
    // id), or clears (no ACTIVE found) — all three branches handle the
    // initial-hint state correctly.

    let cancelled = false;
    // PR-48 Phase 4 (Commit 5) — gate begins. Hydration in-flight; any
    // signed-in pending action is held until this resolves below.
    setHydrationResolutionState('hydrating');
    fetch('/api/drafts/list', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json) => {
        if (cancelled) return;
        // Stale-response guard: if the auth identity changed mid-flight,
        // discard. Only the most recent identity's response should hydrate.
        if (authUser?.uid !== capturedUid) return;

        const drafts = Array.isArray(json?.drafts) ? json.drafts : [];
        const activeDrafts = drafts.filter(
          (d: { persistenceStatus?: PersistenceStatus }) =>
            d?.persistenceStatus === 'ACTIVE',
        );
        if (activeDrafts.length === 0) {
          // PR #21 — cloud has no ACTIVE draft for this user. Any
          // localStorage hint is stale (cloud was the source of truth and
          // it now disagrees). Clear the hint and any draftRecord that may
          // have been optimistically populated by the lazy initializer.
          setDraftRecord({ draftId: null, seedDraftState: null, revision: null });
          writeDraftId(null);
          // PR-48 Phase 4 (Commit 5) — Case C: no cloud ACTIVE + local
          // remains authoritative (local content stays untouched). Silent
          // resolution per locked spec — no modal, no auto-save.
          setHydrationResolutionState('resolved');
          return;
        }

        // Match server's findActiveDraftForUser semantics: chronologically
        // oldest ACTIVE wins. /list returns sorted by updatedAt desc, so we
        // re-sort by createdAt asc to recover insertion order.
        activeDrafts.sort(
          (
            a: { createdAt?: number },
            b: { createdAt?: number },
          ) => (a.createdAt || 0) - (b.createdAt || 0),
        );
        const oldest = activeDrafts[0] as {
          draftId?: string;
          data?: CoupleData;
          draftState?: DraftState;
          updatedAt?: number;
          revision?: number;
        };
        if (!oldest?.draftId || !oldest?.draftState) {
          // Malformed cloud response. Treat as 'resolved' to unblock any
          // deferred pending action — draftRecord remains in its current
          // state.
          setHydrationResolutionState('resolved');
          return;
        }

        // PR-48 Phase 4 (Commit 5) — Case A vs B split.
        // Case A: cloud ACTIVE + no meaningful local. Silent hydration.
        // Case B: cloud ACTIVE + meaningful local. Surface modal; defer.
        const localMeta = getDraftMetadata();
        const localHasMeaningfulContent =
          !!localMeta && localMeta.hasMeaningfulContent;

        if (localHasMeaningfulContent && oldest.data) {
          // Case B — explicit reconciliation required. Do NOT touch
          // draftRecord yet; the user's choice in the modal determines
          // which side wins.
          const cloudRevision =
            typeof oldest.revision === 'number' ? oldest.revision : 1;
          const cloudUpdatedAt =
            typeof oldest.updatedAt === 'number' ? oldest.updatedAt : null;
          setReconciliation({
            kind: 'sign_in_case_b',
            source: 'sign_in',
            cloudDraft: {
              draftId: oldest.draftId,
              data: oldest.data,
              draftState: oldest.draftState,
              revision: cloudRevision,
              updatedAt: cloudUpdatedAt,
            },
            localMetadata: {
              recipientName: localMeta?.recipientName ?? '',
              wordCount: localMeta?.wordCount ?? 0,
              photoCount: localMeta?.photoCount ?? 0,
              savedAt: localMeta?.savedAt ?? '',
            },
          });
          setHydrationResolutionState('needs_reconciliation');
          return;
        }

        // Case A — silent hydration (existing behavior).
        // PR-48 Phase 2 (D1): capture cloud revision so the next save can
        // echo it back as expectedRevision. Pre-Phase-2 drafts without a
        // revision field hydrate as null; first save against them falls
        // through to CREATE-attempt path and the server's transaction
        // detects the existing ACTIVE.
        setDraftRecord({
          draftId: oldest.draftId,
          seedDraftState: oldest.draftState,
          revision: typeof oldest.revision === 'number' ? oldest.revision : null,
        });
        // PR #21 — cloud-wins reconciliation. Mirror the cloud's draftId
        // into the localStorage hint. If the prior hint matched, this is a
        // no-op write; if it differed (stale hint from a previous session
        // or different cloud state), this overwrites it. Cloud is canonical.
        writeDraftId(oldest.draftId);
        // PR #18b CP3.5 — seed lastSaveSuccessAt from the cloud's updatedAt
        // so the rehydrated session immediately renders the settled-state
        // anchor ("Saved {relative time}") instead of the action affordance.
        if (typeof oldest.updatedAt === 'number') {
          setLastSaveSuccessAt(oldest.updatedAt);
        }
        setHydrationResolutionState('resolved');
      })
      .catch(() => {
        // Silent: background hydration must never surface a UI error.
        // draftRecord stays cleared; observer remains dormant.
        // PR-48 Phase 4 (Commit 5) — also unblock any deferred pending
        // action. The user can retry; the next /list fetch will re-enter
        // the gate.
        if (!cancelled) {
          setHydrationResolutionState('resolved');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, authLoading, serverSessionReady]);

  useEffect(() => {
    const onPopState = () => {
      forceLocationUpdate(k => k + 1);
      setStage(prev => {
        const rt = getRouteType();
        if (rt === 'LETTER_CREATE') {
          if (prev === AppStage.LANDING) return AppStage.PREPARE;
          return prev;
        }
        const target = initialStageForRoute(rt);
        return prev === AppStage.LANDING ? target : prev;
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // DEV PREVIEW — ?preview=receiver|intro|letter
  useEffect(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get('preview');
      if (!preview) return;

      // Theme override: ?theme=velvet, ?theme=crimson, etc.
      const themeParam = params.get('theme') as Theme | null;
      const VALID_THEMES: Theme[] = ['obsidian', 'velvet', 'crimson', 'midnight', 'evergreen', 'pearl'];
      const selectedTheme: Theme = (themeParam && VALID_THEMES.includes(themeParam)) ? themeParam : 'obsidian';

      // High-quality free stock images (Unsplash — no auth needed)
      const IMG = {
        cover: 'https://images.unsplash.com/photo-1529634597503-139d3726fed5?w=800&q=80',
        memory1: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80',
        memory2: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80',
        memory3: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&q=80',
        memory4: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=600&q=80',
        memory5: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=80',
      };

      const mockData: CoupleData = {
        sessionId: 'dev-preview-001',
        recipientName: 'Saniya',
        senderName: 'Ajmal',
        timeShared: '3 beautiful years',
        relationshipIntent: 'Deeply romantic, grateful, and present.',
        sharedMoment: 'When we got lost in the old city and found that rooftop café where the stars felt close enough to touch.',
        occasion: 'anniversary',
        writingMode: 'assisted',
        theme: selectedTheme,
        myth: 'Three years. One story. Still unfolding.',

        finalLetter: 'From the moment I first saw you, I knew something had shifted in the universe. Not dramatically — more like a quiet rearrangement of priorities.\n\nYou taught me that love is not a grand gesture. It is the way you remember how I take my coffee. The way you laugh at my worst jokes. The way you hold my hand when I am anxious without me having to ask.\n\nThere are nights I lie awake wondering what I did to deserve this. Wondering how one person can make an entire city feel like home. You are my answer to every question I was afraid to ask.\n\nEvery morning with you feels like a gift I did nothing to deserve. And yet here we are — improbably, stubbornly, beautifully together.\n\nI do not know what the future holds. But I know that whatever it is, I want to face it standing next to you. Always.',

        // Cover image
        userImageUrl: IMG.cover,

        // Memory board — 5 photos with captions
        memoryBoard: [
          { url: IMG.memory1, caption: 'That first evening', angle: -4, xOffset: -15, yOffset: -10 },
          { url: IMG.memory2, caption: 'Lost in the old city', angle: 3, xOffset: 20, yOffset: 5 },
          { url: IMG.memory3, caption: 'Our quiet place', angle: -2, xOffset: -8, yOffset: 15 },
          { url: IMG.memory4, caption: 'You laughed so hard', angle: 5, xOffset: 12, yOffset: -5 },
          { url: IMG.memory5, caption: 'Unplanned and perfect', angle: -3, xOffset: -20, yOffset: 8 },
        ],

        // Sacred location
        sacredLocation: {
          placeName: 'The Rooftop Café, Old City',
          description: 'Where we got lost and found something better. The stars felt close enough to touch.',
          googleMapsUri: 'https://maps.google.com/?q=26.9124,75.7873',
          latLng: { lat: 26.9124, lng: 75.7873 },
        },

        // Promises (coupons)
        coupons: [
          { id: 'c1', title: 'One Midnight Drive', description: 'No destination. No map. Just us, the road, and whatever playlist you choose.', icon: '🌙', isOpen: true },
          { id: 'c2', title: 'A Full Day of Yes', description: 'Whatever you want — wherever you want — no questions asked. Your wish is literally my command.', icon: '✨', isOpen: true },
          { id: 'c3', title: 'Breakfast in Bed', description: 'Handmade by me. Served on the good plates. You don\'t lift a finger until noon.', icon: '🍳', isOpen: true },
        ],

        // Gift
        hasGift: true,
        giftType: 'gastronomy',
        giftTitle: 'Dinner at That Rooftop Place',
        giftLink: 'https://example.com/reservation',

        // Music
        musicType: 'preset',
        musicUrl: '',

        // Reveal
        revealMethod: 'immediate',
        replyEnabled: true,

        // Timestamps
        sealedAt: new Date().toISOString(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      };

      setData(mockData);
      setIsBooting(false);
      setIsFadingOut(true);

      if (preview === 'intro') safeSetStage(AppStage.PERSONAL_INTRO);
      else if (preview === 'letter' || preview === 'main') safeSetStage(AppStage.MAIN_EXPERIENCE);
      else if (preview === 'receiver') safeSetStage(AppStage.PERSONAL_INTRO);
    }
  }, []);

  useEffect(() => {
    const preview = previewParam;
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const isDemoPath = path.startsWith('/demo/');
    const isDemoEidPath = path === '/demo/eid' || /^\/demo\/eid\/[a-z-]+$/.test(path);
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const role = queryParams.get('role') || hashParams.get('role');

    // Safety fallback: unknown /demo/* slugs should never blank-screen.
    if (isDemoPath && !isDemoEidPath && !demoData) {
      setIsBooting(false);
      setIsFadingOut(false);
      window.history.replaceState({}, '', '/');
    }

    if (isDemoMode && demoData) {
      if (!demoSeededRef.current) {
        setData(demoData);
        demoSeededRef.current = true;
      }
      setIsBooting(false);
      setIsFadingOut(false);
    } else if (linkState === LoaderState.SUCCESS && sharedData) {
      setData(hydrateCoupleData(sharedData));
      setIsBooting(false);
      setIsFadingOut(false);
    } else if (linkState === LoaderState.ERROR) {
      console.error('Link loading error:', linkError);
    }
    // NO_LINK creator flow intentionally does not restore data here.
    // Persistence is passive during composition; mount-time restore lives in
    // the `data` useState initializer above. See diagnostic §13 option 5.

    if (linkState !== LoaderState.IDLE) {
      let nextStage = resolveStage({
        currentStage: stage,
        linkState,
        sharedData,
        isReceiverLink,
        isDemoMode,
        isEidFlow,
        isDevPreview,
        preview,
        role,
      });
      if (routeType === 'LETTER_CREATE' && nextStage === AppStage.LANDING) {
        nextStage = AppStage.PREPARE;
      }
      safeSetStage(nextStage);
    }
  }, [
    demoData,
    isDemoMode,
    isEidFlow,
    isReceiverLink,
    linkError,
    linkState,
    routeType,
    sharedData,
    stage,
  ]);

  useEffect(() => {
    if (linkState !== LoaderState.SUCCESS || !sharedData) return;

    if (sharedData.occasion === 'eid') {
      const payload = {
        recipient: sharedData.recipientName || '',
        senderName: sharedData.senderName || '',
        blessing: sharedData.finalLetter || '',
        eidiAmount: sharedData.timeShared || '',
        relationship: sharedData.relationshipIntent || '',
        subtype: sharedData.sharedMoment || '',
        mode: sharedData.writingMode === 'assisted' ? 'assist' : 'self',
      };
      window.sessionStorage.setItem('eidDecodedData', JSON.stringify(payload));
      return;
    }

    window.sessionStorage.removeItem('eidDecodedData');
  }, [linkState, sharedData]);

  // ── HOISTED: hooks must run before any conditional return ────────────
  // Originally these lived below the `if (hasEidPayload)` early-return
  // block and the EIDI render returns. Rules of Hooks require every hook
  // to run on every render; moving them above the first conditional
  // return eliminates the hook-count mismatch.

  useEffect(() => {
    // Skip boot animation for receiver links and any route where it was suppressed at init.
    if (isReceiverLink) return;
    if (!isBooting) return;

    try { sessionStorage.setItem('hasSeenBoot', '1'); } catch {}

    const fadeTimer = setTimeout(() => setIsFadingOut(true), 1100);
    const endTimer = setTimeout(() => setIsBooting(false), 1500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [isReceiverLink, isBooting]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const applyColor = (color: string) => {
      document.body.style.backgroundColor = color;
    };

    switch (stage) {
      case AppStage.LANDING:
      case AppStage.MASTER_CONTROL:
      case AppStage.PERSONAL_INTRO: {
        document.body.style.transition = 'background-color 0.5s ease';
        applyColor('#000000');
        break;
      }
      case AppStage.PREPARE: {
        document.body.style.transition = 'background-color 2.5s ease-out';
        applyColor(STUDIO_BG_COLOR);
        break;
      }
      case AppStage.REFINE: {
        if (previousStageRef.current === AppStage.MAIN_EXPERIENCE) {
          applyColor(STUDIO_BG_COLOR);
        }
        break;
      }
      case AppStage.PAYMENT: {
        if (previousStageRef.current === AppStage.MAIN_EXPERIENCE) {
          applyColor(STUDIO_BG_COLOR);
        }
        break;
      }
      case AppStage.MAIN_EXPERIENCE: {
        if (previousStageRef.current === AppStage.PAYMENT && experienceData) {
          applyColor(THEME_BG_COLORS[experienceData.theme]);
        }
        break;
      }
      case AppStage.SHARE: {
        if (previousStageRef.current === AppStage.PAYMENT) {
          applyColor(STUDIO_BG_COLOR);
        }
        break;
      }
      case AppStage.QUESTION: {
        if (experienceData) {
          document.body.style.transition = 'background-color 0.5s ease';
          applyColor(THEME_BG_COLORS[experienceData.theme]);
        }
        break;
      }
      case AppStage.SOULMATE_SYNC:
      case AppStage.PREVIEW: {
        break;
      }
      default: {
        assertNever(stage as never);
      }
    }

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [stage, experienceData]);

  // Preload post-seal chunks once the receiver reaches PERSONAL_INTRO so the
  // Suspense fallback (wordmark) doesn't flash during the Q→MAIN_EXPERIENCE
  // transition. Paths must match the lazy() imports above exactly so Vite
  // reuses the same chunk.
  const receiverChunksPreloadedRef = useRef(false);
  useEffect(() => {
    if (stage !== AppStage.PERSONAL_INTRO) return;
    if (receiverChunksPreloadedRef.current) return;
    receiverChunksPreloadedRef.current = true;
    import('./components/MainExperience.tsx');
    import('./components/SoulmateSync.tsx');
  }, [stage]);

  const receiverOpenedBeaconSentRef = useRef(false);
  useEffect(() => {
    if (stage !== AppStage.QUESTION || !isReceiverLink || !experienceData || isDemoMode) {
      return;
    }
    if (receiverOpenedBeaconSentRef.current) return;
    const path = window.location.pathname;
    if (path.startsWith('/demo/')) return;
    const parts = path.replace(/^\//, '').replace(/\/$/, '').split('-');
    const key = parts[parts.length - 1];
    if (!key || !/^[a-z0-9]{8}$/i.test(key)) return;
    receiverOpenedBeaconSentRef.current = true;
    fetch('/api/letters/mark-opened', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey: key }),
    }).catch(() => {});
  }, [stage, isReceiverLink, experienceData, isDemoMode]);

  // ── /HOISTED ────────────────────────────────────────────────────────

  if (hasEidPayload) {
    if (isCreatorEidPreview) {
      if (stage === AppStage.PAYMENT && data) {
        return (
          <Suspense fallback={null}>
            <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
              <PaymentStage
                data={data}
                guestEmail={guestEmail ?? undefined}
                onPaymentComplete={(result: {
                  replyEnabled: boolean;
                  sessionKey: string;
                  shareSlug: string;
                  emailDelivered?: boolean;
                }) => {
                  updateData({ replyEnabled: result.replyEnabled, sealedAt: new Date().toISOString() });
                  setSessionKey(result.sessionKey);
                  setShareSlug(result.shareSlug);
                  setEmailDelivered(result.emailDelivered === true);
                  safeSetStage(AppStage.SHARE);
                }}
                onBack={() => {
                  safeSetStage(AppStage.MAIN_EXPERIENCE);
                  setIsCreatorPreview(true);
                }}
              />
            </div>
          </Suspense>
        );
      }

      if (stage === AppStage.SHARE && data && sessionKey && shareSlug) {
        return (
          <Suspense fallback={null}>
            <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
              <SharePackage
                data={data}
                sessionKey={sessionKey}
                shareSlug={shareSlug}
                emailDelivered={emailDelivered}
                onPreview={() => {
                  // Eid renders <EidExperience/> for any non-PAYMENT/non-SHARE
                  // stage, so the value here is a "cycle off SHARE" token. Use
                  // the unified-flow intro stage to keep the enum surface tidy.
                  safeSetStage(AppStage.PERSONAL_INTRO);
                  setIsCreatorPreview(false);
                }}
                onEdit={() => safeSetStage(AppStage.PREPARE)}
              />
            </div>
          </Suspense>
        );
      }

      return (
        <Suspense fallback={null}>
          <EidExperience
            onPayment={() => {
              runOrPromptSignIn(() => {
                const decoded = decodeEidData();

                if (!decoded) {
                  console.error('[App] Eid payment: decoded data missing');
                  alert("Preview data missing - please return to form");
                  window.location.href = '/eid/parent-child';
                  return;
                }

                const coupleData = {
                  sessionId: `eid-${Date.now()}`,
                  recipientName: decoded.recipient || '',
                  senderName: decoded.senderName || '',
                  receiverPhoneNumber: decoded.receiverPhoneNumber || '',
                  occasion: 'eid',
                  theme: 'evergreen',
                  writingMode: decoded.mode === 'assist' ? 'assisted' : 'self',
                  finalLetter: decoded.blessing || '',
                  relationshipIntent: decoded.relationship || '',
                  sharedMoment: decoded.subtype || '',
                  timeShared: decoded.eidiAmount || '',
                  myth: '',
                  sacredLocation: undefined,
                  revealMethod: 'immediate',
                  coupons: [],
                  memoryBoard: [],
                  createdAt: new Date().toISOString(),
                  sealedAt: undefined,
                } as CoupleData;

                setData(coupleData);
                safeSetStage(AppStage.PAYMENT);
              });
            }}
          />
        </Suspense>
      );
    }

    // Receiver side: render EidExperience from the encoded payload, but without payment callback.
    return (
      <Suspense fallback={null}>
        <EidExperience />
      </Suspense>
    );
  }

  // ── EIDI EARLY RETURNS — isolated from main stage engine ──────────
  const eidiLoadingFallback = (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 32, animation: 'spin 2s linear infinite' }}>🌙</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const path = window.location.pathname;
  const normalizedPath = path.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/admin' || normalizedPath === '/admin/claims') {
    return <AdminPanel />;
  }
  if (normalizedPath === '/claim') {
    return <ClaimPage />;
  }

  if (linkState === LoaderState.SUCCESS && sharedData?.occasion === 'eid') {
    return (
      <Suspense fallback={eidiLoadingFallback}>
        <EidExperience sharedSession={sharedData} />
      </Suspense>
    );
  }

  if (isEidiCreate) {
    // Deprecated: we intentionally route `/eidi/create` to the same dark "Choose the Occasion" flow.
    return <Suspense fallback={eidiLoadingFallback}><OccasionSelector /></Suspense>;
  }

  if (routeType === 'EID_SELECTOR') {
    return (
      <Suspense fallback={eidiLoadingFallback}>
        <EidOrbitSelector />
      </Suspense>
    );
  }

  if (routeType === 'DEMO_EID') {
    return (
      <Suspense fallback={eidiLoadingFallback}>
        <EidExperience />
      </Suspense>
    );
  }

  if (routeType === 'EID_PREPARATION') {
    const path = window.location.pathname;
    const relationship = path.split('/eid/')[1]?.split(/[?#]/)[0] || undefined;

    return (
      <Suspense fallback={eidiLoadingFallback}>
        <EidPreparationForm
          relationship={relationship}
          onPreview={(formData) => {
            const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(formData))));
            const url = `/eid?preview=1&r=${encoded}`;
            window.location.href = url;
          }}
        />
      </Suspense>
    );
  }

  if (isEidiReceiver) {
    return <Suspense fallback={eidiLoadingFallback}><EidiReceiverPage /></Suspense>;
  }

  if (routeType === 'OCCASION_SELECTOR') {
    return <Suspense fallback={null}><OccasionSelector /></Suspense>;
  }

  if (routeType === 'ABOUT') {
    return <Suspense fallback={null}><AboutPage /></Suspense>;
  }

  if (routeType === 'HOW_IT_WORKS') {
    return <Suspense fallback={null}><HowItWorksPage /></Suspense>;
  }

  if (routeType === 'FAQ') {
    return <Suspense fallback={null}><FAQPage /></Suspense>;
  }

  const handleEnterStudio = () => {
    window.location.href = "/create";
  };

  const handleQuestionAccepted = () => {
    if (experienceData?.revealMethod === 'sync') {
      safeSetStage(AppStage.SOULMATE_SYNC);
    } else {
      safeSetStage(AppStage.MAIN_EXPERIENCE);
    }
  };

  const bootScreen = (
    <div
      className={`boot-screen-container ${isFadingOut ? 'fade-out' : ''}`}
      style={{
        background:
          'radial-gradient(ellipse 720px 480px at 50% 50%, rgba(154, 36, 53, 0.07) 0%, rgba(154, 36, 53, 0) 70%), var(--sv-bg-base, #1A1220)',
        transition: 'opacity 400ms ease-out',
      }}
    >
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ padding: '0 24px' }}
      >
        <h1
          className="lp-nav__wordmark animate-boot-mark select-none"
          aria-label="Sealed Vow"
          style={{
            fontSize: 'clamp(51px, 11vw, 66px)',
            margin: 0,
            opacity: 0,
          }}
        >
          <span className="lp-nav__wordmark-sealed">
            <span className="lp-nav__wordmark-sealed-first">S</span>
            <span className="lp-nav__wordmark-sealed-rest">ealed</span>
          </span>
          <span className="lp-nav__wordmark-vow">Vow</span>
        </h1>

        <p
          className="animate-boot-sub font-serif-elegant italic"
          style={{
            color: 'rgba(242, 237, 228, 0.85)',
            fontSize: 'clamp(18px, 3.75vw, 20px)',
            fontWeight: 500,
            letterSpacing: '0.05em',
            lineHeight: 1.4,
            marginTop: '32px',
            marginBottom: 0,
            maxWidth: '32ch',
            opacity: 0,
          }}
        >
          Letters take a moment to fold.
        </p>

        <div
          className="animate-boot-anchor"
          style={{
            marginTop: '22px',
            width: '72px',
            height: '1px',
            background: 'rgba(241, 231, 218, 0.62)',
            opacity: 0,
          }}
        />
      </div>
    </div>
  );

  const suspenseFallback = (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--sv-bg-base, #1A1220)' }}
    >
      <h1
        className="lp-nav__wordmark select-none"
        aria-label="Sealed Vow"
        style={{ fontSize: 'clamp(40px, 8vw, 56px)', margin: 0 }}
      >
        <span className="lp-nav__wordmark-sealed">
          <span className="lp-nav__wordmark-sealed-first">S</span>
          <span className="lp-nav__wordmark-sealed-rest">ealed</span>
        </span>
        <span className="lp-nav__wordmark-vow">Vow</span>
      </h1>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden transition-colors duration-1000" style={{ backgroundColor: '#0C0A09' }}>
      {!isEidiRoute(routeType) && isBooting && !isReceiverLink && bootScreen}

      <div className="fixed inset-0 pointer-events-none opacity-[0.04] z-0" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper.png")' }}></div>
      
      {stage === AppStage.PREPARE && (
        <>
         <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)] z-0"></div>
         <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_30%,rgba(60,50,40,0.04)_0%,transparent_70%)] z-0"></div>
        </>
      )}

      <Suspense
        fallback={
          isReceiverLink &&
          (stage === AppStage.MAIN_EXPERIENCE ||
            stage === AppStage.SOULMATE_SYNC)
            ? null
            : suspenseFallback
        }
      >
        <main className={`relative z-10 w-full min-h-screen transition-opacity duration-1000 ${
          isReceiverLink ? 'opacity-100' : (isBooting ? 'opacity-0' : 'opacity-100')
        }`}>
          {isReceiverLink &&
            linkState === LoaderState.LOADING &&
            !experienceData && (
              <AtmosphericShell surfaceTheme="obsidian">
                <div className="min-h-screen flex items-center justify-center">
                  <span className="cold-load-text">Take a moment.</span>
                </div>
              </AtmosphericShell>
            )}
          
          {stage === AppStage.LANDING && !isReceiverLink && (
            <LandingPage onEnter={handleEnterStudio} />
          )}

          {stage === AppStage.PREPARE && (
            <div className="animate-fade-in py-12 px-4">
               <PreparationForm
                 key={prepFormResetKey}
                 onComplete={(d) => { setData(hydrateCoupleData(d)); safeSetStage(AppStage.REFINE); }}
                 onBeginAgainRequest={handleBeginAgainRequest}
               />
            </div>
          )}

          {stage === AppStage.REFINE && data && (
            <RefineStage
              data={data}
              onSave={(finalLetter, enrichedData) => {
                if (!data) return;
                const updated: CoupleData = hydrateCoupleData({ ...data, ...enrichedData, finalLetter });
                setData(updated);
                setIsCreatorPreview(true);
                // PR #17: sender preview enters the unified canonical flow
                // (PERSONAL_INTRO → QUESTION → MAIN_EXPERIENCE) — the same
                // sequence the receiver gets, with preview chrome on top.
                safeSetStage(AppStage.PERSONAL_INTRO);
                // PR-47.1 (Option F): merge enrichedData + finalLetter into
                // the single surviving authority (vday_data_draft). The
                // extended selectiveHydrate allowlist preserves refined-state
                // fidelity (myth, sacredLocation, video, audio, aiImageUrl)
                // on refresh.
                writeDraftFromExternal({ ...enrichedData, finalLetter });
              }}
              onBack={() => safeSetStage(AppStage.PREPARE)}
              onUpdateLetter={(letter) => {
                // Mirror the AI-generated (or manually edited) letter back into
                // App state AND the form draft in localStorage. PreparationForm
                // is unmounted during REFINE, so its persistence hook can't see
                // this change — writeDraftFromExternal merges into the existing
                // draft (preserving step) so Back-to-Details restores fully.
                setData(prev => (prev ? { ...prev, finalLetter: letter } : prev));
                writeDraftFromExternal({ finalLetter: letter });
              }}
              onSaveAndContinueLater={handleSaveAndContinueLater}
              lastSaveSuccessAt={lastSaveSuccessAt}
              lastSaveError={lastSaveError}
              clearLastSaveError={clearLastSaveError}
            />
          )}

          {stage === AppStage.MASTER_CONTROL && data && (
            <MasterControl data={data} />
          )}

          {stage === AppStage.PERSONAL_INTRO && experienceData && (
            <>
              {isCreatorPreview && (
                <div className="fixed top-0 left-0 z-[300] w-full border-b border-luxury-gold/20 bg-[#1C1917] py-3 text-center text-luxury-gold shadow-lg">
                  <p className="animate-pulse text-[10px] font-bold uppercase tracking-[0.4em]">
                    Previewing Receiver Experience
                  </p>
                </div>
              )}
              <PersonalIntro
                recipientName={experienceData.recipientName}
                theme={experienceData.theme}
                isDemoMode={isDemoMode}
                onThemeChange={isDemoMode ? (t: Theme) => setData(prev => (prev ? { ...prev, theme: t } : prev)) : undefined}
                onComplete={() => {
                  safeSetStage(AppStage.QUESTION);
                }}
              />
            </>
          )}

          {stage === AppStage.QUESTION && experienceData && (
            <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
              {isCreatorPreview && (
                <div className="fixed top-0 left-0 z-[300] w-full border-b border-luxury-gold/20 bg-[#1C1917] py-3 text-center text-luxury-gold shadow-lg">
                  <p className="animate-pulse text-[10px] font-bold uppercase tracking-[0.4em]">
                    Previewing Receiver Experience
                  </p>
                </div>
              )}
              <InteractiveQuestion
                 data={experienceData}
                 onAccept={handleQuestionAccepted}
                 isPreview={isCreatorPreview}
                 onThemeChange={isCreatorPreview ? (t: Theme) => setData(prev => (prev ? { ...prev, theme: t } : prev)) : undefined}
              />
            </div>
          )}

          {stage === AppStage.SOULMATE_SYNC && experienceData && (
            <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
              <SoulmateSync 
                senderName={experienceData.senderName} 
                sessionId={experienceData.sessionId}
                onComplete={() => safeSetStage(AppStage.MAIN_EXPERIENCE)} 
              />
            </div>
          )}

          {stage === AppStage.MAIN_EXPERIENCE && experienceData && (
            <div className="animate-fade-in relative">
              {isDemoMode && (
                <>
                  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1C1917]/90 border border-[#D4AF37]/30 px-4 py-1.5 rounded-full">
                    <span className="text-[8px] uppercase tracking-[0.3em] text-[#D4AF37]/70 font-bold">Public Preview</span>
                  </div>
                  <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#1C1917] via-[#1C1917]/95 to-transparent pt-12 pb-6 px-6 text-center">
                    <button
                      onClick={() => { window.location.href = '/create'; }}
                      className="bg-[#722F37] hover:bg-[#5a1f27] text-white font-bold text-[10px] tracking-[0.4em] uppercase px-10 py-4 rounded-full shadow-2xl transition-all active:scale-[0.98] mb-3"
                    >
                      Create Your Own
                    </button>
                    <p className="text-[8px] uppercase tracking-[0.3em] text-[#D4AF37]/30 font-bold">This is a demonstration experience.</p>
                  </div>
                </>
              )}
              <ReceiverErrorBoundary>
                <MainExperience
                  data={experienceData}
                  isPreview={isCreatorPreview}
                  isDemoMode={isDemoMode}
                  onEdit={() => {
                    safeSetStage(AppStage.REFINE);
                    setIsCreatorPreview(false);
                  }}
                  onPayment={() => {
                    runOrPromptSignIn(() => safeSetStage(AppStage.PAYMENT));
                  }}
                  onSaveAndContinueLater={handleSaveAndContinueLater}
                  lastSaveSuccessAt={lastSaveSuccessAt}
                  lastSaveError={lastSaveError}
                  clearLastSaveError={clearLastSaveError}
                />
              </ReceiverErrorBoundary>
            </div>
          )}

          {stage === AppStage.PAYMENT && data && (
            <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
              <PaymentStage
                data={data}
                guestEmail={guestEmail ?? undefined}
                onPaymentComplete={(result: {
                  replyEnabled: boolean;
                  sessionKey: string;
                  shareSlug: string;
                  emailDelivered?: boolean;
                }) => {
                  updateData({ replyEnabled: result.replyEnabled, sealedAt: new Date().toISOString() });
                  setSessionKey(result.sessionKey);
                  setShareSlug(result.shareSlug);
                  setEmailDelivered(result.emailDelivered === true);
                  // PR #16: letter is finalized — drop the refresh-resilience
                  // draft so a fresh visit to /letter/create starts at PREPARE.
                  clearPreparationDraft();
                  safeSetStage(AppStage.SHARE);
                }}
                onBack={() => {
                  safeSetStage(AppStage.MAIN_EXPERIENCE); 
                  setIsCreatorPreview(true);
                }}
              />
            </div>
          )}

          {stage === AppStage.SHARE && data && sessionKey && shareSlug && (
            <div className="animate-fade-in flex items-center justify-center min-h-screen px-4">
              <SharePackage
                data={data}
                sessionKey={sessionKey}
                shareSlug={shareSlug}
                emailDelivered={emailDelivered}
                onPreview={() => {
                   // Post-share re-preview: routes into the canonical receiver
                   // experience (no banner / no theme dots, since
                   // isCreatorPreview=false matches the "see what they'll see"
                   // intent of this button).
                   safeSetStage(AppStage.PERSONAL_INTRO);
                   setIsCreatorPreview(false);
                }}
                onEdit={() => safeSetStage(AppStage.PREPARE)}
              />
            </div>
          )}
        </main>
      </Suspense>

      <style>{`
        @keyframes fade-in { 
          from { opacity: 0; transform: translateY(20px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-fade-in { animation: fade-in 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        
        @keyframes boot-mark {
          0%   { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-boot-mark { animation: boot-mark 600ms ease-out 0ms forwards; }

        @keyframes boot-sub {
          0%   { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-boot-sub { animation: boot-sub 600ms ease-out 100ms forwards; }

        @keyframes boot-anchor {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-boot-anchor { animation: boot-anchor 400ms ease-out 300ms forwards; }
      `}</style>

      {/* Dev Theme Switcher — only in preview mode */}
      {import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') && data && (
        <div className="fixed bottom-0 left-0 right-0 z-[500] bg-black/90 border-t border-white/10 px-4 py-3 flex items-center justify-center gap-3 backdrop-blur-sm">
          <span className="text-[8px] uppercase tracking-widest text-white/30 mr-2">Theme</span>
          {THEME_ORDER.map((t) => {
            const accent = THEME_SYSTEM[t].accent;
            const isActive = data.theme === t;
            return (
              <button
                key={t}
                onClick={() => {
                  updateData({ theme: t } as Partial<CoupleData>);
                  document.body.style.backgroundColor = THEME_BG_COLORS[t];
                }}
                className={`flex flex-col items-center gap-1 px-2 py-1 rounded transition-all ${isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
              >
                <div 
                  className="w-5 h-5 rounded-full border-2" 
                  style={{ 
                    backgroundColor: THEME_BG_COLORS[t], 
                    borderColor: isActive ? accent : 'transparent',
                    boxShadow: isActive ? `0 0 8px ${accent}40` : 'none',
                  }} 
                />
                <span className="text-[7px] uppercase tracking-wider text-white/50">{t}</span>
              </button>
            );
          })}
        </div>
      )}
      <Analytics />
      <SignInPromptModal
        isOpen={showSignInPrompt}
        onClose={cancelPendingAction}
        onContinueAsGuest={(email) => commitPendingAction(email)}
        onSignInSuccess={() => commitPendingAction()}
        variant={signInVariant}
      />
      {/* PR-48 Phase 4 — single exhaustive reconciliation render switch. */}
      {reconciliation.kind === 'stale_revision' && (
        <StaleRevisionModal
          isOpen={true}
          currentRevision={reconciliation.currentRevision}
          onReloadLatest={handleStaleRevisionReloadLatest}
          onKeepLocalForNow={handleStaleRevisionKeepLocalForNow}
          onCancel={handleStaleRevisionCancel}
        />
      )}
      {reconciliation.kind === 'begin_new' && (
        <BeginNewPromptModal
          isOpen={true}
          hasCloudActive={reconciliation.hasCloudActive}
          onSaveAndStartNew={handleBeginNewSaveAndStartNew}
          onDiscardAndStartNew={handleBeginNewDiscardAndStartNew}
          onCancel={handleBeginNewCancel}
        />
      )}
      {reconciliation.kind === 'sign_in_case_b' && (
        <SignInReconciliationModal
          isOpen={true}
          cloudDraft={{
            recipientName: reconciliation.cloudDraft.data.recipientName,
            draftState: reconciliation.cloudDraft.draftState,
            updatedAt: reconciliation.cloudDraft.updatedAt,
          }}
          localMetadata={{
            recipientName: reconciliation.localMetadata.recipientName,
            wordCount: reconciliation.localMetadata.wordCount,
            photoCount: reconciliation.localMetadata.photoCount,
            savedAt: reconciliation.localMetadata.savedAt,
          }}
          onContinueDashboardDraft={handleSignInContinueDashboardDraft}
          onDiscardLocalDraft={handleSignInDiscardLocalDraft}
        />
      )}
    </div>
  );
};

export default App;
