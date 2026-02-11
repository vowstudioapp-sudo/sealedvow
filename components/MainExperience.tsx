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
}> = {
  obsidian: { bg: '#0C0A09', text: '#E5D0A1', gold: '#D4AF37', overlay: 'rgba(0,0,0,0.7)' },
  velvet: { bg: '#1A0B2E', text: '#E9D5FF', gold: '#C084FC', overlay: 'rgba(26, 11, 46, 0.8)' },
  crimson: { bg: '#2B0A0A', text: '#FECDD3', gold: '#F43F5E', overlay: 'rgba(43, 10, 10, 0.8)' },
  midnight: { bg: '#020617', text: '#E0F2FE', gold: '#7DD3FC', overlay: 'rgba(2, 6, 23, 0.8)' },
  evergreen: { bg: '#022C22', text: '#D1FAE5', gold: '#34D399', overlay: 'rgba(2, 44, 34, 0.8)' },
  pearl: { bg: '#1C1917', text: '#F5F5F4', gold: '#A8A29E', overlay: 'rgba(28, 25, 23, 0.8)' }, 
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
    if (data.memoryBoard && data.memoryBoard.length >= 5) count++;
    if (data.sacredLocation) count++;
    if (data.coupons && data.coupons.length > 0) count++;
    if (data.hasGift) count++;
    return count;
  }, [
    data.userImageUrl,
    data.aiImageUrl,
    data.memoryBoard?.length,
    data.sacredLocation,
    data.coupons?.length,
    data.hasGift
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
            "{data.myth || 'Two souls, one timeline.'}"
          </h1>
        </div>
      </section>

      {/* SECTION: Image */}
      {(data.userImageUrl || data.aiImageUrl) && (
        <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center snap-start overflow-hidden bg-black">
          <div className="main-experience-image-blur">
            <img src={data.userImageUrl || data.aiImageUrl} className="w-full h-full object-cover" alt="Background" />
          </div>
          <div className="main-experience-polaroid">
            <div className="main-experience-polaroid-img">
              <img src={data.userImageUrl || data.aiImageUrl} className="w-full h-full object-cover" alt="Memory" />
              <div className="main-experience-polaroid-texture" />
            </div>
            <div className="main-experience-polaroid-caption">
              <p className="font-serif-elegant italic text-2xl text-white/90 mb-2">{data.timeShared}</p>
              <div className="w-8 h-px bg-white/30 mx-auto my-3" />
              <p className="text-[8px] uppercase tracking-[0.4em] opacity-50">Time Dilation</p>
            </div>
          </div>
        </section>
      )}

      {/* SECTION: Memory Board */}
      {interactivePhotos && interactivePhotos.length >= 5 && (
        <section className="snap-section min-h-[100vh] w-full relative flex flex-col items-center justify-center snap-start overflow-hidden bg-[#EAE6DF] py-32">
          <div className="main-experience-board-texture" />
          
          <div className="main-experience-board-header">
            <h2 className="text-[10px] uppercase tracking-[0.5em] text-[#8B5E3C] font-bold mb-2">A beautiful mess</h2>
            <h1 className="text-3xl md:text-5xl font-serif-elegant italic text-[#2D2424] mb-3">Fragments of Us</h1>
            <p className="text-[9px] uppercase tracking-widest text-[#8B5E3C]/80 font-bold animate-pulse">Tap and drag to explore</p>
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
                    <img src={photo.url} className="w-full h-full object-cover grayscale-[0.2]" alt="Memory" draggable="false" />
                  </div>
                  {photo.caption && (
                    <p className="font-romantic text-2xl md:text-3xl text-center mt-3 md:mt-5 text-[#2D2424]/90 -rotate-2 pointer-events-none">
                      {photo.caption}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION: Letter */}
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
              <div className="main-experience-letter-signature">
                <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent mb-6" />
                <p className="font-romantic text-4xl text-[#D4AF37]/90 mb-10">{data.senderName}</p>
                
                {audioBuffer && (
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
                      {isVoicePlaying ? 'Listening...' : 'Play Voice Note'}
                    </span>
                  </button>
                )}
              </div>
            )}
            
            {currentParagraph < letterParagraphs.length - 1 && (
              <div className="mt-12 animate-pulse opacity-30 text-[9px] uppercase tracking-widest text-[#D4AF37]">
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

      {/* SECTION: Location */}
      {data.sacredLocation && (
        <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center snap-start overflow-hidden">
          <div className="main-experience-location-bg">
            <div className="main-experience-location-texture" />
            <div className="main-experience-location-ring main-experience-location-ring--outer" />
            <div className="main-experience-location-ring main-experience-location-ring--inner" />
          </div>

          <div className="main-experience-location-card">
            <div className="text-[#D4AF37] text-2xl mb-4 animate-bounce">📍</div>
            <h3 className="text-[#D4AF37]/80 text-[9px] uppercase tracking-[0.4em] font-bold mb-6">Cosmic Coordinate</h3>
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

      {/* SECTION: Coupons */}
      {coupons && coupons.length > 0 && (
        <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center snap-start overflow-hidden">
          <div className="mb-16 text-center">
            <h2 className="text-[9px] uppercase tracking-[0.5em] text-white/50 font-bold mb-2">The Vows</h2>
            <p className="text-white/30 text-[8px] tracking-widest italic">Three Promises</p>
          </div>

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
                    <div className="w-8 h-0.5 bg-[#2D2424] mx-auto opacity-10 mb-6" />
                    <p className="font-sans text-sm leading-relaxed opacity-70">{coupon.description}</p>
                  </div>

                  <div className="text-center opacity-40 relative z-10">
                    <span className="text-[9px] uppercase tracking-[0.3em] font-bold border-b border-[#2D2424]/20 pb-1">
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
        </section>
      )}

      {/* SECTION: Gift */}
      {data.hasGift && (
        <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center snap-start bg-[#050505]">
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
                  
                  <p className="text-[#D4AF37]/60 text-[9px] uppercase tracking-[0.5em] mb-2 font-bold">Admit One</p>
                  <div className="w-8 h-px bg-[#D4AF37]/20 mb-10" />
                  
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
                        className={`bg-[#D4AF37] ${i % 3 === 0 ? 'w-[2px] md:h-[1px] md:w-full h-full' : 'w-[1px] md:h-[0.5px] md:w-4/5 h-2/3'}`}
                      />
                    ))}
                  </div>
                  <div className="md:mt-8 text-[#D4AF37]/30 text-xl font-serif-elegant italic">V</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-12 opacity-30 flex flex-col items-center gap-2">
            <div className="w-px h-8 bg-white/50" />
            <p className="text-[8px] uppercase tracking-[0.8em] text-white">Forever Yours</p>
          </div>
        </section>
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
            className="px-4 py-2 bg-[#D4AF37] text-black text-[9px] uppercase tracking-widest hover:bg-white"
          >
            Finalize
          </button>
        </div>
      )}
    </div>
  );
};
