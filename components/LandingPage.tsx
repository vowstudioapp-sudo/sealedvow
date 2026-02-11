import React, { useEffect, useRef, useState } from 'react';
import { PrivacyModal } from './PrivacyModal';
import { TermsModal } from './TermsModal';

interface Props {
  onEnter: () => void;
}

export const LandingPage: React.FC<Props> = ({ onEnter }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const intervalRef = useRef<number | null>(null);

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

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isEntering, onEnter]);

  const handleEnter = () => {
    if (isEntering) return;
    setIsEntering(true);
  };

  return (
    <div className="landing min-h-screen bg-[#050505] text-[#D4AF37] relative overflow-hidden flex flex-col">

      {/* Modals */}
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />

      {/* Cinematic Background */}
      <div className="landing-background">
        <div className="landing-glow landing-glow--wine" />
        <div className="landing-glow landing-glow--gold" />
        <div className="landing-texture" />
      </div>

      {/* Main Content */}
      <div
        className={`flex-grow flex flex-col items-center justify-center text-center px-6 transition-all duration-[1500ms] ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
      >

        {/* Monogram */}
        <div className="mb-12 relative w-24 h-24 flex items-center justify-center">
          <div className="monogram-ring monogram-ring--outer" />
          <div className="monogram-ring monogram-ring--inner" />
          <span className="font-serif-elegant italic text-5xl relative z-10 pt-2">
            V
          </span>
          <div className="monogram-glow" />
        </div>

        {/* Branding */}
        <p className="text-[10px] uppercase tracking-[0.8em] font-bold mb-8 animate-fade-in">
          VOW
        </p>

        {/* Hero */}
        <h1 className="text-5xl md:text-8xl font-serif-elegant italic mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-[#D4AF37] via-[#F7E6A7] to-[#8B5E3C]">
          Silence the noise.<br />
          Speak to the soul.
        </h1>

        {/* Subline */}
        <p className="text-[#F7E6A7] text-base md:text-lg font-serif-elegant italic mb-6 max-w-lg mx-auto">
          “A private letter, created by you, for one person.”
        </p>

        {/* Whisper */}
        <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold opacity-80 mb-12 animate-fade-in">
          Designed for moments that deserve ceremony
        </p>

        <div className="w-16 h-px bg-[#D4AF37]/60 mb-16" />

        {/* CTA */}
        <div className="flex flex-col items-center min-h-[100px] justify-center space-y-6">
          {!isEntering ? (
            <>
              <button
                onClick={handleEnter}
                className="landing-enter-button"
              >
                <span className="relative z-10">
                  Enter Studio
                </span>
                <div className="landing-enter-fill" />
              </button>

              <p className="text-[#AAA] text-[10px] uppercase tracking-[0.2em] font-bold opacity-0 animate-fade-in delay-2000">
                Takes less than 5 minutes
              </p>
            </>
          ) : (
            <div className="w-64 flex flex-col items-center space-y-4 animate-fade-in">
              <div className="landing-progress-track">
                <div
                  className="landing-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between w-full text-[10px] uppercase tracking-[0.2em] font-mono font-bold opacity-80">
                <span className="animate-pulse">Initializing Studio</span>
                <span>{Math.floor(progress)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer
        className={`w-full py-6 flex flex-col items-center transition-opacity duration-[2000ms] ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="w-[240px] h-px bg-[#D4AF37]/30" />

        <div className="py-6 flex flex-col items-center space-y-4">
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-80">
            VOW — A private expression studio
          </p>

          <div className="flex flex-col items-center gap-1 opacity-70">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold">
              Private by design.
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold">
              Nothing public. Ever.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 pt-3 opacity-60">
            <div className="flex gap-4 text-[10px] uppercase tracking-[0.2em] font-bold">
              <button onClick={() => setShowPrivacy(true)} className="hover:text-[#D4AF37]">
                Privacy Protocol
              </button>
              <span>·</span>
              <button onClick={() => setShowTerms(true)} className="hover:text-[#D4AF37]">
                Terms
              </button>
            </div>
            <p className="text-[10px] tracking-widest font-bold">© 2026</p>
          </div>
        </div>

        <div className="w-[240px] h-px bg-[#D4AF37]/30" />
      </footer>
    </div>
  );
};