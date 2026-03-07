/**
 * PromiseStack — Reusable coupon card stack with claim interaction.
 *
 * Renders identically in main flow and exit overlay.
 * State (coupons, currentCouponIndex) owned by parent — shared across both instances.
 * This component is presentation + interaction only.
 *
 * Extracted from MainExperience.tsx — zero logic changes.
 */

import React from 'react';
import { Coupon } from '../types';

interface PromiseStackProps {
  coupons: Coupon[];
  currentCouponIndex: number;
  onClaim: () => void;
  theme: {
    text: string;
    gold: string;
  };
}

export const PromiseStack: React.FC<PromiseStackProps> = ({
  coupons,
  currentCouponIndex,
  onClaim,
  theme,
}) => {
  return (
    <div className="relative w-80 md:w-96 h-[28rem] md:h-[32rem] perspective-1000">
      {coupons.map((coupon, index) => {
        if (index < currentCouponIndex) return null;
        const isTop = index === currentCouponIndex;
        const offset = index - currentCouponIndex;

        return (
          <div
            key={coupon.id}
            onClick={isTop ? (e: React.MouseEvent) => { e.stopPropagation(); onClaim(); } : undefined}
            className={`main-experience-coupon ${isTop ? 'main-experience-coupon--active' : 'main-experience-coupon--stacked'}`}
            style={
              !isTop
                ? ({
                    '--coupon-offset-y': `${offset * 15}px`,
                    '--coupon-scale': 1 - offset * 0.05,
                  } as React.CSSProperties)
                : undefined
            }
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

            <div className="text-center opacity-60 relative z-10">
              <span className="text-[9px] uppercase tracking-[0.3em] font-bold pb-1" style={{ borderBottom: `1px solid ${theme.text}20` }}>
                {isTop ? 'Accept Vow' : 'Locked'}
              </span>
            </div>
          </div>
        );
      })}

      {currentCouponIndex >= coupons.length && (
        <div className="absolute inset-0 flex flex-col items-center justify-center border border-white/10 rounded-sm bg-white/5 backdrop-blur-sm">
          <span className="text-4xl mb-6 text-white/60">✓</span>
          <p className="text-xs uppercase tracking-widest text-white/40">Promises Accepted</p>
        </div>
      )}
    </div>
  );
};