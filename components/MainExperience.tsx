/*
 * PRODUCTION POLISH (Staff Engineer Review)
 * 
 * Changes:
 * - All handlers memoized with useCallback to prevent unnecessary re-renders
 * - Coupon transform moved to CSS variables (no inline visual logic)
 * - Pointer event handlers use stable ref for dragging index
 * - Audio lifecycle cleanup ensures source node is nulled
 * - Observer cleanup is more robust (unobserve all before disconnect)
 * - Strategic comments added where future changes could break behavior
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CoupleData, Coupon, Theme, MemoryPhoto, Occasion } from '../types';
import { generateAudioLetter, decodeAudioData } from '../services/geminiService';
import { PaperSurface } from './PaperSurface';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  data: CoupleData;
  isPreview?: boolean;
  onPayment?: () => void;
  onEdit?: () => void;
}

interface InteractivePhoto extends MemoryPhoto {
  dragX: number;
  dragY: number;
  zIndex: number;
}

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                           */
/* ------------------------------------------------------------------ */

const THEME_STYLES: Record<Theme, { 
  bg: string;
  text: string;
  gold: string;
  overlay: string;
  boardBg: string;
  sectionBg: string;
  sealColor: string;
}> = {
  obsidian:   { bg: '#0C0A09', text: '#E5D0A1', gold: '#D4AF37', overlay: 'rgba(0,0,0,0.7)',        boardBg: '#1C1917', sectionBg: '#050505', sealColor: '#722F37' },
  velvet:     { bg: '#1A0B2E', text: '#E9D5FF', gold: '#C084FC', overlay: 'rgba(26,11,46,0.8)',      boardBg: '#2E1065', sectionBg: '#0F0520', sealColor: '#7C3AED' },
  crimson:    { bg: '#2B0A0A', text: '#FECDD3', gold: '#F43F5E', overlay: 'rgba(43,10,10,0.8)',      boardBg: '#3B0A0A', sectionBg: '#1A0505', sealColor: '#9F1239' },
  midnight:   { bg: '#020617', text: '#E0F2FE', gold: '#7DD3FC', overlay: 'rgba(2,6,23,0.8)',        boardBg: '#0F172A', sectionBg: '#010410', sealColor: '#1E40AF' },
  evergreen:  { bg: '#022C22', text: '#D1FAE5', gold: '#34D399', overlay: 'rgba(2,44,34,0.8)',       boardBg: '#064E3B', sectionBg: '#011A14', sealColor: '#065F46' },
  pearl:      { bg: '#1C1917', text: '#F5F5F4', gold: '#A8A29E', overlay: 'rgba(28,25,23,0.8)',      boardBg: '#292524', sectionBg: '#0C0A09', sealColor: '#57534E' },
};

const OCCASION_TITLES: Record<Occasion, string> = {
  valentine: "A Valentine's Dedication",
  anniversary: "A Celebration of Time",
  apology: "A Message of Reconciliation",
  'just-because': "A Spontaneous Thought",
  'long-distance': "Across the Distance",
  'thank-you': "With Gratitude"
};

const MAX_PARAGRAPH_CHARS = 180;

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export const MainExperience: React.FC<Props> = ({ data, isPreview = false, onPayment, onEdit }) => {
  /* ------------------------------------------------------------------ */
  /* STATE                                                               */
  /* ------------------------------------------------------------------ */

  const [coupons, setCoupons] = useState<Coupon[]>(data.coupons || []);
  const [currentCouponIndex, setCurrentCouponIndex] = useState(0);
  const [isGiftRevealed, setIsGiftRevealed] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [sections, setSections] = useState<number[]>([]);
  const [currentParagraph, setCurrentParagraph] = useState(0);
  
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySealed, setReplySealed] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [showExitWhisper, setShowExitWhisper] = useState(false);
  const [showExitOverlay, setShowExitOverlay] = useState(false);
  const [locationUnlocked, setLocationUnlocked] = useState(false);
  const exitWhisperShownRef = useRef(false);

  // Exit intent — soft whisper when user tries to leave
  // Key trigger: location exists + not yet unlocked = receiver thinks it's over
  // Also triggers if user leaves before reaching end of any flow
  useEffect(() => {
    if (isPreview) return;

    const shouldTrigger = () => {
      if (exitWhisperShownRef.current) return false;
      // Primary case: location gate exists and hidden content waits
      if (data.sacredLocation && !locationUnlocked && !isPreview) return true;
      // Secondary case: no location but user hasn't reached end
      if (!data.sacredLocation && activeSection < sections.length - 1) return true;
      return false;
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5 && shouldTrigger()) {
        exitWhisperShownRef.current = true;
        setShowExitWhisper(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && shouldTrigger()) {
        exitWhisperShownRef.current = true;
        const handleReturn = () => {
          if (document.visibilityState === 'visible') {
            setShowExitWhisper(true);
            document.removeEventListener('visibilitychange', handleReturn);
          }
        };
        document.addEventListener('visibilitychange', handleReturn);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPreview, activeSection, sections.length, locationUnlocked, data.sacredLocation]);


  const [interactivePhotos, setInteractivePhotos] = useState<InteractivePhoto[]>(
    data.memoryBoard?.map((p, i) => ({
      ...p,
      dragX: 0,
      dragY: 0,
      zIndex: 10 + i
    })) || []
  );
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  /* ------------------------------------------------------------------ */
  /* REFS                                                                */
  /* ------------------------------------------------------------------ */

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const maxZ = useRef(20);
  const mountedRef = useRef(true);
  // Stable ref for dragging index to avoid recreating pointer handlers
  const draggingIdxRef = useRef<number | null>(null);

  /* ------------------------------------------------------------------ */
  /* DERIVED VALUES                                                      */
  /* ------------------------------------------------------------------ */

  const theme = THEME_STYLES[data.theme || 'obsidian'];
  const activeVideo = data.video?.url;
  const hasVideo = !!activeVideo && data.videoSource !== 'none';
  const occasionTitle = OCCASION_TITLES[data.occasion || 'valentine'] || 'A Private Moment';

  /* ------------------------------------------------------------------ */
  /* LETTER PARAGRAPHS (Memoized Chunking)                              */
  /* ------------------------------------------------------------------ */

  const letterParagraphs = useMemo(() => {
    const text = data.finalLetter || '';
    if (!text) return [];
    
    const explicitParagraphs = text.split('\n').filter(p => p.trim().length > 0);
    const chunks: string[] = [];

    explicitParagraphs.forEach(p => {
      const words = p.split(' ');
      let currentChunk = "";

      words.forEach(word => {
        if ((currentChunk + " " + word).length > MAX_PARAGRAPH_CHARS && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
        } else {
          currentChunk += (currentChunk ? " " : "") + word;
        }
      });
      
      if (currentChunk) chunks.push(currentChunk.trim());
    });
    
    return chunks;
  }, [data.finalLetter]);

  /* ------------------------------------------------------------------ */
  /* SECTION COUNT (Optimized Observer Deps)                            */
  /* ------------------------------------------------------------------ */

  const sectionCount = useMemo(() => {
    let count = 2; // Hero + Letter always present
    if (data.userImageUrl || data.aiImageUrl) count++;
    if (data.memoryBoard?.length) count++;
    if (data.sacredLocation) count++;
    // Locked sections only count when unlocked (or no location to gate them)
    const unlocked = !data.sacredLocation || locationUnlocked || isPreview;
    if (unlocked && !isPreview && data.coupons?.length) count += 2; // divider + coupons
    if (unlocked && !isPreview && data.hasGift) count++;
    if (unlocked && !isPreview) count++; // final closure
    return count;
  }, [
    data.userImageUrl,
    data.aiImageUrl,
    data.memoryBoard?.length,
    data.sacredLocation,
    data.coupons?.length,
    data.hasGift,
    isPreview,
    locationUnlocked,
  ]);

  /* ------------------------------------------------------------------ */
  /* EFFECT: Audio Preparation + Cleanup                                */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    mountedRef.current = true;

    const prepareAudio = async () => {
      if (!mountedRef.current) return;

      // User-uploaded audio
      if (data.audio?.url) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = ctx;
          const fetchResponse = await fetch(data.audio.url);
          const arrayBuffer = await fetchResponse.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          if (mountedRef.current) {
            setAudioBuffer(buffer);
          }
        } catch (e) {
          console.error("User audio failed", e);
        }
        return;
      }

      // AI-generated audio
      if (!data.finalLetter) return;
      try {
        const audioBytes = await generateAudioLetter(data.finalLetter);
        if (audioBytes && mountedRef.current) {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = ctx;
          const buffer = await decodeAudioData(audioBytes, ctx);
          if (mountedRef.current) {
            setAudioBuffer(buffer);
          }
        }
      } catch (e) {
        console.error("AI audio ignored", e);
      }
    };

    prepareAudio();

    return () => {
      mountedRef.current = false;
      // Cleanup: stop source node and null ref before closing context
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {
          // Ignore if already stopped
        }
        sourceNodeRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          // Ignore if already closed
        }
        audioContextRef.current = null;
      }
    };
  }, [data.finalLetter, data.audio?.url]);

  /* ------------------------------------------------------------------ */
  /* EFFECT: Scroll Observer                                            */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const sectionEls = Array.from(document.querySelectorAll('.snap-section'));
    if (sectionEls.length === 0) return;

    const sectionIds = sectionEls.map((el, i) => {
      el.setAttribute('data-section', i.toString());
      return i;
    });
    setSections(sectionIds);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-section'));
            if (!isNaN(index)) {
              setActiveSection(index);
            }
          }
        });
      },
      { threshold: 0.5 } 
    );

    sectionEls.forEach(s => observer.observe(s));
    
    return () => {
      // Unobserve all elements before disconnecting to prevent memory leaks
      sectionEls.forEach(s => observer.unobserve(s));
      observer.disconnect();
    };
  }, [sectionCount]);

  /* ------------------------------------------------------------------ */
  /* EFFECT: Pointer Event Handlers (Stable References)                 */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    // Sync ref with state for stable access in handlers
    draggingIdxRef.current = draggingIdx;
    
    if (draggingIdx === null) {
      // Restore scroll when drag ends
      if (containerRef.current) {
        containerRef.current.style.overflowY = 'scroll';
      }
      return;
    }

    const handleMove = (e: PointerEvent) => {
      e.preventDefault();
      
      const currentIdx = draggingIdxRef.current;
      if (currentIdx === null) return;
      
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      
      setInteractivePhotos(prev => {
        const next = [...prev];
        if (currentIdx !== null && next[currentIdx]) {
          next[currentIdx] = {
            ...next[currentIdx],
            dragX: next[currentIdx].dragX + dx,
            dragY: next[currentIdx].dragY + dy
          };
        }
        return next;
      });
      
      dragStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleUp = () => {
      setDraggingIdx(null);
      if (containerRef.current) {
        containerRef.current.style.overflowY = 'scroll';
      }
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [draggingIdx]);

  /* ------------------------------------------------------------------ */
  /* HANDLERS                                                            */
  /* ------------------------------------------------------------------ */

  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    maxZ.current += 1;
    
    setDraggingIdx(idx);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    
    setInteractivePhotos(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], zIndex: maxZ.current };
      return next;
    });

    if (containerRef.current) {
      containerRef.current.style.overflowY = 'hidden';
    }
  }, []);

  const toggleVoiceNote = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioBuffer || !audioContextRef.current) return;
    
    if (isVoicePlaying) {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {
          // Ignore if already stopped
        }
        sourceNodeRef.current = null;
      }
      setIsVoicePlaying(false);
    } else {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      // Stop any existing source before creating new one
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {
          // Ignore if already stopped
        }
        sourceNodeRef.current = null;
      }
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsVoicePlaying(false);
        sourceNodeRef.current = null;
      };
      source.start(0);
      sourceNodeRef.current = source;
      setIsVoicePlaying(true);
    }
  }, [audioBuffer, isVoicePlaying]);

  const advanceParagraph = useCallback(() => {
    if (currentParagraph < letterParagraphs.length - 1) {
      setCurrentParagraph(prev => prev + 1);
    } else {
      const currentSectionEl = document.querySelector(`[data-section="${activeSection}"]`);
      const nextSectionEl = currentSectionEl?.nextElementSibling as HTMLElement;
      if (nextSectionEl && nextSectionEl.classList.contains('snap-section')) {
        nextSectionEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [currentParagraph, letterParagraphs.length, activeSection]);
  
  const resetParagraph = useCallback(() => {
    setCurrentParagraph(0);
  }, []);

  const handleNextCoupon = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentCouponIndex < coupons.length) {
      setCoupons(prev => {
        const next = [...prev];
        next[currentCouponIndex] = { 
          ...next[currentCouponIndex], 
          isClaimed: true 
        };
        return next;
      });
      setTimeout(() => setCurrentCouponIndex(prev => prev + 1), 400);
    }
  }, [currentCouponIndex, coupons.length]);

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div 
      ref={containerRef}
      className="main-experience-container"
      style={{
        '--theme-bg': theme.bg,
        '--theme-text': theme.text,
        '--theme-gold': theme.gold,
        '--theme-overlay': theme.overlay,
        '--theme-board-bg': theme.boardBg,
        '--theme-section-bg': theme.sectionBg,
        '--theme-seal': theme.sealColor,
      } as React.CSSProperties}
    >
      {/* Global Atmosphere */}
      <div className="main-experience-atmosphere">
        <div className="main-experience-texture" />
        <div className="main-experience-vignette" />
        
        <div className="main-experience-nav-dots">
          {sections.map(idx => (
            <div 
              key={idx} 
              className={`main-experience-nav-dot ${activeSection === idx ? 'main-experience-nav-dot--active' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* SECTION: Hero */}
      <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center text-center p-8 snap-start overflow-hidden">
        {hasVideo && (
          <div className="main-experience-video-bg">
            <video 
              src={activeVideo} 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="main-experience-video"
            />
            <div className="main-experience-video-overlay" />
          </div>
        )}
        
        <div className="main-experience-hero-card">
          <div className="main-experience-hero-card-inner" />
          <div className="main-experience-hero-content">
            <span className="main-experience-hero-icon">✦</span>
            <p className="main-experience-hero-occasion">{occasionTitle}</p>
          </div>
          <h1 className="main-experience-hero-title">
            "{data.myth || (data.timeShared ? `${data.timeShared}. One story.` : 'Two souls, one timeline.')}"
          </h1>
        </div>
      </section>

      {/* SECTION: Image */}
      {(data.userImageUrl || data.aiImageUrl) && (
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="section"
          className="snap-section h-screen w-full flex flex-col items-center justify-center snap-start overflow-hidden"
        >
          <div className="main-experience-image-blur">
            <img src={data.userImageUrl || data.aiImageUrl} className="w-full h-full object-cover" alt="Background" loading="lazy" />
          </div>
          <div className="main-experience-polaroid">
            <div className="main-experience-polaroid-img">
              <img 
                src={data.userImageUrl || data.aiImageUrl} 
                className="w-full h-full object-cover"
                style={{ animation: 'kenBurns 12s ease-in-out infinite alternate', willChange: 'transform' }}
                loading="lazy"
                alt="Memory" 
              />
              <div className="main-experience-polaroid-texture" />
            </div>
            <div className="main-experience-polaroid-caption">
              <p className="font-serif-elegant italic text-2xl text-white/90 mb-2">{data.timeShared}</p>
              <div className="w-8 h-px bg-white/30 mx-auto my-3" />
              <p className="text-[8px] uppercase tracking-[0.4em] opacity-50">Time Dilation</p>
            </div>
          </div>
        </PaperSurface>
      )}

      {/* SECTION: Letter (emotional peak — comes early) */}
      <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center snap-start p-4 md:p-8">
        <div 
          className="main-experience-letter-card"
          onClick={advanceParagraph}
        >
          <div className="main-experience-letter-card-border" />
          <div className="main-experience-letter-texture" />

          <div className="relative z-10 w-full flex flex-col items-center">
            <div className="min-h-[250px] flex items-center justify-center relative w-full perspective-1000 px-2 md:px-0">
              {letterParagraphs.map((para, idx) => (
                <div 
                  key={idx}
                  className={`main-experience-letter-paragraph ${
                    idx === currentParagraph 
                      ? 'main-experience-letter-paragraph--active' 
                      : idx < currentParagraph 
                        ? 'main-experience-letter-paragraph--prev'
                        : 'main-experience-letter-paragraph--next'
                  }`}
                >
                  <span className="main-experience-letter-quote">"</span>
                  <p className="main-experience-letter-text">
                    {para}
                  </p>
                </div>
              ))}
            </div>

            {currentParagraph === letterParagraphs.length - 1 && (
              <div 
                className="main-experience-letter-signature"
                style={{ animation: 'closureReveal 1s ease-out 1.5s both' }}
              >
                <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent mb-6" />
                <p className="font-romantic text-4xl mb-3" style={{ color: theme.gold, opacity: 0.9 }}>{data.senderName}</p>
                <div 
                  className="w-12 h-px mx-auto mb-10"
                  style={{ backgroundColor: theme.gold, opacity: 0.3, animation: 'closureLine 0.8s ease-out 2.2s both' }}
                />
                
                {audioBuffer && (
                  <div style={{ animation: 'closureReveal 0.8s ease-out 2.6s both' }}>
                    <button 
                      onClick={toggleVoiceNote}
                      className={`main-experience-voice-button ${isVoicePlaying ? 'main-experience-voice-button--playing' : ''}`}
                    >
                      <div className={`main-experience-voice-icon ${isVoicePlaying ? 'main-experience-voice-icon--playing' : ''}`}>
                        {isVoicePlaying ? (
                          <div className="flex gap-0.5 h-3 items-center">
                            <div className="w-0.5 bg-black animate-[bounce_1s_infinite] h-full" />
                            <div className="w-0.5 bg-black animate-[bounce_1.2s_infinite] h-2" />
                            <div className="w-0.5 bg-black animate-[bounce_0.8s_infinite] h-full" />
                          </div>
                        ) : (
                          <span className="ml-0.5 text-[10px]">▶</span>
                        )}
                      </div>
                      <span className="main-experience-voice-label">
                        {isVoicePlaying ? 'Listening...' : 'Hear this letter'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {currentParagraph < letterParagraphs.length - 1 && (
              <div className="mt-12 animate-pulse opacity-30 text-[9px] uppercase tracking-widest" style={{ color: theme.gold }}>
                Tap to continue
              </div>
            )}
          </div>
        </div>
        
        {currentParagraph === letterParagraphs.length - 1 && (
          <button 
            onClick={resetParagraph} 
            className="absolute top-10 right-10 text-[8px] uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity border-b border-white/20 pb-1 z-20"
          >
            Read Again
          </button>
        )}
      </section>

      {/* SECTION: Memory Board (warm decompression after letter) */}
      {interactivePhotos && interactivePhotos.length >= 1 && (
        <section
          className="snap-section min-h-[100vh] w-full relative flex flex-col items-center justify-center snap-start overflow-hidden py-32"
          style={{ backgroundColor: theme.boardBg }}
        >
          <div className="main-experience-board-texture" />
          
          <div className="main-experience-board-header">
            <h2 className="text-[10px] uppercase tracking-[0.5em] font-bold mb-2" style={{ color: theme.gold, opacity: 0.6 }}>A beautiful mess</h2>
            <h1 className="text-3xl md:text-5xl font-serif-elegant italic mb-3" style={{ color: theme.text }}>Fragments of Us</h1>
            <p className="text-[9px] uppercase tracking-widest font-bold animate-pulse" style={{ color: theme.gold, opacity: 0.5 }}>Tap and drag to explore</p>
          </div>

          <div className="relative w-full max-w-4xl h-[70vh] flex items-center justify-center mt-12">
            {interactivePhotos.map((photo, idx) => {
              const isDragging = draggingIdx === idx;
              return (
                <div 
                  key={idx}
                  onPointerDown={(e) => handlePointerDown(e, idx)}
                  className={`main-experience-photo ${isDragging ? 'main-experience-photo--dragging' : ''}`}
                  style={{
                    '--photo-offset-x': `${photo.xOffset}px`,
                    '--photo-offset-y': `${photo.yOffset}px`,
                    '--photo-drag-x': `${photo.dragX}px`,
                    '--photo-drag-y': `${photo.dragY}px`,
                    '--photo-angle': `${photo.angle}deg`,
                    '--photo-scale': isDragging ? 1.05 : 1,
                    zIndex: photo.zIndex,
                  } as React.CSSProperties}
                >
                  <div className="main-experience-photo-img">
                    <img src={photo.url} className="w-full h-full object-cover grayscale-[0.2]" alt="Memory" draggable="false" loading="lazy" />
                  </div>
                  {photo.caption && (
                    <p className="font-romantic text-2xl md:text-3xl text-center mt-3 md:mt-5 -rotate-2 pointer-events-none" style={{ color: '#2D2424', opacity: 0.9 }}>
                      {photo.caption}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION: Location */}
      {data.sacredLocation && (
        <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center snap-start overflow-hidden">
          <div className="main-experience-location-bg">
            <div className="main-experience-location-texture" />
            <div className="main-experience-location-ring main-experience-location-ring--outer" />
            <div className="main-experience-location-ring main-experience-location-ring--inner" />
          </div>

          <div className="main-experience-location-card">
            <div className="text-2xl mb-4 animate-bounce" style={{ color: theme.gold }}>📍</div>
            <h3 className="text-[9px] uppercase tracking-[0.4em] font-bold mb-6" style={{ color: theme.gold, opacity: 0.8 }}>Cosmic Coordinate</h3>
            <h2 className="font-serif-elegant italic text-3xl text-white mb-6 leading-tight">{data.sacredLocation.placeName}</h2>
            <div className="w-12 h-px bg-white/10 mx-auto mb-6" />
            <p className="text-white/60 text-xs italic leading-relaxed mb-10 font-serif-elegant">
              "{data.sacredLocation.description}"
            </p>
            <a 
              href={data.sacredLocation.googleMapsUri} 
              target="_blank" 
              rel="noopener noreferrer"
              className="main-experience-location-link"
            >
              <span>View on Map</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* LINEAR FLOW: Divider → Promises → Gift → Closure → Reply      */}
      {/* Gated behind location unlock if location exists.                */}
      {/* If no location, sections render freely.                         */}
      {/* ================================================================ */}

      {(!data.sacredLocation || locationUnlocked || isPreview) && (<>

      {/* SECTION: Promise Divider */}
      {!isPreview && coupons.length > 0 && (
        <PaperSurface 
          theme={data.theme || 'obsidian'} 
          as="section"
          className="snap-section h-screen w-full flex flex-col items-center justify-center snap-start"
          style={{ position: 'relative' }}
        >
          <div id="promises-section" style={{ position: 'absolute', top: 0 }} />
          <div className="text-center px-8">
            <p
              style={{
                fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
                fontStyle: 'italic',
                fontSize: 'clamp(1.2rem, 4vw, 2rem)',
                color: theme.text,
                lineHeight: 1.6,
              }}
            >
              What I promise you.
            </p>
            <div 
              className="h-px mx-auto mt-8 w-12"
              style={{ backgroundColor: theme.gold, opacity: 0.2 }}
            />
          </div>
        </PaperSurface>
      )}

      {/* SECTION: Promises (Coupons) */}
      {!isPreview && coupons.length > 0 && (
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="section"
          className="snap-section min-h-screen w-full flex flex-col items-center justify-center snap-start px-4 py-20"
        >
          <div className="relative w-80 md:w-96 h-[28rem] md:h-[32rem] perspective-1000">
            {coupons.map((coupon, index) => {
              if (index < currentCouponIndex) return null;
              const isTop = index === currentCouponIndex;
              const offset = index - currentCouponIndex;

              return (
                <div
                  key={coupon.id}
                  onClick={isTop ? handleNextCoupon : undefined}
                  className={`main-experience-coupon ${isTop ? 'main-experience-coupon--active' : 'main-experience-coupon--stacked'}`}
                  style={
                    !isTop
                      ? ({
                          '--coupon-offset-y': `${offset * 15}px`,
                          '--coupon-scale': 1 - offset * 0.05,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  <div className="main-experience-coupon-texture" />

                  <div className="flex justify-between items-start opacity-40 relative z-10">
                    <span className="text-[9px] font-bold uppercase tracking-widest">NO. 0{index + 1}</span>
                    <span className="text-2xl">{coupon.icon}</span>
                  </div>

                  <div className="text-center relative z-10 mt-4">
                    <h3 className="font-serif-elegant italic text-3xl mb-6 leading-tight">{coupon.title}</h3>
                    <div className="w-8 h-0.5 mx-auto opacity-10 mb-6" style={{ backgroundColor: theme.text }} />
                    <p className="font-sans text-sm leading-relaxed opacity-70">{coupon.description}</p>
                  </div>

                  <div className="text-center opacity-40 relative z-10">
                    <span className="text-[9px] uppercase tracking-[0.3em] font-bold pb-1" style={{ borderBottom: `1px solid ${theme.text}20` }}>
                      {isTop ? 'Accept Vow' : 'Locked'}
                    </span>
                  </div>
                </div>
              );
            })}
            
            {currentCouponIndex >= coupons.length && (
              <div className="absolute inset-0 flex flex-col items-center justify-center border border-white/10 rounded-sm bg-white/5 backdrop-blur-sm">
                <span className="text-4xl mb-6 text-white/60">✓</span>
                <p className="text-xs uppercase tracking-widest text-white/40">Promises Accepted</p>
              </div>
            )}
          </div>
        </PaperSurface>
      )}

      {/* SECTION: Gift */}
      {!isPreview && data.hasGift && (
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="section"
          className="snap-section min-h-screen w-full flex flex-col items-center justify-center snap-start px-4 py-20"
        >
          <div className={`main-experience-gift-container ${isGiftRevealed ? 'main-experience-gift-container--revealed' : ''}`}>
            <div className="main-experience-gift-glow" />

            <div className="main-experience-gift-card">
              <div className="main-experience-gift-texture" />

              <div className="main-experience-gift-corners">
                <div className="main-experience-gift-corner main-experience-gift-corner--tl" />
                <div className="main-experience-gift-corner main-experience-gift-corner--tr" />
                <div className="main-experience-gift-corner main-experience-gift-corner--bl" />
                <div className="main-experience-gift-corner main-experience-gift-corner--br" />
              </div>

              <div className="flex flex-col md:flex-row">
                <div className="main-experience-gift-content">
                  <div className="main-experience-gift-punch main-experience-gift-punch--left" />
                  <div className="main-experience-gift-punch main-experience-gift-punch--right" />
                  
                  <p className="text-[9px] uppercase tracking-[0.5em] mb-2 font-bold" style={{ color: theme.gold, opacity: 0.6 }}>Sealed For You</p>
                  <div className="w-8 h-px mb-10" style={{ backgroundColor: theme.gold, opacity: 0.2 }} />
                  
                  <h2 className="font-serif-elegant italic text-4xl md:text-5xl text-white mb-10 leading-tight text-center relative z-10 drop-shadow-md">
                    {data.giftTitle}
                  </h2>
                  
                  {!isGiftRevealed ? (
                    <button 
                      onClick={() => setIsGiftRevealed(true)}
                      className="main-experience-gift-reveal"
                    >
                      <span className="relative z-10">Reveal Gift</span>
                      <div className="main-experience-gift-reveal-fill" />
                    </button>
                  ) : (
                    <div className="animate-fade-in w-full">
                      <a 
                        href={isPreview ? '#' : data.giftLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="main-experience-gift-access"
                      >
                        Access Now
                      </a>
                    </div>
                  )}
                </div>

                <div className="main-experience-gift-barcode">
                  <div className="main-experience-gift-serial">
                    NO. {data.sessionId?.substring(0,8).toUpperCase() || "849201"}
                  </div>
                  <div className="main-experience-gift-bars">
                    {[...Array(12)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`${i % 3 === 0 ? 'w-[2px] md:h-[1px] md:w-full h-full' : 'w-[1px] md:h-[0.5px] md:w-4/5 h-2/3'}`}
                        style={{ backgroundColor: theme.gold }}
                      />
                    ))}
                  </div>
                  <div className="md:mt-8 text-xl font-serif-elegant italic" style={{ color: theme.gold, opacity: 0.3 }}>V</div>
                </div>
              </div>
            </div>
          </div>
        </PaperSurface>
      )}

      {/* SECTION: Final Closure — the one and only ending */}
      {!isPreview && (
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="section"
          className="snap-section h-screen w-full flex flex-col items-center justify-center snap-start px-8"
        >
          <div className="text-center">
            {/* Soft closure message — woven into the real ending */}
            <p 
              className="text-[9px] uppercase tracking-[0.4em] font-bold mb-8"
              style={{ color: theme.gold, opacity: 0.25, animation: 'closureReveal 1s ease-out both' }}
            >
              Created for you. Only you.
            </p>

            <p
              style={{
                fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
                fontStyle: 'italic',
                fontSize: 'clamp(1.2rem, 4vw, 2rem)',
                color: theme.text,
                lineHeight: 1.6,
                animation: 'closureReveal 1.2s ease-out 0.4s both',
              }}
            >
              Sealed by {data.senderName}
            </p>

            {(data.sealedAt || data.createdAt) && (
              <p 
                className="mt-3 text-[10px] uppercase tracking-[0.3em] font-bold"
                style={{ color: theme.gold, opacity: 0.4, animation: 'closureReveal 1s ease-out 1s both' }}
              >
                {(() => {
                  const d = new Date(data.sealedAt || data.createdAt || '');
                  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    + ' · '
                    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                })()}
              </p>
            )}

            <div 
              className="h-px mx-auto my-10"
              style={{ backgroundColor: theme.gold, opacity: 0.15, animation: 'closureLine 0.8s ease-out 1.6s both' }}
            />

            {/* Reply CTA */}
            <div style={{ animation: 'closureReveal 0.8s ease-out 2.2s both' }}>
              {data.replyEnabled ? (
                <>
                  <p className="text-[10px] tracking-[0.15em] text-white/25 font-serif-elegant italic mb-3">
                    Your turn.
                  </p>
                  <p className="text-[10px] tracking-[0.12em] text-white/15 mb-6 max-w-[280px] mx-auto leading-relaxed">
                    If you wish... you can seal something back.
                  </p>
                  <button
                    onClick={() => setShowReplyComposer(true)}
                    className="inline-block px-8 py-3 border transition-all duration-300"
                    style={{
                      fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
                      fontStyle: 'italic',
                      fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)',
                      letterSpacing: '0.1em',
                      borderColor: theme.gold + '66',
                      color: theme.text,
                    }}
                  >
                    Seal a reply
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[10px] tracking-[0.15em] text-white/25 font-serif-elegant italic mb-6">
                    Words left unsaid?
                  </p>
                  <a
                    href="/"
                    className="inline-block px-8 py-3 border transition-all duration-300"
                    style={{
                      fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
                      fontStyle: 'italic',
                      fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)',
                      letterSpacing: '0.1em',
                      borderColor: theme.gold + '66',
                      color: theme.text,
                    }}
                  >
                    Seal something back for {data.senderName}
                  </a>
                </>
              )}
            </div>
          </div>
        </PaperSurface>
      )}

      </>)}

      {/* Reply Composer — ceremonial single reply */}
      {showReplyComposer && !replySealed && (
        <div 
          className="fixed inset-0 z-[350] flex flex-col items-center justify-center select-none px-6"
          style={{ backgroundColor: theme.bg, animation: 'exitIntentIn 0.5s ease-out both' }}
        >
          <p
            className="mb-2"
            style={{
              fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
              color: theme.text,
              animation: 'closureReveal 0.8s ease-out 0.2s both',
            }}
          >
            Your reply to {data.senderName}
          </p>
          <p 
            className="text-[9px] uppercase tracking-[0.3em] text-white/20 mb-8"
            style={{ animation: 'closureReveal 0.6s ease-out 0.6s both' }}
          >
            One message. Make it count.
          </p>

          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
            placeholder="Write what you feel..."
            maxLength={500}
            rows={6}
            className="w-full max-w-md bg-transparent rounded-none p-5 text-white/80 text-sm leading-relaxed resize-none focus:outline-none placeholder-white/15"
            style={{
              fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
              fontStyle: 'italic',
              animation: 'closureReveal 0.8s ease-out 0.8s both',
              borderColor: theme.gold + '33',
            }}
            autoFocus
          />
          <p 
            className="mt-2 text-[8px] text-white/15 tracking-wide self-end max-w-md w-full text-right"
            style={{ animation: 'closureReveal 0.6s ease-out 1s both' }}
          >
            {replyText.length}/500
          </p>

          <div 
            className="mt-8 flex flex-col items-center gap-4"
            style={{ animation: 'closureReveal 0.8s ease-out 1.2s both' }}
          >
            <button
              onClick={async () => {
                if (!replyText.trim() || replySending) return;
                setReplySending(true);
                try {
                  // TODO: Store reply in Firebase under sessions/{sessionId}/reply
                  await new Promise(r => setTimeout(r, 1200));
                  setReplySealed(true);
                } catch {
                  setReplySending(false);
                }
              }}
              disabled={!replyText.trim() || replySending}
              className={`px-10 py-3 border transition-all duration-300 ${
                replyText.trim() && !replySending
                  ? ''
                  : 'border-white/10 text-white/20 cursor-not-allowed'
              }`}
              style={{
                fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
                fontStyle: 'italic',
                fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
                letterSpacing: '0.1em',
                ...(replyText.trim() && !replySending ? {
                  borderColor: theme.gold + '80',
                  color: theme.text,
                } : {}),
              }}
            >
              {replySending ? 'Sealing...' : 'Seal this reply'}
            </button>

            <button
              onClick={() => setShowReplyComposer(false)}
              className="text-[8px] uppercase tracking-[0.4em] text-white/15 hover:text-white/30 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Reply Sealed Confirmation */}
      {replySealed && (
        <div 
          className="fixed inset-0 z-[350] flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: theme.bg, animation: 'exitIntentIn 0.6s ease-out both' }}
        >
          <p
            style={{
              fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
              color: theme.text,
              animation: 'closureReveal 1s ease-out 0.3s both',
            }}
          >
            Your words have been sealed.
          </p>

          <div 
            className="h-px mx-auto my-8"
            style={{ backgroundColor: theme.gold, opacity: 0.2, animation: 'closureLine 0.8s ease-out 1.2s both' }}
          />

          <p 
            className="text-[10px] uppercase tracking-[0.3em] font-bold"
            style={{ color: theme.gold, opacity: 0.3, animation: 'closureReveal 0.8s ease-out 2s both' }}
          >
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {' · '}
            {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>

          <button
            onClick={() => {
              setShowReplyComposer(false);
              setReplySealed(false);
            }}
            className="mt-12 text-[8px] uppercase tracking-[0.4em] text-white/15 hover:text-white/30 transition-colors"
            style={{ animation: 'closureReveal 0.8s ease-out 3s both' }}
          >
            Return
          </button>
        </div>
      )}

      {/* Exit Whisper — soft nudge, not a gate. Dismisses cleanly. */}
      {showExitWhisper && (
        <div 
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: theme.bg, opacity: 0.98, animation: 'exitIntentIn 0.6s ease-out both' }}
        >
          <p
            style={{
              fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.2rem, 4vw, 2rem)',
              color: theme.text,
              lineHeight: 1.6,
              animation: 'closureReveal 0.8s ease-out 0.3s both',
            }}
          >
            Before you go...
          </p>

          <div 
            className="h-px mx-auto my-6 w-12"
            style={{ backgroundColor: theme.gold, opacity: 0.2, animation: 'closureLine 0.6s ease-out 0.8s both' }}
          />

          <p 
            className="text-[10px] tracking-[0.15em] font-serif-elegant italic"
            style={{ color: theme.text, opacity: 0.35, animation: 'closureReveal 0.8s ease-out 1.2s both' }}
          >
            {data.senderName} left something more for you
          </p>

          <button
            onClick={() => {
              setShowExitWhisper(false);
              setShowExitOverlay(true);
            }}
            className="mt-10 px-8 py-3 border transition-all duration-300"
            style={{ 
              animation: 'closureReveal 0.8s ease-out 1.8s both',
              fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
              letterSpacing: '0.1em',
              borderColor: theme.gold + '44',
              color: theme.text,
            }}
          >
            Show me
          </button>

          <button
            onClick={() => setShowExitWhisper(false)}
            className="mt-4 text-[8px] uppercase tracking-[0.4em] transition-colors"
            style={{ color: theme.text, opacity: 0.15, animation: 'closureReveal 0.6s ease-out 2.2s both' }}
          >
            Maybe later
          </button>
        </div>
      )}

      {/* Exit Overlay — fullscreen popup with remaining content */}
      {showExitOverlay && (
        <div 
          className="fixed inset-0 z-[280] overflow-y-auto"
          style={{ backgroundColor: theme.bg, animation: 'exitIntentIn 0.8s ease-out both' }}
        >
          {/* Close button */}
          <button
            onClick={() => setShowExitOverlay(false)}
            className="fixed top-6 right-6 z-[290] text-xs uppercase tracking-widest transition-colors"
            style={{ color: theme.text, opacity: 0.2 }}
          >
            ✕
          </button>

          {/* Promises */}
          {coupons.length > 0 && (
            <>
              <div className="min-h-screen w-full flex flex-col items-center justify-center px-8" style={{ backgroundColor: theme.bg }}>
                <p
                  style={{
                    fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
                    fontStyle: 'italic',
                    fontSize: 'clamp(1.2rem, 4vw, 2rem)',
                    color: theme.text,
                    lineHeight: 1.6,
                  }}
                >
                  What I promise you.
                </p>
                <div className="h-px mx-auto mt-8 w-12" style={{ backgroundColor: theme.gold, opacity: 0.2 }} />
              </div>

              <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-20 relative" style={{ backgroundColor: theme.bg }}>
                <div className="relative w-80 md:w-96 h-[28rem] md:h-[32rem] perspective-1000">
                  {coupons.map((coupon, index) => {
                    if (index < currentCouponIndex) return null;
                    const isTop = index === currentCouponIndex;
                    const offset = index - currentCouponIndex;
                    return (
                      <div
                        key={coupon.id}
                        onClick={isTop ? handleNextCoupon : undefined}
                        className={`main-experience-coupon ${isTop ? 'main-experience-coupon--active' : 'main-experience-coupon--stacked'}`}
                        style={!isTop ? ({ '--coupon-offset-y': `${offset * 15}px`, '--coupon-scale': 1 - offset * 0.05 } as React.CSSProperties) : undefined}
                      >
                        <div className="main-experience-coupon-texture" />
                        <div className="flex justify-between items-start opacity-40 relative z-10">
                          <span className="text-[9px] font-bold uppercase tracking-widest">NO. 0{index + 1}</span>
                          <span className="text-2xl">{coupon.icon}</span>
                        </div>
                        <div className="text-center relative z-10 mt-4">
                          <h3 className="font-serif-elegant italic text-3xl mb-6 leading-tight">{coupon.title}</h3>
                          <div className="w-8 h-0.5 mx-auto opacity-10 mb-6" style={{ backgroundColor: theme.text }} />
                          <p className="font-sans text-sm leading-relaxed opacity-70">{coupon.description}</p>
                        </div>
                        <div className="text-center opacity-40 relative z-10">
                          <span className="text-[9px] uppercase tracking-[0.3em] font-bold pb-1" style={{ borderBottom: `1px solid ${theme.text}20` }}>
                            {isTop ? 'Accept Vow' : 'Locked'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {currentCouponIndex >= coupons.length && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center border border-white/10 rounded-sm bg-white/5 backdrop-blur-sm">
                      <span className="text-4xl mb-6 text-white/60">✓</span>
                      <p className="text-xs uppercase tracking-widest text-white/40">Promises Accepted</p>
                    </div>
                  )}
                </div>

                {/* Scroll hint */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center animate-pulse">
                  <p className="text-[8px] uppercase tracking-[0.4em] mb-2" style={{ color: theme.gold, opacity: 0.3 }}>Scroll</p>
                  <span className="text-xs" style={{ color: theme.gold, opacity: 0.25 }}>↓</span>
                </div>
              </div>
            </>
          )}

          {/* Gift */}
          {data.hasGift && (
            <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-20" style={{ backgroundColor: theme.sectionBg }}>
              <div className={`main-experience-gift-container ${isGiftRevealed ? 'main-experience-gift-container--revealed' : ''}`}>
                <div className="main-experience-gift-glow" />
                <div className="main-experience-gift-card">
                  <div className="main-experience-gift-texture" />
                  <div className="main-experience-gift-corners">
                    <div className="main-experience-gift-corner main-experience-gift-corner--tl" />
                    <div className="main-experience-gift-corner main-experience-gift-corner--tr" />
                    <div className="main-experience-gift-corner main-experience-gift-corner--bl" />
                    <div className="main-experience-gift-corner main-experience-gift-corner--br" />
                  </div>
                  <div className="flex flex-col md:flex-row">
                    <div className="main-experience-gift-content">
                      <div className="main-experience-gift-punch main-experience-gift-punch--left" />
                      <div className="main-experience-gift-punch main-experience-gift-punch--right" />
                      <p className="text-[9px] uppercase tracking-[0.5em] mb-2 font-bold" style={{ color: theme.gold, opacity: 0.6 }}>Sealed For You</p>
                      <div className="w-8 h-px mb-10" style={{ backgroundColor: theme.gold, opacity: 0.2 }} />
                      <h2 className="font-serif-elegant italic text-4xl md:text-5xl text-white mb-10 leading-tight text-center relative z-10 drop-shadow-md">{data.giftTitle}</h2>
                      {!isGiftRevealed ? (
                        <button onClick={() => setIsGiftRevealed(true)} className="main-experience-gift-reveal">
                          <span className="relative z-10">Reveal Gift</span>
                          <div className="main-experience-gift-reveal-fill" />
                        </button>
                      ) : (
                        <div className="animate-fade-in w-full">
                          <a href={data.giftLink} target="_blank" rel="noopener noreferrer" className="main-experience-gift-access">Access Now</a>
                        </div>
                      )}
                    </div>
                    <div className="main-experience-gift-barcode">
                      <div className="main-experience-gift-serial">NO. {data.sessionId?.substring(0,8).toUpperCase() || "849201"}</div>
                      <div className="main-experience-gift-bars">
                        {[...Array(12)].map((_, i) => (
                          <div key={i} className={`${i % 3 === 0 ? 'w-[2px] md:h-[1px] md:w-full h-full' : 'w-[1px] md:h-[0.5px] md:w-4/5 h-2/3'}`} style={{ backgroundColor: theme.gold }} />
                        ))}
                      </div>
                      <div className="md:mt-8 text-xl font-serif-elegant italic" style={{ color: theme.gold, opacity: 0.3 }}>V</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Closure + Reply */}
          <div className="min-h-screen w-full flex flex-col items-center justify-center px-8 py-20" style={{ backgroundColor: theme.bg }}>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.4em] font-bold mb-8" style={{ color: theme.gold, opacity: 0.25 }}>
                Created for you. Only you.
              </p>
              <p style={{ fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif', fontStyle: 'italic', fontSize: 'clamp(1.2rem, 4vw, 2rem)', color: theme.text, lineHeight: 1.6 }}>
                Sealed by {data.senderName}
              </p>
              {(data.sealedAt || data.createdAt) && (
                <p className="mt-3 text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: theme.gold, opacity: 0.4 }}>
                  {(() => {
                    const d = new Date(data.sealedAt || data.createdAt || '');
                    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  })()}
                </p>
              )}
              <div className="h-px mx-auto my-10" style={{ backgroundColor: theme.gold, opacity: 0.15 }} />
              {data.replyEnabled ? (
                <button onClick={() => { setShowExitOverlay(false); setShowReplyComposer(true); }} className="inline-block px-8 py-3 border transition-all duration-300" style={{ fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif', fontStyle: 'italic', fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', letterSpacing: '0.1em', borderColor: theme.gold + '66', color: theme.text }}>
                  Seal a reply
                </button>
              ) : (
                <a href="/" className="inline-block px-8 py-3 border transition-all duration-300" style={{ fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif', fontStyle: 'italic', fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', letterSpacing: '0.1em', borderColor: theme.gold + '66', color: theme.text }}>
                  Seal something back for {data.senderName}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Controls */}
      {isPreview && (
        <div className="fixed bottom-6 right-6 z-[100] flex gap-2">
          <button 
            onClick={onEdit} 
            className="px-4 py-2 bg-white/10 backdrop-blur text-white text-[9px] uppercase tracking-widest border border-white/20 hover:bg-white/20"
          >
            Edit
          </button>
          <button 
            onClick={onPayment} 
            className="px-4 py-2 text-black text-[9px] uppercase tracking-widest hover:opacity-80"
            style={{ backgroundColor: theme.gold }}
          >
            Finalize
          </button>
        </div>
      )}
    </div>
  );
};