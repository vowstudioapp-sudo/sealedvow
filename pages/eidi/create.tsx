import React, { useState } from 'react';
import { CreateEidiRequest } from '../../types/eidi';
import { FEATURES } from '../../config/features';
import { getActiveFestival } from '../../config/festivals';

// ─────────────────────────────────────────────────────────────────────
// SealedVow — Eidi Create Page
// Route: /eidi/create
// Multi-step sender flow:
//   step 1 → names + relationship
//   step 2 → blessing (type / AI generate)
//   step 3 → amount (optional)
//   step 4 → theme + timing → submit
// ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

const THEMES = [
  { id: 'classic-green',  label: 'Classic Green',  preview: '🌿' },
  { id: 'golden-royal',   label: 'Golden Royal',   preview: '✨' },
  { id: 'animated-moon',  label: 'Animated Moon',  preview: '🌙' },
  { id: 'ottoman-art',    label: 'Ottoman Art',    preview: '🔮' },
] as const;

const AI_BLESSINGS = [
  'Taqabbal Allahu minna wa minkum. May your home be filled with peace and your heart with gratitude this Eid.',
  'Eid Mubarak! May Allah accept your prayers, forgive your sins, and ease whatever is heavy on your heart.',
  'May the blessings of this Eid bring you closer to those you love and fill your days with light and warmth.',
  'Wishing you a Eid overflowing with mercy, joy, and the comfort of family around you.',
];

// Eid morning unlock — 6:00 AM on Eid day
function getEidMorningTimestamp(): number {
  const festival = getActiveFestival();
  if (festival) {
    const eidDate = new Date(festival.start + 'T06:00:00');
    if (eidDate.getTime() > Date.now()) return eidDate.getTime();
  }
  // Fallback: 6am tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);
  return tomorrow.getTime();
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#050505',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    fontFamily: 'Georgia, serif',
    color: '#D4AF37',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'linear-gradient(145deg, #0f3d24, #1B4332)',
    border: '1px solid rgba(212,175,55,0.25)',
    borderRadius: 16,
    padding: '36px 28px',
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    letterSpacing: '0.4em',
    textTransform: 'uppercase' as const,
    color: 'rgba(212,175,55,0.6)',
    fontWeight: 'bold',
    marginBottom: 8,
    display: 'block',
  },
  input: {
    width: '100%',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: 8,
    padding: '12px 14px',
    color: '#F7E6A7',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: 8,
    padding: '12px 14px',
    color: '#F7E6A7',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 100,
    boxSizing: 'border-box' as const,
  },
  btn: {
    width: '100%',
    padding: '14px',
    background: 'rgba(212,175,55,0.15)',
    color: '#D4AF37',
    border: '1px solid rgba(212,175,55,0.35)',
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: '0.3em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    marginTop: 24,
  } as React.CSSProperties,
  btnPrimary: {
    width: '100%',
    padding: '14px',
    background: '#D4AF37',
    color: '#050505',
    border: 'none',
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: '0.3em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    marginTop: 24,
  } as React.CSSProperties,
  error: {
    fontSize: 11,
    color: '#f87171',
    marginTop: 8,
  },
};

export const EidiCreatePage: React.FC = () => {
  const [step,         setStep]        = useState<Step>(1);
  const [senderName,   setSenderName]  = useState('');
  const [receiverName, setReceiverName]= useState('');
  const [relationship, setRelationship]= useState('');
  const [blessing,     setBlessing]    = useState('');
  const [amount,       setAmount]      = useState('');
  const [currency,     setCurrency]    = useState<'INR' | 'USD' | 'AED'>('INR');
  const [theme,        setTheme]       = useState<string>('classic-green');
  const [lockToEid,    setLockToEid]   = useState(false);
  const [aiLoading,    setAiLoading]   = useState(false);
  const [submitting,   setSubmitting]  = useState(false);
  const [error,        setError]       = useState('');
  const [doneId,       setDoneId]      = useState<string | null>(null);
  const [copied,       setCopied]      = useState(false);

  if (!FEATURES.eidiEnabled) {
    return <div style={s.page}><p style={{ color: 'rgba(247,230,167,0.4)' }}>Coming soon 🌙</p></div>;
  }

  // ── AI BLESSING ───────────────────────────────────────────────────
  async function handleAiGenerate() {
    setAiLoading(true);
    setError('');
    // Rotate through preset blessings (real AI call = Phase 2)
    await new Promise(r => setTimeout(r, 700));
    const pick = AI_BLESSINGS[Math.floor(Math.random() * AI_BLESSINGS.length)];
    setBlessing(pick);
    setAiLoading(false);
  }

  // ── SUBMIT ────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError('');
    const parsedAmount = amount.trim() ? Number(amount.trim()) : undefined;

    if (!blessing.trim() && !parsedAmount) {
      setError('Please add a blessing or an Eidi amount.');
      return;
    }
    if (parsedAmount !== undefined && (!Number.isInteger(parsedAmount) || parsedAmount <= 0)) {
      setError('Please enter a valid amount.');
      return;
    }

    const payload: CreateEidiRequest = {
      senderName:   senderName.trim(),
      receiverName: receiverName.trim(),
      ...(relationship.trim() && { relationship: relationship.trim() }),
      ...(blessing.trim()     && { blessing: blessing.trim() }),
      ...(parsedAmount        && { amount: parsedAmount, currency }),
      envelopeTheme: theme,
      ...(lockToEid           && { unlockAt: getEidMorningTimestamp() }),
    };

    setSubmitting(true);
    try {
      const res  = await fetch('/api/create-eidi', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setDoneId(json.id);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDoneId(null);
    setStep(1);
    setSenderName('');
    setReceiverName('');
    setRelationship('');
    setBlessing('');
    setAmount('');
    setError('');
  }

  // ── DONE SCREEN ────────────────────────────────────────────────────
  if (doneId) {
    const shareUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/eidi/${doneId}`
      : `/eidi/${doneId}`;
    const handleCopy = async () => {
      try { await navigator.clipboard.writeText(shareUrl); }
      catch {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select(); ta.setSelectionRange(0, ta.value.length);
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    };
    const handleWhatsApp = () => {
      const text = encodeURIComponent(`🌙 Eid Mubarak! I've sent you a sealed Eidi.\n\nOpen it here: ${shareUrl}`);
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    };

    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌙</div>
            <p style={{ fontSize: 10, letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', fontWeight: 'bold', marginBottom: 8 }}>Eidi Sealed</p>
            <p style={{ fontSize: 18, fontStyle: 'italic', color: '#F7E6A7', marginBottom: 8 }}>For {receiverName}</p>
            <p style={{ fontSize: 12, color: 'rgba(247,230,167,0.4)', marginBottom: 28 }}>
              {lockToEid ? 'Unlocks on Eid morning 🌙' : 'Ready to open now'}
            </p>

            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, wordBreak: 'break-all', fontSize: 12, color: 'rgba(247,230,167,0.6)', textAlign: 'left' }}>
              {shareUrl}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleWhatsApp} style={{ flex: 1, padding: '12px 0', background: '#25D366', color: '#fff', border: 'none', borderRadius: 100, fontSize: 10, fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>WhatsApp 💬</button>
              <button onClick={handleCopy} style={{ flex: 1, padding: '12px 0', background: copied ? 'rgba(27,67,50,0.8)' : 'rgba(212,175,55,0.15)', color: copied ? '#4ade80' : '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 100, fontSize: 10, fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.3s' }}>{copied ? 'Copied ✓' : 'Copy Link'}</button>
            </div>

            <button onClick={() => { setDoneId(null); setStep(1); setSenderName(''); setReceiverName(''); setBlessing(''); setAmount(''); }} style={{ ...s.btn, marginTop: 16, fontSize: 9 }}>Send another Eidi →</button>
          </div>
        </div>
      </div>
    );
  }

  const stepLabel = `Step ${step} of 4`;

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.4)', fontWeight: 'bold', marginBottom: 4 }}>{stepLabel}</p>
          <p style={{ fontSize: 22, fontStyle: 'italic', color: '#F7E6A7' }}>Send Eidi 🌙</p>
        </div>

        {/* ── STEP 1 — Names ── */}
        {step === 1 && (
          <div>
            <label style={s.label}>Your name</label>
            <input style={s.input} value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Chacha Ahmed" maxLength={100} />

            <div style={{ marginTop: 16 }}>
              <label style={s.label}>Receiver's name</label>
              <input style={s.input} value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="Hamza" maxLength={100} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={s.label}>Relationship <span style={{ opacity: 0.4 }}>(optional)</span></label>
              <input style={s.input} value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Nephew, best friend..." maxLength={50} />
            </div>

            {error && <p style={s.error}>{error}</p>}

            <button
              style={s.btnPrimary}
              onClick={() => {
                if (!senderName.trim()) { setError('Please enter your name.'); return; }
                if (!receiverName.trim()) { setError("Please enter the receiver's name."); return; }
                setError(''); setStep(2);
              }}
            >
              Next →
            </button>
          </div>
        )}

        {/* ── STEP 2 — Blessing ── */}
        {step === 2 && (
          <div>
            <label style={s.label}>Write a blessing <span style={{ opacity: 0.4 }}>(optional)</span></label>
            <textarea
              style={s.textarea}
              value={blessing}
              onChange={e => setBlessing(e.target.value)}
              placeholder={`Eid Mubarak ${receiverName}! May Allah bless you this Eid...`}
              maxLength={1000}
            />
            <p style={{ fontSize: 10, color: 'rgba(212,175,55,0.3)', marginTop: 4, textAlign: 'right' }}>{blessing.length}/1000</p>

            <button
              onClick={handleAiGenerate}
              disabled={aiLoading}
              style={{ ...s.btn, marginTop: 12, background: 'rgba(27,67,50,0.5)', fontSize: 10 }}
            >
              {aiLoading ? 'Generating...' : '✨ Generate blessing with AI'}
            </button>

            {error && <p style={s.error}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button style={{ ...s.btn, marginTop: 0, flex: 1 }} onClick={() => { setError(''); setStep(1); }}>← Back</button>
              <button style={{ ...s.btnPrimary, marginTop: 0, flex: 2 }} onClick={() => { setError(''); setStep(3); }}>Next →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Amount ── */}
        {step === 3 && (
          <div>
            <label style={s.label}>Eidi amount <span style={{ opacity: 0.4 }}>(optional)</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as 'INR' | 'USD' | 'AED')}
                style={{ ...s.input, width: 'auto', padding: '12px 10px', flexShrink: 0 }}
              >
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="AED">AED</option>
              </select>
              <input
                style={{ ...s.input, flex: 1 }}
                type="number"
                min="1"
                max="100000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="500"
              />
            </div>
            <p style={{ fontSize: 10, color: 'rgba(247,230,167,0.35)', marginTop: 8, fontStyle: 'italic' }}>
              Symbolic for now. Real transfers come in Phase 2 🌙
            </p>

            {!blessing.trim() && !amount.trim() && (
              <p style={{ ...s.error, marginTop: 12 }}>You need a blessing or an amount — add at least one.</p>
            )}

            {error && <p style={s.error}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button style={{ ...s.btn, marginTop: 0, flex: 1 }} onClick={() => { setError(''); setStep(2); }}>← Back</button>
              <button
                style={{ ...s.btnPrimary, marginTop: 0, flex: 2 }}
                onClick={() => {
                  if (!blessing.trim() && !amount.trim()) { setError('Add a blessing or an Eidi amount.'); return; }
                  setError(''); setStep(4);
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4 — Theme + Timing ── */}
        {step === 4 && (
          <div>
            <label style={s.label}>Envelope theme</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{
                    padding: '10px 8px',
                    background: theme === t.id ? 'rgba(212,175,55,0.2)' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${theme === t.id ? 'rgba(212,175,55,0.6)' : 'rgba(212,175,55,0.15)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: 'Georgia, serif',
                    textAlign: 'center' as const,
                  }}
                >
                  <div style={{ fontSize: 20 }}>{t.preview}</div>
                  <div style={{ fontSize: 9, color: 'rgba(212,175,55,0.7)', marginTop: 4, letterSpacing: '0.1em' }}>{t.label}</div>
                </button>
              ))}
            </div>

            <label style={{ ...s.label, marginTop: 8 }}>When to open</label>
            <button
              onClick={() => setLockToEid(!lockToEid)}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: lockToEid ? 'rgba(27,67,50,0.7)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${lockToEid ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.15)'}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'Georgia, serif',
                textAlign: 'left' as const,
                color: '#F7E6A7',
                fontSize: 13,
              }}
            >
              {lockToEid ? '🌙 Locked until Eid morning (6:00 AM)' : '⚡ Open immediately'}
            </button>

            {error && <p style={s.error}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button style={{ ...s.btn, marginTop: 0, flex: 1 }} onClick={() => { setError(''); setStep(3); }}>← Back</button>
              <button
                style={{ ...s.btnPrimary, marginTop: 0, flex: 2, opacity: submitting ? 0.6 : 1 }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Sealing...' : 'Seal & Send 🌙'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Back to home */}
      <a href="/" style={{ marginTop: 24, fontSize: 10, color: 'rgba(212,175,55,0.3)', letterSpacing: '0.2em', textDecoration: 'none' }}>← SealedVow</a>
    </div>
  );
};