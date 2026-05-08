import { useState } from 'react';
import { formatRelativeTime } from '../utils/relativeTime';
import type { DraftMetadata } from '../hooks/usePreparationPersistence';

interface Props {
  metadata: DraftMetadata;
  onContinue: () => void;
  onBeginAgain: () => void;
}

export default function DraftResumeModal({
  metadata,
  onContinue,
  onBeginAgain,
}: Props) {
  const [confirmingFresh, setConfirmingFresh] = useState(false);

  const previewLines: string[] = [];

  if (metadata.recipientName) {
    previewLines.push(`For ${metadata.recipientName}`);
  }

  previewLines.push(`Saved ${formatRelativeTime(metadata.savedAt)}`);

  const stepLine = `Step ${metadata.step} of 3`;
  const writingFragment = metadata.wordCount > 0
    ? ` · ${metadata.wordCount} ${metadata.wordCount === 1 ? 'word' : 'words'} written`
    : '';
  previewLines.push(stepLine + writingFragment);

  const mediaFragments: string[] = [];
  if (metadata.photoCount > 0) {
    mediaFragments.push(
      `${metadata.photoCount} ${metadata.photoCount === 1 ? 'photo' : 'photos'}`
    );
  }
  if (metadata.hasCoverImage) mediaFragments.push('cover image');
  if (metadata.hasVoiceNote) mediaFragments.push('voice note');
  if (mediaFragments.length > 0) {
    previewLines.push(mediaFragments.join(' · '));
  }

  const heading = metadata.recipientName
    ? `Your letter to ${metadata.recipientName}`
    : 'A letter in progress';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-resume-heading"
    >
      <div className="bg-luxury-paper text-luxury-ink max-w-md w-full p-8 md:p-10 shadow-2xl rounded-sm">

        {!confirmingFresh ? (
          <>
            <h2
              id="draft-resume-heading"
              className="text-xl md:text-2xl font-serif-elegant text-center mb-6"
            >
              {heading}
            </h2>

            <div className="border-t border-luxury-ink/20 my-6" />

            <div className="text-center text-sm md:text-base font-serif-elegant leading-relaxed text-luxury-ink/80 space-y-1">
              {previewLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>

            <div className="border-t border-luxury-ink/20 my-6" />

            {/* Wine = forward emotional progression (PR #10 canon) */}
            <button
              onClick={onContinue}
              className="w-full px-8 py-4 mb-4 bg-luxury-wine text-white rounded-full hover:bg-[#3D1F1F] transition-all font-bold uppercase text-[10px] md:text-xs tracking-[0.3em]"
            >
              Continue your letter
            </button>

            <button
              onClick={() => setConfirmingFresh(true)}
              className="w-full text-center text-sm font-serif-elegant text-luxury-ink/70 hover:text-luxury-ink underline underline-offset-4 transition-colors py-2"
            >
              Begin again
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl md:text-2xl font-serif-elegant text-center mb-4">
              Begin a new letter?
            </h2>

            <p className="text-center text-sm md:text-base font-serif-elegant text-luxury-ink/80 mb-2 leading-relaxed">
              {metadata.recipientName
                ? `This will replace the letter you've been writing for ${metadata.recipientName}.`
                : "This will replace the letter you've been writing."}
            </p>
            <p className="text-center text-xs md:text-sm font-serif-elegant text-luxury-ink/60 mb-8 italic">
              Your current draft will be replaced.
            </p>

            {/* BRONZE — preserves PR #10's CTA semantic system. Wine is
                reserved for emotional forward progression; destructive
                lateral actions use bronze. Putting wine here would weaken
                the language we just stabilized. */}
            <button
              onClick={onBeginAgain}
              className="w-full px-8 py-4 mb-4 bg-luxury-bronze text-white rounded-full hover:bg-luxury-ink transition-all font-bold uppercase text-[10px] md:text-xs tracking-[0.3em]"
            >
              Yes, begin again
            </button>

            <button
              onClick={() => setConfirmingFresh(false)}
              className="w-full text-center text-sm font-serif-elegant text-luxury-ink/70 hover:text-luxury-ink underline underline-offset-4 transition-colors py-2"
            >
              Keep current draft
            </button>
          </>
        )}
      </div>
    </div>
  );
}
