import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '../types';

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
/* THEME DEFINITIONS                                                    */
/* ------------------------------------------------------------------ */

const ENVELOPE_STYLES: Record<
  Theme,
  {
    paper: string;
    border: string;
    text: string;
    subtext: string;
    seal: string;
    sealText: string;
    particle: string;
  }
> = {
  obsidian: {
    paper: '#0A0A0A',
    border: '#D4AF37',
    text: '#E5D0A1',
    subtext: 'rgba(212, 175, 55, 0.5)',
    seal: 'radial-gradient(circle at 30% 30%, #a83232, #582F2F)',
    sealText: 'rgba(255,255,255,0.8)',
    particle: '#D4AF37',
  },
  velvet: {
    paper: '#2E1065',
    border: '#C084FC',
    text: '#E9D5FF',
    subtext: '#D8B4FE',
    seal: 'radial-gradient(circle at 30% 30%, #F59E0B, #B45309)',
    sealText: 'rgba(255,255,255,0.9)',
    particle: '#F59E0B',
  },
  crimson: {
    paper: '#881337',
    border: '#FECDD3',
    text: '#FFF1F2',
    subtext: '#FDA4AF',
    seal: 'radial-gradient(circle at 30% 30%, #4c0519, #881337)',
    sealText: 'rgba(255,255,255,0.8)',
    particle: '#FECDD3',
  },
  midnight: {
    paper: '#172554',
    border: '#93c5fd',
    text: '#eff6ff',
    subtext: '#60a5fa',
    seal: 'radial-gradient(circle at 30% 30%, #94a3b8, #475569)',
    sealText: 'rgba(255,255,255,0.95)',
    particle: '#93c5fd',
  },
  evergreen: {
    paper: '#022c22',
    border: '#b45309',
    text: '#ecfdf5',
    subtext: '#d97706',
    seal: 'radial-gradient(circle at 30% 30%, #d97706, #92400e)',
    sealText: 'rgba(255,255,255,0.85)',
    particle: '#d97706',
  },
  pearl: {
    paper: '#fafafa',
    border: '#d4af37',
    text: '#44403c',
    subtext: '#a8a29e',
    seal: 'radial-gradient(circle at 30% 30%, #e7e5e4, #a8a29e)',
    sealText: 'rgba(255,255,255,1)',
    particle: '#d4af37',
  },
};

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
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
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
            boxShadow: `0 0 0 3px ${styles.border}40, 0 8px 24px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.15)`,
          }}
        >
          <span
            className="text-2xl italic font-serif select-none"
            style={{ color: styles.sealText, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
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
  );
};