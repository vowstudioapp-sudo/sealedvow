import React, { useEffect, useMemo, useState } from 'react';

interface Props {
  unlockAt: number;
  onUnlock?: () => void;
  variant?: 'receiver' | 'landing';
  receiverName?: string;
}

interface TimeLeft {
  days: number; hours: number; minutes: number; seconds: number; total: number;
}

function getTimeLeft(unlockAt: number): TimeLeft {
  const total = Math.max(0, unlockAt - Date.now());
  return {
    total,
    days:    Math.floor(total / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

// ─────────────────────────────────────────────
// RECEIVER VARIANT — Full page countdown
// ─────────────────────────────────────────────

function ReceiverCountdown({ unlockAt, onUnlock, receiverName }: Props) {
  const [time, setTime] = useState<TimeLeft>(() => getTimeLeft(unlockAt));

  // Stars memoised — never recalculate on countdown tick re-renders
  const stars = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      top:      `${(i * 7.3) % 100}%`,
      left:     `${(i * 11.7) % 100}%`,
      size:     `${(i % 2) + 1}px`,
      duration: `${(i % 3) + 2}s`,
      delay:    `${i % 3}s`,
    }))
  , []);

  useEffect(() => {
    let unlocked = false;

    const tick = () => {
      const next = getTimeLeft(unlockAt);
      setTime(next);
      if (!unlocked && next.total <= 0) {
        unlocked = true;
        onUnlock?.();
      }
    };

    tick(); // immediate reset when unlockAt changes
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [unlockAt, onUnlock]);

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', fontFamily: 'Georgia, serif', color: '#D4AF37', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes twinkle { 0%,100%{opacity:.2;transform:scale(1)} 50%{opacity:.9;transform:scale(1.5)} }
        @keyframes moonGlow { 0%,100%{text-shadow:0 0 20px rgba(212,175,55,.4)} 50%{text-shadow:0 0 40px rgba(212,175,55,.8),0 0 80px rgba(212,175,55,.3)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .fu0{animation:fadeUp 1s ease forwards}
        .fu1{animation:fadeUp 1s ease .2s forwards;opacity:0}
        .fu2{animation:fadeUp 1s ease .4s forwards;opacity:0}
        .fu3{animation:fadeUp 1s ease .6s forwards;opacity:0}
        .fu4{animation:fadeUp 1s ease .8s forwards;opacity:0}
      `}</style>

      {/* Stars — rendered from memoised array, not recreated on tick */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {stars.map((s, i) => (
          <div key={i} style={{ position: 'absolute', top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: '50%', background: 'white', opacity: 0.4, animation: `twinkle ${s.duration} ease-in-out infinite`, animationDelay: s.delay }} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="fu0" style={{ fontSize: 64, marginBottom: 24, animation: 'moonGlow 3s ease-in-out infinite', lineHeight: 1 }}>🌙</div>
        <p className="fu0" style={{ fontSize: 10, letterSpacing: '0.5em', textTransform: 'uppercase', fontWeight: 'bold', opacity: 0.6, marginBottom: 12 }}>Your Eidi is sealed</p>
        {receiverName && (
          <p className="fu1" style={{ fontSize: 22, fontStyle: 'italic', color: '#F7E6A7', marginBottom: 8 }}>For {receiverName}</p>
        )}
        <p className="fu2" style={{ fontSize: 13, color: 'rgba(247,230,167,0.6)', marginBottom: 40 }}>Opens on Eid morning 🌙</p>

        {/* Countdown boxes — flex-wrap for small screens */}
        <div className="fu3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { value: time.days,    label: 'Days' },
            { value: time.hours,   label: 'Hours' },
            { value: time.minutes, label: 'Mins' },
            { value: time.seconds, label: 'Secs' },
          ].map((u, i) => (
            <div key={i} style={{ background: 'rgba(27,67,50,0.5)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 10, padding: '12px 16px', minWidth: 64, textAlign: 'center' }}>
              <p style={{ fontSize: 28, fontWeight: 'bold', color: '#D4AF37', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{pad(u.value)}</p>
              <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold', marginTop: 4 }}>{u.label}</p>
            </div>
          ))}
        </div>

        {/* "open at Fajr" = anticipation, not instruction */}
        <p className="fu4" style={{ fontSize: 11, color: 'rgba(247,230,167,0.35)', marginTop: 40, fontStyle: 'italic' }}>
          Your Eidi will open at Fajr 🌙
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LANDING VARIANT — Compact homepage section
// ─────────────────────────────────────────────

function LandingCountdown({ unlockAt }: Props) {
  const [time, setTime] = useState<TimeLeft>(() => getTimeLeft(unlockAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = getTimeLeft(unlockAt);
      setTime(next);
      // Stop when countdown reaches zero — no wasted ticks
      if (next.total <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [unlockAt]);

  return (
    <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif' }}>
      <p style={{ fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.6)', fontWeight: 'bold', marginBottom: 16 }}>
        Eid begins in
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { value: time.days,    label: 'Days' },
          { value: time.hours,   label: 'Hrs' },
          { value: time.minutes, label: 'Min' },
        ].map((u, i) => (
          <React.Fragment key={i}>
            <div style={{ background: 'rgba(27,67,50,0.4)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#D4AF37', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{pad(u.value)}</p>
              <p style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold' }}>{u.label}</p>
            </div>
            {i < 2 && <span style={{ color: 'rgba(212,175,55,0.4)', fontSize: 20, fontWeight: 'bold' }}>:</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────

export const EidCountdown: React.FC<Props> = (props) => {
  const variant = props.variant ?? 'receiver';
  return variant === 'landing'
    ? <LandingCountdown {...props} />
    : <ReceiverCountdown {...props} />;
};