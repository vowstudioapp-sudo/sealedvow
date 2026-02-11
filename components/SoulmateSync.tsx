
import React, { useState, useEffect, useRef } from 'react';
import { updateSyncState, listenToSyncState } from '../services/firebase';

interface Props {
  senderName: string;
  onComplete: () => void;
  // We need sessionId passed here, but it wasn't in props before. 
  // Ideally App.tsx passes the whole data object or just ID. 
  // I will assume for now we use a global approach or better, pass it as prop.
  // Note: App.tsx passes `senderName` currently. I will add `sessionId`.
  sessionId?: string; 
}

export const SoulmateSync: React.FC<Props> = ({ senderName, onComplete, sessionId }) => {
  const [progress, setProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [partnerActive, setPartnerActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionId) {
      const unsubscribe = listenToSyncState(sessionId, (syncData) => {
        setPartnerActive(syncData.sender);
      });
      return () => unsubscribe();
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return; // Fallback for no backend

    if (isPressing) {
      updateSyncState(sessionId, 'receiver', true);

      timerRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (!partnerActive) return Math.min(prev + 0.5, 50); // Cap if alone

          if (prev >= 100) {
            clearInterval(timerRef.current!);
            setTimeout(onComplete, 800);
            return 100;
          }
          return prev + 1.2;
        });
      }, 20);
    } else {
      updateSyncState(sessionId, 'receiver', false);
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(prev => Math.max(0, prev - 3));
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPressing, onComplete, sessionId, partnerActive]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 select-none">
      <div className="mb-20 animate-fade-in">
        <h2 className="text-[10px] uppercase tracking-[0.4em] text-luxury-gold/80 font-bold mb-6 italic">Security Check</h2>
        <h1 className="text-3xl font-serif-elegant italic text-luxury-wine mb-4">Identity Verification</h1>
        <p className="text-luxury-stone/70 max-w-xs mx-auto text-sm italic leading-relaxed">
          Hold your thumb below to sync your heartbeat with {senderName}'s.
        </p>
      </div>

      <div className="relative">
        {/* Glow Effect */}
        <div 
          className="absolute inset-0 rounded-full bg-luxury-gold/30 blur-2xl transition-all duration-300"
          style={{ 
            opacity: isPressing ? 0.8 : 0, 
            transform: `scale(${1 + progress / 40})` 
          }}
        ></div>
        
        <button
          onMouseDown={() => setIsPressing(true)}
          onMouseUp={() => setIsPressing(false)}
          onMouseLeave={() => setIsPressing(false)}
          onTouchStart={() => setIsPressing(true)}
          onTouchEnd={() => setIsPressing(false)}
          className={`relative w-40 h-40 rounded-full bg-luxury-wine/5 backdrop-blur-sm border flex items-center justify-center transition-all duration-300 active:scale-95 overflow-hidden ${isPressing ? 'border-luxury-gold shadow-[0_0_30px_rgba(212,175,55,0.3)]' : 'border-luxury-gold/40'}`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className={`text-5xl transition-all duration-500 ${isPressing ? 'text-luxury-wine opacity-80 scale-110' : 'text-luxury-stone/40 grayscale scale-100'}`}>
            ❦
          </div>
          
          <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.05]">
            <circle
              cx="80"
              cy="80"
              r="78"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="1.5"
              strokeDasharray="490"
              strokeDashoffset={490 - (490 * progress) / 100}
              className="transition-all duration-75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="mt-24 h-8">
        <p className="text-[9px] uppercase tracking-[0.3em] text-luxury-gold font-bold transition-all duration-500" style={{ opacity: isPressing ? 1 : 0.6, letterSpacing: isPressing ? '0.5em' : '0.3em' }}>
          {progress >= 100 ? 'ACCESS GRANTED' : isPressing ? (partnerActive ? 'SYNCING HEARTS...' : 'WAITING FOR PARTNER...') : 'HOLD TO UNLOCK'}
        </p>
      </div>
    </div>
  );
};
