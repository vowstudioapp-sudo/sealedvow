/**
 * GiftReveal — Reusable gift card with reveal animation and barcode.
 *
 * Renders identically in main flow and exit overlay.
 * State (isGiftRevealed) owned by parent — shared across both instances.
 * Caller handles link href (e.g. preview guard: isPreview ? '#' : giftLink).
 *
 * Extracted from MainExperience.tsx — zero logic changes.
 */

import React from 'react';

interface GiftRevealProps {
  isRevealed: boolean;
  onReveal: () => void;
  giftTitle: string;
  giftNote?: string;
  /** Pre-resolved link. Caller handles preview guard. */
  giftLink?: string;
  sessionId?: string;
  theme: {
    gold: string;
  };
}

export const GiftReveal: React.FC<GiftRevealProps> = ({
  isRevealed,
  onReveal,
  giftTitle,
  giftNote,
  giftLink,
  sessionId,
  theme,
}) => {
  return (
    <div className={`main-experience-gift-container ${isRevealed ? 'main-experience-gift-container--revealed' : ''}`}>
      <div className="main-experience-gift-glow" />

      <div className="main-experience-gift-card">
        <div className="main-experience-gift-texture" />

        <div className="main-experience-gift-corners">
          <div className="main-experience-gift-corner main-experience-gift-corner--tl" />
          <div className="main-experience-gift-corner main-experience-gift-corner--tr" />
          <div className="main-experience-gift-corner main-experience-gift-corner--bl" />
          <div className="main-experience-gift-corner main-experience-gift-corner--br" />
        </div>

        <div className="flex flex-col md:flex-row">
          <div className="main-experience-gift-content">
            <div className="main-experience-gift-punch main-experience-gift-punch--left" />
            <div className="main-experience-gift-punch main-experience-gift-punch--right" />

            <p className="text-[9px] uppercase tracking-[0.5em] mb-2 font-bold" style={{ color: theme.gold, opacity: 0.6 }}>Sealed For You</p>
            <div className="w-8 h-px mb-10" style={{ backgroundColor: theme.gold, opacity: 0.2 }} />

            <h2 className="font-serif-elegant italic text-4xl md:text-5xl text-white mb-6 leading-tight text-center relative z-10 drop-shadow-md">
              {giftTitle}
            </h2>

            {giftNote && (
              <p className="font-serif-elegant italic text-sm text-white/50 text-center mb-10 max-w-xs mx-auto leading-relaxed">
                "{giftNote}"
              </p>
            )}
            {!giftNote && <div className="mb-4" />}

            {!isRevealed ? (
              <button
                onClick={onReveal}
                className="main-experience-gift-reveal"
              >
                <span className="relative z-10">Reveal Gift</span>
                <div className="main-experience-gift-reveal-fill" />
              </button>
            ) : (
              <div className="animate-fade-in w-full">
                <a
                  href={giftLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="main-experience-gift-access"
                >
                  Access Now
                </a>
              </div>
            )}
          </div>

          <div className="main-experience-gift-barcode">
            <div className="main-experience-gift-serial">
              NO. {sessionId?.substring(0, 8).toUpperCase() || "849201"}
            </div>
            <div className="main-experience-gift-bars">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className={`${i % 3 === 0 ? 'w-[2px] md:h-[1px] md:w-full h-full' : 'w-[1px] md:h-[0.5px] md:w-4/5 h-2/3'}`}
                  style={{ backgroundColor: theme.gold }}
                />
              ))}
            </div>
            <div className="md:mt-8 text-xl font-serif-elegant italic" style={{ color: theme.gold, opacity: 0.3 }}>V</div>
          </div>
        </div>
      </div>
    </div>
  );
};