import { useEffect, useRef, useState } from 'react';
import '../styles/eid.css';
import { EID_DEMOS, getDemoByKey, type EidDemo } from '../data/eidDemoData.ts';
import { decodeEidData } from '../utils/eidDecoder';

function generateMemories(relationship?: string, recipient?: string) {
  if (!relationship) return [];

  const map: Record<string, { icon: string; caption: string }[]> = {
    "parent-child": [
      { icon: "🧸", caption: "All those times you cared for me without saying a word" },
      { icon: "🍲", caption: "Your food that always felt like home" },
      { icon: "🕊️", caption: "Your silent sacrifices I now understand" },
    ],
    "child-parent": [
      { icon: "👶", caption: "From holding my hand to guiding my life" },
      { icon: "🏡", caption: "You built everything so I could stand tall" },
      { icon: "❤️", caption: "Your love has always been my strength" },
    ],
    "siblings": [
      { icon: "😂", caption: "All the fights that turned into laughter" },
      { icon: "🤝", caption: "Always having each other's back" },
      { icon: "🎮", caption: "The chaos only we understand" },
    ],
    "friends": [
      { icon: "☕", caption: "Endless conversations that made no sense but meant everything" },
      { icon: "🚶", caption: "Walking through life side by side" },
      { icon: "🔥", caption: "Memories that still make us laugh randomly" },
    ]
  };

  return map[relationship] || [];
}

function generateDuas(relationship?: string) {
  return [
    { icon: "🤲", text: "May Allah fill your life with peace and barakah" },
    { icon: "🌙", text: "May every Eid bring you closer to happiness" },
    { icon: "✨", text: "May your القلب always stay light and content" },
  ];
}

function sanitize(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatSenderDisplay(sender?: string, subtype?: string) {
  if (sender) return sender;
  if (subtype === "father") return "Abu";
  if (subtype === "mother") return "Ammi";
  return "Someone";
}

function isMultipleSender(name: string) {
  if (!name) return false;
  return name.includes("&") || name.toLowerCase().includes(" and ");
}

function getPossessive(name: string) {
  if (!name) return "";
  if (name.endsWith("s")) {
    return `${name}'`;
  }
  return `${name}'s`;
}

function getDuaLabel(relationship?: string, subtype?: string, sender?: string) {
  const senderDisplay = formatSenderDisplay(sender, subtype);
  const multiple = isMultipleSender(senderDisplay);
  const possessive = getPossessive(senderDisplay);

  if (relationship === "parent-child") {
    return multiple
      ? `${possessive} duas for you`
      : `${possessive} dua for you`;
  }

  switch (relationship) {
    case "child-parent":
      return "Your child's dua for you";
    case "elder-child":
      return "An elder's dua for you";
    case "sibling":
    case "friend":
      return multiple
        ? `${possessive} duas for you`
        : `${possessive} dua for you`;
    default:
      return "A special dua for you";
  }
}

function formatLetter(blessing: string, sender?: string, recipient?: string) {
  const safeSender = sanitize(sender || "Someone");
  return `
    <p>My dear ${recipient || "there"},</p>

    <p>${blessing}</p>

    <p>
      On this Eid, I just want you to know how much you mean to me.
      Some feelings are not said every day, but they are always there.
    </p>

    <p>
      May Allah bless you with happiness, peace, and barakah.
    </p>

    <p>Eid Mubarak 🌙</p>

    <p>— ${safeSender}</p>
  `;
}

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
      display: 'flex', gap: 7, zIndex: 100, pointerEvents: 'none',
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
   PREMIUM DIGIT COLUMN ROLLING (Tesla-style Mechanical Counter)
   
   Each digit is a vertical reel that scrolls smoothly.
   Only changing digits move - creates intelligent, physical feel.
───────────────────────────────────────────────────────────── */
function SlotDigit({ value, isMinusSign = false }: { value: number; isMinusSign?: boolean }) {
  if (isMinusSign) {
    return (
      <span style={{ 
        fontSize: '0.85em', 
        fontWeight: 800,
        opacity: 0.9,
        display: 'inline-block',
        width: '0.5em',
      }}>
        −
      </span>
    );
  }

  return (
    <div style={{
      height: '1em',
      width: '0.65em',
      overflow: 'hidden',
      display: 'inline-block',
      position: 'relative',
    }}>
      <div style={{
        transform: `translateY(-${value * 10}%)`,
        transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)', // Apple spring curve
        willChange: 'transform',
      }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <div
            key={digit}
            style={{
              height: '1em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums', // Consistent width
              fontFeatureSettings: '"tnum"',
            }}
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
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
    
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
    
    setTimeout(() => {
      onNext();
    }, 700);
  };

  return (
    <Screen active style={{ background: 'radial-gradient(ellipse at 50% 40%, #0f4a37 0%, #072018 100%)' }}>
      <div className="eid-envelope-container">
        <div className="eid-envelope">
          <div className="eid-envelope-body"></div>
          <div className="eid-envelope-flap-bottom-left"></div>
          <div className="eid-envelope-flap-bottom-right"></div>
          <div className="eid-envelope-flap-top-left"></div>
          <div className="eid-envelope-flap-top-right"></div>
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
        maxWidth: 680, width: '100%',
        background: '#fffef8', borderRadius: 3,
        padding: 'clamp(28px, 6vw, 52px) clamp(24px, 6vw, 52px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
        position: 'relative', borderTop: '3px solid #c9a84c',
      }}>
        <div style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: 16, opacity: 0.7 }}>🌙</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: '#0d3b2e', textAlign: 'center', marginBottom: 8 }}>
          {d.letterHeading}
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,18,10,0.35)', marginBottom: 28 }}>
          {d.letterMeta}
        </div>
        <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)', marginBottom: 28 }} />

        <div
          className="eid-letter-body"
          style={{ fontSize: 'clamp(0.92rem, 2.2vw, 1.05rem)', lineHeight: 2, color: '#2a1a10', fontWeight: 300 }}
          dangerouslySetInnerHTML={{ __html: d.letterBody }}
        />

        <div className="eid-letter-sign" style={{ marginTop: 32, fontFamily: 'Georgia, serif', fontSize: '1.3rem', color: '#1a5c44' }}>
          {d.letterSign}
        </div>

        <div className="eid-letter-continue" style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
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
   SCREEN 7 — EIDI (TWO JOKES VERSION!)
───────────────────────────────────────────────────────────── */
function S7Eidi({ d, onNext }: { d: EidDemo; onNext: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);
  const [showJoke1, setShowJoke1] = useState(false); // At +1000: "Is this enough?"
  const [showJoke2, setShowJoke2] = useState(false); // At -1000: "You owe me!"
  const [shakeAmount, setShakeAmount] = useState(false); // For crash shake animation

  const finalAmount = parseInt(d.eidiAmount.replace(/[^\d]/g, ''), 10);
  const currency = d.eidiAmount.match(/[^\d,]+/)?.[0] || '₹';

  const revealEidi = () => {
    if (revealed) return;
    
    setRevealed(true);
    
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    
    // PHASE 1: CHAOTIC CLIMB from 0 to 3100 (THE TRAP!)
    let spinCount = 0;
    const phase1Steps = 25;
    
    const spin1 = setInterval(() => {
      const progressToTarget = spinCount / phase1Steps;
      const idealValue = 3100 * progressToTarget; // Climb to 3100 instead of 1000!
      
      const bounce = Math.random() * 500 - 200;
      let next = idealValue + bounce;
      next = Math.max(0, Math.min(3100, next));
      
      setDisplayAmount(Math.floor(next));
      spinCount++;
      
      if (spinCount >= phase1Steps) {
        clearInterval(spin1);
        setDisplayAmount(3100); // Peak at 3100
        
        // MICRO-TRAP: Pause at 3100, then DROP to 1000
        setTimeout(() => {
          // Sudden drop to 1000
          setDisplayAmount(1000);
          
          if (navigator.vibrate) {
            navigator.vibrate(20); // Small vibration on drop
          }
          
          // Bounce effect at 1000
          setTimeout(() => setDisplayAmount(980), 100);
          setTimeout(() => setDisplayAmount(1000), 200);
          setTimeout(() => setDisplayAmount(990), 300);
          setTimeout(() => setDisplayAmount(1000), 400);
          
          // NOW show JOKE 1 after the bounce
          setTimeout(() => {
            setShowJoke1(true);
            if (navigator.vibrate) {
              navigator.vibrate([50, 100, 50]);
            }
          }, 800); // Pause to let the 1000 sink in
        }, 600); // Pause at 3100 for 600ms
      }
    }, 200);
  };

  const rejectOffer = () => {
    // User clicked NO (either green or red)
    setShowJoke1(false);
    
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    
    // PHASE 2: CHAOTIC CRASH from 1000 to -1000
    let spinCount = 0;
    const phase2Steps = 30;
    
    const spin2 = setInterval(() => {
      const progressToTarget = spinCount / phase2Steps;
      const idealValue = 1000 - (2000 * progressToTarget);
      
      const bounce = Math.random() * 500 - 300;
      let next = idealValue + bounce;
      next = Math.max(-1000, Math.min(1000, next));
      
      setDisplayAmount(Math.floor(next));
      spinCount++;
      
      if (spinCount >= phase2Steps) {
        clearInterval(spin2);
        setDisplayAmount(-1000);
        
        // ChatGPT's Expectation Break Haptics - "uh-oh" vibration pattern + shake
        if (navigator.vibrate) {
          navigator.vibrate([40, 50, 80]); // Pause between bursts creates "uh-oh" feel
        }
        
        // Trigger shake animation
        setShakeAmount(true);
        setTimeout(() => setShakeAmount(false), 150);
        
        // Show JOKE 2 after reaching -1000
        setTimeout(() => {
          setShowJoke2(true);
          if (navigator.vibrate) {
            navigator.vibrate([50, 100, 50]);
          }
        }, 500);
      }
    }, 200);
  };

  const acceptDebt = () => {
    // User clicked YES (either red or green)
    setShowJoke2(false);
    
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    
    // PHASE 3: CHAOTIC RECOVERY from -1000 to final amount
    let spinCount = 0;
    const totalChange = finalAmount - (-1000);
    const phase3Steps = 35;
    
    const spin3 = setInterval(() => {
      const progressToTarget = spinCount / phase3Steps;
      const idealValue = -1000 + (totalChange * progressToTarget);
      
      const bounce = Math.random() * 600 - 250;
      let next = idealValue + bounce;
      next = Math.max(-1000, Math.min(finalAmount, next));
      
      setDisplayAmount(Math.floor(next));
      spinCount++;
      
      if (spinCount >= phase3Steps) {
        clearInterval(spin3);
        
        // ChatGPT's Digit Inertia - overshoot then settle for mechanical feel
        setDisplayAmount(finalAmount + 20); // Overshoot by 20
        
        setTimeout(() => {
          setDisplayAmount(finalAmount); // Settle to exact amount
          
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }, 150); // 150ms overshoot duration
      }
    }, 200);
  };

  const isNegative = displayAmount < 0;
  const absAmount = Math.abs(displayAmount);

  return (
    <Screen active style={{ background: 'radial-gradient(ellipse at 50% 40%, #0f4a37 0%, #061810 100%)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)' }}>
          {d.eidiLabel}
        </div>

        {!revealed ? (
          <>
            <div
              onClick={revealEidi}
              style={{ 
                width: 120, 
                height: 130, 
                cursor: 'pointer', 
                transition: 'transform 0.3s ease',
                transform: 'scale(1)',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
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
            
            <div 
              className={shakeAmount ? 'shake-on-crash' : ''}
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 'clamp(3rem, 12vw, 5.5rem)',
                color: isNegative ? '#ff4a4a' : '#e8c97a',
                lineHeight: 1,
                filter: 'drop-shadow(0 0 20px rgba(201,168,76,0.4)) drop-shadow(0 0 40px rgba(201,168,76,0.2))',
                display: 'flex',
                alignItems: 'center',
                gap: '0.15em',
              }}>
              <span>{currency}</span>
              
              {isNegative && <SlotDigit value={0} isMinusSign />}
              
              {absAmount
                .toString()
                .padStart(4, "0")
                .split("")
                .map((digit, i) => (
                  <SlotDigit key={i} value={Number(digit)} />
                ))}
            </div>
            
            {!showJoke1 && !showJoke2 && displayAmount >= finalAmount && (
              <>
                <div style={{ fontSize: '0.72rem', color: 'rgba(201,168,76,0.5)', fontFamily: 'Georgia, serif', fontStyle: 'italic', letterSpacing: '0.08em', marginTop: -4 }}>
                  Eidi feels better when you give it too.
                </div>
                
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', color: '#f5e9c4', fontStyle: 'italic', maxWidth: 300, lineHeight: 1.6 }}>
                  {d.eidiMsg}
                </div>

                {/* ChatGPT's Screenshot Line - appears after 200ms delay */}
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '0.95rem',
                  color: '#e8c97a',
                  maxWidth: 340,
                  lineHeight: 1.6,
                  marginTop: 16,
                  opacity: 0,
                  animation: 'fadeInDelayed 0.4s ease 0.2s forwards', // 200ms delay
                }}>
                  Don't worry…<br />
                  I saw how fast you clicked "NO" earlier 😏
                </div>
                
                <BtnNext onClick={onNext} style={{ marginTop: 8 }}>{d.duaTitle} ✦</BtnNext>
              </>
            )}
          </div>
        )}
      </div>

      {/* JOKE 1: At +1000 - "Is this enough?" with NO/NO */}
      {showJoke1 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'eid-fadeUp 0.3s ease forwards',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0d3b2e 0%, #0a2e1e 100%)',
            padding: '48px 40px',
            borderRadius: 16,
            maxWidth: 420,
            textAlign: 'center',
            border: '2px solid rgba(201,168,76,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ 
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(1.15rem, 4vw, 1.45rem)',
              color: '#e8c97a',
              marginBottom: 12,
              lineHeight: 1.5,
            }}>
              Is ₹1000 enough Eidi for you?
            </div>
            
            {/* ChatGPT's subtle nudge */}
            <div style={{
              fontSize: '0.85rem',
              color: 'rgba(201,168,76,0.6)',
              marginBottom: 32,
              fontStyle: 'italic',
            }}>
              Be honest 😏
            </div>
            
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {/* GREEDY BUTTON (LEFT) - Larger, Green, Appears First, Pulsing */}
              <button
                onClick={rejectOffer}
                style={{
                  padding: '16px 48px', // BIGGER than right button
                  background: '#2e7d32', // GREEN = good
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.95rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 16px rgba(46,125,50,0.5)',
                  animation: 'greedyPulse 2s ease-in-out infinite', // PULSE to attract attention
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#27632a';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#2e7d32';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                NO
              </button>
              
              {/* SECOND BUTTON (RIGHT) - Smaller, Red, Delayed Appearance */}
              <button
                onClick={rejectOffer}
                style={{
                  padding: '14px 40px', // SMALLER than left button
                  background: '#d32f2f', // RED = bad
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(211,47,47,0.4)',
                  opacity: showJoke1 ? 1 : 0, // Fades in after 250ms
                  animation: 'fadeInDelayed 0.3s ease 0.25s forwards', // 250ms delay
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#c62828';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#d32f2f';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOKE 2: At -1000 - "You owe me!" with YES/YES */}
      {showJoke2 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'eid-fadeUp 0.3s ease forwards',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0d3b2e 0%, #0a2e1e 100%)',
            padding: '48px 40px',
            borderRadius: 16,
            maxWidth: 420,
            textAlign: 'center',
            border: '2px solid rgba(201,168,76,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: '3.2rem', marginBottom: 24 }}>😏</div>
            
            <div style={{ 
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(1.15rem, 4vw, 1.45rem)',
              color: '#e8c97a',
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              Too greedy, huh?
            </div>
            
            <div style={{ 
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(1.05rem, 3.5vw, 1.25rem)',
              color: '#f5e9c4',
              marginBottom: 32,
              lineHeight: 1.6,
            }}>
              Now YOU owe me Eidi this year.
            </div>
            
            <div style={{
              fontSize: '0.9rem',
              color: 'rgba(201,168,76,0.7)',
              marginBottom: 28,
              letterSpacing: '0.05em',
              fontFamily: 'Georgia, serif',
            }}>
              Deal?
            </div>
            
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={acceptDebt}
                style={{
                  padding: '14px 40px',
                  background: '#d32f2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(211,47,47,0.4)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#c62828';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#d32f2f';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                YES
              </button>
              
              <button
                onClick={acceptDebt}
                style={{
                  padding: '14px 40px',
                  background: '#2e7d32',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(46,125,50,0.4)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#27632a';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#2e7d32';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                YES
              </button>
            </div>
          </div>
        </div>
      )}
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
   SCREEN 9 — VIRAL CHAIN
───────────────────────────────────────────────────────────── */
function S9Chain({ d }: { d: EidDemo }) {
  return (
    <Screen active style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f4a37 0%, #061810 100%)', textAlign: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 420 }}>
        <div style={{ fontSize: '2.2rem', animation: 'eid-closingMoon 3s ease-in-out infinite' }}>🌙</div>

        <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.5rem, 5vw, 2rem)', color: '#e8c97a', lineHeight: 1.4 }}>
          Someone made your<br />Eid special.
        </div>

        <div style={{ width: 48, height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)' }} />

        <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', color: '#e8c97a', lineHeight: 1.5 }}>
          Think of someone who would smile<br />receiving this today.
        </div>

        <button
          onClick={() => { window.location.href = '/demo/eid'; }}
          style={{
            marginTop: 16,
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
          Send an Eid card ✦
        </button>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────
   HOME BUTTON
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
   STYLES
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
  @keyframes eid-eidiGlow {
    0%, 100% { 
      filter: drop-shadow(0 0 20px rgba(201,168,76,0.4)) drop-shadow(0 0 40px rgba(201,168,76,0.2));
    }
    50% { 
      filter: drop-shadow(0 0 30px rgba(201,168,76,0.6)) drop-shadow(0 0 60px rgba(201,168,76,0.3));
    }
  }
  @keyframes greedyPulse {
    0%, 100% { 
      transform: scale(1);
      box-shadow: 0 4px 16px rgba(46,125,50,0.5);
    }
    50% { 
      transform: scale(1.03);
      box-shadow: 0 6px 24px rgba(46,125,50,0.7);
    }
  }
  @keyframes fadeInDelayed {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    50% { transform: translateX(6px); }
    75% { transform: translateX(-4px); }
    100% { transform: translateX(0); }
  }
  .shake-on-crash {
    animation: shake 0.15s ease-in-out;
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
  // Step 2: Detect encoded message from URL
  const decoded = decodeEidData();
  const senderDisplayName = formatSenderDisplay(decoded?.senderName, decoded?.subtype);

  const params = new URLSearchParams(window.location.search);
  const isPreview = params.get("preview") === "1";

  // Step 3: Convert decoded data to EidDemo format if it exists
  const customDemo: EidDemo | null = decoded
    ? {
        recipient: decoded.recipient || "Someone",
        envFrom: 'A message for you',
        blessing: decoded.blessing || "Eid Mubarak",

        letterHeading: `Eid Mubarak — to ${decoded.recipient || "Someone"}`,
        letterMeta: 'EID',
        letterBody: formatLetter(
          decoded.blessing || "Eid Mubarak!",
          senderDisplayName,
          decoded.recipient
        ),
        letterSign: '',

        memTitle: "Our Eid Memories",
        memSub: "Moments worth remembering",
        memories: generateMemories(decoded.relationship, decoded.recipient),

        duaTitle: getDuaLabel(decoded.relationship, decoded.subtype, decoded.senderName),
        duaSub: "",
        duas: generateDuas(decoded.relationship),

        eidiLabel: "Your Eidi",
        eidiFrom: 'With love',
        eidiAmount: decoded.eidiAmount || "₹0",
        eidiMsg: "",

        closingMain: "Eid Mubarak",
        closingSender: '',

        senderName: senderDisplayName
      }
    : null;

  // Step 4: Select data source (prioritize decoded > demo)
  const path = window.location.pathname;
  const key = path.split('/demo/eid/')[1]?.split(/[?#]/)[0] ?? '';
  const relationship = decoded?.relationship || key || undefined;
  const baseDemo = customDemo || getDemoByKey(key) || EID_DEMOS[key];
  const d = baseDemo
    ? {
        ...baseDemo,
        duaTitle: getDuaLabel(relationship, decoded?.subtype, decoded?.senderName),
      }
    : baseDemo;

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
      {isPreview && (
        <div style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1C1917",
          color: "#D4AF37",
          padding: "6px 14px",
          fontSize: 10,
          letterSpacing: "0.3em",
          borderRadius: 999,
          zIndex: 1000
        }}>
          PREVIEW MODE
        </div>
      )}
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
