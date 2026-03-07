import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PrivacyModal } from './PrivacyModal';
import { TermsModal } from './TermsModal';
import { HelpModal } from './HelpModal';
import { EidCountdown } from './EidCountdown';
import { getActiveFestival } from '../config/festivals';
import { FEATURES } from '../config/features';

interface Props {
  onEnter: () => void;
}

export const LandingPage: React.FC<Props> = ({ onEnter }) => {
  const [isVisible,    setIsVisible]    = useState(false);
  const [isEntering,   setIsEntering]   = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [showPrivacy,  setShowPrivacy]  = useState(false);
  const [showTerms,    setShowTerms]    = useState(false);
  const [showHelp,     setShowHelp]     = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem('eid_banner_dismissed_2026') === '1'; }
    catch { return false; }
  });

  const intervalRef = useRef<number | null>(null);

  // Active festival — memoised, changes only if festival config changes
  const festival = useMemo(() => getActiveFestival(), []);
  const showEid  = FEATURES.eidiEnabled && !!festival;

  // Eid start timestamp for countdown
  const eidStartAt = useMemo(() => {
    if (!festival) return null;
    return new Date(festival.start + 'T00:00:00').getTime();
  }, [festival]);

  /* ------------------------------------------------
     Entrance Reveal
     ------------------------------------------------ */
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  /* ------------------------------------------------
     Cinematic Deterministic Progress
     ------------------------------------------------ */
  useEffect(() => {
    if (!isEntering) return;
    let current = 0;
    intervalRef.current = window.setInterval(() => {
      current += (100 - current) * 0.12;
      if (current >= 99) {
        current = 100;
        setProgress(100);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(onEnter, 600);
        return;
      }
      setProgress(current);
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isEntering, onEnter]);

  const handleEnter = () => { if (isEntering) return; setIsEntering(true); };

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    try { localStorage.setItem('eid_banner_dismissed_2026', '1'); } catch {}
  };

  return (
    <div className="landing min-h-screen bg-[#050505] text-[#D4AF37] relative overflow-hidden flex flex-col">

      {/* Modals */}
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsModal   isOpen={showTerms}   onClose={() => setShowTerms(false)} />
      <HelpModal    isOpen={showHelp}    onClose={() => setShowHelp(false)} />

      {/* ── EID TOUCHPOINT 1 — Dismissable top banner ── */}
      {showEid && !bannerDismissed && (
        <div style={{
          width: '100%',
          background: 'rgba(27,67,50,0.95)',
          borderBottom: '1px solid rgba(212,175,55,0.25)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          fontFamily: 'Georgia, serif',
        }}>
          <span style={{ fontSize: 13 }}>🌙</span>
          <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#F7E6A7', fontWeight: 'bold', margin: 0 }}>
            Eid Special — Send a Sealed Eidi
          </p>
          <a
            href="/eidi/create"
            style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#D4AF37', fontWeight: 'bold', textDecoration: 'none', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 100, padding: '4px 12px', marginLeft: 4 }}
          >
            Send →
          </a>
          <button
            onClick={handleDismissBanner}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(212,175,55,0.4)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Cinematic Background */}
      <div className="landing-background">
        <div className="landing-glow landing-glow--wine" />
        <div className="landing-glow landing-glow--gold" />
        <div className="landing-texture" />
      </div>

      {/* Main Content */}
      <div className={`flex-grow flex flex-col items-center justify-center text-center px-6 transition-all duration-[1500ms] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}>

        {/* Monogram */}
        <div className="mb-6 md:mb-12 relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center">
          <div className="monogram-ring monogram-ring--outer" />
          <div className="monogram-ring monogram-ring--inner" />
          <span className="font-serif-elegant italic text-4xl md:text-5xl relative z-10 pt-2">V</span>
          <div className="monogram-glow monogram-glow--mobile-dim" />
        </div>

        {/* Branding */}
        <p className="text-[10px] uppercase tracking-[0.8em] font-bold mb-4 md:mb-8 animate-fade-in">VOW</p>

        {/* Hero — NEVER TOUCHED */}
        <h1 className="text-[2.6rem] md:text-8xl font-serif-elegant italic mb-4 md:mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-[#D4AF37] via-[#F7E6A7] to-[#8B5E3C]">
          Silence the noise.<br />
          Speak to the soul.
        </h1>

        {/* Subline */}
        <p className="hidden md:block text-[#F7E6A7] text-base md:text-lg font-serif-elegant italic mb-6 max-w-lg mx-auto">
          "A private letter, created by you, for one person."
        </p>

        {/* Whisper */}
        <p className="hidden md:block text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold opacity-80 mb-12 animate-fade-in">
          Designed for moments that deserve ceremony
        </p>

        <div className="hidden md:block w-16 h-px bg-[#D4AF37]/60 mb-16" />

        {/* ── EID TOUCHPOINT 2 — Dual CTA ── */}
        <div className="flex flex-col items-center min-h-[80px] md:min-h-[100px] justify-center space-y-4 md:space-y-6 mt-2 md:mt-0">
          {!isEntering ? (
            <>
              <button onClick={handleEnter} className="landing-enter-button">
                <span className="relative z-10">Enter Studio</span>
                <div className="landing-enter-fill" />
              </button>

              <p className="hidden md:block text-[#AAA] text-[10px] uppercase tracking-[0.2em] font-bold opacity-0 animate-fade-in delay-2000">
                Takes less than 5 minutes
              </p>
              <p className="md:hidden text-[#9A8F7E] text-[10px] uppercase tracking-[0.15em] font-bold animate-fade-in">
                Private. Takes less than 5 minutes.
              </p>
            </>
          ) : (
            <div className="w-64 flex flex-col items-center space-y-4 animate-fade-in">
              <div className="landing-progress-track">
                <div className="landing-progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between w-full text-[10px] uppercase tracking-[0.2em] font-mono font-bold opacity-80">
                <span className="animate-pulse">Initializing Studio</span>
                <span>{Math.floor(progress)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── EID TOUCHPOINT 3 — Eid section below hero ── */}
      {showEid && (
        <section style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          padding: '48px 24px',
          textAlign: 'center',
          fontFamily: 'Georgia, serif',
          borderTop: '1px solid rgba(212,175,55,0.1)',
        }}>
          <style>{`
            @keyframes moonGlow {
              0%,100% { text-shadow: 0 0 20px rgba(212,175,55,0.3); }
              50% { text-shadow: 0 0 40px rgba(212,175,55,0.7); }
            }
          `}</style>

          <div style={{ fontSize: 40, animation: 'moonGlow 3s ease-in-out infinite', marginBottom: 16 }}>🌙</div>

          <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold', marginBottom: 8 }}>
            {festival?.name ?? 'Eid ul-Fitr 2026'}
          </p>
          <p style={{ fontSize: 18, fontStyle: 'italic', color: '#F7E6A7', marginBottom: 32, lineHeight: 1.5 }}>
            Send a sealed Eidi.<br />Let them scratch to reveal.
          </p>

          {/* 3-step explainer */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
            {[
              { step: '1', text: 'Write a blessing' },
              { step: '2', text: 'Add Eidi amount' },
              { step: '3', text: 'They scratch to reveal' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'rgba(27,67,50,0.4)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10, padding: '12px 14px', minWidth: 100, textAlign: 'center' }}>
                <p style={{ fontSize: 18, fontWeight: 'bold', color: '#D4AF37', marginBottom: 4 }}>{s.step}</p>
                <p style={{ fontSize: 10, color: 'rgba(247,230,167,0.6)', letterSpacing: '0.05em' }}>{s.text}</p>
              </div>
            ))}
          </div>

          {/* Countdown */}
          {eidStartAt && eidStartAt > Date.now() && (
            <div style={{ marginBottom: 28 }}>
              <EidCountdown unlockAt={eidStartAt} variant="landing" />
            </div>
          )}

          <a
            href="/eidi/create"
            style={{ display: 'inline-block', padding: '14px 36px', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)', borderRadius: 100, fontSize: 11, fontWeight: 'bold', letterSpacing: '0.3em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Georgia, serif' }}
          >
            Send Eidi 🌙
          </a>
        </section>
      )}

      {/* Footer */}
      <footer className={`w-full py-6 flex flex-col items-center transition-opacity duration-[2000ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-[240px] h-px bg-[#D4AF37]/30" />
        <div className="py-6 flex flex-col items-center space-y-4">
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-80">VOW — A private expression studio</p>
          <div className="flex flex-col items-center gap-1 opacity-70">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Private by design.</p>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Nothing public. Ever.</p>
          </div>
          <div className="flex flex-col items-center gap-2 pt-3 opacity-60">
            <div className="flex gap-4 text-[10px] uppercase tracking-[0.2em] font-bold">
              <button onClick={() => setShowPrivacy(true)} className="hover:text-[#D4AF37]">Privacy Protocol</button>
              <span>·</span>
              <button onClick={() => setShowTerms(true)} className="hover:text-[#D4AF37]">Terms</button>
            </div>
            <p className="text-[10px] tracking-widest font-bold">© 2026</p>
          </div>
          <button onClick={() => setShowHelp(true)} className="text-[9px] uppercase tracking-[0.2em] font-bold opacity-60 hover:opacity-70 hover:text-[#D4AF37] transition-all mt-4">
            Support
          </button>
        </div>
        <div className="w-[240px] h-px bg-[#D4AF37]/30" />
      </footer>
    </div>
  );
};
