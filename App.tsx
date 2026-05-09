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

const EidPreparationForm = lazy(() =>
  import('./components/EidPreparationForm.tsx').then(m => ({ default: m.default }))
);
import { CoupleData, AppStage, Theme } from './types.ts';
import { useLinkLoader, LoaderState } from './hooks/useLinkLoader';
import { validateCoupleData } from './lib/coupleDataValidator.js';
import { writeDraftFromExternal, peekDraft, writeStage, clearPreparationDraft } from './hooks/usePreparationPersistence';
import { useDraftStateObserver } from './hooks/useDraftStateObserver';
import type { DraftState, PersistenceStatus } from './types/draft';
import { DRAFT_STATE_ORDER } from './types/draft';
import { UI_STAGE_TO_DRAFT_STATE } from './hooks/draftStateLogic';
import { getDemoData } from './data/demoData.ts';

import { THEME_ORDER, THEME_SYSTEM } from './theme/themeSystem';

const THEME_BG_COLORS: Record<Theme, string> = Object.fromEntries(
  THEME_ORDER.map((id) => [id, THEME_SYSTEM[id].surfaceSolid]),
) as Record<Theme, string>;

const STUDIO_BG_COLOR = THEME_SYSTEM.obsidian.boardSurface;


const STORAGE_KEY = 'vday_data';

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

const readPersistedCoupleData = (): CoupleData | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const result = validateCoupleData(parsed);
    if (!result.success) {
      console.warn('[Persistence] Discarding invalid CoupleData from storage');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return hydrateCoupleData(result.data);
  } catch (e) {
    console.error('[Persistence] Failed to read CoupleData from storage', e);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

// H6: optional onQuotaError callback. Mobile Safari's ~5-10 MB cap (and iOS's
// memory-pressure-driven storage clears) can throw QuotaExceededError on
// setItem. Without a user-visible signal the draft is silently lost on next
// page load. Caller passes a setter to surface a banner.
const writePersistedCoupleData = (value: CoupleData, onQuotaError?: () => void): void => {
  const hydrated = hydrateCoupleData(value);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
  } catch (e) {
    console.error('[Persistence] Failed to write CoupleData to storage', e);
    const isQuotaError = e instanceof DOMException && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014
    );
    if (isQuotaError && onQuotaError) onQuotaError();
  }
};

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

  // H6: surfaces when localStorage.setItem throws QuotaExceededError so the
  // user can save their work before refreshing. Dismissable; sticky for the
  // rest of the session because the underlying quota likely persists.
  const [storageError, setStorageError] = useState(false);

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
    // Hydrate data only when a valid post-PREPARE stage was restored — that
    // way RefineStage / PersonalIntro / etc. have something to render on the
    // very first paint instead of flashing blank until the resolver effect runs.
    // PREPARE-form data continues to flow through PreparationForm's own peek.
    if (getRouteType() !== 'LETTER_CREATE') return null;
    if (!initialDraft.data || !initialDraft.stage) return null;
    if (initialDraft.stage === AppStage.PREPARE) return null;
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
  const [, forceLocationUpdate] = useState(0);

  const previousStageRef = useRef<AppStage | null>(null);
  const demoSeededRef = useRef(false);

  // ── Sign-in prompt at Preview → Payment transition ──
  // PR #18b — `serverSessionReady` is the deterministic gate for
  // authenticated fetches. It flips true only AFTER /api/auth/session has
  // minted the cookie; gating the hydration effect on `authUser?.uid`
  // alone races onAuthStateChanged ahead of the cookie-set.
  const { user: authUser, serverSessionReady } = useAuth();
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
  const [draftRecord, setDraftRecord] = useState<{
    draftId: string | null;
    seedDraftState: DraftState | null;
  }>({ draftId: null, seedDraftState: null });

  // PR #18b — variant + onCancel are additive. Existing payment call sites
  // pass only `action` (variant defaults to 'payment', onCancel undefined),
  // preserving byte-identical UX. Persistence callers pass 'persistence' to
  // switch the modal copy/Guest-button visibility, and pass onCancel to be
  // notified when the user dismisses without signing in.
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

  const commitPendingAction = () => {
    setShowSignInPrompt(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    pendingCancelRef.current = null;
    if (action) action();
  };

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

      const payload: {
        draftId?: string;
        data: Partial<CoupleData> | CoupleData | Record<string, never>;
        step?: 1 | 2 | 3;
        draftState: DraftState;
        persistenceStatus: PersistenceStatus;
      } = {
        data: data ?? {},
        draftState: draftStateToSend,
        persistenceStatus: 'ACTIVE',
      };
      if (draftRecord.draftId) payload.draftId = draftRecord.draftId;
      if (step !== undefined) payload.step = step;

      try {
        const res = await fetch('/api/drafts/save', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // Mount guard — abort silently if the component unmounted mid-flight.
        if (!mountedRef.current) {
          saveInFlightRef.current = false;
          return;
        }

        if (!res.ok) {
          setLastSaveError("Couldn't save just now. Your work is still here.");
          saveInFlightRef.current = false;
          return;
        }

        const json = (await res.json()) as { ok?: boolean; draftId?: string; updatedAt?: number };

        if (!mountedRef.current) {
          saveInFlightRef.current = false;
          return;
        }

        if (!json?.ok || !json?.draftId) {
          setLastSaveError("Couldn't save just now. Your work is still here.");
          saveInFlightRef.current = false;
          return;
        }

        // DraftId identity invariant (Decision #14). If we already have a
        // draftId and the server returned a different one, refuse the swap.
        if (draftRecord.draftId && json.draftId !== draftRecord.draftId) {
          console.warn(
            `[18b] /save returned draftId=${json.draftId} but currentDraftId=${draftRecord.draftId}; refusing identity swap.`,
          );
          setLastSaveError("Couldn't save just now. Your work is still here.");
          saveInFlightRef.current = false;
          return;
        }

        // Success — update draftRecord atomically (single setter, both
        // fields together) so the observer's activation seeding sees the
        // matching values in the same render. seedDraftState carries the
        // state we just told the server about; the observer will treat
        // the next /transition for the same state as a noop (same_state).
        setDraftRecord({ draftId: json.draftId, seedDraftState: draftStateToSend });

        // PR #18b CP3.5 — set the settled-state anchor. No auto-dismiss
        // timer; the affordance now renders the receipt as long as the
        // session holds it. Re-saves refresh the timestamp; sign-out clears.
        setLastSaveError(null);
        setLastSaveSuccessAt(Date.now());

        saveInFlightRef.current = false;
      } catch {
        if (mountedRef.current) {
          setLastSaveError("Couldn't save just now. Your work is still here.");
        }
        // Do NOT clear draftRecord. Do NOT auto-retry. User retries by
        // clicking the action again.
        saveInFlightRef.current = false;
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
    const capturedUid = authUser?.uid;

    // Sign-out (or unauthenticated): clear EVERYTHING — draftRecord plus
    // the settled-state anchor (lastSaveSuccessAt) plus any pending error.
    // Without this, the link would still render "Saved {time}" after sign-
    // out, contradicting the affordance state.
    if (!capturedUid) {
      setDraftRecord({ draftId: null, seedDraftState: null });
      setLastSaveSuccessAt(null);
      setLastSaveError(null);
      return;
    }

    // Mid-sign-in window (cookie not yet established): clear draftRecord
    // only. lastSaveSuccessAt is null at this point anyway (no save can
    // succeed before sign-in completes), but preserve the slot to avoid
    // any future code path that might set it pre-session.
    if (!serverSessionReady) {
      setDraftRecord({ draftId: null, seedDraftState: null });
      return;
    }

    // Reset first so a previous user's draft never persists visibly during
    // the window between sign-in and /list resolution. Strict-mode double
    // invocation produces a benign double-clear; the cleanup discards the
    // first in-flight response.
    setDraftRecord({ draftId: null, seedDraftState: null });

    let cancelled = false;
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
        if (activeDrafts.length === 0) return;

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
          draftState?: DraftState;
          updatedAt?: number;
        };
        if (!oldest?.draftId || !oldest?.draftState) return;

        setDraftRecord({
          draftId: oldest.draftId,
          seedDraftState: oldest.draftState,
        });
        // PR #18b CP3.5 — seed lastSaveSuccessAt from the cloud's updatedAt
        // so the rehydrated session immediately renders the settled-state
        // anchor ("Saved {relative time}") instead of the action affordance.
        if (typeof oldest.updatedAt === 'number') {
          setLastSaveSuccessAt(oldest.updatedAt);
        }
      })
      .catch(() => {
        // Silent: background hydration must never surface a UI error.
        // draftRecord stays cleared; observer remains dormant.
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, serverSessionReady]);

  // PR #18b — Observer is LIVE. Activates when the user is signed in AND a
  // draftRecord has been hydrated (or just-saved in CP2). The hook's early
  // return on `!enabled || !draftId` keeps the anonymous case (and the brief
  // window during /list hydration) at zero work per render. The seedDraftState
  // pass-through prevents a duplicate /transition write on the activation
  // tick — without it, the observer would always fire for the current
  // UIStage on first activation because lastPersistedDraftStateRef starts null.
  useDraftStateObserver({
    uiStage: stage,
    draftId: draftRecord.draftId,
    enabled: !!authUser && !!draftRecord.draftId,
    seedDraftState: draftRecord.seedDraftState ?? undefined,
  });

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
    } else if (linkState === LoaderState.NO_LINK) {
      const persisted = readPersistedCoupleData();
      if (persisted) {
        setData(persisted);
      }
    } else if (linkState === LoaderState.ERROR) {
      console.error('Link loading error:', linkError);
    }

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
                onPaymentComplete={(result: { replyEnabled: boolean; sessionKey: string; shareSlug: string }) => {
                  updateData({ replyEnabled: result.replyEnabled, sealedAt: new Date().toISOString() });
                  setSessionKey(result.sessionKey);
                  setShareSlug(result.shareSlug);
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
      {/* H6: storage-quota banner — sticky, dismissable, single-instance per session. */}
      {storageError && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-900/95 text-amber-100 text-[10px] md:text-xs uppercase tracking-widest px-4 py-3 text-center shadow-lg">
          Browser storage is full. Save your letter to avoid losing it on refresh.
          <button
            onClick={() => setStorageError(false)}
            className="ml-3 underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

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
               <PreparationForm onComplete={(d) => { setData(hydrateCoupleData(d)); safeSetStage(AppStage.REFINE); }} />
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
                writePersistedCoupleData(updated, () => setStorageError(true));
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
                onPaymentComplete={(result: { replyEnabled: boolean; sessionKey: string; shareSlug: string }) => {
                  updateData({ replyEnabled: result.replyEnabled, sealedAt: new Date().toISOString() });
                  setSessionKey(result.sessionKey);
                  setShareSlug(result.shareSlug);
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
        onContinueAsGuest={commitPendingAction}
        onSignInSuccess={commitPendingAction}
        variant={signInVariant}
      />
    </div>
  );
};

export default App;
