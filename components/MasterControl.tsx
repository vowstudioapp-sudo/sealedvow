import React from 'react';
import { CoupleData } from '../types';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  data: CoupleData;
}

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export const MasterControl: React.FC<Props> = ({ data }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#0C0A09' }}>
      <div className="text-center max-w-2xl mx-auto space-y-8">
        {/* Title */}
        <h1 className="font-serif-elegant italic text-5xl md:text-7xl text-[#D4AF37] leading-tight">
          Sender Control Panel
        </h1>

        {/* Subtitle */}
        <p className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-bold text-[#D4AF37]/80">
          VIGIL • SYNC • REMOTE
        </p>

        {/* Divider */}
        <div className="w-16 h-px bg-[#D4AF37]/30 mx-auto"></div>

        {/* Body Text */}
        <p className="text-base md:text-lg font-serif-elegant italic text-[#E5D0A1]/90 leading-relaxed max-w-md mx-auto">
          Ritual reveal mechanics are currently being refined.
          <br />
          This feature will be unlocked in the next version.
        </p>

        {/* Footer */}
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37]/50 font-bold mt-12">
          For now, the letter reveals immediately upon opening.
        </p>
      </div>
    </div>
  );
};