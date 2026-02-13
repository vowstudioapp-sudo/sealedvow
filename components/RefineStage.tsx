import React, { useState, useEffect, useRef } from 'react';
import { CoupleData } from '../types';
import { generateLoveLetter, generateCoupleMyth, generateValentineImage, generateCinematicVideo, generateSacredLocation, generateFutureProphecy } from '../services/geminiService';

interface Props {
  data: CoupleData;
  onSave: (finalLetter: string, enrichedData?: Partial<CoupleData>) => void;
  onBack: () => void;
}

export const RefineStage: React.FC<Props> = ({ data, onSave, onBack }) => {
  const [letter, setLetter] = useState(data.finalLetter || '');
  const [loading, setLoading] = useState(data.writingMode === 'assisted' && !data.finalLetter);
  const [isPackaging, setIsPackaging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [packageStatus, setPackageStatus] = useState("Initializing...");
  // Separate progress for drafting phase
  const [draftingProgress, setDraftingProgress] = useState(0);

  // Helper to compress AI images so they fit in the URL
  const compressBase64 = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Aggressive compression for URL safety
        const maxWidth = 500; 
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = () => resolve(base64Str); // Fallback
    });
  };

  useEffect(() => {
    if (data.writingMode === 'assisted' && !data.finalLetter) {
      // Simulate progress during generation
      const draftInterval = setInterval(() => {
        setDraftingProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 5;
        });
      }, 200);

      const fetchDraft = async () => {
        setLoading(true);
        const draft = await generateLoveLetter(data);
        
        // Generation done, complete bar
        clearInterval(draftInterval);
        setDraftingProgress(100);
        
        setTimeout(() => {
           setLetter(draft);
           setLoading(false);
        }, 500); // Brief delay to see 100%
      };
      fetchDraft();
      
      return () => clearInterval(draftInterval);
    }
  }, [data]);

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
      setProgress(20);

      // 2. Future Prophecy (Fast Text)
      setPackageStatus("Envisioning the future...");
      try {
        await generateFutureProphecy(data);
      } catch (e) { console.warn("Prophecy failed", e); }
      setProgress(40);

      // 3. Sacred Location (Medium Search)
      if (data.locationMemory) {
          setPackageStatus("Finding your sacred coordinate...");
          try {
             const res = await generateSacredLocation(data.locationMemory, data.manualMapLink);
             if (res) enrichedData.sacredLocation = res;
          } catch (e) { console.warn("Location failed", e); }
      }
      setProgress(60);

      // 4. Main Image (Slow Image) - Only if needed
      if (!data.userImageUrl) {
          setPackageStatus("Painting a memory...");
          try {
             const res = await generateValentineImage(`A quiet, private moment of two people, candid and intimate photography.`);
             if (res) enrichedData.aiImageUrl = await compressBase64(res);
          } catch (e) { console.warn("Image failed", e); }
      }
      setProgress(80);

      // 5. Video (Very Slow) - Only if specifically requested
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
          className="w-full bg-transparent border-none focus:ring-0 p-0 font-serif-elegant text-xl md:text-2xl leading-[1.8] text-luxury-ink italic h-[50vh] resize-none"
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
        />
        
        <div className="flex flex-col md:flex-row gap-6 pt-8 border-t border-luxury-ink/20">
          <button 
            onClick={onBack}
            className="flex-1 py-4 text-luxury-ink/80 text-xs font-bold uppercase tracking-widest hover:text-luxury-ink transition-colors rounded-full hover:bg-luxury-ink/10"
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