import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

export default function ClaimPage() {
  const params = new URLSearchParams(window.location.search);
  const isPreview = params.get("preview") === "1";
  const [upi, setUpi] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [reward, setReward] = useState(null);

  const cardRef = useRef<HTMLDivElement | null>(null);

  const sessionKey = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') ?? params.get('sessionKey') ?? window.sessionStorage.getItem('claimSessionKey') ?? '';
  }, []);

  const successAmountText = useMemo(() => {
    if (!reward) return '';
    const raw = reward.eidiAmount;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return String(n);
  }, [reward]);

  const successSenderText = useMemo(() => {
    if (!reward) return '';
    const s = reward.senderName;
    if (typeof s !== 'string') return 'Someone special';
    const t = s.trim();
    return t || 'Someone special';
  }, [reward]);

  const handleClaim = async () => {
    if (isPreview) {
      setError("This is a preview. You cannot claim your own Eidi.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/claim-eidi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey,
          upiId: upi,
          phoneNumber: phone
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to claim');
        setLoading(false);
        return;
      }

      setReward(data);
      setSuccess(true);
      setLoading(false);

    } catch {
      setError('Network issue. Try again.');
      setLoading(false);
    }
  };

  const isAlreadyClaimed = error === 'Already claimed';

  useEffect(() => {
    if (isPreview) return;
    if (!success) return;
    const t = window.setTimeout(() => {
      window.location.href = '/create';
    }, 4000);
    return () => window.clearTimeout(t);
  }, [isPreview, success]);

  useEffect(() => {
    if (isPreview) return;
    if (!isAlreadyClaimed) return;
    const t = window.setTimeout(() => {
      window.location.href = '/create';
    }, 3500);
    return () => window.clearTimeout(t);
  }, [isAlreadyClaimed, isPreview]);

  /* ================= SHARE ================= */

  const shareWhatsApp = () => {
    const amt = successAmountText && successAmountText !== '—' ? successAmountText : 'Eidi';
    const text = `I just received ₹${amt} on Vow ✦\n\nTry it 👉 https://sealedvow.com`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const downloadScreenshot = async () => {
    if (!cardRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const target = cardRef.current;
    const canvas = await html2canvas(target, {
      backgroundColor: '#0f172a',
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      useCORS: true,
      logging: false,
      onclone: (_doc, cloned) => {
        if (!(cloned instanceof HTMLElement)) return;
        cloned.style.background = 'linear-gradient(165deg, #1e293b 0%, #0f172a 55%, #020617 100%)';
        cloned.style.backdropFilter = 'none';
        cloned.style.setProperty('-webkit-backdrop-filter', 'none');
        cloned.style.color = '#f8fafc';
        cloned.querySelectorAll('h1').forEach((node) => {
          if (node instanceof HTMLElement) {
            node.style.color = '#f8fafc';
          }
        });
        cloned.querySelectorAll('p').forEach((node) => {
          if (node instanceof HTMLElement) {
            node.style.color = 'rgba(248, 250, 252, 0.92)';
            node.style.opacity = '1';
          }
        });
        cloned.querySelectorAll('strong').forEach((node) => {
          if (node instanceof HTMLElement) {
            node.style.color = '#fecaca';
          }
        });
        cloned.querySelectorAll('[data-screenshot-amount]').forEach((node) => {
          if (node instanceof HTMLElement) {
            node.style.color = '#fde047';
          }
        });
        cloned.querySelectorAll('button').forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          const label = (node.textContent || '').toLowerCase();
          if (label.includes('whatsapp')) {
            node.style.background = '#128c3a';
            node.style.color = '#ffffff';
          } else if (label.includes('screenshot')) {
            node.style.background = '#374151';
            node.style.color = '#ffffff';
          }
        });
      }
    });
    const link = document.createElement('a');
    link.download = 'eidi.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={wrapper}>
      {isPreview && (
        <button
          type="button"
          onClick={() => {
            const savedReturnUrl = window.sessionStorage.getItem('previewReturnUrl');
            if (savedReturnUrl) {
              window.sessionStorage.removeItem('previewReturnUrl');
              window.location.href = savedReturnUrl;
              return;
            }
            window.location.href = '/demo/eid?preview=1&resume=eidi';
          }}
          style={previewBackBtn}
        >
          ← Back to preview
        </button>
      )}
      <div style={card} ref={cardRef} className="fadeIn" data-claim-card>
        {!success && !isAlreadyClaimed ? (
          <>
            <div style={gift}>🎁</div>

            <h1 style={title}>Your Eidi has arrived ✦</h1>
            <p style={subtitle}>Enter your UPI and phone number to process your claim</p>
            {isPreview && (
              <p style={{ color: '#facc15', marginBottom: 20 }}>
                ⚠️ This is a preview of the receiver experience.
                <br />
                The actual Eidi link is not generated yet.
              </p>
            )}

            <input
              placeholder="UPI ID"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              style={input}
            />

            <input
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={input}
            />

            <button onClick={handleClaim} disabled={loading} style={button}>
              {loading ? 'Processing...' : 'Claim Eidi ✦'}
            </button>

            {!isPreview && (
              <p style={processingNoteStyle}>
                EIDI WILL BE PROCESSED WITHIN 3 HOURS AFTER YOU SUBMIT YOUR DETAILS.
              </p>
            )}

            {error && <p style={errorStyle}>{error}</p>}
          </>
        ) : (
          <div className="popIn" style={{ textAlign: 'center' }}>

            <div className="burst"></div>

            <h1 style={title}>{success ? 'Eidi Received ✦' : 'You already received your Eidi ✦'}</h1>

            {success && <div style={amount} data-screenshot-amount>₹{successAmountText}</div>}

            {success ? (
              <p style={subtitle}>
                From <strong>{successSenderText}</strong>
              </p>
            ) : (
              <p style={subtitle}>This Eidi has already been claimed.</p>
            )}

            <p style={emotion}>Sent with love ✦</p>

            {/* ACTION BUTTONS */}
            <div style={{ marginTop: 20 }}>
              <button style={shareBtn} onClick={shareWhatsApp}>
                🟢 Share on WhatsApp
              </button>

              {success && (
                <button style={downloadBtn} onClick={downloadScreenshot}>
                  📸 Save Screenshot
                </button>
              )}

              <button
                type="button"
                style={ctaBtn}
                onClick={() => {
                  window.location.href = '/create';
                }}
              >
                ✦ Create your own Eidi for someone
              </button>
            </div>

          </div>
        )}

      </div>

      <style>{`
        input::placeholder {
          color: rgba(255,255,255,0.7);
        }

        .fadeIn {
          animation: fadeIn 0.8s ease forwards;
        }

        .popIn {
          animation: popIn 0.5s ease forwards;
        }

        .burst::before {
          content: "✨🎉✨🎊✨";
          font-size: 28px;
          display: block;
          margin-bottom: 10px;
          animation: popIn 0.6s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

    </div>
  );
}

/* ================= STYLES ================= */

const wrapper: CSSProperties = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, #0f172a, #000)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const card: CSSProperties = {
  width: 400,
  padding: 28,
  borderRadius: 24,
  background: 'rgba(255,255,255,0.1)',
  backdropFilter: 'blur(14px)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
  textAlign: 'center'
};

const gift: CSSProperties = {
  fontSize: 42,
  marginBottom: 10
};

const title: CSSProperties = {
  fontSize: 24,
  color: '#f8fafc',
  fontWeight: 700
};

const subtitle: CSSProperties = {
  color: 'rgba(255,255,255,0.85)',
  marginBottom: 20
};

const amount: CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  margin: '10px 0',
  color: '#fde047'
};

const emotion: CSSProperties = {
  color: 'rgba(248, 250, 252, 0.88)',
  opacity: 1
};

const input: CSSProperties = {
  width: '100%',
  padding: 14,
  marginBottom: 10,
  borderRadius: 12,
  background: 'rgba(15,23,42,0.9)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.22)'
};

const button: CSSProperties = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  background: 'linear-gradient(135deg,#22c55e,#4ade80)',
  border: 'none',
  color: '#052e16',
  cursor: 'pointer',
  fontWeight: 700
};

const shareBtn: CSSProperties = {
  width: '100%',
  padding: 12,
  marginBottom: 10,
  borderRadius: 10,
  background: '#25D366',
  border: 'none',
  color: '#fff',
  cursor: 'pointer'
};

const downloadBtn: CSSProperties = {
  width: '100%',
  padding: 12,
  borderRadius: 10,
  background: '#1f2937',
  border: 'none',
  color: '#fff',
  cursor: 'pointer'
};

const ctaBtn: CSSProperties = {
  width: '100%',
  padding: 12,
  borderRadius: 10,
  background: 'linear-gradient(135deg,#c9a84c,#f0d28a)',
  border: '1px solid rgba(0,0,0,0.2)',
  color: '#0a2e1e',
  cursor: 'pointer',
  fontWeight: 800
};

const errorStyle: CSSProperties = {
  color: '#f87171',
  marginTop: 10
};

const processingNoteStyle: CSSProperties = {
  marginTop: 10,
  color: '#facc15',
  fontSize: 12,
  letterSpacing: '0.04em'
};

const previewBackBtn: CSSProperties = {
  position: 'fixed',
  top: 20,
  left: 20,
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(250,204,21,0.45)',
  background: 'rgba(17,24,39,0.75)',
  color: '#facc15',
  cursor: 'pointer',
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
};