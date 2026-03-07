import React, { useEffect, useRef, useState } from 'react';

interface Props {
  senderName:   string;
  blessing?:    string;
  receiverName: string;
  onShare?:     () => void;
}

// ── Word-aware truncation when possible (hard-cuts if no spaces) ───
function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  const slice     = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return slice.slice(0, lastSpace > 0 ? lastSpace : max) + '...';
}

// ── Clipboard with execCommand fallback (old Safari / http) ────────
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');   // prevents mobile keyboard popup
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);  // iOS Safari reliability
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

export const EidiShareCard: React.FC<Props> = ({
  senderName,
  blessing,
  receiverName,
  onShare,
}) => {
  // cardRef reserved for future html-to-image PNG export
  const cardRef     = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const [copied,  setCopied]  = useState(false);
  const [sharing, setSharing] = useState(false);

  // Cleanup timer on unmount — prevents state update on unmounted component
  useEffect(() => {
    return () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); };
  }, []);

  const displayBlessing = blessing
    ? truncate(blessing)
    : 'Eid Mubarak 🌙';

  const shareText = [
    `🌙 Eid Mubarak`,
    ``,
    `"${displayBlessing}"`,
    ``,
    `— ${senderName}`,
    ``,
    `Sent via SealedVow · sealedvow.com`,
  ].join('\n');

  // ── Native share → clipboard fallback ─────────────────────────────
  const handleShare = async () => {
    if (sharing) return;   // prevent double-tap race
    setSharing(true);
    onShare?.();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Eid blessing from ${senderName}`,
          text:  shareText,
          url:   'https://sealedvow.com',
        });
      } else {
        await copyText(shareText);
        setCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // User dismissed share sheet — not an error
    } finally {
      setSharing(false);
    }
  };

  // ── WhatsApp deep link — noopener,noreferrer prevents tabnapping ──
  const handleWhatsApp = () => {
    onShare?.();
    const text = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ width: '100%', maxWidth: 360, margin: '0 auto', fontFamily: 'Georgia, serif' }}>

      {/* Visual card — cardRef used for future PNG export */}
      <div
        ref={cardRef}
        style={{ background: 'linear-gradient(145deg, #0f3d24, #1B4332, #0a2a18)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: 16, padding: '32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', pointerEvents: 'none' }} />
        <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold', marginBottom: 20 }}>SealedVow · Eid 2026</p>
        <div style={{ fontSize: 36, marginBottom: 16, lineHeight: 1 }}>🌙</div>
        <p style={{ fontSize: 15, fontStyle: 'italic', color: '#F7E6A7', lineHeight: 1.7, marginBottom: 24, position: 'relative', zIndex: 1 }}>"{displayBlessing}"</p>
        <div style={{ width: 40, height: 1, background: 'rgba(212,175,55,0.3)', margin: '0 auto 16px' }} />
        <p style={{ fontSize: 12, color: 'rgba(212,175,55,0.8)', letterSpacing: '0.15em' }}>— {senderName}</p>
        <p style={{ fontSize: 10, color: 'rgba(247,230,167,0.35)', marginTop: 6, letterSpacing: '0.1em' }}>For {receiverName} · Eid Mubarak</p>
        <p style={{ fontSize: 8, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.2)', marginTop: 20, fontWeight: 'bold' }}>sealedvow.com</p>
      </div>

      {/* Share buttons */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={handleWhatsApp} style={{ flex: 1, padding: '12px 0', background: '#25D366', color: '#fff', border: 'none', borderRadius: 100, fontSize: 10, fontWeight: 'bold', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
          WhatsApp 💬
        </button>
        <button onClick={handleShare} disabled={sharing} style={{ flex: 1, padding: '12px 0', background: copied ? 'rgba(27,67,50,0.8)' : 'rgba(212,175,55,0.15)', color: copied ? '#4ade80' : '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 100, fontSize: 10, fontWeight: 'bold', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.3s' }}>
          {copied ? 'Copied ✓' : sharing ? 'Sharing...' : 'Share 🌙'}
        </button>
      </div>

      <p style={{ fontSize: 9, color: 'rgba(212,175,55,0.3)', textAlign: 'center', marginTop: 12, letterSpacing: '0.1em' }}>
        Your Eidi amount is never shared 🔒
      </p>
    </div>
  );
};