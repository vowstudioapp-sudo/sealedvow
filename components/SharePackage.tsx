import React, { useState } from 'react';
import { CoupleData } from '../types';

// ════════════════════════════════════════════════════════════════════
// CHANGED: SharePackage no longer calls saveSession().
// Session was already created server-side during payment verification.
// sessionKey and shareSlug are passed in as props from App.tsx.
// ════════════════════════════════════════════════════════════════════

interface Props {
  data: CoupleData;
  sessionKey: string;   // NEW: from server via payment flow
  shareSlug: string;    // NEW: from server via payment flow
  onPreview: () => void;
  onEdit: () => void;
}

export const SharePackage: React.FC<Props> = ({ data, sessionKey, shareSlug, onPreview, onEdit }) => {
  const [copied, setCopied] = useState(false);
  const [masterCopied, setMasterCopied] = useState(false);

  const baseUrl = window.location.origin;
  const shareBaseUrl = `${baseUrl}/${shareSlug}`;
  const shareUrl = shareBaseUrl;
  const masterUrl = `${shareBaseUrl}?role=master`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMasterCopy = () => {
    navigator.clipboard.writeText(masterUrl);
    setMasterCopied(true);
    setTimeout(() => setMasterCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `For ${data.recipientName}`,
          text: `I have prepared a private experience for you. This key is the only way to unlock it.\n\nOpen this when you are alone.`,
          url: shareUrl,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const showMasterKey = data.revealMethod === 'remote' || data.revealMethod === 'sync';

  return (
    <div className="max-w-2xl mx-auto p-3 md:p-4 mt-2 pb-6">
      <div className="bg-luxury-paper border-2 border-[#D4C5A5] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-center animate-fade-in p-5 md:p-6 relative overflow-hidden">

        {/* Header */}
        <div className="mb-5 flex justify-center relative">
          <div className="w-14 h-14 rounded-full bg-[#1C1917] flex items-center justify-center border-2 border-luxury-gold/60 relative z-10 shadow-lg">
            <span className="text-2xl text-luxury-gold">🗝️</span>
          </div>
        </div>

        <h2 className="text-[9px] md:text-[10px] uppercase tracking-[0.45em] text-luxury-gold-dark font-bold mb-2">Cryptographically Sealed</h2>
        <h1 className="text-2xl md:text-4xl font-serif-elegant italic text-luxury-ink mb-3">The Private Key</h1>

        <div className="w-14 h-1 bg-luxury-gold/50 mx-auto mb-4 rounded-full"></div>

        <p className="text-luxury-stone/90 mb-5 font-serif-elegant italic text-base leading-relaxed max-w-md mx-auto font-bold">
          "This link is the only key to your message. It exists only for you and {data.recipientName}."
        </p>

        {/* RECIPIENT LINK */}
        <div className="mb-6">
          <label className="block text-[9px] font-bold text-luxury-ink/60 uppercase tracking-[0.2em] mb-2">Link for {data.recipientName}</label>
          <div
            className="bg-[#1C1917] rounded-lg p-3 border-2 border-luxury-gold/40 text-left relative group cursor-pointer hover:border-luxury-gold transition-colors shadow-inner"
            onClick={handleCopy}
          >
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-bold text-luxury-gold/80 uppercase tracking-[0.2em]">Key</p>
              <div className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${copied ? 'text-green-400' : 'text-luxury-gold/60'}`}>
                {copied ? 'COPIED' : 'COPY'}
              </div>
            </div>
            <div className="font-mono text-xs text-luxury-ivory/80 tracking-wider font-bold">
              {shareUrl}
            </div>
          </div>

          <button
            onClick={handleNativeShare}
            className="w-full mt-3 py-3.5 bg-luxury-wine text-white font-bold text-[10px] tracking-[0.35em] uppercase rounded-full hover:bg-black shadow-xl transition-all flex items-center justify-center group"
          >
            <span>Deliver Key</span>
          </button>
        </div>

        {/* MASTER KEY (For Remote/Sync) */}
        {showMasterKey && (
          <div className="pt-5 border-t-2 border-luxury-ink/20">
            <label className="block text-[9px] font-bold text-luxury-wine uppercase tracking-[0.2em] mb-2">
              Your Master Control Link
              <span className="block text-[9px] text-luxury-stone/80 mt-1 font-bold opacity-90">Save this to control the unlock. Do not share.</span>
            </label>
            <div
              className="bg-[#2D2424] rounded-lg p-3 border-2 border-luxury-wine/50 text-left relative group cursor-pointer hover:border-luxury-wine transition-colors"
              onClick={handleMasterCopy}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-bold text-luxury-wine/80 uppercase tracking-[0.2em]">Master Key</p>
                <div className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${masterCopied ? 'text-green-400' : 'text-luxury-stone/60'}`}>
                  {masterCopied ? 'COPIED' : 'COPY'}
                </div>
              </div>
              <div className="font-mono text-xs text-white/70 tracking-wider font-bold">
                {masterUrl}
              </div>
            </div>
          </div>
        )}

        {/* SECURITY SEAL */}
        <div className="mt-6 pt-5 border-t-2 border-luxury-ink/20 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <svg className="w-4 h-4 text-luxury-gold-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-luxury-ink">Secured Transit</span>
          </div>
          <div className="max-w-md text-center space-y-2">
            <p className="text-[9px] md:text-[10px] text-luxury-stone/80 leading-relaxed font-serif-elegant italic font-bold">
              "Your message is encrypted in transit and at rest. Access is restricted to automated delivery systems only. No humans, no AI training."
            </p>
            <div className="flex justify-center gap-2 text-[8px] uppercase tracking-widest text-luxury-ink/50 font-bold mt-1">
              <span>AES-256 Storage</span>
              <span>•</span>
              <span>TLS 1.3 Transit</span>
              <span>•</span>
              <span>Ephemeral Access</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button onClick={onPreview} className="text-[10px] md:text-xs text-luxury-ink/60 hover:text-luxury-ink font-bold uppercase tracking-[0.3em] transition-colors border-b-2 border-transparent hover:border-luxury-ink/30 pb-1">
            Preview Receiver View
          </button>
        </div>

      </div>
    </div>
  );
};