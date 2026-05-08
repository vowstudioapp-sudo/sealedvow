import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CoupleData } from '../types';
import { generateLoveLetter, generateCoupleMyth, generateCinematicVideo, generateSacredLocation } from '../services/geminiService';

interface Props {
  data: CoupleData;
  onSave: (finalLetter: string, enrichedData?: Partial<CoupleData>) => void;
  onBack: () => void;
  // Propagates the in-progress letter back to the parent so it survives
  // Back-to-Details navigation. Called after AI generation succeeds and
  // on textarea blur (to capture manual edits).
  onUpdateLetter: (letter: string) => void;
}

export const RefineStage: React.FC<Props> = ({ data, onSave, onBack, onUpdateLetter }) => {
  const [letter, setLetter] = useState(data.finalLetter || '');
  const [loading, setLoading] = useState(data.writingMode === 'assisted' && !data.finalLetter);
  const [isPackaging, setIsPackaging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [packageStatus, setPackageStatus] = useState("Initializing...");
  // Separate progress for drafting phase
  const [draftingProgress, setDraftingProgress] = useState(0);
  const hasGeneratedRef = useRef(false);
  const draftIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // H7: failure UX — error message + retry/manual fallback states.
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Hoisted from inside useEffect so the retry button can call it again.
  // Reset progress + clear error on each attempt; user input (data prop) is
  // preserved by the parent (App.tsx), so retry is just a fresh AI call.
  const fetchDraft = useCallback(async () => {
    setError(null);
    setLoading(true);
    setDraftingProgress(0);

    if (draftIntervalRef.current) clearInterval(draftIntervalRef.current);
    draftIntervalRef.current = setInterval(() => {
      setDraftingProgress(prev => (prev >= 90 ? prev : prev + Math.random() * 5));
    }, 200);

    try {
      const draft = await generateLoveLetter(data);

      if (draftIntervalRef.current) clearInterval(draftIntervalRef.current);
      setDraftingProgress(100);

      setTimeout(() => {
        setLetter(draft);
        setLoading(false);
        // Propagate to parent so Back-to-Details preserves the draft and
        // future RefineStage entries skip regeneration (data.finalLetter
        // is non-empty → useEffect's `!data.finalLetter` gate is false).
        onUpdateLetter(draft);
      }, 300);
    } catch (err) {
      if (draftIntervalRef.current) clearInterval(draftIntervalRef.current);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'AI generation failed.');
    } finally {
      setRetrying(false);
    }
  }, [data, onUpdateLetter]);

  const handleRetry = () => {
    setRetrying(true);
    fetchDraft();
  };

  const handleWriteItMyself = () => {
    setError(null);
    setLetter(''); // empty textarea for user to type into
    setLoading(false);
  };

  // Explicit user request for a fresh AI draft. Resets the
  // hasGeneratedRef gate, clears local + parent letter, then fires
  // fetchDraft. The success path's onUpdateLetter call writes the
  // new draft back to parent + localStorage.
  const handleRegenerate = () => {
    hasGeneratedRef.current = false;
    setLetter('');
    onUpdateLetter('');
    fetchDraft();
  };

  useEffect(() => {
    if (
      data &&
      data.senderName &&
      data.recipientName &&
      data.writingMode === 'assisted' &&
      !data.finalLetter &&
      !hasGeneratedRef.current
    ) {
      hasGeneratedRef.current = true;
      fetchDraft();
      return () => {
        if (draftIntervalRef.current) clearInterval(draftIntervalRef.current);
      };
    }
    // Intentionally only run on mount — fetchDraft has data in its closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFinalize = async () => {
    setIsPackaging(true);
    setProgress(0);
    setPackageStatus("Orchestrating digital magic...");

    try {
      const enrichedData: Partial<CoupleData> = {};

      // --- SEQUENTIAL EXECUTION BLOCK ---
      // We run API calls sequentially to prevent hitting Google AI rate limits (429 Quota Exhausted)
      
      // 1. Myth Generation (Fast Text)
      setPackageStatus("Sealing your vow...");
      try {
        enrichedData.myth = await generateCoupleMyth({ ...data, finalLetter: letter });
      } catch (e) { console.warn("Myth failed", e); }
      setProgress(33);

      // 2. Sacred Location (Medium Search)
      if (data.locationMemory) {
          setPackageStatus("Finding your sacred coordinate...");
          try {
             const res = await generateSacredLocation(data.locationMemory, data.manualMapLink);
             if (res) enrichedData.sacredLocation = res;
          } catch (e) { console.warn("Location failed", e); }
      }
      setProgress(66);

      // 3. Video (Very Slow) - Only if specifically requested
      if (data.videoSource === 'veo') {
          setPackageStatus("Dreaming in cinema (Veo AI - this takes a moment)...");
          try {
              const res = await generateCinematicVideo({ ...data, finalLetter: letter });
              if (res) {
                enrichedData.video = { url: res, source: 'ai' };
              }
          } catch (e) { console.warn("Video failed", e); }
      }
      setProgress(100);
      setPackageStatus("Ready.");

      // Brief delay to show 100%
      setTimeout(() => {
        setIsPackaging(false);
        onSave(letter, enrichedData);
      }, 500);

    } catch (error) {
       console.error("Packaging failed", error);
       setIsPackaging(false);
       onSave(letter, {}); // Proceed anyway to avoid locking the user out
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 animate-fade-in text-[#E5D0A1]">
        <div className="w-16 h-16 border border-[#E5D0A1]/40 rounded-full mb-8 relative">
          <div className="absolute inset-0 border-t-[#E5D0A1] border border-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-xl font-serif-elegant italic mb-4">Drafting your letter...</h2>
        <p className="text-[#A89F91] text-sm italic mb-8">Finding the right words.</p>
        
        {/* New Drafting Progress Bar */}
        <div className="w-48 flex flex-col items-center space-y-2">
            <div className="w-full h-[2px] bg-[#E5D0A1]/30 relative overflow-hidden rounded-full">
               <div 
                 className="absolute top-0 left-0 h-full bg-[#E5D0A1] transition-all duration-200 ease-out"
                 style={{ width: `${draftingProgress}%` }}
               ></div>
            </div>
            <p className="text-[10px] font-mono text-[#E5D0A1]/80 font-bold">{Math.floor(draftingProgress)}%</p>
        </div>
      </div>
    );
  }

  // H7: error state — shown if the AI draft fails (e.g., 5xx, 503 cap hit,
  // network error). Two affordances: Try Again (re-runs the same fetch) and
  // Write It Myself (clears the loading state and lets the user type into
  // the existing textarea below). User input is preserved either way because
  // `data` (CoupleData) lives in the parent component.
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 animate-fade-in text-[#E5D0A1]">
        <div className="max-w-md">
          <div className="w-16 h-16 rounded-full border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-8">
            <span className="text-2xl">✦</span>
          </div>
          <h2 className="text-xl font-serif-elegant italic mb-4">We couldn't draft your letter</h2>
          <p className="text-[#A89F91] text-sm italic mb-2">{error}</p>
          <p className="text-[#A89F91] text-xs italic mb-8">Your input is saved. You can try again or write it yourself.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-6 py-3 border border-[#E5D0A1]/40 rounded-full text-xs uppercase tracking-widest font-bold hover:bg-[#E5D0A1]/10 transition disabled:opacity-50 disabled:cursor-wait"
            >
              {retrying ? 'Retrying…' : 'Try Again'}
            </button>
            <button
              onClick={handleWriteItMyself}
              className="px-6 py-3 bg-luxury-wine text-white rounded-full text-xs uppercase tracking-widest font-bold hover:bg-black transition"
            >
              Write It Myself
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isPackaging) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 animate-fade-in text-[#E5D0A1]">
        <div className="w-24 h-24 border border-luxury-wine/40 rounded-full mb-8 relative flex items-center justify-center">
          <div className="absolute inset-0 border-t-luxury-wine border-r-luxury-wine border border-transparent rounded-full animate-spin duration-700"></div>
          <span className="text-3xl animate-pulse"><img src="/logo-gold.webp" alt="VOW" className="w-14 h-14" /></span>
        </div>
        <h2 className="text-2xl font-serif-elegant italic mb-6 text-luxury-wine">Compiling Experience</h2>
        
        {/* Progress Bar */}
        <div className="w-64 h-1 bg-luxury-wine/20 rounded-full overflow-hidden mb-6 relative">
           <div 
             className="absolute top-0 left-0 h-full bg-luxury-wine transition-all duration-300 ease-out shadow-[0_0_10px_rgba(88,47,47,0.8)]" 
             style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
           ></div>
        </div>

        <div className="flex flex-col items-center space-y-3">
           {/* UPDATED: Fully Opaque, Bright Text for readability */}
           <p className="text-[#E5D0A1] text-xs font-bold uppercase tracking-[0.2em] animate-pulse min-h-[1.5em] transition-all drop-shadow-md">
             {packageStatus}
           </p>
           <p className="text-luxury-wine/80 text-[10px] font-mono font-bold">{Math.round(progress)}%</p>
           
           {data.videoSource === 'veo' && progress < 100 && (
               <p className="text-xs text-white/70 mt-4 max-w-xs leading-relaxed italic">
                   Note: AI Video generation takes longer than other steps.
               </p>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-12 animate-fade-in">
      <div className="text-center mb-12">
        <h2 className="text-xs uppercase tracking-[0.5em] text-luxury-gold font-bold mb-4">Chapter V &nbsp;•&nbsp; The Review</h2>
        <h1 className="text-3xl md:text-4xl font-serif-elegant italic text-[#E5D0A1] mb-4">Review Your Message</h1>
        <p className="text-[#A89F91] text-sm italic max-w-lg mx-auto leading-relaxed">
          This is what {data.recipientName} will see. Edit anything you like to make sure it sounds like you.
        </p>
      </div>

      <div className="bg-luxury-paper border border-[#D4C5A5] p-8 md:p-12 rounded-xl shadow-sm space-y-8 relative">
        <textarea
          className="w-full bg-transparent border-none focus:ring-0 p-0 font-serif-elegant text-xl md:text-2xl leading-[1.8] text-luxury-ink italic h-[50vh] resize-none placeholder:text-luxury-ink/40"
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          // Propagate manual edits to parent on blur so they survive
          // Back-to-Details navigation. onChange stays local for typing
          // performance.
          onBlur={(e) => onUpdateLetter(e.target.value)}
          placeholder="Write your letter here…"
        />

        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleRegenerate}
            className="px-6 py-2.5 rounded-full border border-luxury-ink/70 bg-transparent text-luxury-ink hover:bg-luxury-ink/5 hover:border-luxury-ink transition-colors text-[10px] uppercase tracking-[0.3em] font-bold"
          >
            Regenerate Draft
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 pt-8 border-t border-luxury-ink/20">
          <button
            onClick={onBack}
            className="flex-1 py-4 rounded-full border border-luxury-ink/70 bg-transparent text-luxury-ink hover:bg-luxury-ink/5 hover:border-luxury-ink transition-colors font-bold text-[10px] tracking-[0.4em] uppercase"
          >
            ← Back to Details
          </button>
          <button
            onClick={handleFinalize}
            className="flex-[2] py-4 bg-luxury-wine text-white font-bold text-[10px] tracking-[0.4em] uppercase rounded-full shadow-xl hover:bg-black transition-all transform active:scale-[0.98]"
          >
            Preview Experience
          </button>
        </div>
      </div>
      
      <p className="text-center mt-12 text-[10px] text-luxury-gold font-bold uppercase tracking-[0.6em] italic opacity-80">
        Ready for packaging
      </p>
    </div>
  );
};
