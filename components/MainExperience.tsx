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
import { experienceTheme, getCinematicLayer, THEME_SYSTEM, UI_PALETTE } from '../theme/themeSystem';
import { safeUrl } from '../utils/safeUrl';
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

/** Format the polaroid caption for the receiver.
 *  Pure integers get a "year(s) together" suffix; anything with non-digit
 *  characters is shown verbatim; empty/zero values return null so the caller
 *  can hide the block. */
function formatCaption(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (n === 0) return null;
    return n === 1 ? '1 year together' : `${n} years together`;
  }
  return trimmed;
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
  const [closureRevealed, setClosureRevealed] = useState(false);
  const [locationCardHover, setLocationCardHover] = useState(false);
  const [demoConversionBtnHover, setDemoConversionBtnHover] = useState(false);

  // Polaroid screen staggered reveal — caption at 1.5s, chevron at 3s
  const [polaroidRevealed, setPolaroidRevealed] = useState({
    caption: false,
    chevron: false,
  });

  const [soundtrackIndex, setSoundtrackIndex] = useState<number | null>(null);
  const [soundtrackHasBeenActive, setSoundtrackHasBeenActive] = useState(false);

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
    let count = 1; // LetterSection — one .snap-section
    if (data.userImageUrl) count++;
    if (data.musicType === 'youtube' && data.musicUrl && isYouTubeLink(data.musicUrl)) count++;
    if (data.memoryBoard && data.memoryBoard.length >= 1) count++;
    if (data.sacredLocation) count++;
    if (!isPreview && coupons.length > 0) count += 2; // promise divider + PromiseStack (each own .snap-section)
    if (!isPreview && data.hasGift) count++;
    if (!isPreview) count++; // final closure (.snap-section wrapper)
    if (isDemoMode && !isPreview) count++;
    return count;
  }, [
    data.userImageUrl,
    data.musicType,
    data.musicUrl,
    data.memoryBoard?.length,
    data.sacredLocation,
    data.hasGift,
    coupons.length,
    isPreview,
    isDemoMode,
  ]);

  /* ------------------------------------------------------------------ */
  /* EFFECT: Polaroid staggered reveal                                  */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!data.userImageUrl) return;
    const captionTimer = setTimeout(() => {
      setPolaroidRevealed(prev => ({ ...prev, caption: true }));
    }, 1500);
    const chevronTimer = setTimeout(() => {
      setPolaroidRevealed(prev => ({ ...prev, chevron: true }));
    }, 3000);
    return () => {
      clearTimeout(captionTimer);
      clearTimeout(chevronTimer);
    };
  }, [data.userImageUrl]);

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
            if (entry.target.getAttribute('data-section-type') === 'closure') {
              setClosureRevealed(true);
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

  useEffect(() => {
    const marker = document.querySelector('[data-section-type="soundtrack"]');
    if (!marker) {
      setSoundtrackIndex(null);
      setSoundtrackHasBeenActive(false);
      return;
    }
    const snap = marker.closest('.snap-section');
    if (!snap) return;
    const raw = snap.getAttribute('data-section');
    if (raw == null) return;
    const index = Number(raw);
    if (!isNaN(index)) {
      setSoundtrackIndex(index);
    }
  }, [data.musicType, data.musicUrl, sectionCount]);

  useEffect(() => {
    if (soundtrackHasBeenActive) return;
    if (soundtrackIndex === null) return;
    if (activeSection === soundtrackIndex) {
      setSoundtrackHasBeenActive(true);
    }
  }, [activeSection, soundtrackIndex, soundtrackHasBeenActive]);

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

      {/* SECTION: Image */}
      {data.userImageUrl && (() => {
        const formattedCaption = formatCaption(data.timeShared);
        return (
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
            {formattedCaption && (
              <div
                className={`main-experience-polaroid-caption polaroid-caption-fade ${polaroidRevealed.caption ? 'polaroid-caption-fade--visible' : ''}`}
              >
                <p className="font-serif-elegant italic text-2xl mb-2" style={{ color: read.primary }}>{formattedCaption}</p>
                <div className="w-8 h-px mx-auto my-3" style={{ backgroundColor: read.secondary }} />
                <p className="text-[8px] uppercase tracking-[0.4em]" style={{ color: read.muted }}>Time Dilation</p>
              </div>
            )}
          </div>

          {/* Subtle scroll cue — appears at 3s, anchored to section */}
          <div
            className={`polaroid-chevron ${polaroidRevealed.chevron ? 'polaroid-chevron--visible' : ''}`}
            onClick={() => {
              const allSections = document.querySelectorAll('.snap-section');
              const nextIndex = activeSection + 1;
              if (nextIndex < allSections.length && allSections[nextIndex]) {
                allSections[nextIndex].scrollIntoView({ behavior: 'smooth' });
              }
            }}
            aria-hidden="true"
          >
            ↓
          </div>
        </PaperSurface>
        );
      })()}

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

      {/* SECTION: YouTube Video (soundtrack rendered as embedded player) */}
      {data.musicType === 'youtube' && data.musicUrl && isYouTubeLink(data.musicUrl) && (
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="section"
          className="snap-section h-screen w-full flex flex-col items-center justify-center snap-start px-4 md:px-8"
        >
          <div
            data-section-type="soundtrack"
            className="w-full flex flex-col items-center justify-center min-h-0"
          >
          <div
            className="text-center w-full max-w-2xl mx-auto"
            style={{
              opacity: soundtrackHasBeenActive ? 1 : 0,
              transform: soundtrackHasBeenActive ? 'translateY(0px)' : 'translateY(16px)',
              transition: 'opacity 500ms ease-out, transform 500ms ease-out',
            }}
          >
            <div
              className="w-full rounded-xl overflow-hidden shadow-2xl"
              style={{
                border: `1px solid ${theme.gold}20`,
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
                <div
                  className="absolute inset-0"
                  style={{
                    background: `
                      radial-gradient(circle at center,
                        rgba(0,0,0,0.0) 0%,
                        rgba(0,0,0,0.12) 60%,
                        rgba(0,0,0,0.28) 100%
                      ),
                      linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.20) 100%)
                    `,
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                  aria-hidden="true"
                />
                <div
                  className="absolute top-0 left-0 w-full"
                  style={{
                    height: '60px',
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.0) 100%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                  aria-hidden="true"
                />
                <div
                  className="absolute bottom-0 right-0"
                  style={{
                    width: '140px',
                    height: '80px',
                    background: 'radial-gradient(ellipse at bottom right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
          </div>
        </PaperSurface>
      )}

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
            <h3 className="text-[9px] uppercase tracking-[0.4em] font-bold mb-6" style={{ color: theme.gold, opacity: 0.8 }}>A place that matters</h3>
            <h2 className="font-serif-elegant italic text-3xl mb-8 leading-tight" style={{ color: read.primary }}>{data.sacredLocation.placeName}</h2>
            <div className="text-[9px] uppercase tracking-[0.3em] font-bold" style={{ color: theme.gold, opacity: 0.6 }}>
              Open
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
                <h3 className="text-[9px] uppercase tracking-[0.5em] font-bold mb-4" style={{ color: theme.gold, opacity: 0.8 }}>A place that matters</h3>
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
                  href={safeUrl(data.sacredLocation.googleMapsUri)}
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
      {/* LINEAR FLOW: Divider → Promises → Gift → Closure → Demo         */}
      {/* ================================================================ */}

      <>

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
        <section
          data-section-type="closure"
          className="snap-section h-screen w-full flex flex-col items-center justify-center snap-start px-8"
        >
        <PaperSurface
          theme={data.theme || 'obsidian'}
          as="div"
          className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center"
        >
          <div className="text-center">
            <p 
              className="text-[9px] uppercase tracking-[0.4em] font-bold mb-8"
              style={{
                color: theme.gold,
                opacity: closureRevealed ? 0.6 : 0,
                animation: closureRevealed ? 'closureReveal 1s ease-out both' : undefined,
              }}
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
                opacity: closureRevealed ? 1 : 0,
                animation: closureRevealed ? 'closureReveal 1.2s ease-out 0.4s both' : undefined,
              }}
            >
              Sealed by {data.senderName}
            </p>

            {sealedDate && (
              <p 
                className="mt-3 text-[10px] uppercase tracking-[0.3em] font-bold"
                style={{
                  color: theme.gold,
                  opacity: closureRevealed ? 0.6 : 0,
                  animation: closureRevealed ? 'closureReveal 1s ease-out 1s both' : undefined,
                }}
              >
                {sealedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  + ' · '
                  + sealedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            )}
          </div>
        </PaperSurface>
        </section>
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

      </>

      {/* Reply Composer — ceremonial single reply */}
      {showReplyComposer && (
        <ReplyComposer
          senderName={data.senderName}
          theme={theme}
          onClose={() => setShowReplyComposer(false)}
        />
      )}

      {/* Creator Preview Controls — Modify + Seal & Deliver */}
      {isPreview && (onPayment || onEdit) && (
        <>
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