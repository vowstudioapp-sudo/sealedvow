import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CoupleData, Theme } from '../types';

/* ------------------------------------------------------------------ */
/* THEME COLORS                                                        */
/* ------------------------------------------------------------------ */

const IQ_THEME: Record<Theme, { bg: string; text: string; gold: string; seal: string; goldRgb: string; sealRgb: string }> = {
  obsidian:  { bg: '#0C0A09', text: '#E5D0A1', gold: '#D4AF37', seal: '#722F37', goldRgb: '212,175,55',  sealRgb: '114,47,55' },
  velvet:    { bg: '#1A0B2E', text: '#E9D5FF', gold: '#C084FC', seal: '#7C3AED', goldRgb: '192,132,252', sealRgb: '124,58,237' },
  crimson:   { bg: '#2B0A0A', text: '#FECDD3', gold: '#F43F5E', seal: '#9F1239', goldRgb: '244,63,94',   sealRgb: '159,18,57' },
  midnight:  { bg: '#020617', text: '#E0F2FE', gold: '#7DD3FC', seal: '#1E40AF', goldRgb: '125,211,252', sealRgb: '30,64,175' },
  evergreen: { bg: '#022C22', text: '#D1FAE5', gold: '#34D399', seal: '#065F46', goldRgb: '52,211,153',  sealRgb: '6,95,70' },
  pearl:     { bg: '#1C1917', text: '#F5F5F4', gold: '#A8A29E', seal: '#57534E', goldRgb: '168,162,158', sealRgb: '87,83,78' },
};

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  data: CoupleData;
  onAccept: () => void;
}

type Phase =
  | 'vigil'
  | 'remote-wait'
  | 'sync'
  | 'ignite'
  | 'accepted';

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                           */
/* ------------------------------------------------------------------ */

const IGNITION_TARGET = 100;
const ENERGY_FILL_RATE = 0.6;
const ENERGY_DECAY_RATE = 1.5;
const ACCEPT_DELAY_IGNITE = 1200;
const ACCEPT_DELAY_REMOTE = 2000;

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export const InteractiveQuestion: React.FC<Props> = ({ data, onAccept }) => {
  const tc = IQ_THEME[data.theme || 'obsidian'];
  /* ------------------------------------------------------------------ */
  /* ONE-SHOT ACCEPT GUARARD                                             */
  /* ------------------------------------------------------------------ */

  const acceptedRef = useRef(false);

  const acceptOnce = useCallback(() => {
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    onAccept();
  }, [onAccept]);

  /* ------------------------------------------------------------------ */
  /* PHASE RESOLUTION                                                    */
  /* ------------------------------------------------------------------ */

  const initialPhase: Phase = useMemo(() => {
    switch (data.revealMethod) {
      case 'vigil':
        return 'vigil';
      case 'remote':
        return 'remote-wait';
      case 'sync':
        return 'sync';
      default:
        return 'ignite';
    }
  }, [data.revealMethod]);

  const [phase, setPhase] = useState<Phase>(initialPhase);

  /* ------------------------------------------------------------------ */
  /* VIGIL TIMER                                                         */
  /* ------------------------------------------------------------------ */

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (phase !== 'vigil' || !data.unlockDate) return;

    const tick = () => {
      const now = Date.now();
      const unlock = new Date(data.unlockDate).getTime();
      const diff = unlock - now;

      if (diff <= 0) {
        setTimeLeft(null);
        setPhase('ignite');
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, data.unlockDate]);

  /* ------------------------------------------------------------------ */
  /* REMOTE UNLOCK                                                       */
  /* ------------------------------------------------------------------ */

  // Realtime functionality removed - remote unlock no longer supported

  /* ------------------------------------------------------------------ */
  /* IGNITION RITUAL                                                     */
  /* ------------------------------------------------------------------ */

  const [energy, setEnergy] = useState(0);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (phase !== 'ignite') return;

    let rafId: number;

    const step = () => {
      setEnergy((prev) => {
        if (holding) {
          const next = Math.min(prev + ENERGY_FILL_RATE, IGNITION_TARGET);
          if (next >= IGNITION_TARGET) {
            setPhase('accepted');
            setTimeout(acceptOnce, ACCEPT_DELAY_IGNITE);
          }
          return next;
        }
        return Math.max(0, prev - ENERGY_DECAY_RATE);
      });

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [phase, holding, acceptOnce]);

  /* ------------------------------------------------------------------ */
  /* RENDER: VIGIL                                                       */
  /* ------------------------------------------------------------------ */

  if (phase === 'vigil' && timeLeft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center select-none">
        <h2 className="uppercase tracking-[0.6em] text-xs opacity-60 mb-8">
          The Wait
        </h2>
        <h1 className="text-4xl italic mb-12">
          Patience is part of the gift.
        </h1>
        <div className="flex gap-10 text-3xl">
          <span>{timeLeft.days}d</span>
          <span>{timeLeft.hours.toString().padStart(2, '0')}h</span>
          <span>{timeLeft.minutes.toString().padStart(2, '0')}m</span>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* RENDER: REMOTE WAIT                                                 */
  /* ------------------------------------------------------------------ */

  if (phase === 'remote-wait') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center select-none">
        <h2 className="uppercase tracking-[0.6em] text-xs opacity-60 mb-6">
          Remote Connection
        </h2>
        <h1 className="text-3xl italic mb-6">
          Waiting for {data.senderName}
        </h1>
        <p className="opacity-60 italic text-sm">
          They will unlock this when the moment is right.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* RENDER: SYNC                                                        */
  /* ------------------------------------------------------------------ */

  if (phase === 'sync') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
        <h2 className="uppercase tracking-[0.6em] text-xs opacity-60 mb-6">
          Synchronization
        </h2>
        <h1 className="text-3xl italic mb-8">
          Two Hearts, One Moment
        </h1>
        <button
          onClick={acceptOnce}
          className="px-10 py-4 rounded-full text-black uppercase tracking-widest text-xs"
          style={{ backgroundColor: tc.gold }}
        >
          Initiate Link
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* RENDER: IGNITION                                                    */
  /* ------------------------------------------------------------------ */

  if (phase === 'ignite') {
    const progress = energy / IGNITION_TARGET;
    const glowIntensity = progress * 30;
    const sealScale = 1 + progress * 0.08;
    const crackOpacity = Math.min(progress * 1.5, 1);

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center select-none" style={{ backgroundColor: tc.bg }}>
        <p
          className="mb-4"
          style={{
            fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
            fontStyle: 'italic',
            fontSize: 'clamp(1.6rem, 5vw, 2.4rem)',
            color: tc.text,
            opacity: 0.8,
          }}
        >
          {data.recipientName}
        </p>

        <p 
          className="mb-16 text-[10px] uppercase tracking-[0.3em]"
          style={{ color: `rgba(${tc.goldRgb}, 0.6)` }}
        >
          Something awaits you
        </p>

        <button
          aria-label="Hold to break the seal"
          onMouseDown={() => setHolding(true)}
          onMouseUp={() => setHolding(false)}
          onMouseLeave={() => setHolding(false)}
          onTouchStart={() => setHolding(true)}
          onTouchEnd={() => setHolding(false)}
          className="relative w-40 h-40 rounded-full flex items-center justify-center cursor-pointer active:cursor-grabbing"
          style={{
            transform: `scale(${sealScale})`,
            transition: holding ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: `0 0 ${glowIntensity}px ${glowIntensity / 2}px rgba(${tc.goldRgb}, ${progress * 0.3})`,
              transition: holding ? 'none' : 'box-shadow 0.3s ease-out',
            }}
          />

          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(${tc.sealRgb}, ${0.8 - progress * 0.3}) 0%, rgba(${tc.sealRgb}, ${0.9 - progress * 0.4}) 70%, transparent 100%)`,
              border: `1.5px solid rgba(${tc.goldRgb}, ${0.3 + progress * 0.4})`,
            }}
          />

          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160" style={{ opacity: crackOpacity }}>
            <line x1="80" y1="30" x2="75" y2="55" stroke={tc.gold} strokeWidth="0.5" opacity={progress > 0.2 ? 1 : 0} />
            <line x1="75" y1="55" x2="65" y2="70" stroke={tc.gold} strokeWidth="0.5" opacity={progress > 0.35 ? 1 : 0} />
            <line x1="130" y1="75" x2="110" y2="80" stroke={tc.gold} strokeWidth="0.5" opacity={progress > 0.3 ? 1 : 0} />
            <line x1="110" y1="80" x2="100" y2="95" stroke={tc.gold} strokeWidth="0.5" opacity={progress > 0.5 ? 1 : 0} />
            <line x1="85" y1="130" x2="90" y2="110" stroke={tc.gold} strokeWidth="0.5" opacity={progress > 0.4 ? 1 : 0} />
            <line x1="35" y1="90" x2="55" y2="85" stroke={tc.gold} strokeWidth="0.5" opacity={progress > 0.45 ? 1 : 0} />
            <line x1="55" y1="85" x2="60" y2="75" stroke={tc.gold} strokeWidth="0.5" opacity={progress > 0.6 ? 1 : 0} />
          </svg>

          <span 
            className="relative z-10 text-3xl"
            style={{ 
              color: `rgba(${tc.goldRgb}, ${0.6 + progress * 0.4})`,
              filter: `drop-shadow(0 0 ${progress * 8}px rgba(${tc.goldRgb}, ${progress * 0.5}))`,
            }}
          >
            ❦
          </span>
        </button>

        <p 
          className="mt-14"
          style={{
            fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
            fontStyle: 'italic',
            fontSize: '0.85rem',
            color: holding ? `rgba(${tc.goldRgb}, 0.7)` : 'rgba(255, 255, 255, 0.5)',
            letterSpacing: '0.05em',
            transition: 'color 0.3s ease',
          }}
        >
          {holding ? 'Breaking the seal...' : 'Hold to break the seal'}
        </p>

        {energy > 0 && (
          <div className="mt-6 w-32 h-px bg-white/10 overflow-hidden rounded-full">
            <div 
              className="h-full transition-all"
              style={{ 
                backgroundColor: tc.gold,
                opacity: 0.5,
                width: `${progress * 100}%`,
                transition: holding ? 'width 0.05s linear' : 'width 0.3s ease-out',
              }} 
            />
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* ACCEPTED (FLASH / TRANSITION)                                       */
  /* ------------------------------------------------------------------ */

  return (
    <div className="fixed inset-0 bg-white transition-opacity duration-1000 opacity-100" />
  );
};