/**
 * PromiseStack — Triptych presentation of the sender's three promises.
 *
 * Renders all populated promise cards together as a single, static
 * presentation surface. No tap-to-advance, no claim interaction, no
 * completion state. The cards exist to be read.
 *
 * Layout: horizontal triptych on desktop (md and up), vertical column
 * on mobile. Centered within the snap-section, with generous gaps so
 * the cards retain ceremonial weight rather than collapsing into a
 * SaaS-grid.
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
    <div className="w-full max-w-6xl mx-auto px-6 md:px-10">
      <div className="flex flex-col md:flex-row md:items-stretch justify-center gap-8 md:gap-12">
        {coupons.map((coupon, index) => (
          <div
            key={coupon.id}
            className="main-experience-coupon main-experience-coupon--active md:flex-1 md:max-w-sm w-full"
          >
            <div className="main-experience-coupon-texture" />

            <div className="flex justify-between items-start opacity-60 relative z-10">
              <span className="text-[9px] font-bold uppercase tracking-widest">NO. 0{index + 1}</span>
              <span className="text-2xl">{coupon.icon}</span>
            </div>

            <div className="text-center relative z-10 mt-4">
              <h3 className="font-serif-elegant italic text-3xl mb-6 leading-tight">{coupon.title}</h3>
              <div className="w-8 h-0.5 mx-auto opacity-10 mb-6" style={{ backgroundColor: theme.text }} />
              <p className="font-sans text-sm leading-relaxed opacity-70">{coupon.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
