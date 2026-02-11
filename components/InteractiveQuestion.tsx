import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CoupleData } from '../types';
import { listenToSessionStatus } from '../services/firebase';

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

  useEffect(() => {
    if (phase !== 'remote-wait' || !data.sessionId) return;

    const unsubscribe = listenToSessionStatus(
      data.sessionId,
      (status) => {
        if (status === 'unlocked') {
          setPhase('accepted');
          const t = setTimeout(acceptOnce, ACCEPT_DELAY_REMOTE);
          return () => clearTimeout(t);
        }
      }
    );

    return () => unsubscribe();
  }, [phase, data.sessionId, acceptOnce]);

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
          className="px-10 py-4 rounded-full bg-[#D4AF37] text-black uppercase tracking-widest text-xs"
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
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black select-none">
        <h1 className="mb-20 text-3xl italic">
          {data.recipientName}
        </h1>

        <button
          aria-label="Hold to connect"
          onMouseDown={() => setHolding(true)}
          onMouseUp={() => setHolding(false)}
          onMouseLeave={() => setHolding(false)}
          onTouchStart={() => setHolding(true)}
          onTouchEnd={() => setHolding(false)}
          className="relative w-48 h-48 rounded-full border border-[#D4AF37] flex items-center justify-center"
        >
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="94"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2"
              strokeDasharray="590"
              strokeDashoffset={590 - (590 * energy) / 100}
            />
          </svg>
          <span className="text-3xl text-[#D4AF37]">❦</span>
        </button>

        <p className="mt-16 uppercase tracking-widest text-xs opacity-60">
          {holding ? 'Establishing Link…' : 'Hold to Connect'}
        </p>
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