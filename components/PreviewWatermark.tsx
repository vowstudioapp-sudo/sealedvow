import React from 'react';

// ════════════════════════════════════════════════════════════════════
// PreviewWatermark
//
// Ceremonial overlay shown during creator preview (before payment).
// Subtle repeating "Seal This Vow" pattern + light tint (NO blur).
// Sender can read all content clearly.
//
// Usage:
//   <PreviewWatermark onSeal={() => goToPayment()} onEdit={() => goToRefine()} />
// ════════════════════════════════════════════════════════════════════

interface Props {
  onSeal?: () => void;
  onEdit?: () => void;
}

export const PreviewWatermark: React.FC<Props> = ({ onSeal, onEdit }) => {
  return (
    <>
      {/* Light tint — no blur, sender can read everything */}
      <div 
        className="fixed inset-0 z-[80] pointer-events-none"
        style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
      />

      {/* Repeating watermark text pattern */}
      <div 
        className="fixed inset-0 z-[82] pointer-events-none overflow-hidden select-none"
        style={{ opacity: 0.045 }}
      >
        <div 
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            transform: 'rotate(-25deg)',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'center',
            justifyContent: 'center',
            gap: '3rem',
          }}
        >
          {Array.from({ length: 80 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontStyle: 'italic',
                fontSize: '1.5rem',
                color: '#D4AF37',
                letterSpacing: '0.15em',
                whiteSpace: 'nowrap',
              }}
            >
              Seal This Vow
            </span>
          ))}
        </div>
      </div>

      {/* CTA Buttons — centered bottom */}
      {onSeal && (
        <div className="fixed bottom-0 left-0 right-0 z-[90] flex flex-col items-center pb-10 pt-16 pointer-events-auto"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
          }}
        >
          {/* Edit button — above Seal */}
          {onEdit && (
            <button
              onClick={onEdit}
              className="mb-4 px-6 py-2 text-[9px] font-bold uppercase tracking-[0.3em] transition-all hover:text-white"
              style={{
                color: 'rgba(255,255,255,0.5)',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              Edit Contents
            </button>
          )}

          {/* Seal & Deliver */}
          <button
            onClick={onSeal}
            className="px-10 py-4 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-[0.4em] transition-all transform hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
            style={{
              color: '#1C1917',
              backgroundColor: '#D4AF37',
              boxShadow: '0 0 30px rgba(212,175,55,0.3), 0 10px 40px rgba(0,0,0,0.5)',
            }}
          >
            Seal & Deliver
          </button>
          <p 
            className="mt-4 text-[10px] italic"
            style={{ color: 'rgba(212,175,55,0.5)', fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Your private link will be generated instantly.
          </p>
        </div>
      )}
    </>
  );
};