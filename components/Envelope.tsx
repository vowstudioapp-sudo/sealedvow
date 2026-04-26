import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '../types';
import { AtmosphericShell } from './AtmosphericShell';
import { ENVELOPE_STYLES } from './envelopeTheme';
import { UI_PALETTE } from '../theme/themeSystem';

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
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  recipientName: string;
  theme: Theme;
  onOpen: () => void;
  onInteract?: () => void;
}

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export const Envelope: React.FC<Props> = ({
  recipientName,
  theme,
  onOpen,
  onInteract,
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
        className={`relative w-[22rem] h-64 cursor-pointer transition-all duration-[1200ms] ${
          phase === 'gone'
            ? 'scale-150 opacity-0 -translate-y-20 blur-sm'
            : 'hover:-translate-y-2'
        }`}
        style={{ backgroundColor: styles.paper }}
      >
        <div
          className="absolute inset-0 border opacity-20"
          style={{ borderColor: styles.border }}
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
              style={{ color: styles.subtext }}
            >
              Private &amp; Sealed
            </p>
            <h2
              className="text-3xl italic font-serif"
              style={{ color: styles.text }}
            >
              For {recipientName}
            </h2>
          </div>
        )}

        {/* Wax Seal — gold ring + gloss highlight */}
        <div
          className={`absolute left-1/2 w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 ${
            phase === 'breaking' ? 'animate-seal-explode' : 'hover:scale-105'
          }`}
          style={{
            background: styles.seal,
            transform: 'translateX(-50%)',
            bottom: '1.5rem',
            boxShadow: `0 0 0 3px ${styles.border}40, 0 8px 24px ${UI_PALETTE.sealLiftShadow}, inset 0 -2px 4px ${UI_PALETTE.sealInsetDark}, inset 0 2px 4px ${UI_PALETTE.sealInsetHighlight}`,
          }}
        >
          <span
            className="text-2xl italic font-serif select-none"
            style={{ color: styles.sealText, textShadow: `0 1px 2px ${UI_PALETTE.sealGlyphShadow}` }}
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
            style={{ color: styles.subtext, opacity: 0.9 }}
          >
            Tap to break the seal
          </p>
        </div>
      )}
      </div>
    </AtmosphericShell>
  );
};
