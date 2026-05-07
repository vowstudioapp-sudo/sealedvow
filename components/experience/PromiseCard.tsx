/**
 * PromiseCard — single full-viewport vow card.
 *
 * Each populated coupon renders as its own snap-section in MainExperience.
 * The receiver encounters vows one at a time by scrolling — no clicking,
 * no advancing carousel, no claim interaction. Scroll alone is the
 * progression mechanic.
 *
 * Reveal: parent (MainExperience) tracks per-section visibility via the
 * existing IntersectionObserver. When the section enters viewport, parent
 * flips an entry in `revealedPromises: Set<number>` and passes
 * `isRevealed` down to this card. The card mirrors the closure section's
 * fade-in: opacity + small translate-y settle via the shared
 * `closureReveal` keyframe.
 *
 * Surface treatment lives in `.main-experience-promise-card` in
 * styles/main-experience.effects.css and consumes the per-letter theme
 * cascade (--theme-board-bg / --theme-text / --theme-gold) set on
 * .main-experience-container.
 */

import React from 'react';
import { Coupon } from '../../types';

interface PromiseCardProps {
  coupon: Coupon;
  index: number;
  isRevealed: boolean;
  theme: {
    text: string;
    gold: string;
  };
}

export const PromiseCard: React.FC<PromiseCardProps> = ({ coupon, index, isRevealed, theme }) => {
  const number = String(index + 1).padStart(2, '0');

  return (
    <div
      className="main-experience-promise-card relative flex flex-col w-full max-w-md mx-auto min-h-[24rem] md:min-h-[28rem] p-8 md:p-10 rounded-sm border"
      style={{
        opacity: isRevealed ? 1 : 0,
        animation: isRevealed ? 'closureReveal 1.2s ease-out 0.2s both' : undefined,
      }}
    >
      <div className="main-experience-coupon-texture" />

      <div className="flex justify-between items-start opacity-60 relative z-10">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.3em]"
          style={{ color: theme.gold }}
        >
          VOW {number}
        </span>
        <span className="text-2xl">{coupon.icon}</span>
      </div>

      <div className="text-center relative z-10 flex-1 flex flex-col justify-center my-8">
        <h3 className="font-serif-elegant italic text-2xl md:text-3xl mb-6 leading-tight">
          {coupon.title}
        </h3>
        <div className="w-8 h-0.5 mx-auto opacity-10 mb-6 bg-current" />
        <p className="font-sans text-base leading-relaxed opacity-70">
          {coupon.description}
        </p>
      </div>
    </div>
  );
};
