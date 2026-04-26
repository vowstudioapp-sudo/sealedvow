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
import { CoupleData, Coupon, Theme } from '../types';
import { OCCASION_OPENING_LINES } from '@/content/occasionLines';
import { experienceTheme, getCinematicLayer, THEME_SYSTEM, UI_PALETTE } from '../theme/themeSystem';
import { PaperSurface } from './PaperSurface';
import { LetterSection } from './experience/LetterSection';
import { MemoryBoard } from './experience/MemoryBoard';
import { PromiseStack } from './experience/PromiseStack';
import { GiftReveal } from './experience/GiftReveal';
import { ReplyComposer } from './experience/ReplyComposer';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  data: CoupleData;
  isPreview?: boolean;
  isDemoMode?: boolean;
  onPayment?: () => void;
  onEdit?: () => void;
}

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

/** Detect if a URL is a YouTube link */
function isYouTubeLink(url?: string): boolean {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

/** Extract YouTube video ID from various URL formats */
function getYouTubeEmbedId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export const MainExperience: React.FC<Props> = ({ data, isPreview = false, isDemoMode = false, onPayment, onEdit }) => {
  /* ------------------------------------------------------------------ */
  /* STATE                                                               */
  /* ------------------------------------------------------------------ */

  const [coupons, setCoupons] = useState<Coupon[]>(data.coupons || []);
  const [currentCouponIndex, setCurrentCouponIndex] = useState(0);
  const [isGiftRevealed, setIsGiftRevealed] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [sections, setSections] = useState<number[]>([]);
  
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [showExitWhisper, setShowExitWhisper] = useState(false);
  const [showExitOverlay, setShowExitOverlay] = useState(false);
  const [locationUnlocked, setLocationUnlocked] = useState(false);
  const [locationCardHover, setLocationCardHover] = useState(false);
  const [demoConversionBtnHover, setDemoConversionBtnHover] = useState(false);
  const exitWhisperShownRef = useRef(false);

  // Exit intent — soft whisper when user tries to leave
  // Desktop: cursor moves to top of screen (desktop only)
  // Mobile: user reaches last section + stays there for 2.5s
  // Visibility: only triggers at last section (not mid-flow)
  // Preview: always allow trigger so sender sees the feature
  const mobileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Precise last-section check — exact match, not greater-than
  const atLastSection = useMemo(() => {
    const lastIndex = sections.length - 1;
    return lastIndex >= 0 && activeSection === lastIndex;
  }, [activeSection, sections.length]);

  useEffect(() => {
    if (exitWhisperShownRef.current) return;

    const shouldTrigger = () => {
      if (exitWhisperShownRef.current) return false;
      // Preview: always allow
      if (isPreview) return true;
      // Only at the emotional end — last section or location gate
      if (atLastSection) return true;
      if (data.sacredLocation && !locationUnlocked) return true;
      return false;
    };

    // Desktop only: cursor leaves viewport at top
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5 && shouldTrigger()) {
        exitWhisperShownRef.current = true;
        setShowExitWhisper(true);
      }
    };

    // Both: tab switch / phone lock — only at last section
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && (atLastSection || (data.sacredLocation && !locationUnlocked) || isPreview)) {
        if (exitWhisperShownRef.current) return;
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

    if (isDesktop) {
      document.addEventListener('mouseleave', handleMouseLeave);
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (isDesktop) {
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPreview, atLastSection, locationUnlocked, data.sacredLocation]);

  // Mobile: trigger whisper when user reaches last section AND stays there
  useEffect(() => {
    if (isPreview) return;
    if (exitWhisperShownRef.current) return;
    if (sections.length === 0) return;

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;

    if (atLastSection) {
      if (!mobileTimerRef.current) {
        mobileTimerRef.current = setTimeout(() => {
          if (!exitWhisperShownRef.current) {
            exitWhisperShownRef.current = true;
            setShowExitWhisper(true);
          }
          mobileTimerRef.current = null;
        }, 2500);
      }
    } else {
      if (mobileTimerRef.current) {
        clearTimeout(mobileTimerRef.current);
        mobileTimerRef.current = null;
      }
    }

    return () => {
      if (mobileTimerRef.current) {
        clearTimeout(mobileTimerRef.current);
        mobileTimerRef.current = null;
      }
    };
  }, [atLastSection, sections.length, isPreview]);


  /* ------------------------------------------------------------------ */
  /* REFS                                                                */
  /* ------------------------------------------------------------------ */

  const containerRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------ */
  /* DERIVED VALUES                                                      */
  /* ------------------------------------------------------------------ */

  const themeId = data.theme || 'obsidian';
  const themeTokens = THEME_SYSTEM[themeId] ?? THEME_SYSTEM.obsidian;
  const theme = experienceTheme(themeId);
  const cinematic = useMemo(() => getCinematicLayer(themeTokens), [themeId]);
  const { readability: read } = cinematic;
  const isLightMode = themeTokens.mode === 'light';
  const locationGlowRgba = `rgba(${themeTokens.accentRgb},${(0.15 * cinematic.glowStrength).toFixed(3)})`;
  const modalBackdropResolved = isLightMode ? 'rgba(28,25,23,0.4)' : themeTokens.modalBackdrop;
  const modalSurfaceResolved = isLightMode ? 'rgba(250,250,250,0.96)' : themeTokens.modalSurface;
  const modalCloseResolved = isLightMode ? 'rgba(44,40,40,0.55)' : themeTokens.modalClose;
  const activeVideo = data.video?.url;
  const hasVideo = !!activeVideo && data.videoSource !== 'none';
  const openingLine =
    OCCASION_OPENING_LINES[data.occasion] ||
    OCCASION_OPENING_LINES.anniversary;

  // Derive sealed date once — validated and memoized
  const sealedDate = useMemo(() => {
    if (!data.sealedAt && !data.createdAt) return null;
    const raw = data.sealedAt || data.createdAt;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }, [data.sealedAt, data.createdAt]);

  /* ------------------------------------------------------------------ */
  /* SECTION COUNT (Optimized Observer Deps)                            */
  /* ------------------------------------------------------------------ */

  const sectionCount = useMemo(() => {
    let count = 2; // Hero + Letter always present
    if (data.userImageUrl) count++;
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
    data.memoryBoard?.length,
    data.sacredLocation,
    data.coupons?.length,
    data.hasGift,
    isPreview,
    locationUnlocked,
  ]);

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
  /* HANDLERS                                                            */
  /* ------------------------------------------------------------------ */

  // Scroll lock callbacks for MemoryBoard drag — parent owns scroll container
  const handleDragStart = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.overflowY = 'hidden';
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.overflowY = 'scroll';
    }
  }, []);

  const handleNextCoupon = useCallback(() => {
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
        <div className="main-experience-vignette" style={{ background: cinematic.vignette }} />
      </div>

      <div className="main-experience-nav-dots">
        {sections.map(idx => (
          <div 
            key={idx} 
            className={`main-experience-nav-dot ${activeSection === idx ? 'main-experience-nav-dot--active' : ''}`}
          />
        ))}
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
            <p className="main-experience-hero-occasion">{openingLine}</p>
          </div>
          <h1 className="main-experience-hero-title">
            "{data.myth || (data.timeShared ? `${data.timeShared}. One story.` : 'Two souls, one timeline.')}"
          </h1>
        </div>
      </section>

      {/* SECTION: Image */}
      {data.userImageUrl && (
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="section"
          className="snap-section h-screen w-full flex flex-col items-center justify-center snap-start overflow-hidden"
        >
          <div className="main-experience-image-blur">
            <img src={data.userImageUrl} className="w-full h-full object-cover" alt="Background" loading="lazy" />
          </div>
          <div className="main-experience-polaroid">
            <div className="main-experience-polaroid-img">
              <img 
                src={data.userImageUrl}
                className="w-full h-full object-cover"
                style={{ animation: 'kenBurns 12s ease-in-out infinite alternate', willChange: 'transform' }}
                loading="lazy"
                alt="Memory" 
              />
              <div className="main-experience-polaroid-texture" />
            </div>
            <div className="main-experience-polaroid-caption">
              <p className="font-serif-elegant italic text-2xl mb-2" style={{ color: read.primary }}>{data.timeShared}</p>
              <div className="w-8 h-px mx-auto my-3" style={{ backgroundColor: read.secondary }} />
              <p className="text-[8px] uppercase tracking-[0.4em]" style={{ color: read.muted }}>Time Dilation</p>
            </div>
          </div>
        </PaperSurface>
      )}

      {/* SECTION: YouTube Video (soundtrack rendered as embedded player) */}
      {data.musicType === 'youtube' && data.musicUrl && isYouTubeLink(data.musicUrl) && (
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="section"
          className="snap-section h-screen w-full flex flex-col items-center justify-center snap-start px-4 md:px-8"
        >
          <div className="text-center w-full max-w-2xl mx-auto">
            <p 
              className="text-[9px] uppercase tracking-[0.5em] font-bold mb-6"
              style={{ color: theme.gold, opacity: 0.5, animation: 'closureReveal 0.8s ease-out both' }}
            >
              A Soundtrack For You
            </p>

            <div 
              className="w-full rounded-xl overflow-hidden shadow-2xl"
              style={{ 
                border: `1px solid ${theme.gold}20`,
                animation: 'closureReveal 1s ease-out 0.3s both',
              }}
            >
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeEmbedId(data.musicUrl)}?rel=0&modestbranding=1`}
                  title="Soundtrack"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 'none' }}
                />
              </div>
            </div>

            <p 
              className="mt-6 text-[8px] uppercase tracking-[0.3em]"
              style={{ color: read.muted, animation: 'closureReveal 0.8s ease-out 0.8s both' }}
            >
              Press play
            </p>
          </div>
        </PaperSurface>
      )}

      {/* SECTION: Letter (emotional peak — comes early) */}
      <LetterSection
        finalLetter={data.finalLetter || ''}
        senderName={data.senderName}
        audioUrl={data.audio?.url}
        theme={theme}
        readability={read}
        surfaceTheme={data.theme || 'obsidian'}
        activeSection={activeSection}
      />

      {/* SECTION: Memory Board (warm decompression after letter) */}
      {data.memoryBoard && data.memoryBoard.length >= 1 && (
        <MemoryBoard
          photos={data.memoryBoard}
          theme={theme}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      )}

      {/* SECTION: Location */}
      {data.sacredLocation && (
        <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center snap-start overflow-hidden">
          <div className="main-experience-location-bg">
            <div className="main-experience-location-texture" />
            <div className="main-experience-location-ring main-experience-location-ring--outer" />
            <div className="main-experience-location-ring main-experience-location-ring--inner" />
          </div>

          {/* Compact Card — click to expand */}
          <div 
            className="main-experience-location-card cursor-pointer transition-all duration-300 hover:scale-[1.02]"
            style={{
              boxShadow: locationCardHover ? `0 0 40px ${locationGlowRgba}` : undefined,
              transition: 'box-shadow 0.3s ease-out, transform 0.3s ease-out',
            }}
            onMouseEnter={() => setLocationCardHover(true)}
            onMouseLeave={() => setLocationCardHover(false)}
            onClick={() => setLocationExpanded(true)}
          >
            <div className="text-2xl mb-4 animate-bounce" style={{ color: theme.gold }}>📍</div>
            <h3 className="text-[9px] uppercase tracking-[0.4em] font-bold mb-6" style={{ color: theme.gold, opacity: 0.8 }}>Cosmic Coordinate</h3>
            <h2 className="font-serif-elegant italic text-3xl mb-6 leading-tight" style={{ color: read.primary }}>{data.sacredLocation.placeName}</h2>
            <div className="w-12 h-px mx-auto mb-6" style={{ backgroundColor: read.muted }} />
            <p className="text-xs italic leading-relaxed mb-6 font-serif-elegant line-clamp-2" style={{ color: read.secondary }}>
              "{data.sacredLocation.description}"
            </p>
            <div className="text-[8px] uppercase tracking-[0.3em] font-bold" style={{ color: theme.gold, opacity: 0.5 }}>
              Tap to explore →
            </div>
          </div>

          {/* Expanded Modal */}
          {locationExpanded && (
            <div 
              className="fixed inset-0 z-[200] flex items-center justify-center p-6"
              onClick={() => setLocationExpanded(false)}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 backdrop-blur-md"
                style={{ animation: 'fadeIn 0.3s ease', backgroundColor: modalBackdropResolved }}
              />
              
              {/* Modal Content */}
              <div 
                className="relative max-w-lg w-full rounded-2xl p-8 md:p-12 text-center border overflow-y-auto max-h-[85vh]"
                style={{ 
                  backgroundColor: modalSurfaceResolved, 
                  borderColor: `${theme.gold}30`,
                  boxShadow: `0 25px 60px ${cinematic.shadowStrength}, 0 0 40px ${theme.gold}10`,
                  animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button 
                  onClick={() => setLocationExpanded(false)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                  style={{ color: modalCloseResolved }}
                >
                  ✕
                </button>

                <div className="text-3xl mb-6" style={{ color: theme.gold }}>📍</div>
                <h3 className="text-[9px] uppercase tracking-[0.5em] font-bold mb-4" style={{ color: theme.gold, opacity: 0.8 }}>Cosmic Coordinate</h3>
                <h2 className="font-serif-elegant italic text-2xl md:text-3xl mb-6 leading-tight" style={{ color: read.primary }}>{data.sacredLocation.placeName}</h2>
                
                <div className="w-16 h-px mx-auto mb-8" style={{ backgroundColor: `${theme.gold}30` }} />
                
                <p className="text-sm italic leading-relaxed mb-10 font-serif-elegant max-w-md mx-auto" style={{ color: read.secondary }}>
                  "{data.sacredLocation.description}"
                </p>

                {data.sacredLocation.latLng && (
                  <div className="mb-8 text-[10px] uppercase tracking-widest font-bold" style={{ color: read.muted }}>
                    {data.sacredLocation.latLng.lat.toFixed(4)}° N · {data.sacredLocation.latLng.lng.toFixed(4)}° E
                  </div>
                )}
                
                <a 
                  href={data.sacredLocation.googleMapsUri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-[10px] uppercase tracking-[0.3em] font-bold transition-all hover:scale-[1.03]"
                  style={{ 
                    color: theme.gold,
                    border: `1px solid ${theme.gold}40`,
                    backgroundColor: `${theme.gold}08`
                  }}
                >
                  <span>View on Map</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          )}
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
                color: read.primary,
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
          <PromiseStack
            coupons={coupons}
            currentCouponIndex={currentCouponIndex}
            onClaim={handleNextCoupon}
            theme={theme}
          />
        </PaperSurface>
      )}

      {/* SECTION: Gift */}
      {!isPreview && data.hasGift && (
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="section"
          className="snap-section min-h-screen w-full flex flex-col items-center justify-center snap-start px-4 py-20"
        >
          <GiftReveal
            isRevealed={isGiftRevealed}
            onReveal={() => setIsGiftRevealed(true)}
            giftTitle={data.giftTitle}
            giftNote={data.giftNote}
            giftLink={isPreview ? '#' : data.giftLink}
            sessionId={data.sessionId}
            theme={theme}
          />
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
            <p 
              className="text-[9px] uppercase tracking-[0.4em] font-bold mb-8"
              style={{ color: theme.gold, opacity: 0.6, animation: 'closureReveal 1s ease-out both' }}
            >
              Created for you. Only you.
            </p>

            <p
              style={{
                fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
                fontStyle: 'italic',
                fontSize: 'clamp(1.2rem, 4vw, 2rem)',
                color: read.primary,
                lineHeight: 1.6,
                animation: 'closureReveal 1.2s ease-out 0.4s both',
              }}
            >
              Sealed by {data.senderName}
            </p>

            {sealedDate && (
              <p 
                className="mt-3 text-[10px] uppercase tracking-[0.3em] font-bold"
                style={{ color: theme.gold, opacity: 0.6, animation: 'closureReveal 1s ease-out 1s both' }}
              >
                {sealedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  + ' · '
                  + sealedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            )}
          </div>
        </PaperSurface>
      )}

      {/* DEMO: Final Conversion Screen — the only CTA in the entire demo */}
      {isDemoMode && !isPreview && (
        <section className="snap-section min-h-screen w-full flex flex-col items-center justify-center snap-start px-8 relative" style={{ backgroundColor: themeTokens.bg }}>
          <div className="text-center max-w-md mx-auto">

            <div className="mb-16" style={{ animation: 'closureReveal 1.2s ease-out 0.2s both' }}>
              <p className="text-[13px] italic leading-relaxed mb-3" style={{ fontFamily: '"Playfair Display", Georgia, serif', color: read.secondary }}>
                They didn't speak for a few seconds.
              </p>
              <p className="text-[13px] italic leading-relaxed" style={{ fontFamily: '"Playfair Display", Georgia, serif', color: read.secondary }}>
                Then softly,<br/>
                "You actually made this for me?"
              </p>
            </div>

            <div
              className="w-px h-12 mx-auto mb-10"
              style={{ animation: 'closureReveal 0.8s ease-out 1s both', backgroundImage: `linear-gradient(to bottom, transparent, ${themeTokens.accent}33, transparent)` }}
            />

            <div style={{ animation: 'closureReveal 0.8s ease-out 1.2s both' }}>
              <p className="text-[11px] italic font-serif-elegant mb-10 leading-relaxed" style={{ color: read.secondary }}>
                If this reminded you of someone — don't scroll away.
              </p>
            </div>

            <div style={{ animation: 'closureReveal 1s ease-out 1.6s both' }}>
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold mb-2" style={{ color: read.secondary }}>Love should not be assumed.</p>
              <p className="text-[9px] italic mb-10" style={{ color: read.muted }}>It should be expressed.</p>
            </div>

            <div style={{ animation: 'closureReveal 0.8s ease-out 2.2s both' }}>
              <button
                onClick={() => { window.location.href = '/create'; }}
                className="font-bold text-[11px] tracking-[0.4em] uppercase px-14 py-5 rounded-full shadow-2xl transition-all duration-300 active:scale-[0.98]"
                style={{
                  backgroundColor: demoConversionBtnHover ? themeTokens.ctaSealHover : themeTokens.seal,
                  color: UI_PALETTE.onVividFill,
                }}
                onMouseEnter={() => setDemoConversionBtnHover(true)}
                onMouseLeave={() => setDemoConversionBtnHover(false)}
              >
                Create Your Own
              </button>
            </div>

            <div className="mt-8" style={{ animation: 'closureReveal 0.8s ease-out 3s both' }}>
              <p className="text-[7px] uppercase tracking-[0.3em]" style={{ color: read.muted }}>This is how people are choosing to say it this year.</p>
            </div>

          </div>
        </section>
      )}

      </>)}

      {/* Reply Composer — ceremonial single reply */}
      {showReplyComposer && (
        <ReplyComposer
          senderName={data.senderName}
          theme={theme}
          onClose={() => setShowReplyComposer(false)}
        />
      )}

      {/* Exit Whisper — soft nudge, not a gate. Dismisses cleanly. */}
      {showExitWhisper && (
        <div 
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: theme.bg, opacity: cinematic.overlayOpacity, animation: 'exitIntentIn 0.6s ease-out both' }}
        >
          <p
            style={{
              fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.2rem, 4vw, 2rem)',
              color: read.primary,
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
            style={{ color: read.secondary, animation: 'closureReveal 0.8s ease-out 1.2s both' }}
          >
            {isPreview ? 'This is what your receiver will see when they try to leave' : `${data.senderName} left something more for you`}
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
              color: read.primary,
            }}
          >
            Reveal it
          </button>

          <button
            onClick={() => setShowExitWhisper(false)}
            className="mt-4 text-[8px] uppercase tracking-[0.4em] transition-colors"
            style={{ color: read.muted, animation: 'closureReveal 0.6s ease-out 2.2s both' }}
          >
            Maybe later
          </button>
        </div>
      )}

      {/* Exit Overlay — fullscreen popup with remaining content */}
      {showExitOverlay && (
        <div 
          className="fixed inset-0 z-[280] overflow-y-auto"
          style={{ backgroundColor: theme.bg, opacity: cinematic.overlayOpacity, animation: 'exitIntentIn 0.8s ease-out both' }}
        >
          {/* Close button */}
          <button
            onClick={() => setShowExitOverlay(false)}
            className="fixed top-6 right-6 z-[290] text-xs uppercase tracking-widest transition-colors"
            style={{ color: read.muted }}
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
                    color: read.primary,
                    lineHeight: 1.6,
                  }}
                >
                  What I promise you.
                </p>
                <div className="h-px mx-auto mt-8 w-12" style={{ backgroundColor: theme.gold, opacity: 0.2 }} />
              </div>

              <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-20 relative" style={{ backgroundColor: theme.bg }}>
                <PromiseStack
                  coupons={coupons}
                  currentCouponIndex={currentCouponIndex}
                  onClaim={handleNextCoupon}
                  theme={theme}
                />

                {/* Scroll hint */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center animate-pulse">
                  <p className="text-[8px] uppercase tracking-[0.4em] mb-2" style={{ color: theme.gold, opacity: 0.6 }}>Scroll</p>
                  <span className="text-xs" style={{ color: theme.gold, opacity: 0.6 }}>↓</span>
                </div>
              </div>
            </>
          )}

          {/* Gift */}
          {data.hasGift && (
            <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-20" style={{ backgroundColor: theme.sectionBg }}>
              <GiftReveal
                isRevealed={isGiftRevealed}
                onReveal={() => setIsGiftRevealed(true)}
                giftTitle={data.giftTitle}
                giftNote={data.giftNote}
                giftLink={data.giftLink}
                sessionId={data.sessionId}
                theme={theme}
              />
            </div>
          )}

          {/* Closure + Reply */}
          <div className="min-h-screen w-full flex flex-col items-center justify-center px-8 py-20" style={{ backgroundColor: theme.bg }}>
            <div className="text-center">
              {/* Seal block - only show for preview and demo, not for actual receivers (they have detailed version below) */}
              {(isPreview && (onPayment || onEdit)) || isDemoMode ? (
                <>
                  <p className="text-[9px] uppercase tracking-[0.4em] font-bold mb-8" style={{ color: theme.gold, opacity: 0.6 }}>
                    Created for you. Only you.
                  </p>
                  <p style={{ fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif', fontStyle: 'italic', fontSize: 'clamp(1.2rem, 4vw, 2rem)', color: read.primary, lineHeight: 1.6 }}>
                    Sealed by {data.senderName}
                  </p>
                  {sealedDate && (
                    <p className="mt-3 text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: theme.gold, opacity: 0.6 }}>
                      {sealedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + sealedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  )}
                  <div className="h-px mx-auto my-10" style={{ backgroundColor: theme.gold, opacity: 0.15 }} />
                </>
              ) : null}

              {isPreview && (onPayment || onEdit) ? (
                <>
                  <p className="text-[10px] tracking-[0.12em] font-serif-elegant italic mb-3" style={{ color: read.secondary }}>
                    {data.replyEnabled 
                      ? `If ${data.recipientName || 'your receiver'} feels moved, they can seal a reply back to you right here.`
                      : `${data.recipientName || 'Your receiver'} will see an option to create their own Sealed Vow for you.`
                    }
                  </p>
                  <div className="inline-block px-8 py-3 border cursor-default" style={{ fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif', fontStyle: 'italic', fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', letterSpacing: '0.1em', borderColor: theme.gold + '66', color: read.secondary }}>
                    {data.replyEnabled ? 'Seal a reply' : `Seal something back for ${data.senderName}`}
                  </div>
                  <p className="mt-3 text-[8px] uppercase tracking-[0.3em]" style={{ color: read.muted }}>
                    ↑ This is what your receiver will see
                  </p>
                </>
              ) : isDemoMode ? (
                <>
                  <div className="text-center mt-2">
                    <p className="text-[11px] italic font-serif-elegant mb-8 leading-relaxed" style={{ color: read.secondary }}>
                      If this reminded you of someone — don't scroll away.
                    </p>
                    <a
                      href="/create"
                      className="inline-block px-14 py-5 rounded-full font-bold text-[11px] tracking-[0.4em] uppercase transition-all duration-300 active:scale-[0.98]"
                      style={{
                        backgroundColor: themeTokens.seal,
                        color: UI_PALETTE.onVividFill,
                        boxShadow: `0 10px 30px rgba(${themeTokens.sealRgb},${(0.4 * cinematic.glowStrength).toFixed(2)})`,
                      }}
                    >
                      Create Your Own
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mt-4">
                    <p className="text-[8px] uppercase tracking-[0.3em] mb-3" style={{ color: theme.gold, opacity: 0.6 }}>
                      Created for you. Only you.
                    </p>
                    <p
                      className="font-serif-elegant italic mb-6"
                      style={{
                        fontSize: 'clamp(1rem, 3vw, 1.4rem)',
                        color: read.muted,
                      }}
                    >
                      Sealed by {data.senderName}
                    </p>
                    {sealedDate && (
                      <div style={{ color: theme.gold, opacity: 0.2 }}>
                        <p className="text-[8px] uppercase tracking-[0.3em] mb-1">Sealed on</p>
                        <p className="text-[10px] font-bold tracking-[0.15em]">
                          {sealedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-[9px] tracking-[0.1em] mt-0.5">
                          {sealedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Creator Preview Controls — Modify + Seal & Deliver */}
      {isPreview && (onPayment || onEdit) && (
        <>
          {/* Exit intent hint — fixed top banner */}
          {!showExitOverlay && !showExitWhisper && !exitWhisperShownRef.current && (
            <div className="fixed top-0 left-0 right-0 z-[400] text-center py-3 px-4" style={{ backgroundColor: theme.bg + 'ee', borderBottom: `1px solid ${theme.gold}15` }}>
              <p className="text-[11px] font-serif-elegant italic" style={{ color: theme.gold, opacity: 0.7 }}>
                ✨ Move your cursor toward the close button — see what your receiver experiences when they try to leave
              </p>
            </div>
          )}
          <div className="fixed bottom-0 left-0 right-0 z-[400]" style={{ background: `linear-gradient(to top, ${theme.bg}, ${theme.bg}ee, transparent)` }}>
          <div className="max-w-md mx-auto px-6 pb-8 pt-6 flex flex-col items-center gap-3">
            {onEdit && (
              <button
                onClick={onEdit}
                className="w-full py-3.5 text-[10px] font-bold uppercase tracking-[0.4em] border rounded-full transition-all duration-300 hover:bg-white/5"
                style={{ borderColor: theme.gold + '40', color: read.primary }}
              >
                ← Modify
              </button>
            )}
            {onPayment && (
              <button
                onClick={onPayment}
                className="w-full py-4 text-[10px] font-bold uppercase tracking-[0.4em] rounded-full transition-all duration-300 shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: themeTokens.seal, color: UI_PALETTE.onVividFill, letterSpacing: '0.4em' }}
              >
                Send letter
              </button>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
};