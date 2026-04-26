/**
 * LetterSection — The emotional peak of the receiver experience.
 *
 * Owns: paragraph-by-paragraph reveal, voice note toggle, signature block.
 * Internal state: currentParagraph (fully local — no parent dependency).
 * Audio: Managed via useAudioNarration hook (lifecycle + cleanup internal).
 *
 * Extracted from MainExperience.tsx — zero logic changes.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Theme } from '../../types';
import { useAudioNarration } from '../../hooks/useAudioNarration';
import { AtmosphericShell } from '../AtmosphericShell';

const MAX_PARAGRAPH_CHARS = 180;

export type LetterReadability = {
  primary: string;
  secondary: string;
  muted: string;
};

interface LetterSectionProps {
  finalLetter: string;
  senderName: string;
  audioUrl?: string;
  theme: {
    gold: string;
    text: string;
  };
  readability: LetterReadability;
  /** Letter / experience theme — drives atmospheric backdrop behind the letter. */
  surfaceTheme: Theme;
  activeSection: number;
}

export const LetterSection: React.FC<LetterSectionProps> = ({
  finalLetter,
  senderName,
  audioUrl,
  theme,
  readability: read,
  surfaceTheme,
  activeSection,
}) => {
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const { audioBuffer, isVoicePlaying, toggleVoiceNote } = useAudioNarration(finalLetter, audioUrl);

  /* ── Letter Paragraphs (Memoized Chunking) ── */
  const letterParagraphs = useMemo(() => {
    if (!finalLetter) return [];

    const explicitParagraphs = finalLetter.split('\n').filter(p => p.trim().length > 0);
    const chunks: string[] = [];

    explicitParagraphs.forEach(p => {
      const words = p.split(' ');
      let currentChunk = "";

      words.forEach(word => {
        if ((currentChunk + " " + word).length > MAX_PARAGRAPH_CHARS && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
        } else {
          currentChunk += (currentChunk ? " " : "") + word;
        }
      });

      if (currentChunk) chunks.push(currentChunk.trim());
    });

    return chunks;
  }, [finalLetter]);

  /* ── Handlers ── */
  const advanceParagraph = useCallback(() => {
    if (currentParagraph < letterParagraphs.length - 1) {
      setCurrentParagraph(prev => prev + 1);
    } else {
      // At last paragraph — scroll to next snap section
      const currentSectionEl = document.querySelector(`[data-section="${activeSection}"]`);
      const nextSectionEl = currentSectionEl?.nextElementSibling as HTMLElement;
      if (nextSectionEl && nextSectionEl.classList.contains('snap-section')) {
        nextSectionEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [currentParagraph, letterParagraphs.length, activeSection]);

  const resetParagraph = useCallback(() => {
    setCurrentParagraph(0);
  }, []);

  /* ── Render ── */
  return (
    <AtmosphericShell surfaceTheme={surfaceTheme}>
      <section className="snap-section h-screen w-full relative flex flex-col items-center justify-center snap-start p-4 md:p-8">
      <div
        className="main-experience-letter-card"
        onClick={advanceParagraph}
        style={
          {
            ['--sv-letter-read-primary']: read.primary,
            ['--sv-letter-read-secondary']: read.secondary,
            ['--sv-letter-read-muted']: read.muted,
          } as React.CSSProperties
        }
      >
        <div className="main-experience-letter-card-border" />
        <div className="main-experience-letter-texture" />

        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="min-h-[250px] flex items-center justify-center relative w-full perspective-1000 px-2 md:px-0">
            {letterParagraphs.map((para, idx) => (
              <div
                key={idx}
                className={`main-experience-letter-paragraph ${
                  idx === currentParagraph
                    ? 'main-experience-letter-paragraph--active'
                    : idx < currentParagraph
                      ? 'main-experience-letter-paragraph--prev'
                      : 'main-experience-letter-paragraph--next'
                }`}
              >
                <span className="main-experience-letter-quote">"</span>
                <p className="main-experience-letter-text">
                  {para}
                </p>
              </div>
            ))}
          </div>

          {currentParagraph === letterParagraphs.length - 1 && (
            <div
              className="main-experience-letter-signature"
              style={{ animation: 'closureReveal 1s ease-out 1.5s both' }}
            >
              <div
                className="w-px h-12 mb-6 mx-auto"
                style={{
                  backgroundImage: `linear-gradient(to bottom, transparent, ${read.secondary}, transparent)`,
                }}
              />
              <p className="font-romantic text-4xl mb-3" style={{ color: theme.gold }}>{senderName}</p>
              <div
                className="w-12 h-px mx-auto mb-10"
                style={{ backgroundColor: read.secondary, animation: 'closureLine 0.8s ease-out 2.2s both' }}
              />

              {audioBuffer && (
                <div style={{ animation: 'closureReveal 0.8s ease-out 2.6s both' }}>
                  <button
                    onClick={toggleVoiceNote}
                    className={`main-experience-voice-button ${isVoicePlaying ? 'main-experience-voice-button--playing' : ''}`}
                  >
                    <div className={`main-experience-voice-icon ${isVoicePlaying ? 'main-experience-voice-icon--playing' : ''}`}>
                      {isVoicePlaying ? (
                        <div className="flex gap-0.5 h-3 items-center">
                          <div className="w-0.5 animate-[bounce_1s_infinite] h-full" style={{ backgroundColor: read.primary }} />
                          <div className="w-0.5 animate-[bounce_1.2s_infinite] h-2" style={{ backgroundColor: read.primary }} />
                          <div className="w-0.5 animate-[bounce_0.8s_infinite] h-full" style={{ backgroundColor: read.primary }} />
                        </div>
                      ) : (
                        <span className="ml-0.5 text-[10px]" style={{ color: read.primary }}>▶</span>
                      )}
                    </div>
                    <span className="main-experience-voice-label">
                      {isVoicePlaying ? 'Listening...' : 'Hear this letter'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {currentParagraph < letterParagraphs.length - 1 && (
            <div className="mt-12 animate-pulse text-[11px] uppercase tracking-widest" style={{ color: read.secondary }}>
              Tap to continue
            </div>
          )}
        </div>
      </div>

      {currentParagraph === letterParagraphs.length - 1 && (
        <button
          onClick={resetParagraph}
          className="absolute top-10 right-10 text-[11px] uppercase tracking-widest transition-opacity hover:opacity-100 pb-1 z-20"
          style={{ color: read.muted, opacity: 0.85, borderBottomWidth: 1, borderBottomStyle: 'solid', borderColor: read.muted }}
        >
          Read Again
        </button>
      )}
      </section>
    </AtmosphericShell>
  );
};
