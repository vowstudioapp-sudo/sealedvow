import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePreparationState } from '../hooks/usePreparationState';
import {
  usePreparationPersistence,
  peekDraft,
  getDraftMetadata,
  clearPreparationDraft,
} from '../hooks/usePreparationPersistence';
import { useMediaUploads } from '../hooks/useMediaUploads';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useDictation } from '../hooks/useDictation';
import { CoupleData, Occasion, GiftType, Theme, Coupon, RevealMethod, AppStage } from '../types.ts';
import { FEATURES } from '../config/features';
import DraftResumeModal from './DraftResumeModal';
import { consumeIntentionalEntry } from '../utils/intentionalEntry';
import { isWithinLastMinutes } from '../utils/relativeTime';
import { getActiveMode } from '../utils/activeMode';
import { saveAndContinue as cloudSaveAndContinue } from '../utils/cloudDraftSave';
import { UI_STAGE_TO_DRAFT_STATE } from '../hooks/draftStateLogic';

const SILENT_RESTORE_WINDOW_MINUTES = 10;

interface Props {
  onComplete: (data: CoupleData) => void;
  // PR-48 Phase 4 — optional cloud-aware Begin Again hook. When provided,
  // the resume modal's "Begin again" button delegates to the parent which
  // orchestrates cloud-side action (pause/discard) before clearing local.
  // The parent uses a remount key to force a clean PreparationForm instance
  // after clearing local; this component therefore does NOT call
  // clearPreparationDraft / resetPreparationState in that path.
  //
  // When omitted (legacy callers), the local-only fallback is preserved:
  // clearPreparationDraft + resetPreparationState run inline.
  onBeginAgainRequest?: () => void;

  // PR-49 C2 hotfix: authenticated-mode draft identity threading. Passed by
  // App.tsx from draftRecord.draftId so subsequent saves UPDATE the same
  // record rather than triggering ACTIVE_DRAFT_EXISTS on CREATE. The callback
  // fires after a successful server save with the authoritative draftId
  // (the server assigns one on first save; echoes it back on updates).
  // Guest mode does not use these props (passes neither; both are optional).
  cloudDraftId?: string | null;
  onCloudDraftSaved?: (draftId: string) => void;

  // PR-49 C2 hydration hotfix (LOCK-A): one-time mount seed for authenticated
  // mode. App.tsx passes cloud-hydrated data here when mode is 'authenticated'.
  // Guest mode leaves this undefined and the form continues to seed from
  // localStorage via peekDraft() — guest authority is unchanged.
  //
  // This is a ONE-TIME mount seed. No reactive sync, no prop→state listener.
  // After the mount-time hydration effect runs, PreparationForm is the sole
  // owner of PREPARE state.
  initialData?: Partial<CoupleData>;
}

// CORE OCCASIONS — V1: Anniversary + Unsaid only.
// 'just-because' internal ID retained for the Unsaid tile so the existing
// AI prompt contract (already calibrated to restrained-intimacy register)
// requires no rewrite and no historical-data migration.
const CORE_OCCASIONS: { id: Occasion; label: string; icon: string; defaultTone: string; hint: string }[] = [
  { id: 'anniversary',  label: 'Anniversary', icon: '🥂', hint: 'Celebrate your journey',                defaultTone: 'Nostalgic, proud, and enduring.' },
  { id: 'just-because', label: 'Unsaid',      icon: '✨', hint: 'For the words that have been waiting',  defaultTone: 'Restrained, intimate, finally-spoken. Like saying something that has been waiting to be said.' },
];

// FESTIVAL OCCASIONS — Removed as Eid now has dedicated flow via OccasionSelector
// Festivals are handled at the occasion selection screen level, not in this form

const MUSIC_PRESETS = [
  { id: 'piano', label: 'Eternal Piano (Satie)', url: 'https://archive.org/download/gymnopedie-no-1-by-kevin-macleod/Gymnopedie_No_1.mp3' },
  { id: 'cello', label: 'Deep Cello Suite', url: 'https://archive.org/download/BachCelloSuiteNo.1InGMajor/01-SuiteNo.1InGMajorBwv1007-IPrelude.mp3' },
  { id: 'ambient', label: 'Ethereal Silence', url: 'https://archive.org/download/N5280_Restoration/Restoration.mp3' }
];

const DEFAULT_COUPONS: Coupon[] = [
  { id: 'special', title: '', description: '', icon: '🕊️', isOpen: false, isSpecial: true },
  { id: '1', title: '', description: '', icon: '🥂', isOpen: false },
  { id: '2', title: '', description: '', icon: '🕯️', isOpen: false },
];

// Per-slot placeholder copy for the Three Promises form. Shown as ghost text
// in the empty title/description inputs. Senders see these as examples; if
// they leave both fields empty for a slot, the receiver-side gate (in
// MainExperience) hides that promise card entirely.
const PROMISE_PLACEHOLDERS: { title: string; description: string }[] = [
  { title: 'The Open Invitation', description: 'A quiet morning, or a long walk. Whenever you need me to just be there.' },
  { title: 'Dinner at Home', description: "I'll cook your favorite thing. No phones, just us." },
  { title: 'A Day for You', description: 'I take care of everything else. You just breathe.' },
];

const RITUALS: { id: RevealMethod; title: string; desc: string; icon: string }[] = [
  { id: 'immediate', title: 'Immediate Open', desc: 'Simple and direct. They can open the letter as soon as they receive it. No wait.', icon: '📬' },
  { id: 'remote', title: 'Remote Kiss', desc: 'You control the moment. Use your Master Key to unlock their letter instantly from your phone.', icon: '💋' },
  { id: 'vigil', title: 'Ambient Vigil', desc: 'Set a specific time. Their screen becomes a living countdown art piece until the moment arrives.', icon: '⏳' },
  { id: 'sync', title: 'Soulmate Sync', desc: 'Requires you both to be online. Unlocks only when you both touch your screens at the exact same time.', icon: '⚡' },
];

const ENABLED_RITUALS: RevealMethod[] = ['immediate'];
const ENABLE_VIDEO = false;

// V1: occasions removed from the active picker. Fresh URL navigation to
// /letter/create?occasion=<one-of-these> redirects to the OccasionSelector.
// Existing drafts saved with these occasion values continue to hydrate
// normally — the redirect is gated on draft absence (see shouldRedirectAway).
const REMOVED_OCCASIONS = new Set<string>(['birthday', 'apology', 'thank-you']);

export const PreparationForm: React.FC<Props> = ({
  onComplete,
  onBeginAgainRequest,
  cloudDraftId,
  onCloudDraftSaved,
  initialData,
}) => {
  const [error, setError] = useState<string | null>(null);

  // Read any saved draft once on mount, BEFORE state hook init.
  // useRef ensures the read runs exactly once (initializer fires only on
  // the first render); subsequent renders return the same captured peek.
  const initialDraftRef = useRef(peekDraft());

  // PR-49 C2 hydration hotfix (LOCK-A): one-time mount seed selector.
  // Authenticated mode passes hydrated cloud data via `initialData` —
  // takes precedence over the localStorage peek. Guest mode (and no-mode)
  // pass undefined, falling back to peekDraft() unchanged. useMemo with
  // empty deps locks this to a single read at first render; later prop
  // changes are intentionally ignored (LOCK-A: no reactive sync).
  const initialDataSource = useMemo<Partial<CoupleData> | null>(() => {
    if (initialData) return initialData;
    return initialDraftRef.current.data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PR #11 — Decide on mount whether to show the resume modal, silent-
  // restore, or start empty. Computed once via useMemo (empty deps).
  // consumeIntentionalEntry has a side effect (clears the sessionStorage
  // flag) — that's intentional, fires exactly once per mount.
  //
  // PR-49 C2 hydration hotfix: authenticated mode skips the resume modal
  // entirely. The Continue/Discard prompt at LandingPage already gates
  // resume vs. discard; by the time PreparationForm mounts for an
  // authenticated user, the choice was already made (Continue → mount
  // with cloud data; Discard → mount with empty data after DELETE).
  // Guest mode preserves the pre-PR-49 DraftResumeModal flow exactly.
  const initialDecision = useMemo(() => {
    if (initialData) {
      // Authenticated path: cloud data already chosen at LandingPage gate.
      return { mode: 'empty' as const };
    }
    const metadata = getDraftMetadata();
    if (!metadata) return { mode: 'empty' as const };
    if (!metadata.hasMeaningfulContent) {
      return { mode: 'silent-restore' as const, metadata };
    }
    if (consumeIntentionalEntry()) {
      return { mode: 'show-modal' as const, metadata };
    }
    if (isWithinLastMinutes(metadata.savedAt, SILENT_RESTORE_WINDOW_MINUTES)) {
      return { mode: 'silent-restore' as const, metadata };
    }
    return { mode: 'show-modal' as const, metadata };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showModal, setShowModal] = useState(initialDecision.mode === 'show-modal');
  const [hydrationDeferred, setHydrationDeferred] = useState(
    initialDecision.mode === 'show-modal',
  );

  // PR #23 — V1 narrowing: redirect fresh navigation to a removed-occasion
  // URL away from PreparationForm and onto the OccasionSelector.
  // Decided synchronously at mount so render returns null instead of
  // briefly flashing the form before the redirect lands.
  // Edge cases this protects against:
  //   - Old drafts with occasion='birthday' resume normally (gated on
  //     initialDecision.mode === 'empty' so a meaningful draft is never
  //     yanked out from under a returning user).
  //   - Redirect loops: replaceState (not pushState) means Back doesn't
  //     return to /letter/create?occasion=birthday and re-fire.
  //   - Hydration race: decision is sync-from-URL + sync-from-localStorage;
  //     no async dependencies. Fires once.
  const urlOccasionParam = useMemo(
    () => (typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('occasion')),
    [],
  );
  const shouldRedirectAway = useMemo(() => {
    if (!urlOccasionParam || !REMOVED_OCCASIONS.has(urlOccasionParam)) return false;
    // Resume case: don't yank a returning user away from their own draft.
    if (initialDecision.mode !== 'empty') return false;
    return true;
  }, [urlOccasionParam, initialDecision.mode]);
  useEffect(() => {
    if (!shouldRedirectAway) return;
    // replaceState matches the codebase SPA pattern (OccasionSelector.go)
    // and avoids adding /letter/create?occasion=birthday to the back-stack.
    window.history.replaceState({}, '', '/create');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [shouldRedirectAway]);

  const { step, data, updateData, next, back, resetPreparationState } = usePreparationState(
    DEFAULT_COUPONS,
    initialDraftRef.current.step ?? 1,
  );

  // PR-49 C2 (Task 4): mode is captured once at mount. Mode is bound at the
  // entry-point gate and CANNOT change mid-flow (invariant I2). Reading via
  // useState initializer guarantees a stable value across renders, which is
  // required for the conditional persistence-hook gate below (Rules of Hooks:
  // the hook is always called, but `enabled` toggles its effect).
  const [mode] = useState(() => getActiveMode());

  // Guest-mode autosave. Authenticated mode skips local persistence (cloud
  // is sole authority — invariant I4 / anti-pattern A2). The hook is always
  // invoked (Rules of Hooks); `enabled: false` makes the effect a no-op.
  usePreparationPersistence(data, step, { enabled: mode === 'guest' });

  const [stepSaveError, setStepSaveError] = useState<string | null>(null);
  const [isStepSaving, setIsStepSaving] = useState(false);

  // One-shot data hydration. Step is hydrated via usePreparationState's
  // initialStep arg above; this effect merges the text-safe field values
  // from the chosen seed source into form state on mount only.
  // PR #11 — gated on hydrationDeferred so the guest DraftResumeModal
  // flow can decide whether to apply hydration (Continue) or skip it
  // (Begin Again).
  // PR-49 C2 hydration hotfix (LOCK-A): seed source is initialDataSource
  // (cloud data for authenticated, peekDraft() for guest). One-time only.
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (hasHydratedRef.current) return;
    if (hydrationDeferred) return;
    if (initialDataSource) {
      updateData(initialDataSource);
    }
    hasHydratedRef.current = true;
  }, [updateData, hydrationDeferred, initialDataSource]);

  // PR #11 modal handlers.
  const handleContinue = () => {
    setShowModal(false);
    setHydrationDeferred(false); // gated effect now fires + applies saved data
  };

  const handleBeginAgain = () => {
    // PR-48 Phase 4: if the parent (App.tsx) provided onBeginAgainRequest,
    // delegate the cloud-aware Begin New orchestration to it. The parent
    // will open BeginNewPromptModal (or short-circuit on trivial Begin
    // Again), perform any required cloud-side action (pause/discard),
    // clear local, and force-remount this component via a key change.
    // We close the resume modal so the user sees the parent's reconciliation
    // modal layer cleanly.
    setShowModal(false);
    if (onBeginAgainRequest) {
      onBeginAgainRequest();
      return;
    }

    // Legacy local-only fallback. Preserves pre-Phase-4 behavior for any
    // future caller that doesn't wire onBeginAgainRequest. Order matters:
    // 1. Clear localStorage FIRST so persistence's auto-save can't pick
    //    up reset state and re-write stale fields.
    // 2. Reset in-memory state.
    // 3. Mark hydration complete so the gated effect doesn't re-apply
    //    the stale hydratedData (still in scope from peekDraft).
    // 4. Close modal (already done above).
    clearPreparationDraft();
    resetPreparationState();
    hasHydratedRef.current = true;
    setHydrationDeferred(false);
  };

  // iOS keyboard cover fix — scroll focused textarea into view after
  // keyboard finishes animating (~250ms). 'instant' (default) avoids
  // smooth-scroll/keyboard-animation double-jump.
  const handleTextareaFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setTimeout(() => {
      target.scrollIntoView({ block: 'center' });
    }, 300);
  };

  // Read occasion from URL parameter and pre-fill on mount.
  // PR #23 — Skipped when shouldRedirectAway is true; the redirect effect
  // above swaps routes to the OccasionSelector and this prefill becomes
  // moot (the form unmounts immediately).
  useEffect(() => {
    if (shouldRedirectAway) return;
    const urlParams = new URLSearchParams(window.location.search);
    const occasionParam = urlParams.get('occasion') as Occasion | null;

    if (occasionParam) {
      const occasionConfig = CORE_OCCASIONS.find(o => o.id === occasionParam);
      updateData({
        occasion: occasionParam,
        relationshipIntent: occasionConfig ? occasionConfig.defaultTone : data.relationshipIntent,
      });
    }
  }, [shouldRedirectAway]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const media = useMediaUploads({
    sessionId: data.sessionId,
    currentMemoryCount: () => data.memoryBoard?.length || 0,
    updateData,
    onError: setError,
  });
  
  const audio = useAudioRecorder({
    sessionId: data.sessionId,
    updateData,
    onError: setError,
  });
  
  const dictation = useDictation({
    onTranscript: (text) => {
      updateData(prev => ({
        finalLetter: (prev.finalLetter || '') + ' ' + text
      }));
    },
    onError: setError,
  });
  const [writingMode, setWritingMode] = useState<'self' | 'assisted'>('assisted');
  
  const [showLocationFields, setShowLocationFields] = useState(false);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const [phase, setPhase] = useState(1);
  const [phaseDirection, setPhaseDirection] = useState<1 | -1>(1);

  const phaseVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 160 : -160,
      opacity: 0,
      filter: 'blur(8px)',
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: 'blur(0px)',
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -160 : 160,
      opacity: 0,
      filter: 'blur(8px)',
      scale: 0.98,
    }),
  };

  const goNextPhase = () => {
    setPhaseDirection(1);
    setPhase(p => p + 1);
  };

  const goBackPhase = () => {
    setPhaseDirection(-1);
    setPhase(p => p - 1);
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const memoryInputRef = useRef<HTMLInputElement>(null);

  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activePhoto !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [activePhoto]);


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    media.uploadCoverImage(file);
  };

  const handleMemoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    media.uploadMemoryBoard(files);
  };

  const updateMemoryCaption = (index: number, caption: string) => {
    updateData(prev => ({
      memoryBoard: prev.memoryBoard
        ? prev.memoryBoard.map((photo, i) =>
            i === index ? { ...photo, caption } : photo
          )
        : []
    }));
  };

  const removeMemoryPhoto = (index: number) => {
    updateData(prev => ({
      memoryBoard: prev.memoryBoard?.filter((_, i) => i !== index) || []
    }));
  };

  const togglePreview = () => {
    if (!data.audio?.url) return;

    if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio(data.audio.url);
        previewAudioRef.current.onended = () => setIsPreviewPlaying(false);
    } else if (previewAudioRef.current.src !== data.audio.url) {
         previewAudioRef.current.src = data.audio.url;
    }

    if (isPreviewPlaying) {
        previewAudioRef.current.pause();
        setIsPreviewPlaying(false);
    } else {
        previewAudioRef.current.play().catch(e => console.error("Playback failed", e));
        setIsPreviewPlaying(true);
    }
  };

  const handleDeleteRecording = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
    audio.deleteRecording();
  };

  const updateCoupon = (index: number, field: keyof Coupon, value: string) => {
    updateData(prev => ({
      coupons: prev.coupons?.map((coupon, i) =>
        i === index ? { ...coupon, [field]: value } : coupon
      ) ?? []
    }));
  };

  // PR-49 C2 (Task 4) + C2 hotfix: mode-aware step advance. Guest mode
  // advances locally (autosave persists in the background). Authenticated
  // mode performs an explicit cloud save first and only advances on success.
  //
  // C2 hotfix: cloudDraftId is threaded through every save so subsequent
  // calls UPDATE the same record. Without this, the server returns 409
  // ACTIVE_DRAFT_EXISTS on the second save attempt. On success, the
  // server's authoritative draftId is reported back via onCloudDraftSaved
  // so App.tsx's draftRecord stays in sync for downstream stages.
  //
  // On 401: hard redirect to "/" (OQ3). On other errors: inline message;
  // stay on the current step.
  const advanceStepAuthenticated = async (
    onAdvance: () => void,
    isFinal: boolean,
  ) => {
    if (isStepSaving) return;
    setIsStepSaving(true);
    setStepSaveError(null);
    try {
      const draftState = UI_STAGE_TO_DRAFT_STATE[AppStage.PREPARE] ?? 'IN_PROGRESS';
      const result = await cloudSaveAndContinue({
        data: { ...data, writingMode },
        draftState,
        draftId: cloudDraftId ?? null,
      });
      if (result.kind === 'auth_required') {
        window.location.href = '/';
        return;
      }
      if (result.kind === 'error') {
        setStepSaveError(result.message);
        return;
      }
      // ok — propagate authoritative draftId upward so App.tsx tracks identity.
      if (onCloudDraftSaved) onCloudDraftSaved(result.draftId);
      if (isFinal) {
        if (previewAudioRef.current) previewAudioRef.current.pause();
        onComplete({ ...data, writingMode });
      } else {
        onAdvance();
      }
    } finally {
      setIsStepSaving(false);
    }
  };

  // PR-49 C2 (Task 4): wrapper for the two Step-2 "Continue" buttons that
  // bypass form submit (the desktop side-button and the mobile step-2 next
  // button). Same mode-aware semantics as handleSubmit.
  const handleNextStepFromStep2 = () => {
    if (mode === 'authenticated') {
      void advanceStepAuthenticated(
        () => { next(); setPhase(1); },
        false,
      );
      return;
    }
    next();
    setPhase(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isFinal = step === 3;

    if (mode === 'authenticated') {
      void advanceStepAuthenticated(
        () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          next();
        },
        isFinal,
      );
      return;
    }

    if (!isFinal) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      next();
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      onComplete({ ...data, writingMode });
    }
  };

  // PR #23 — When redirecting a fresh removed-occasion URL, render nothing
  // so the OccasionSelector mount is the only visible state. Eliminates the
  // form-skeleton flash that an unguarded effect-based redirect would cause.
  if (shouldRedirectAway) return null;

  return (
    <>
      {showModal && initialDecision.mode === 'show-modal' && (
        <DraftResumeModal
          metadata={initialDecision.metadata}
          onContinue={handleContinue}
          onBeginAgain={handleBeginAgain}
        />
      )}
    <div className={`mx-auto ${(step as number) === 2 ? 'max-w-5xl p-4 mt-2 mb-4' : 'max-w-3xl p-4 md:p-12 mt-4 mb-32'}`}>
      <div className={`text-center animate-fade-in ${(step as number) === 2 ? 'mb-2' : 'mb-16'}`}>
        {step !== 2 && (
          <h2 className="text-[10px] md:text-xs uppercase tracking-[0.5em] text-luxury-gold/90 font-bold mb-4 text-center w-full">VOW STUDIO</h2>
        )}
        
        <div className={`flex flex-col items-center justify-center space-y-4 ${(step as number) === 2 ? "" : "min-h-[100px]"}`}>
            {step > 1 && step !== 2 && (
                <div className="animate-fade-in text-[9px] uppercase tracking-[0.2em] text-green-400/80 font-bold mb-1 flex items-center gap-2">
                    <span>✓</span>
                    <span>{(step as number) === 2 ? "The foundation is complete" : "The narrative is complete"}</span>
                </div>
            )}

            {step !== 2 && (
              <h1 className="text-3xl md:text-5xl font-serif-elegant italic text-[#E5D0A1] leading-tight animate-fade-in" key={step}>
                {step === 1 && "You are shaping the foundation"}
                {(step as number) === 2 && "You are crafting the narrative"}
                {step === 3 && "You are shaping the final experience"}
              </h1>
            )}

            <div className="flex items-center gap-4 mt-2">
                <div className={`h-px bg-luxury-gold/30 transition-all duration-700 ${step >= 1 ? 'w-8 opacity-100' : 'w-2 opacity-30'}`}></div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-luxury-gold/60 font-bold">
                    Step {step} of 3
                </p>
                <div className={`h-px bg-luxury-gold/30 transition-all duration-700 ${step >= 1 ? 'w-8 opacity-100' : 'w-2 opacity-30'}`}></div>
            </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={`relative ${(step as number) === 2 ? "space-y-0" : "space-y-12"}`}>

        {error && (
          <div className="mx-auto max-w-md p-4 bg-[#2B0A0A]/80 border border-red-400/30 text-red-200 text-[11px] tracking-wide rounded-lg text-center backdrop-blur-sm"
               onClick={() => setError(null)}>
            {error}
            <span className="block text-[9px] text-red-300/50 mt-1 uppercase tracking-widest">Tap to dismiss</span>
          </div>
        )}
        
        {/* STEP 1: THE FOUNDATION */}
        {step === 1 && (
          <div className="animate-fade-in space-y-12">
            <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border border-[#C5B498] p-8 md:p-16 rounded-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative">
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper.png')] rounded-xl"></div>
              <div className="relative z-10 space-y-12">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                  <div className="space-y-4 group">
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Recipient's Name</label>
                    <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. My Wife / Boyfriend / Partner" value={data.recipientName} onChange={e => updateData({ recipientName: e.target.value })} required />
                  </div>
                  <div className="space-y-4 group">
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Your Name</label>
                    <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="Your Name" value={data.senderName} onChange={e => updateData({ senderName: e.target.value })} required />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* STEP 2: CINEMATIC PHASES */}
        {(step as number) === 2 && (
          <div className="relative">

            {/* ═══ Desktop Side Buttons — absolute, beside the card ═══ */}
            <button
              type="button"
              onClick={phase > 1 ? goBackPhase : back}
              className="hidden lg:block absolute -left-36 top-1/2 -translate-y-1/2 px-6 py-3 rounded-full bg-luxury-bronze text-white hover:bg-luxury-ink transition-all duration-300 text-[10px] uppercase tracking-[0.2em] font-bold whitespace-nowrap shadow-lg"
            >
              ← Back
            </button>
            {phase < 3 ? (
              <button
                type="button"
                onClick={goNextPhase}
                className="hidden lg:block absolute -right-36 top-1/2 -translate-y-1/2 px-6 py-3 rounded-full bg-luxury-wine text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#3D1F1F] transition-all duration-300 shadow-lg hover:shadow-xl whitespace-nowrap"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextStepFromStep2}
                disabled={isStepSaving}
                className="hidden lg:block absolute -right-36 top-1/2 -translate-y-1/2 px-6 py-3 rounded-full bg-luxury-wine text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#3D1F1F] transition-all duration-300 shadow-lg whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {mode === 'authenticated'
                  ? (isStepSaving ? 'Saving…' : 'Save and Continue →')
                  : 'Continue →'}
              </button>
            )}

            {/* ═══ ANIMATED PHASE CONTENT ═══ */}
            <AnimatePresence mode="wait" custom={phaseDirection}>
              <motion.div
                key={phase}
                custom={phaseDirection}
                variants={phaseVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: 0.55,
                  ease: [0.65, 0, 0.35, 1],
                }}
                className="w-full"
              >

                {/* ═══ PHASE 1: SET THE ATMOSPHERE ═══ */}
                {phase === 1 && (
                  <>
                <div className="text-center pt-2 pb-4">
                  <p className="text-[9px] uppercase tracking-[0.5em] font-bold" style={{ color: '#C5A55A' }}>Phase One</p>
                  <h3 className="font-serif-elegant italic text-2xl text-luxury-stone mt-2">Set the atmosphere.</h3>
                </div>

                <div className="flex items-center justify-center py-6">
                  <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border border-[#C5B498] p-8 md:p-12 rounded-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative max-w-3xl w-full mx-4">
                    <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper.png')] rounded-xl"></div>
                    <div className="relative z-10 flex flex-col items-center space-y-10">
                      
                      {/* Cover Image */}
                      <div className="flex flex-col items-center space-y-6 w-full pb-10 border-b border-luxury-ink/20">
                        <label className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-stone/90 text-center">
                          The Cover Image (Optional)
                          <span className="block text-[11px] text-luxury-ink/75 mt-2 font-normal normal-case tracking-normal max-w-sm mx-auto leading-relaxed">
                            This single photo will be the <strong>main cinematic background</strong> for the letter itself.
                          </span>
                        </label>
                        <div onClick={() => !media.isUploadingImage && fileInputRef.current?.click()} className={`relative w-28 h-28 md:w-36 md:h-36 rounded-full bg-[#D6CDB8] border-2 border-luxury-ink/20 flex items-center justify-center overflow-hidden group hover:border-luxury-gold-dark/60 transition-all shadow-inner ${media.isUploadingImage ? 'cursor-wait' : 'cursor-pointer'}`}>
                          {media.isUploadingImage ? (
                            <div className="text-center p-6 space-y-3">
                              <div className="w-10 h-10 mx-auto border-2 border-luxury-ink/20 border-t-luxury-gold-dark rounded-full animate-spin" />
                              <span className="text-[9px] uppercase tracking-[0.2em] text-luxury-ink/60 block font-bold">{media.uploadProgress}%</span>
                              <div className="w-16 h-1 bg-luxury-ink/10 rounded-full mx-auto overflow-hidden">
                                <div className="h-full bg-luxury-gold-dark rounded-full transition-all duration-300" style={{ width: `${media.uploadProgress}%` }} />
                              </div>
                            </div>
                          ) : data.userImageUrl ? (
                            <img src={data.userImageUrl} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-1000" alt="Preview" />
                          ) : (
                            <div className="text-center p-6 space-y-2">
                              <span className="text-luxury-ink/60 text-3xl block transition-transform group-hover:scale-110">📷</span>
                              <span className="text-[10px] uppercase tracking-[0.2em] text-luxury-ink/80 block font-bold group-hover:text-luxury-wine transition-colors">ADD</span>
                            </div>
                          )}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                        <p className="text-[11px] text-luxury-ink/65 mt-2 text-center leading-relaxed font-medium">
                          🔒 Your images are stored securely and are only accessible through your private link.
                        </p>
                      </div>

                      {/* Memory Board */}
                      <div className="w-full space-y-6">
                        <div className="text-center">
                          <label className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-stone/90 mb-2 block">
                            The Memory Board (Optional)
                          </label>
                          <p className="text-[10px] uppercase tracking-widest text-luxury-ink/70 mb-4 font-bold max-w-sm mx-auto">
                            Upload up to 10 photos for a scattered polaroid collage.
                          </p>
                          <p className="text-xs italic text-luxury-ink/75 max-w-sm mx-auto leading-relaxed font-serif-elegant">
                            A single caption can make a photo unforgettable.
                          </p>
                        </div>
                        
                        <div className="flex flex-col items-center">
                          <button 
                            type="button"
                            onClick={() => memoryInputRef.current?.click()}
                            disabled={media.isUploadingMemories || (data.memoryBoard?.length || 0) >= 10}
                            className={`px-8 py-3 border-2 border-luxury-ink/40 text-luxury-ink text-[10px] uppercase tracking-widest font-bold rounded-full hover:bg-luxury-ink/10 transition-all ${media.isUploadingMemories ? 'opacity-60 cursor-wait' : ''}`}
                          >
                            {media.isUploadingMemories ? (
                              <span className="flex flex-col items-center gap-1">
                                <span>Uploading... {media.uploadProgress}%</span>
                                <span className="w-24 h-1 bg-luxury-ink/10 rounded-full overflow-hidden inline-block">
                                  <span className="block h-full bg-luxury-gold-dark rounded-full transition-all duration-300" style={{ width: `${media.uploadProgress}%` }} />
                                </span>
                              </span>
                            ) : 'Add Polaroids'}
                          </button>
                          <input 
                            type="file" 
                            ref={memoryInputRef} 
                            onChange={handleMemoryUpload} 
                            accept="image/*" 
                            multiple 
                            className="hidden" 
                          />
                          <p className="text-[10px] mt-3 text-luxury-stone/80 uppercase tracking-widest font-bold">
                            {(data.memoryBoard?.length || 0)} / 10 Uploaded
                          </p>
                        </div>

                        {data.memoryBoard && data.memoryBoard.length > 0 && (
                          <div className="relative w-full mt-4" style={{ minHeight: `${Math.ceil((data.memoryBoard.length) / 2) * 180 + 60}px` }}>
                            {activePhoto !== null && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90]"
                                onClick={() => setActivePhoto(null)}
                              />
                            )}
                            {data.memoryBoard.map((photo, idx) => {
                              const col = idx % 2;
                              const row = Math.floor(idx / 2);
                              const baseX = col * 52;
                              const baseY = row * 180;
                              const isActive = activePhoto === idx;
                              return (
                                <motion.div
                                  key={`${photo.url}-${idx}`}
                                  drag={!isActive}
                                  dragMomentum={false}
                                  dragElastic={0.15}
                                  initial={false}
                                  animate={{
                                    scale: isActive ? 1.6 : 1,
                                    rotate: isActive ? 0 : photo.angle,
                                    zIndex: isActive ? 100 : idx + 1,
                                  }}
                                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                                  onTap={() => setActivePhoto(isActive ? null : idx)}
                                  className={`absolute group touch-none ${isActive ? 'cursor-zoom-out' : 'cursor-grab active:cursor-grabbing'}`}
                                  style={{
                                    left: `${baseX + photo.xOffset * 0.15}%`,
                                    top: `${baseY + photo.yOffset}px`,
                                    width: '44%',
                                  }}
                                >
                                  <div className={`bg-white p-2 pb-6 border border-black/5 relative transition-shadow duration-300 ${isActive ? 'shadow-[0_12px_40px_rgba(0,0,0,0.35)]' : 'shadow-[0_4px_20px_rgba(0,0,0,0.15)]'}`}>
                                    {!isActive && (
                                      <button 
                                        type="button" 
                                        onClick={(e) => { e.stopPropagation(); removeMemoryPhoto(idx); }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-luxury-wine text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                                      >
                                        ✕
                                      </button>
                                    )}
                                    <div className="aspect-square overflow-hidden bg-gray-100 mb-2" onPointerDown={(e) => { if (isActive) e.stopPropagation(); }}>
                                      <img src={photo.url} className="w-full h-full object-cover pointer-events-none select-none" alt="Memory" draggable={false} />
                                    </div>
                                    <input 
                                      type="text" 
                                      placeholder="caption..."
                                      value={photo.caption}
                                      onChange={e => updateMemoryCaption(idx, e.target.value)}
                                      onPointerDown={(e) => e.stopPropagation()}
                                      className="w-full bg-transparent border-b border-transparent hover:border-luxury-ink/20 text-center text-[16px] font-romantic text-luxury-ink outline-none focus:border-luxury-gold transition-colors pb-1 placeholder-luxury-ink/30"
                                      maxLength={25}
                                    />
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* ═══ PHASE 2: SHAPE THE STORY ═══ */}
                {phase === 2 && (
                  <>
                <div className="text-center pt-2 pb-4">
                  <p className="text-[9px] uppercase tracking-[0.5em] font-bold" style={{ color: '#C5A55A' }}>Phase Two</p>
                  <h3 className="font-serif-elegant italic text-2xl text-luxury-stone mt-2">Shape the story.</h3>
                </div>

                <div className="flex items-center justify-center py-6">
                  <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border border-[#C5B498] p-8 md:p-12 rounded-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative max-w-2xl w-full mx-4">
                    <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper.png')] rounded-xl"></div>
                    <div className="relative z-10 space-y-10">
                      
                      <div className="space-y-3 group">
                        <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">How long together?</label>
                        <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. 10 years, or just a few months" value={data.timeShared} onChange={e => updateData({ timeShared: e.target.value })} required />
                      </div>

                      <div className="space-y-3 group">
                        <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Key Memory to Mention</label>
                        <p className="text-xs italic text-luxury-ink/75 mb-2 font-serif-elegant">This memory becomes the thread running through your letter.</p>
                        <textarea className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic h-24 resize-none leading-relaxed text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. When we got lost in Tokyo, or just drinking coffee this morning..." value={data.sharedMoment} onChange={e => updateData({ sharedMoment: e.target.value })} onFocus={handleTextareaFocus} required />
                      </div>

                      {!showLocationFields ? (
                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={() => setShowLocationFields(true)}
                            className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-luxury-stone/60 hover:text-luxury-ink transition-colors font-bold border-b border-transparent hover:border-luxury-ink/30 pb-1"
                          >
                            + Want to anchor this to a specific place?
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6 group animate-fade-in bg-luxury-ink/5 p-6 rounded-lg border border-luxury-ink/10 relative">
                          <button 
                            type="button" 
                            onClick={() => setShowLocationFields(false)}
                            className="absolute top-4 right-4 text-luxury-stone/40 hover:text-luxury-wine transition-colors font-bold text-xs"
                          >
                            ✕
                          </button>
                          <div>
                            <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Your Sacred Place</label>
                            <input type="text" className="w-full bg-white/50 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. The exact spot we met, or the Eiffel Tower" value={data.locationMemory} onChange={e => updateData({ locationMemory: e.target.value })} />
                            <p className="text-[11px] text-luxury-ink/70 italic text-right mt-1 font-medium">Featured within the letter — tap to view it on a full-screen map.</p>
                          </div>
                          <div>
                            <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 group-focus-within:text-luxury-ink transition-colors">Google Maps Link (Optional)</label>
                            <input 
                              type="text" 
                              className="w-full bg-white/50 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all text-xs text-luxury-ink placeholder-luxury-ink/50" 
                              placeholder="Paste a direct Google Maps link for 100% accuracy..." 
                              value={data.manualMapLink || ''} 
                              onChange={e => updateData({ manualMapLink: e.target.value })} 
                            />
                            <p className="text-[11px] text-luxury-ink/70 italic text-right mt-1 font-medium">If provided, we will use this exact location instead of searching.</p>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* ═══ PHASE 3: WRITE THE HEART ═══ */}
                {phase === 3 && (
                  <>
                <div className="text-center pt-2 pb-4">
                  <p className="text-[9px] uppercase tracking-[0.5em] font-bold" style={{ color: '#C5A55A' }}>Phase Three</p>
                  <h3 className="font-serif-elegant italic text-2xl text-luxury-stone mt-2">Write the heart.</h3>
                </div>

                <div className="flex items-center justify-center py-6">
                  <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border border-[#C5B498] p-8 md:p-12 rounded-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative max-w-2xl w-full mx-4">
                    <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper.png')] rounded-xl"></div>
                    <div className="relative z-10 space-y-8">
                      
                      <div className="flex flex-col md:flex-row justify-center gap-4">
                        <button type="button" onClick={() => setWritingMode('assisted')} className={`flex-1 py-4 px-4 rounded-xl text-center transition-all duration-300 border-2 ${writingMode === 'assisted' ? 'bg-[#D6CDB8] border-luxury-gold-dark/60 text-luxury-wine shadow-inner' : 'bg-transparent border-luxury-ink/30 text-luxury-ink/80 hover:bg-[#D6CDB8]/50'}`}>
                          <span className="block text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Assisted</span>
                          <span className="block font-serif-elegant italic text-base">Help me write it</span>
                        </button>
                        <button type="button" onClick={() => setWritingMode('self')} className={`flex-1 py-4 px-4 rounded-xl text-center transition-all duration-300 border-2 ${writingMode === 'self' ? 'border-luxury-ink text-luxury-ink bg-[#D6CDB8]' : 'border-luxury-ink/30 text-luxury-ink/80 hover:border-luxury-ink/70 hover:bg-[#D6CDB8]/50'}`}>
                          <span className="block text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Manual</span>
                          <span className="block font-serif-elegant italic text-base">I'll write it myself</span>
                        </button>
                      </div>
                      
                      {writingMode === 'self' ? (
                        <div className="animate-fade-in space-y-4 relative group">
                          <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80">Your Letter</label>
                          <p className="text-[9px] italic text-luxury-ink/60 mb-2 font-serif-elegant">The heart of the experience — revealed one paragraph at a time.</p>
                          <div className="relative">
                            <textarea 
                              className="w-full bg-luxury-ink/5 border-l-4 border-luxury-ink/30 pl-6 py-4 pr-12 focus:border-luxury-gold-dark outline-none transition-all font-serif-elegant text-xl italic h-40 resize-none leading-relaxed text-luxury-ink placeholder-luxury-ink/50" 
                              placeholder="Write from the heart..." 
                              value={data.finalLetter} 
                              onChange={e => updateData({ finalLetter: e.target.value })} 
                              required 
                            />
                            {dictation.isSupported && (
                              <>
                                <button 
                                  type="button"
                                  onClick={dictation.isDictating ? dictation.stopDictation : dictation.startDictation}
                                  className={`absolute top-4 right-4 p-2 rounded-full transition-all ${dictation.isDictating ? 'text-red-500 animate-pulse bg-red-100' : 'text-luxury-ink/50 hover:text-luxury-gold hover:bg-luxury-ink/10'}`}
                                  title="Dictate Letter"
                                >
                                  <span className="text-xl">🎙️</span>
                                </button>
                                {dictation.isDictating && <p className="text-[10px] font-bold text-red-500 italic text-right mt-1">Listening... Speak clearly.</p>}
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="animate-fade-in space-y-6">
                          <div className="space-y-4">
                            <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80">Your Words</label>
                            <p className="text-xs text-luxury-ink/70 leading-relaxed -mt-2">Write a few lines in your own words. Don't worry about grammar or structure. Just say what you feel.</p>
                            <textarea
                              className="w-full bg-luxury-ink/5 border-l-4 border-luxury-ink/30 pl-6 py-4 pr-4 focus:border-luxury-gold-dark outline-none transition-all font-serif-elegant text-lg italic h-32 resize-none leading-relaxed text-luxury-ink placeholder-luxury-ink/40"
                              placeholder="I just want to say that... the way you... I feel like..."
                              value={data.senderRawThoughts || ''}
                              onChange={e => updateData({ senderRawThoughts: e.target.value })}
                              onFocus={handleTextareaFocus}
                            />
                            <p className="text-[9px] text-luxury-ink/60 text-right">{(data.senderRawThoughts || '').split(/\s+/).filter(Boolean).length} words</p>
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80">Relationship Tone</label>
                            <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 rounded-t focus:border-luxury-ink outline-none transition-all font-serif-elegant text-xl italic text-luxury-ink placeholder-luxury-ink/50" placeholder="e.g. Deeply romantic, playful, grateful, apologetic..." value={data.relationshipIntent} onChange={e => updateData({ relationshipIntent: e.target.value })} required />
                          </div>
                        </div>
                      )}

                      <div className="animate-fade-in pt-6 border-t border-luxury-ink/20">
                        <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80 mb-4 block">Vocal Vow (Optional)</label>
                        <div className="bg-luxury-ink/5 rounded-xl p-6 flex flex-col items-center justify-center border-2 border-luxury-ink/20">
                          {!data.audio?.url ? (
                            <>
                              <button 
                                type="button"
                                onClick={audio.isRecording ? audio.stopRecording : audio.startRecording}
                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${audio.isRecording ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] scale-110' : 'bg-luxury-ink text-white hover:bg-luxury-gold'}`}
                              >
                                {audio.isRecording ? (
                                  <div className="w-6 h-6 bg-white rounded-sm"></div>
                                ) : (
                                  <span className="text-2xl">●</span>
                                )}
                              </button>
                              <p className="mt-3 text-[10px] uppercase tracking-widest text-luxury-ink/70 font-bold">
                                {audio.isRecording ? `Recording... ${audio.formatTime(audio.recordingTime)}` : 'Tap to Record Voice Note'}
                              </p>
                              {!audio.isRecording && (
                                <div className="mt-3 text-center max-w-sm mx-auto">
                                  <p className="text-xs font-serif-elegant italic text-luxury-ink/75">
                                    "Even a few seconds in your real voice can mean more than perfect words."
                                  </p>
                                  <p className="text-[10px] uppercase tracking-wider text-luxury-ink/65 mt-2 font-bold">
                                    Optional — you can skip this
                                  </p>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-full flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <button 
                                  type="button"
                                  onClick={togglePreview}
                                  className="w-12 h-12 rounded-full bg-luxury-gold text-white flex items-center justify-center hover:bg-luxury-gold-dark transition-colors text-xl"
                                >
                                  {isPreviewPlaying ? <span>⏸</span> : <span>▶</span>}
                                </button>
                                <div>
                                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-luxury-ink">Voice Note Recorded</p>
                                  <p className="text-[10px] font-bold text-luxury-ink/60">
                                    {isPreviewPlaying ? 'Playing...' : 'Ready to include in package.'}
                                  </p>
                                </div>
                              </div>
                              <button 
                                type="button" 
                                onClick={handleDeleteRecording}
                                className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 border-b-2 border-red-300"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                  </>
                )}

              </motion.div>
            </AnimatePresence>

            {/* ═══ MOBILE BOTTOM NAVIGATION ═══ */}
            <div className="lg:hidden flex justify-between items-center px-2 py-4 mt-4">
              <button
                type="button"
                onClick={phase > 1 ? goBackPhase : back}
                className="px-8 py-3 rounded-full bg-luxury-bronze text-white hover:bg-luxury-ink transition-all text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold shadow-lg"
              >
                ← Back
              </button>
              
              {phase < 3 ? (
                <button
                  type="button"
                  onClick={goNextPhase}
                  className="px-8 py-3 rounded-full bg-luxury-wine text-white text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] hover:bg-[#3D1F1F] transition-all shadow-lg"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextStepFromStep2}
                  disabled={isStepSaving}
                  className="px-10 py-4 bg-luxury-wine text-white font-bold rounded-full shadow-2xl hover:bg-[#3D1F1F] transition-all uppercase tracking-[0.3em] text-[10px] md:text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {mode === 'authenticated'
                    ? (isStepSaving ? 'Saving…' : 'Save and Continue')
                    : 'Continue'}
                </button>
              )}
            </div>

          </div>
        )}
        
        {step === 3 && (
          <div className="animate-fade-in space-y-8">
            
            {FEATURES.ritualsEnabled && (
              <div className="bg-[#1C1917] border-2 border-[#3D3530] p-8 md:p-10 rounded-xl relative overflow-hidden group">
                 <div className="relative z-10">
                   <h3 className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-luxury-gold font-bold mb-2">Choose Your Ritual</h3>
                   <p className="text-[10px] text-luxury-stone/80 mb-6 font-bold italic">
                     How would you like them to open this gift? Choose how they'll first open and experience your letter.
                   </p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {RITUALS.map(ritual => {
                        const isEnabled = ENABLED_RITUALS.includes(ritual.id);
                        return (
                        <button
                          key={ritual.id}
                          type="button"
                          disabled={!isEnabled}
                          onClick={() =>
                            isEnabled && updateData(prev => ({
                              revealMethod: ritual.id,
                              unlockDate: ritual.id === 'vigil' ? prev.unlockDate : null,
                            }))
                          }
                          className={`p-6 rounded-lg text-left border-2 transition-all duration-300 relative overflow-hidden ${
                            !isEnabled
                              ? 'opacity-50 cursor-not-allowed border-[#333] bg-transparent'
                              : data.revealMethod === ritual.id ? 'bg-[#2A2522] border-luxury-gold shadow-lg' : 'bg-transparent border-[#444] hover:border-[#666]'
                          }`}
                        >
                           {!isEnabled && (
                             <span className="absolute top-3 right-3 text-[8px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border border-white/15 text-white/40">
                               Coming Soon
                             </span>
                           )}
                           <div className="text-3xl mb-3">{ritual.icon}</div>
                           <h4 className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 ${
                             !isEnabled ? 'text-[#666]' : data.revealMethod === ritual.id ? 'text-luxury-gold' : 'text-[#BBB]'
                           }`}>{ritual.title}</h4>
                           <p className="text-[10px] text-white/60 leading-relaxed font-bold">{ritual.desc}</p>
                        </button>
                        );
                      })}
                   </div>

                   {data.revealMethod === 'vigil' && (
                     <div className="animate-fade-in bg-black/40 p-6 rounded-lg border border-luxury-gold/40 flex flex-col md:flex-row gap-6 items-center mt-4">
                         <p className="text-luxury-stone/90 text-sm italic font-bold">When should the vigil end?</p>
                         <input
                            type="datetime-local"
                            className="bg-transparent border-2 border-luxury-gold/60 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-luxury-gold transition-colors"
                            onChange={(e) => updateData({ unlockDate: e.target.value })}
                            value={data.unlockDate || ''}
                         />
                     </div>
                   )}
                 </div>
              </div>
            )}

            {ENABLE_VIDEO && (
            <div className="bg-[#1C1917] border-2 border-[#3D3530] p-8 rounded-xl">
               <h3 className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-luxury-gold font-bold mb-6">Cinematic Backdrop</h3>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    type="button"
                    onClick={() => updateData({ videoSource: 'none' })}
                    className={`p-6 rounded border-2 transition-all ${data.videoSource === 'none' ? 'bg-[#2A2522] border-white/40' : 'bg-transparent border-white/10 opacity-70'}`}
                  >
                     <span className="text-3xl block mb-2">🌑</span>
                     <span className="text-[10px] uppercase font-bold tracking-widest text-white">None</span>
                  </button>

                  {/* C7 cleanup: "Upload Video" card removed — server gate now blocks type='video'. */}

                  <button
                    type="button"
                    onClick={() => updateData({ videoSource: 'veo' })}
                    className={`p-6 rounded border-2 transition-all ${data.videoSource === 'veo' ? 'bg-luxury-gold/10 border-luxury-gold shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'bg-transparent border-white/10 opacity-90 hover:opacity-100 hover:border-luxury-gold/60'}`}
                  >
                     <span className="text-3xl block mb-2">✨</span>
                     <span className="text-[10px] uppercase font-bold tracking-widest text-white block mb-1">AI Dreamscape</span>
                     <span className="text-[10px] uppercase tracking-widest text-luxury-gold block font-bold">Premium (Veo)</span>
                  </button>
               </div>
               
               {data.videoSource === 'veo' && (
                  <div className="mt-6 p-6 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg space-y-6 animate-fade-in">
                      <div>
                           <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 block">Director's Cut: Style</label>
                           <div className="grid grid-cols-3 gap-2">
                               {['cinematic', 'dreamy', 'vintage'].map(style => (
                                   <button
                                      key={style}
                                      type="button"
                                      onClick={() => updateData({ videoStyle: style as any })}
                                      className={`py-3 border-2 text-[10px] font-bold uppercase tracking-widest transition-all ${data.videoStyle === style ? 'bg-luxury-gold text-black border-luxury-gold' : 'border-white/20 text-white/70 hover:text-white'}`}
                                   >
                                      {style}
                                   </button>
                               ))}
                           </div>
                      </div>
                      <div className="flex gap-6">
                          <div className="flex-1">
                               <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 block">Ratio</label>
                               <div className="flex gap-2">
                                   <button type="button" onClick={() => updateData({ videoAspectRatio: '9:16' })} className={`flex-1 py-3 border-2 text-[10px] font-bold uppercase tracking-widest ${data.videoAspectRatio === '9:16' ? 'bg-luxury-gold/30 border-luxury-gold text-white' : 'border-white/20 text-white/70'}`}>Mobile (9:16)</button>
                                   <button type="button" onClick={() => updateData({ videoAspectRatio: '16:9' })} className={`flex-1 py-3 border-2 text-[10px] font-bold uppercase tracking-widest ${data.videoAspectRatio === '16:9' ? 'bg-luxury-gold/30 border-luxury-gold text-white' : 'border-white/20 text-white/70'}`}>TV (16:9)</button>
                               </div>
                          </div>
                          <div className="flex-1">
                               <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 block">Quality</label>
                               <div className="flex gap-2">
                                   <button type="button" onClick={() => updateData({ videoResolution: '720p' })} className={`flex-1 py-3 border-2 text-[10px] font-bold uppercase tracking-widest ${data.videoResolution === '720p' ? 'bg-luxury-gold/30 border-luxury-gold text-white' : 'border-white/20 text-white/70'}`}>720p</button>
                                   <button type="button" onClick={() => updateData({ videoResolution: '1080p' })} className={`flex-1 py-3 border-2 text-[10px] font-bold uppercase tracking-widest ${data.videoResolution === '1080p' ? 'bg-luxury-gold/30 border-luxury-gold text-white' : 'border-white/20 text-white/70'}`}>1080p</button>
                               </div>
                          </div>
                      </div>
                  </div>
               )}

               {/* C7 cleanup: videoSource === 'upload' requirements callout removed. */}
            </div>
            )}

            <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border-2 border-[#C5B498] p-8 md:p-12 rounded-xl shadow-sm">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-baseline mb-1 gap-2">
                        <label className="flex items-center space-x-2 text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/80">
                            <span className="text-xl">🎵</span>
                            <span>Soundtrack (YouTube)</span>
                        </label>
                        <span className="text-[11px] text-luxury-ink/70 font-medium italic">
                            This plays throughout the experience — from the opening to your final words.
                        </span>
                    </div>
                    
                    <input 
                        type="text" 
                        className="w-full bg-luxury-ink/5 border-2 border-luxury-ink/20 py-3 px-4 rounded-lg focus:border-luxury-gold outline-none text-base text-luxury-ink placeholder-luxury-ink/50"
                        placeholder="e.g. https://www.youtube.com/watch?v=..." 
                        value={data.musicType === 'youtube' ? data.musicUrl : ''}
                        onChange={e => {
                           const val = e.target.value;
                           if (val) {
                             updateData({ musicType: 'youtube', musicUrl: val });
                           } else {
                             updateData({ musicType: 'preset', musicUrl: MUSIC_PRESETS[0].url });
                           }
                        }}
                    />

                    {data.musicType === 'youtube' && (
                        <div className="flex items-start space-x-2 mt-4 p-3 bg-luxury-ink/5 rounded-lg border border-luxury-ink/10">
                            <span className="text-luxury-gold-dark text-sm mt-0.5">ℹ️</span>
                            <p className="text-[10px] text-luxury-ink/70 font-bold leading-relaxed">
                                <span className="font-extrabold text-luxury-ink">System Note:</span> YouTube audio is streamed directly from their servers. 
                                It does not consume your storage space. However, for the best looping experience, 
                                we recommend tracks between <span className="font-extrabold text-luxury-ink">3-5 minutes</span>.
                                Avoid 1h+ videos to ensure fast loading for the receiver.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gradient-to-br from-luxury-paper to-luxury-sandstone border-2 border-[#C5B498] p-8 md:p-12 rounded-xl shadow-sm">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-luxury-ink/70 mb-2">Three Promises</p>
                <p className="text-xs italic text-luxury-ink/75 mb-6 font-serif-elegant">Shown after the letter — your final promises, presented as elegant cards.</p>
                <div className="space-y-8">
                  {data.coupons?.map((coupon, idx) => (
                    <div key={coupon.id} className="flex gap-4 items-start border-b-2 border-luxury-ink/10 pb-6 last:border-0">
                        <div className="pt-2 text-sm font-bold text-luxury-gold-dark">{idx + 1}</div>
                        <div className="flex-1 space-y-4">
                           <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/60 block mb-1">Title</label>
                              <input
                                type="text"
                                className="w-full bg-transparent border-b-2 border-luxury-ink/20 py-1 focus:border-luxury-ink outline-none font-serif-elegant italic text-luxury-ink text-xl placeholder:text-luxury-ink/40"
                                value={coupon.title}
                                placeholder={PROMISE_PLACEHOLDERS[idx]?.title}
                                onChange={e => updateCoupon(idx, 'title', e.target.value)}
                              />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/60 block mb-1">Description</label>
                              <textarea
                                className="w-full bg-luxury-ink/5 border-2 border-luxury-ink/20 p-4 rounded-lg focus:border-luxury-ink outline-none font-sans text-sm text-luxury-ink leading-relaxed resize-none h-24 placeholder:text-luxury-ink/40"
                                value={coupon.description}
                                placeholder={PROMISE_PLACEHOLDERS[idx]?.description}
                                onChange={e => updateCoupon(idx, 'description', e.target.value)}
                                onFocus={handleTextareaFocus}
                              />
                           </div>
                        </div>
                    </div>
                  ))}
                </div>
            </div>

            <div className={`transition-all duration-700 rounded-xl overflow-hidden border-2 ${data.hasGift ? 'border-[#D4C5A5] shadow-xl bg-luxury-paper' : 'border-[#3D3530] bg-[#1C1917]'}`}>
                <div className={`p-8 md:p-10 cursor-pointer transition-colors flex items-center justify-between group ${data.hasGift ? 'bg-gradient-to-r from-[#E8E2D2] to-[#D6CDB8]' : 'bg-[#2A2522] hover:bg-[#332D2A]'}`} onClick={() => updateData(prev => ({ hasGift: !prev.hasGift }))}>
                    <div className="flex items-center space-x-6">
                        <div className={`w-8 h-8 border-2 rounded-full flex items-center justify-center transition-all ${data.hasGift ? 'border-luxury-wine bg-luxury-wine' : 'border-[#A89F91] bg-transparent'}`}>{data.hasGift && <span className="text-white text-sm font-bold">✓</span>}</div>
                        <div>
                            <h3 className={`text-xs md:text-sm font-bold uppercase tracking-[0.2em] mb-1 ${data.hasGift ? 'text-luxury-wine' : 'text-[#A89F91] group-hover:text-[#E5D0A1] transition-colors'}`}>Include a Grand Gesture?</h3>
                            <p className={`text-[10px] md:text-xs font-bold italic ${data.hasGift ? 'text-luxury-stone/80' : 'text-[#888]'}`}>Appears at the end — a surprise you've chosen just for them.</p>
                        </div>
                    </div>
                </div>
                {data.hasGift && (
                    <div className="bg-luxury-paper border-t-2 border-[#D4C5A5] p-8 space-y-6 animate-fade-in">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/60 block">Gift Title</label>
                            <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 focus:border-luxury-ink outline-none font-serif-elegant italic text-xl placeholder-luxury-ink/50" placeholder="e.g. Dinner Under the Stars" value={data.giftTitle} onChange={e => updateData({ giftTitle: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/60 block">Why This Matters</label>
                            <textarea className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 focus:border-luxury-ink outline-none font-serif-elegant italic text-base placeholder-luxury-ink/50 resize-none h-16 leading-relaxed" placeholder="Because you once said you've always wanted to…" value={data.giftNote || ''} onChange={e => updateData({ giftNote: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/60 block">Booking or Surprise Link <span className="text-luxury-ink/40 normal-case italic">(optional)</span></label>
                            <input type="text" className="w-full bg-luxury-ink/5 border-b-2 border-luxury-ink/30 py-3 px-3 focus:border-luxury-ink outline-none text-base placeholder-luxury-ink/50" placeholder="e.g. https://booking-confirmation.com/..." value={data.giftLink} onChange={e => updateData({ giftLink: e.target.value })} />
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

        <div className={`pt-8 pb-20 flex justify-between items-center border-t border-white/10 ${(step as number) === 2 ? "hidden" : ""}`}>
           {step > 1 ? (
             <button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); back(); }} className="px-12 py-5 rounded-full bg-luxury-bronze text-white hover:bg-luxury-ink transition-all transform hover:-translate-y-1 active:scale-[0.99] uppercase tracking-[0.4em] text-[10px] md:text-xs font-bold shadow-2xl">
               ← Back
             </button>
           ) : <div></div>}
           
           <button
             type="submit"
             disabled={isStepSaving}
             className="px-12 py-5 bg-luxury-wine text-white font-bold rounded-full shadow-2xl hover:bg-[#3D1F1F] transition-all transform hover:-translate-y-1 active:scale-[0.99] uppercase tracking-[0.4em] text-[10px] md:text-xs disabled:opacity-60 disabled:cursor-not-allowed"
           >
             {/* PR-49 C2: mode-aware labels per strategy §8.1. Step 3 retains
                 the 'Generate Draft' semantic regardless of mode — that click
                 launches AI generation, not a stage save. */}
             {step === 3
               ? (isStepSaving ? 'Saving…' : 'Generate Draft')
               : mode === 'authenticated'
                 ? (isStepSaving ? 'Saving…' : 'Save and Continue')
                 : 'Continue'}
           </button>
        </div>
        {stepSaveError && (
          <p
            role="alert"
            className="text-center text-xs text-luxury-gold/70 italic pb-4"
            style={{ color: '#e88' }}
          >
            {stepSaveError}
          </p>
        )}
      </form>
    </div>
    </>
  );
};