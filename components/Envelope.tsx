import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '../types';
import { AtmosphericShell } from './AtmosphericShell';
import { ENVELOPE_STYLES } from './envelopeTheme';
import { UI_PALETTE, THEME_ORDER, THEME_SYSTEM } from '../theme/themeSystem';

/* ------------------------------------------------------------------ */
/* CONFIGURATION (single source of truth)                               */
/* ------------------------------------------------------------------ */

const TIMING = {
  SEAL_EXPLODE: 600,
  ENVELOPE_EXIT: 1600,
  OPEN_CALLBACK: 2400,
};

const PARTICLE_COUNT = 16;

/* ------------------------------------------------------------------ */
/* THEME INDICATOR OPACITY CALIBRATION                                  */
/* Per-theme inactive/active opacity, balanced for perceptual brightness */
/* so no inactive dot dominates the active one. Crimson/velvet pulled    */
/* down (high inherent brightness); pearl pushed up (low brightness).    */
/* Active state cue is opacity ONLY — no scale change, no glow.         */
/* ------------------------------------------------------------------ */
const THEME_INDICATOR_OPACITY: Record<Theme, { inactive: number; active: number }> = {
  obsidian:  { inactive: 0.25, active: 0.48 },
  velvet:    { inactive: 0.20, active: 0.42 },
  crimson:   { inactive: 0.18, active: 0.40 },
  midnight:  { inactive: 0.20, active: 0.42 },
  evergreen: { inactive: 0.22, active: 0.45 },
  pearl:     { inactive: 0.32, active: 0.55 },
};

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  recipientName: string;
  theme: Theme;
  onOpen: () => void;
  onInteract?: () => void;
  // Phase B + Phase C-lite: when true AND onThemeChange is provided,
  // render the atmospheric theme indicators on the seal screen.
  // Receiver path leaves both undefined; row never appears for receivers.
  isPreview?: boolean;
  // Architectural rule: Envelope is theme-stateless. This callback
  // writes UP to App state. The new theme value flows DOWN via the
  // existing `theme` prop. No local theme state in Envelope.
  onThemeChange?: (theme: Theme) => void;
}

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export const Envelope: React.FC<Props> = ({
  recipientName,
  theme,
  onOpen,
  onInteract,
  isPreview = false,
  onThemeChange,
}) => {
  const styles = ENVELOPE_STYLES[theme] ?? ENVELOPE_STYLES.obsidian;

  const [phase, setPhase] = useState<'idle' | 'breaking' | 'gone'>('idle');
  const [showParticles, setShowParticles] = useState(false);

  const timers = useRef<number[]>([]);

  /* ------------------------------------------------------------------ */
  /* PARTICLES (deterministic, memoized)                                 */
  /* ------------------------------------------------------------------ */

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
      const angle = (i / PARTICLE_COUNT) * 360;
      const distance = 110 + i * 2;
      return {
        tx: Math.cos((angle * Math.PI) / 180) * distance,
        ty: Math.sin((angle * Math.PI) / 180) * distance,
        delay: i * 0.02,
        size: i % 2 === 0 ? 6 : 3,
      };
    });
  }, []);

  /* ------------------------------------------------------------------ */
  /* TIMING HELPERS                                                      */
  /* ------------------------------------------------------------------ */

  const schedule = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timers.current.push(id);
  };

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* INTERACTION                                                         */
  /* ------------------------------------------------------------------ */

  const handleOpen = () => {
    if (phase !== 'idle') return;

    onInteract?.();
    setPhase('breaking');

    schedule(() => setShowParticles(true), TIMING.SEAL_EXPLODE);
    schedule(() => setPhase('gone'), TIMING.ENVELOPE_EXIT);
    schedule(onOpen, TIMING.OPEN_CALLBACK);
  };

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <AtmosphericShell surfaceTheme={theme}>
      <div className="w-full flex flex-col items-center justify-center min-h-[100dvh] px-4">
      {/* Envelope */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Open invitation"
        onClick={handleOpen}
        onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
        className={`relative w-[22rem] h-64 cursor-pointer ${
          phase === 'gone'
            ? 'scale-150 opacity-0 -translate-y-20 blur-sm'
            : 'hover:-translate-y-2'
        }`}
        style={{
          backgroundColor: styles.paper,
          // Replaces the prior `transition-all duration-[1200ms]` Tailwind class.
          // Two-tier transition: the seal-break properties (transform/opacity/
          // filter) keep their 1200ms cinematic feel; backgroundColor eases at
          // the faster atmospheric tempo (300ms) so theme switches don't feel
          // sluggish at this element scale.
          transition:
            'background-color 300ms ease-out, transform 1200ms ease, opacity 1200ms ease, filter 1200ms ease',
        }}
      >
        <div
          className="absolute inset-0 border opacity-20"
          style={{
            borderColor: styles.border,
            transition: 'border-color 300ms ease-out',
          }}
        />

        {/* Paper grain texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")',
          }}
        />

        {/* Center Text */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <p
              className="text-[9px] uppercase tracking-[0.6em] mb-4 opacity-60 font-bold"
              style={{
                color: styles.subtext,
                transition: 'color 300ms ease-out',
              }}
            >
              Private &amp; Sealed
            </p>
            <h2
              className="text-3xl italic font-serif"
              style={{
                color: styles.text,
                transition: 'color 300ms ease-out',
              }}
            >
              For {recipientName}
            </h2>
          </div>
        )}

        {/* Wax Seal — gold ring + gloss highlight */}
        <div
          className={`absolute left-1/2 w-16 h-16 rounded-full flex items-center justify-center ${
            phase === 'breaking' ? 'animate-seal-explode' : 'hover:scale-105'
          }`}
          style={{
            background: styles.seal,
            transform: 'translateX(-50%)',
            bottom: '1.5rem',
            boxShadow: `0 0 0 3px ${styles.border}40, 0 8px 24px ${UI_PALETTE.sealLiftShadow}, inset 0 -2px 4px ${UI_PALETTE.sealInsetDark}, inset 0 2px 4px ${UI_PALETTE.sealInsetHighlight}`,
            // Replaces the prior `transition-transform duration-300` class.
            // The seal disc is the discrete focal element of this surface;
            // its color + shadow shift at the brisk atmospheric tempo so a
            // theme tap is felt immediately but never snaps. Transform stays
            // on its existing 300ms feel (preserves hover:scale-105).
            transition:
              'background 300ms ease-out, box-shadow 300ms ease-out, transform 300ms ease-out',
          }}
        >
          <span
            className="text-2xl italic font-serif select-none"
            style={{
              color: styles.sealText,
              textShadow: `0 1px 2px ${UI_PALETTE.sealGlyphShadow}`,
              transition: 'color 300ms ease-out, text-shadow 300ms ease-out',
            }}
          >
            V
          </span>
        </div>

        {/* Particles */}
        {showParticles && (
          <div className="absolute top-1/2 left-1/2 pointer-events-none">
            {particles.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-particle"
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: styles.particle,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  animationDelay: `${p.delay}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      {phase === 'idle' && (
        <div className="mt-16 text-center">
          <p
            className="text-xs uppercase tracking-widest"
            style={{
              color: styles.subtext,
              opacity: 0.9,
              transition: 'color 300ms ease-out',
            }}
          >
            Tap to break the seal
          </p>
        </div>
      )}
      </div>

      {/* ── Phase B + Phase C-lite — Atmospheric theme indicators ──────
         The row is steady; the theme around it shifts. Six indicators,
         each carrying its theme's accent color at calibrated low opacity.
         Active state = opacity bump only (no scale, no glow, no motion).
         Tap target is invisible 44×44; visible mark is 6px dot.
         No labels visible; ARIA labels for screen readers only.
         Hidden during seal-break + receiver path (gated by isPreview +
         onThemeChange presence). */}
      {phase === 'idle' && isPreview && typeof onThemeChange === 'function' && (
        <div
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-8"
        >
          {THEME_ORDER.map((t) => {
            const isActive = theme === t;
            const accent = THEME_SYSTEM[t].accent;
            const opacity = THEME_INDICATOR_OPACITY[t][isActive ? 'active' : 'inactive'];
            return (
              <button
                key={t}
                type="button"
                aria-label={`Theme: ${t}`}
                aria-pressed={isActive}
                onClick={() => onThemeChange(t)}
                className="w-11 h-11 flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
              >
                <span
                  className="block rounded-full w-1.5 h-1.5"
                  style={{
                    backgroundColor: accent,
                    opacity,
                    transition: 'opacity 300ms ease-out',
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </AtmosphericShell>
  );
};
