import React, { useState, useEffect } from 'react';
import { Theme } from '../types';

const THEME_COLORS: Record<Theme, { bg: string; text: string; accent: string }> = {
  obsidian:  { bg: '#0C0A09', text: '#E5D0A1', accent: 'rgba(212, 175, 55, 0.5)' },
  velvet:    { bg: '#1A0B2E', text: '#E9D5FF', accent: 'rgba(192, 132, 252, 0.5)' },
  crimson:   { bg: '#2B0A0A', text: '#FECDD3', accent: 'rgba(244, 63, 94, 0.5)' },
  midnight:  { bg: '#020617', text: '#E0F2FE', accent: 'rgba(125, 211, 252, 0.5)' },
  evergreen: { bg: '#022C22', text: '#D1FAE5', accent: 'rgba(52, 211, 153, 0.5)' },
  pearl:     { bg: '#1C1917', text: '#F5F5F4', accent: 'rgba(168, 162, 158, 0.5)' },
};

const THEME_DOTS: { id: Theme; color: string; label: string }[] = [
  { id: 'obsidian', color: '#D4AF37', label: 'Obsidian' },
  { id: 'velvet', color: '#C084FC', label: 'Velvet' },
  { id: 'crimson', color: '#F43F5E', label: 'Crimson' },
  { id: 'midnight', color: '#60A5FA', label: 'Midnight' },
  { id: 'evergreen', color: '#34D399', label: 'Evergreen' },
  { id: 'pearl', color: '#A8A29E', label: 'Pearl' },
];

interface Props {
  recipientName: string;
  theme?: Theme;
  isDemoMode?: boolean;
  onThemeChange?: (theme: Theme) => void;
  onComplete: () => void;
}

export const PersonalIntro: React.FC<Props> = ({ recipientName, theme = 'obsidian', isDemoMode = false, onThemeChange, onComplete }) => {
  const colors = THEME_COLORS[theme];
  const [showName, setShowName] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowName(true), 500);
    const t2 = setTimeout(() => setShowSubtitle(true), 1400);

    if (isDemoMode) {
      const t3 = setTimeout(() => setShowThemeSelector(true), 2000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }

    const t3 = setTimeout(() => setFadeOut(true), 3800);
    const t4 = setTimeout(() => onComplete(), 4400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete, isDemoMode]);

  const handleContinue = () => {
    setFadeOut(true);
    setTimeout(() => onComplete(), 600);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-8 select-none"
      style={{
        backgroundColor: colors.bg,
        opacity: fadeOut ? 0 : 1,
        transition: 'background-color 400ms ease-out, opacity 500ms ease-out',
      }}
    >
      <h1
        className="text-center leading-tight"
        style={{
          fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
          fontStyle: 'italic',
          fontSize: 'clamp(2rem, 8vw, 4rem)',
          color: colors.text,
          opacity: showName ? 1 : 0,
          transform: showName ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 800ms ease-out, transform 800ms ease-out, color 400ms ease-out',
        }}
      >
        {recipientName}
      </h1>

      <p
        className="mt-6 text-center"
        style={{
          fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
          fontSize: '11px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: colors.accent,
          opacity: showSubtitle ? 1 : 0,
          transition: 'opacity 600ms ease-out, color 400ms ease-out',
        }}
      >
        This wasn't sent by accident.
      </p>

      {/* Demo Theme Selector */}
      {isDemoMode && showThemeSelector && (
        <div className="mt-12 flex flex-col items-center" style={{ animation: 'closureReveal 0.6s ease-out both' }}>
          <p
            className="text-[8px] uppercase tracking-[0.4em] font-bold mb-4"
            style={{ color: colors.accent, opacity: 0.5 }}
          >
            Preview Theme
          </p>
          <div className="flex gap-3 mb-8">
            {THEME_DOTS.map((t) => (
              <button
                key={t.id}
                onClick={() => onThemeChange?.(t.id)}
                className="relative w-7 h-7 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                  backgroundColor: t.color,
                  boxShadow: theme === t.id
                    ? `0 0 0 2px ${colors.bg}, 0 0 0 4px ${t.color}`
                    : '0 2px 8px rgba(0,0,0,0.3)',
                  opacity: theme === t.id ? 1 : 0.5,
                }}
                title={t.label}
              />
            ))}
          </div>
          <button
            onClick={handleContinue}
            className="text-[9px] uppercase tracking-[0.35em] font-bold px-8 py-3 border rounded-full transition-all duration-300 hover:opacity-80"
            style={{
              borderColor: colors.accent,
              color: colors.text,
              opacity: 0.6,
            }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};