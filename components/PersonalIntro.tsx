import React, { useState, useEffect } from 'react';

interface Props {
  recipientName: string;
  onComplete: () => void;
}

/**
 * PersonalIntro
 * 
 * Pure black screen. Receiver's name. One subtitle.
 * Auto-advances after 3.5 seconds.
 * 
 * Renders from minimal DOM — no images, no external fonts required.
 * System serif used as immediate fallback until custom fonts load.
 */
export const PersonalIntro: React.FC<Props> = ({ recipientName, onComplete }) => {
  const [showName, setShowName] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowName(true), 400);
    const t2 = setTimeout(() => setShowSubtitle(true), 1200);
    const t3 = setTimeout(() => setFadeOut(true), 3000);
    const t4 = setTimeout(() => onComplete(), 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center px-8 select-none"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 500ms ease-out',
      }}
    >
      {/* Receiver's name */}
      <h1
        className="text-center leading-tight"
        style={{
          fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
          fontStyle: 'italic',
          fontSize: 'clamp(2rem, 8vw, 4rem)',
          color: '#E5D0A1',
          opacity: showName ? 1 : 0,
          transform: showName ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 800ms ease-out, transform 800ms ease-out',
        }}
      >
        {recipientName}
      </h1>

      {/* Subtitle */}
      <p
        className="mt-6 text-center"
        style={{
          fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
          fontSize: '11px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'rgba(212, 175, 55, 0.5)',
          opacity: showSubtitle ? 1 : 0,
          transition: 'opacity 600ms ease-out',
        }}
      >
        Someone sealed this for you
      </p>
    </div>
  );
};