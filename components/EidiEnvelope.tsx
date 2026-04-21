import React, { useEffect, useRef, useState } from 'react';
import { LoadEidiResponse } from '../types/eidi';
import { EidCountdown }   from './EidCountdown';
import { ScratchReveal }  from './ScratchReveal';
import { EidiShareCard }  from './EidiShareCard';

// ─────────────────────────────────────────────────────────────────────
// SealedVow — Eidi Envelope (experience controller)
//
// Stage machine — single source of truth, no boolean soup:
//
//   loading  → fetching envelope from API
//   locked   → time-locked, shows countdown
//   sealed   → ready to open, envelope visible
//   opening  → tap registered, animation playing
//   blessing → blessing revealed word by word
//   scratch  → scratch card shown
//   share    → share card shown
// ─────────────────────────────────────────────────────────────────────

type Particle = {
  x: number; y: number; delay: number; tx: number; ty: number;
};

type Stage =
  | 'loading'
  | 'locked'
  | 'sealed'
  | 'opening'
  | 'blessing'
  | 'scratch'
  | 'share';

interface Props {
  eidiId: string;
}

// Timing constants — cinematic feel on mobile
const T = {
  ENVELOPE_EXIT:   600,   // ms envelope slides up
  SENDER_REVEAL:   800,   // ms after exit, sender name appears
  BLESSING_DELAY:  400,   // ms before first word
  WORD_STAGGER:    150,   // ms between each word
  SCRATCH_DELAY:  1200,   // ms after blessing completes → scratch appears
} as const;

// ─────────────────────────────────────────────────────────────────────
export const EidiEnvelope: React.FC<Props> = ({ eidiId }) => {
  const [stage,   setStage]   = useState<Stage>('loading');
  const [data,    setData]    = useState<LoadEidiResponse | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [words,   setWords]   = useState<string[]>([]);
  const [wordIdx, setWordIdx] = useState(0);  // words revealed so far
  const [particles, setParticles] = useState<Particle[]>([]);

  const sealRef    = useRef<HTMLDivElement>(null);
  const openingRef  = useRef(false);   // prevents double-tap during animation
  const openTimer   = useRef<number | undefined>(undefined);
  const revealTimer = useRef<number | undefined>(undefined);

  // ── FETCH ON MOUNT ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/load-eidi?id=${eidiId}`);
        const json = (await res.json().catch(() => null)) as (LoadEidiResponse & { error?: string }) | null;
        if (!json) { setError('Unexpected server error. Please try again.'); return; }

        if (!res.ok) {
          setError(json.error ?? 'Could not load this Eidi.');
          return;
        }

        setData(json);
        setStage(json.locked ? 'locked' : 'sealed');
      } catch {
        setError('Connection error. Please check your internet and try again.');
      }
    }
    load();
  }, [eidiId]);

  // ── WORD-BY-WORD BLESSING REVEAL ────────────────────────────────────
  useEffect(() => {
    if (stage !== 'blessing' || !data?.blessing) return;

    // match handles emojis, punctuation, multiple spaces
    const allWords = data.blessing.match(/\S+/g) || [];
    setWords(allWords);
    setWordIdx(0);

    let interval: ReturnType<typeof setInterval>;

    const timer = setTimeout(() => {
      interval = setInterval(() => {
        setWordIdx(prev => {
          const next = prev + 1;
          if (next >= allWords.length) {
            clearInterval(interval);
            // Scratch only if amount present — blessing already shown above
            const hasAmount = Boolean(data.amount);
            revealTimer.current = window.setTimeout(() => setStage(hasAmount ? 'scratch' : 'share'), T.SCRATCH_DELAY);
          }
          return next;
        });
      }, T.WORD_STAGGER);
    }, T.BLESSING_DELAY);

    // Clean up both timer AND interval on unmount/stage change
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [stage, data]);

  // Cleanup open timer on unmount
  useEffect(() => {
    return () => {
      if (openTimer.current)  clearTimeout(openTimer.current);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  // ── TAP HANDLER ─────────────────────────────────────────────────────
  function handleTap() {
    if (stage !== 'sealed' || openingRef.current) return;
    openingRef.current = true;
    setStage('opening');

    // Generate gold particles at seal position
    const rect = sealRef.current?.getBoundingClientRect();
    if (rect) {
      setParticles(
        Array.from({ length: 18 }, (_, i) => ({
          x:     rect.left + rect.width  / 2,
          y:     rect.top  + rect.height / 2,
          delay: i * 30,
          tx:    (Math.random() - 0.5) * 120,
          ty:    (Math.random() - 0.5) * 120,
        }))
      );
    }

    // Capture value before async timeout — avoids stale closure on slow devices
    const hasBlessing = Boolean(data?.blessing);
    openTimer.current = window.setTimeout(() => {
      setStage(hasBlessing ? 'blessing' : 'scratch');
    }, T.ENVELOPE_EXIT + T.SENDER_REVEAL);
  }

  // ── RENDER ─────────────────────────────────────────────────────────

  const bg: React.CSSProperties = {
    minHeight:      '100vh',
    background:     '#050505',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '24px 20px',
    fontFamily:     'Georgia, serif',
    color:          '#D4AF37',
    textAlign:      'center',
    overflowX:      'hidden',
  };

  // ── LOADING ──
  if (stage === 'loading') {
    return (
      <div style={bg}>
        <div style={{ fontSize: 40, animation: 'spin 2s linear infinite' }}>🌙</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <div style={bg}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>🌙</p>
        <p style={{ fontSize: 14, color: 'rgba(247,230,167,0.6)', maxWidth: 280 }}>{error}</p>
      </div>
    );
  }

  // ── LOCKED ──
  if (stage === 'locked' && data?.lockedUntil) {
    return (
      <EidCountdown
        unlockAt={data.lockedUntil}
        receiverName={data.receiverName}
        onUnlock={() => setStage('sealed')}
      />
    );
  }

  // ── SEALED ──
  if (stage === 'sealed' || stage === 'opening') {
    const isOpening = stage === 'opening';
    return (
      <div style={bg}>
        <style>{`
          @keyframes twinkle { 0%,100%{opacity:.2} 50%{opacity:.8} }
          @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes exitUp   { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-60px)} }
          @keyframes particle {
            0%   { transform: translate(0,0) scale(1); opacity:1; }
            100% { transform: translate(var(--tx),var(--ty)) scale(0); opacity:0; }
          }
        `}</style>

        {/* Stars */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', top: `${(i * 7.3) % 100}%`, left: `${(i * 11.7) % 100}%`, width: `${(i % 2) + 1}px`, height: `${(i % 2) + 1}px`, borderRadius: '50%', background: '#fff', opacity: 0.3, animation: `twinkle ${(i % 3) + 2}s ease-in-out infinite`, animationDelay: `${i % 3}s` }} />
          ))}
        </div>

        {/* Particles on open */}
        {particles.map((p, i) => (
          <div key={i} style={{
            position:  'fixed',
            top:       p.y,
            left:      p.x,
            width:     6,
            height:    6,
            borderRadius: '50%',
            background: '#D4AF37',
            pointerEvents: 'none',
            zIndex:    100,
            animation: `particle 0.8s ease-out forwards`,
            animationDelay: `${p.delay}ms`,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
          } as React.CSSProperties} />
        ))}

        {/* Envelope card */}
        <div
          onClick={handleTap}
          style={{
            position:   'relative',
            zIndex:     1,
            width:      '100%',
            maxWidth:   320,
            background: 'linear-gradient(145deg, #0f3d24, #1B4332)',
            border:     '1px solid rgba(212,175,55,0.3)',
            borderRadius: 16,
            padding:    '40px 28px 60px',
            cursor:     'pointer',
            animation:  isOpening ? `exitUp ${T.ENVELOPE_EXIT}ms ease forwards` : `fadeUp 0.8s ease forwards`,
            userSelect: 'none',
          }}
        >
          <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold', marginBottom: 24 }}>
            Someone sent you Eidi 🌙
          </p>
          <div style={{ fontSize: 52, marginBottom: 20, lineHeight: 1 }}>🌙</div>
          <p style={{ fontSize: 20, fontStyle: 'italic', color: '#F7E6A7', marginBottom: 8 }}>
            For {data?.receiverName}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(247,230,167,0.4)', marginBottom: 32 }}>
            A sealed Eidi awaits you
          </p>

          {/* Wax seal */}
          <div
            ref={sealRef}
            style={{
              position:     'absolute',
              bottom:       '-24px',
              left:         '50%',
              transform:    'translateX(-50%)',
              width:        48,
              height:       48,
              borderRadius: '50%',
              background:   'radial-gradient(circle at 30% 30%, #c0392b, #7b241c)',
              boxShadow:    `0 0 0 3px rgba(212,175,55,0.4), 0 8px 20px rgba(0,0,0,0.5)`,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              fontSize:     18,
              color:        'rgba(255,255,255,0.8)',
              fontStyle:    'italic',
            }}
          >
            ✦
          </div>
        </div>

        {!isOpening && (
          <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.4)', marginTop: 48, animation: 'fadeUp 1s ease 0.5s forwards', opacity: 0 }}>
            Tap to break the seal
          </p>
        )}
      </div>
    );
  }

  // ── BLESSING ──
  if (stage === 'blessing') {
    return (
      <div style={bg}>
        <style>{`
          @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes wordIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        {/* Sender revealed */}
        <p style={{ fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold', marginBottom: 8, animation: 'fadeUp 0.6s ease forwards' }}>
          From {data?.senderName}
          {data?.relationship ? ` · ${data.relationship}` : ''}
        </p>

        {/* Word by word blessing */}
        <p style={{ fontSize: 22, fontStyle: 'italic', color: '#F7E6A7', lineHeight: 1.8, maxWidth: 300, marginTop: 32 }}>
          {words.slice(0, wordIdx).map((w, i) => (
            <span
              key={i}
              style={{ display: 'inline-block', marginRight: '0.3em', animation: 'wordIn 0.3s ease forwards' }}
            >
              {w}
            </span>
          ))}
        </p>
      </div>
    );
  }

  // ── SCRATCH ──
  if (stage === 'scratch') {
    // Determine what's under the scratch card (3-case logic from spec)
    const revealContent = data?.amount ? (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'rgba(212,175,55,0.5)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Eidi</p>
        <p style={{ fontSize: 36, fontWeight: 'bold', color: '#D4AF37' }}>
          {data.currency === 'USD' ? '$' : data.currency === 'AED' ? 'AED ' : '₹'}
          {data.amount.toLocaleString()}
        </p>
      </div>
    ) : (
      <p style={{ fontSize: 14, fontStyle: 'italic', color: '#F7E6A7', padding: '0 16px' }}>
        A blessing sent with love 🌙
      </p>
    );

    return (
      <div style={bg}>
        <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }`}</style>

        <p style={{ fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold', marginBottom: 8 }}>
          From {data?.senderName}
        </p>
        <p style={{ fontSize: 12, color: 'rgba(247,230,167,0.4)', marginBottom: 32 }}>
          Your Eidi is inside 🌙
        </p>

        <ScratchReveal
          revealContent={revealContent}
          label="Scratch to reveal 🌙"
          onRevealed={() => setTimeout(() => setStage('share'), 800)}
        />

        <p style={{ fontSize: 10, color: 'rgba(212,175,55,0.3)', marginTop: 20 }}>
          Use your finger to scratch
        </p>
      </div>
    );
  }

  // ── SHARE ──
  if (stage === 'share' && data) {
    return (
      <div style={{ ...bg, justifyContent: 'flex-start', paddingTop: 48 }}>
        <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }`}</style>

        <p style={{ fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold', marginBottom: 24, animation: 'fadeUp 0.6s ease forwards' }}>
          Eid Mubarak 🌙
        </p>

        <div style={{ width: '100%', animation: 'fadeUp 0.8s ease 0.2s forwards', opacity: 0 }}>
          <EidiShareCard
            senderName={data.senderName}
            receiverName={data.receiverName}
            blessing={data.blessing}
          />
        </div>

        {/* Viral loop CTA */}
        <div style={{ marginTop: 32, animation: 'fadeUp 0.8s ease 0.6s forwards', opacity: 0 }}>
          <a
            href="/create"
            style={{ display: 'inline-block', padding: '14px 32px', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 100, fontSize: 11, fontWeight: 'bold', letterSpacing: '0.3em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Georgia, serif' }}
          >
            Send Eidi to someone →
          </a>
        </div>
      </div>
    );
  }

  return null;
};
