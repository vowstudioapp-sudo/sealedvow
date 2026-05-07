/**
 * PromiseStack — Triptych presentation of the sender's three promises.
 *
 * All populated promise cards render simultaneously inside a single
 * snap-section. No tap-to-advance, no claim interaction, no completion
 * state. The cards exist to be read.
 *
 * Layout: horizontal triptych on desktop (md+), vertical column on mobile.
 * Cards use direct Tailwind utility classes + CSS custom properties for
 * theming. The previous carousel-era `.main-experience-coupon` and
 * `.main-experience-coupon--active` CSS classes are intentionally NOT
 * used — those rules `position: absolute; inset: 0` cards on top of each
 * other (the carousel's stack), which defeats the triptych layout. The
 * inner paper-texture overlay class is preserved.
 *
 * Filtering of empty entries is performed by the parent (MainExperience)
 * before passing `coupons`. This component renders whatever it receives.
 *
 * Misnomer note: file is still named PromiseStack.tsx for import-stability.
 * The component is a triptych, not a stack. Rename is post-launch hygiene.
 */

import React from 'react';
import { Coupon } from '../../types';

interface PromiseStackProps {
  coupons: Coupon[];
  theme: {
    text: string;
    gold: string;
  };
}

export const PromiseStack: React.FC<PromiseStackProps> = ({ coupons, theme }) => {
  if (coupons.length === 0) return null;

  return (
    <div className="w-full max-w-5xl mx-auto px-6">
      <div className="flex flex-col md:flex-row md:items-stretch justify-center gap-6 md:gap-8">
        {coupons.map((coupon, index) => (
          <div
            key={coupon.id}
            className="main-experience-promise-card relative flex flex-col justify-between w-full max-w-sm md:max-w-none md:w-72 md:h-[26rem] mx-auto md:mx-0 p-6 md:p-8 rounded-sm border"
            style={{ ['--card-border-color' as string]: `${theme.gold}40` } as React.CSSProperties}
          >
            <div className="main-experience-coupon-texture" />

            <div className="flex justify-between items-start opacity-60 relative z-10">
              <span className="text-[9px] font-bold uppercase tracking-widest">NO. 0{index + 1}</span>
              <span className="text-2xl">{coupon.icon}</span>
            </div>

            <div className="text-center relative z-10 my-6">
              <h3 className="font-serif-elegant italic text-xl md:text-2xl mb-5 leading-tight">
                {coupon.title}
              </h3>
              <div className="w-8 h-0.5 mx-auto opacity-10 mb-5 bg-current" />
              <p className="font-sans text-sm leading-relaxed opacity-70">
                {coupon.description}
              </p>
            </div>

            {/* Spacer to keep eyebrow at top, content vertically centered, and
                a small bottom breathing room. The flex justify-between handles
                vertical distribution; this empty slot anchors the bottom. */}
            <div className="relative z-10" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
};
