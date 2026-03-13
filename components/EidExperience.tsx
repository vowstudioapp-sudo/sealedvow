import { useEffect, useRef, useState } from 'react';
import '../styles/eid.css';
import { EID_DEMOS, type EidDemo } from '../data/eidDemoData.ts';

/* ─────────────────────────────────────────────────────────────
   STARS background (generated once)
───────────────────────────────────────────────────────────── */
function Stars() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 45 }, (_, i) => {
        const sz = Math.random() < 0.75 ? 1 : 2.2;
        const brightness = Math.random() < 0.8
          ? 'rgba(255,255,255,0.8)'
          : 'rgba(255,255,255,1)';
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              background: brightness,
              width: sz,
              height: sz,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `eid-twinkle ${2 + Math.random() * 4}s ${Math.random() * 4}s linear infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PROGRESS DOTS
───────────────────────────────────────────────────────────── */
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{
      position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 7, zIndex: 100,
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i === current ? '#c9a84c' : 'rgba(201,168,76,0.25)',
          transform: i === current ? 'scale(1.3)' : 'scale(1)',
          transition: 'background 0.3s ease, transform 0.3s ease',
        }} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN WRAPPER
───────────────────────────────────────────────────────────── */
function Screen({
  active, children, style, scrollable = false, className,
}: {
  active: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  scrollable?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active && ref.current) ref.current.scrollTop = 0;
  }, [active]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: scrollable ? 'flex-start' : 'center',
        padding: scrollable ? '48px 20px 80px' : '24px',
        opacity: active ? 1 : 0,
        pointerEvents: active ? 'all' : 'none',
        transition: 'opacity 0.7s ease',
        zIndex: 10,
        overflowY: scrollable ? 'auto' : 'hidden',
        WebkitOverflowScrolling: 'touch' as 'touch',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   BUTTON
───────────────────────────────────────────────────────────── */
function BtnNext({ children, onClick, style }: { children: React.ReactNode; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 32px',
        background: '#0d3b2e',
        color: '#e8c97a',
        border: 'none',
        borderRadius: 40,
        fontSize: '0.72rem',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'background 0.25s ease',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#1a5c44')}
      onMouseLeave={e => (e.currentTarget.style.background = '#0d3b2e')}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 2 — ENVELOPE
───────────────────────────────────────────────────────────── */
function S2Envelope({ d, onNext }: { d: EidDemo; onNext: () => void }) {
  const [holding, setHolding] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const holdTimer = useRef<NodeJS.Timeout | null>(null);

  const breakSeal = () => {
    setBreaking(true);
    
    // Vibration feedback (mobile)
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
    
    // Wait for animation to complete (0.7s) then go to next screen
    setTimeout(() => {
      onNext();
    }, 700);
  };

  return (
    <Screen active style={{ background: 'radial-gradient(ellipse at 50% 40%, #0f4a37 0%, #072018 100%)' }}>
      <div className="eid-envelope-container">
        {/* Complete Envelope - Clean State */}
        <div className="eid-envelope">
          {/* Base body */}
          <div className="eid-envelope-body"></div>

          {/* Bottom flaps */}
          <div className="eid-envelope-flap-bottom-left"></div>
          <div className="eid-envelope-flap-bottom-right"></div>

          {/* Top flaps */}
          <div className="eid-envelope-flap-top-left"></div>
          <div className="eid-envelope-flap-top-right"></div>

          {/* Wax seal - HOLD TO BREAK */}
          <div
            className={`eid-wax-seal ${holding ? 'holding' : ''} ${breaking ? 'breaking' : ''}`}
            onMouseDown={() => {
              setHolding(true);
              holdTimer.current = setTimeout(() => {
                breakSeal();
              }, 2200);
            }}
            onMouseUp={() => {
              setHolding(false);
              if (holdTimer.current) clearTimeout(holdTimer.current);
            }}
            onMouseLeave={() => {
              setHolding(false);
              if (holdTimer.current) clearTimeout(holdTimer.current);
            }}
            onTouchStart={() => {
              setHolding(true);
              holdTimer.current = setTimeout(() => {
                breakSeal();
              }, 2200);
            }}
            onTouchEnd={() => {
              setHolding(false);
              if (holdTimer.current) clearTimeout(holdTimer.current);
            }}
          >
            🌙
          </div>
        </div>

        <div className="eid-seal-message">
          I have sealed the message for you this Eid
        </div>
        <div className="eid-seal-instruction">
          {holding ? 'Keep holding...' : '(Press and hold to break the seal)'}
        </div>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 3 — BLESSING
───────────────────────────────────────────────────────────── */
function S3Blessing({ d, onNext }: { d: EidDemo; onNext: () => void }) {
  return (
    <Screen active style={{ background: 'radial-gradient(ellipse at 50% 40%, #0f4a37 0%, #072018 100%)' }}>
      <div style={{ maxWidth: 480, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', color: '#c9a84c', letterSpacing: '0.1em', opacity: 0.8 }}>
          بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
        </div>
        <div style={{ width: 60, height: 1, background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }} />
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.2rem, 4vw, 1.7rem)', lineHeight: 1.9, color: '#f5e9c4', fontStyle: 'italic' }}>
          {d.blessing.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
        </p>
        <div style={{ width: 60, height: 1, background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }} />
        <button
          onClick={onNext}
          style={{
            marginTop: 16, padding: '12px 32px',
            border: '1px solid rgba(201,168,76,0.4)', borderRadius: 40,
            fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase',
            color: '#c9a84c', cursor: 'pointer', background: 'rgba(201,168,76,0.06)',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.14)'; e.currentTarget.style.borderColor = '#c9a84c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.06)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; }}
        >
          Continue ✦
        </button>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 4 — LETTER
───────────────────────────────────────────────────────────── */
function S4Letter({ d, onNext }: { d: EidDemo; onNext: () => void }) {
  return (
    <Screen active scrollable style={{ background: '#fdf8ee', color: '#1a120a' }}>
      <div style={{
        maxWidth: 560, width: '100%',
        background: '#fffef8', borderRadius: 3,
        padding: 'clamp(28px, 6vw, 52px) clamp(24px, 6vw, 52px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
        position: 'relative', borderTop: '3px solid #c9a84c',
      }}>
        {/* Margin line */}
        <div style={{ position: 'absolute', left: 62, top: 0, bottom: 0, width: 1, background: 'rgba(201,168,76,0.18)' }} />

        <div style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: 16, opacity: 0.7 }}>🌙</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: '#0d3b2e', textAlign: 'center', marginBottom: 8 }}>
          {d.letterHeading}
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,18,10,0.35)', marginBottom: 28 }}>
          {d.letterMeta}
        </div>
        <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)', marginBottom: 28 }} />

        <div
          style={{ fontSize: 'clamp(0.92rem, 2.2vw, 1.05rem)', lineHeight: 2, color: '#2a1a10', fontWeight: 300 }}
          dangerouslySetInnerHTML={{ __html: d.letterBody }}
        />

        <div style={{ marginTop: 32, fontFamily: 'Georgia, serif', fontSize: '1.3rem', color: '#1a5c44' }}>
          {d.letterSign}
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <BtnNext onClick={onNext}>Our Eid Memories ✦</BtnNext>
        </div>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 5 — MEMORIES
───────────────────────────────────────────────────────────── */
function S5Memories({ d, onNext }: { d: EidDemo; onNext: () => void }) {
  return (
    <Screen active scrollable style={{ background: 'linear-gradient(160deg, #0a2e1e 0%, #061810 100%)' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.8rem, 6vw, 2.8rem)', color: '#e8c97a', textAlign: 'center', marginBottom: 8 }}>
        {d.memTitle}
      </div>
      <div style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.5)', textAlign: 'center', marginBottom: 40 }}>
        {d.memSub}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 20, maxWidth: 680, width: '100%' }}>
        {d.memories.map((m, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)',
            borderRadius: 6, overflow: 'hidden', transition: 'transform 0.25s ease',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{ width: '100%', height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.2rem', background: 'rgba(201,168,76,0.06)', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
              {m.icon}
            </div>
            <div style={{ padding: '14px 16px', fontFamily: 'Georgia, serif', fontSize: '0.95rem', color: '#f5e9c4', lineHeight: 1.5 }}>
              {m.caption}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 36 }}>
        <BtnNext onClick={onNext}>{d.duaTitle} ✦</BtnNext>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 6 — DUAS
───────────────────────────────────────────────────────────── */
function S6Duas({ d, active, onNext }: { d: EidDemo; active: boolean; onNext: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!active) { setVisibleCount(0); return; }
    const timers = d.duas.map((_, i) =>
      setTimeout(() => setVisibleCount(n => Math.max(n, i + 1)), 300 + i * 180)
    );
    return () => timers.forEach(clearTimeout);
  }, [active, d.duas]);

  return (
    <Screen active={active} scrollable style={{ background: 'linear-gradient(160deg, #0a2e1e 0%, #061810 100%)' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.8rem, 6vw, 2.8rem)', color: '#e8c97a', textAlign: 'center', marginBottom: 8 }}>
        {d.duaTitle}
      </div>
      <div style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.5)', textAlign: 'center', marginBottom: 40 }}>
        {d.duaSub}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520, width: '100%' }}>
        {d.duas.map((dua, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 16,
            padding: '20px 22px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(201,168,76,0.15)',
            borderLeft: '3px solid #c9a84c', borderRadius: 4,
            opacity: i < visibleCount ? 1 : 0,
            transform: i < visibleCount ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}>
            <div style={{ fontSize: '1.4rem', marginTop: 2 }}>{dua.icon}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1rem, 3vw, 1.2rem)', color: '#f5e9c4', lineHeight: 1.65 }}>
              {dua.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 36 }}>
        <BtnNext onClick={onNext}>Your Eidi ✦</BtnNext>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 7 — EIDI POUCH
───────────────────────────────────────────────────────────── */
function S7Eidi({ d, onNext }: { d: EidDemo; onNext: () => void }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Screen active style={{ background: 'radial-gradient(ellipse at 50% 40%, #0f4a37 0%, #061810 100%)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)' }}>
          {d.eidiLabel}
        </div>

        {!revealed ? (
          <>
            <div
              onClick={() => setRevealed(true)}
              style={{ width: 120, height: 130, cursor: 'pointer', transition: 'transform 0.3s ease' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05) rotate(-2deg)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1) rotate(0)')}
            >
              <svg viewBox="0 0 120 130" fill="none" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <radialGradient id="pg" cx="40%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#1a6646" />
                    <stop offset="100%" stopColor="#0a3328" />
                  </radialGradient>
                </defs>
                <ellipse cx="60" cy="85" rx="46" ry="40" fill="url(#pg)" stroke="rgba(201,168,76,0.4)" strokeWidth="1.5" />
                <path d="M38 55 Q60 42 82 55 Q74 68 60 65 Q46 68 38 55Z" fill="#0d4a35" stroke="rgba(201,168,76,0.35)" strokeWidth="1" />
                <path d="M48 52 Q60 44 72 52" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <text x="60" y="95" textAnchor="middle" fontSize="22" fill="rgba(201,168,76,0.7)">🌙</text>
                <ellipse cx="44" cy="72" rx="8" ry="4" fill="rgba(255,255,255,0.07)" transform="rotate(-20 44 72)" />
              </svg>
            </div>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', animation: 'eid-pulse 2s ease-in-out infinite' }}>
              ✦ Tap the pouch to open your eidi ✦
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, animation: 'eid-fadeUp 0.6s ease forwards' }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)' }}>
              {d.eidiFrom}
            </div>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(3rem, 12vw, 5.5rem)',
              color: '#e8c97a', lineHeight: 1,
              filter: 'drop-shadow(0 0 20px rgba(201,168,76,0.4))',
            }}>
              {d.eidiAmount}
            </div>
            {/* Emotional nudge — not a CTA, purely feeling */}
            <div style={{ fontSize: '0.72rem', color: 'rgba(201,168,76,0.5)', fontFamily: 'Georgia, serif', fontStyle: 'italic', letterSpacing: '0.08em', marginTop: -4 }}>
              Eidi feels better when you give it too.
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', color: '#f5e9c4', fontStyle: 'italic', maxWidth: 300, lineHeight: 1.6 }}>
              {d.eidiMsg}
            </div>
            <BtnNext onClick={onNext} style={{ marginTop: 8 }}>Bhai's Dua for You ✦</BtnNext>
          </div>
        )}
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 8 — CLOSING
───────────────────────────────────────────────────────────── */
function S8Closing({ d, onNext }: { d: EidDemo; onNext: () => void }) {
  return (
    <Screen active style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f4a37 0%, #061810 100%)', textAlign: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 440 }}>
        <div style={{ fontSize: '3rem', animation: 'eid-closingMoon 3s ease-in-out infinite' }}>🌙</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.8rem', color: '#c9a84c', opacity: 0.7 }}>عيد مبارك</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.4rem, 5vw, 2rem)', color: '#e8c97a', lineHeight: 1.65 }}>
          {d.closingMain.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
        </div>
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.5)' }}>
          ✦ &nbsp; Eid Mubarak &nbsp; ✦
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(201,168,76,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {d.closingSender}
        </div>
        <BtnNext onClick={onNext} style={{ marginTop: 8 }}>Continue ✦</BtnNext>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 9 — VIRAL CHAIN (receiver → sender)
───────────────────────────────────────────────────────────── */
function S9Chain({ d }: { d: EidDemo }) {
  return (
    <Screen active style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f4a37 0%, #061810 100%)', textAlign: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 420 }}>
        <div style={{ fontSize: '2.2rem', animation: 'eid-closingMoon 3s ease-in-out infinite' }}>🌙</div>

        <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.5rem, 5vw, 2rem)', color: '#e8c97a', lineHeight: 1.4 }}>
          Someone thought of you<br />this Eid.
        </div>

        <div style={{ width: 48, height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)' }} />

        <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(0.95rem, 3vw, 1.1rem)', color: 'rgba(245,233,196,0.75)', lineHeight: 1.8, fontStyle: 'italic' }}>
          {d.senderName} made your Eid special.<br />
          Someone's waiting for you to do the same.
        </div>

        <button
          onClick={() => { window.location.href = '/demo/eid'; }}
          style={{
            marginTop: 8,
            padding: '14px 36px',
            background: '#c9a84c',
            color: '#0a2e1e',
            border: 'none',
            borderRadius: 40,
            fontSize: '0.72rem',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontWeight: 700,
            transition: 'background 0.25s ease, transform 0.2s ease',
            boxShadow: '0 0 30px rgba(201,168,76,0.3)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#e8c97a'; e.currentTarget.style.transform = 'scale(1.03)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#c9a84c'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          Create your Eid card ✦
        </button>

        <div style={{ fontSize: '0.65rem', color: 'rgba(201,168,76,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          Send Eid wishes — with or without Eidi.
        </div>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   HOME BUTTON — persistent, non-intrusive
───────────────────────────────────────────────────────────── */
function HomeBtn() {
  return (
    <button
      onClick={() => { window.location.href = '/demo/eid'; }}
      style={{
        position: 'fixed', top: 18, left: 20, zIndex: 200,
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'Georgia, serif', fontStyle: 'italic',
        fontSize: '0.72rem', letterSpacing: '0.12em',
        color: 'rgba(201,168,76,0.35)',
        transition: 'color 0.2s ease',
        padding: '6px 8px',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(201,168,76,0.7)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(201,168,76,0.35)')}
    >
      ← Back
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
───────────────────────────────────────────────────────────── */
const STYLES = `
  @keyframes eid-twinkle {
    0%, 100% { opacity: 0.1; transform: scale(1); }
    50% { opacity: 0.9; transform: scale(1.3); }
  }
  @keyframes eid-moonGlow {
    0%, 100% { filter: drop-shadow(0 0 30px rgba(240,208,128,0.4)); }
    50% { filter: drop-shadow(0 0 60px rgba(240,208,128,0.8)); }
  }
  @keyframes eid-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
  @keyframes eid-fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes eid-closingMoon {
    0%, 100% { transform: translateY(0); opacity: 0.8; }
    50% { transform: translateY(-8px); opacity: 1; }
  }
  .eid-letter {
    opacity: 0;
    display: inline-block;
    animation: eid-letterIn 0.25s forwards;
  }
  @keyframes eid-letterIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  #eid-experience * { box-sizing: border-box; margin: 0; padding: 0; }
  .eid-letter-body p + p { margin-top: 18px; }
  .eid-letter-body em { font-style: italic; }
`;

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export function EidExperience() {
  // Read key from URL: /demo/eid/child-parent → 'child-parent'
  const path = window.location.pathname;
  const key = path.split('/demo/eid/')[1] ?? '';
  const d = EID_DEMOS[key];

  const [screen, setScreen] = useState(0);
  const TOTAL = 8;
  const [introStage, setIntroStage] = useState(0);
  const [showName, setShowName] = useState(false);

  const go = (n: number) => setScreen(n);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowName(true);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (introStage > 2) return;

    let delay;
    if (introStage === 0) delay = 3200;
    else if (introStage === 1) delay = 2800;
    else delay = 2500;

    const timer = setTimeout(() => {
      setIntroStage(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [introStage]);

  if (!d) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d3b2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8c97a', fontFamily: 'Georgia, serif', fontSize: '1.5rem' }}>
        Eid experience not found 🌙
      </div>
    );
  }

  const Moon = () => (
    <svg
      width="150"
      height="150"
      viewBox="0 0 120 120"
      style={{
        overflow: "visible",
        filter: "drop-shadow(0 0 40px rgba(240,208,128,0.8)) drop-shadow(0 0 80px rgba(201,168,76,0.35))",
        transform: "rotate(-15deg)"
      }}
    >
      <defs>
        <radialGradient id="moonGold">
          <stop offset="0%" stopColor="#f5d76e"/>
          <stop offset="100%" stopColor="#c9a84c"/>
        </radialGradient>

        <mask id="crescentMask">
          <rect width="120" height="120" fill="white"/>
          <circle cx="72" cy="60" r="52" fill="black"/>
        </mask>
      </defs>

      <circle
        cx="60"
        cy="60"
        r="52"
        fill="#ffd86b"
        mask="url(#crescentMask)"
      />

      <polygon
        points="88,40 91,46 97,46 92,50 94,56 88,52 82,56 84,50 79,46 85,46"
        fill="#f5e090"
        opacity="0.9"
      />
    </svg>
  );

  if (introStage < 3) {
    return (
      <div className="eid-intro">
        <Stars />
        <HomeBtn />
        
        {/* All three layers - crossfade between them */}
        <div 
          className="eid-intro-layer"
          style={{ 
            opacity: introStage === 0 && showName ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }}
        >
          <div className="eid-name">
            {d.recipient.split('').map((c, i) => (
              <span
                key={i}
                className="eid-letter"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {c}
              </span>
            ))}
            <span
              className="eid-letter"
              style={{ animationDelay: `${d.recipient.length * 0.08}s` }}
            >
              ...
            </span>
          </div>
        </div>

        <div 
          className="eid-intro-layer"
          style={{ 
            opacity: introStage === 1 ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }}
        >
          <div className="eid-greeting">
            <Moon />

            <div className="eid-greeting-text arabic">
              عِيد مُبَارَك
            </div>

            <div className="eid-year">
              2026 • 1447 AH
            </div>
          </div>
        </div>

        <div 
          className="eid-intro-layer"
          style={{ 
            opacity: introStage === 2 ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }}
        >
          <div className="eid-sender-reveal">
            <div className="eid-sender-text">
              {d.envFrom}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="eid-experience" style={{ fontFamily: 'Lato, sans-serif', background: '#0d3b2e', color: '#fdf8ee', height: '100%', overflow: 'hidden' }}>
      <style>{STYLES}</style>
      <Stars />
      <HomeBtn />
      <ProgressDots total={TOTAL} current={screen} />

      {screen === 0 && <S2Envelope d={d} onNext={() => go(1)} />}
      {screen === 1 && <S3Blessing d={d} onNext={() => go(2)} />}
      {screen === 2 && <S4Letter d={d} onNext={() => go(3)} />}
      {screen === 3 && <S5Memories d={d} onNext={() => go(4)} />}
      {screen === 4 && <S6Duas d={d} active={true} onNext={() => go(5)} />}
      {screen === 5 && <S7Eidi d={d} onNext={() => go(6)} />}
      {screen === 6 && <S8Closing d={d} onNext={() => go(7)} />}
      {screen === 7 && <S9Chain d={d} />}
    </div>
  );
}