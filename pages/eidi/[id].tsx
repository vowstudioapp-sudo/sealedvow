import React from 'react';
import { EidiEnvelope } from '../../components/EidiEnvelope';
import { isValidEidiKey } from '../../lib/generateEidiKey';

// ─────────────────────────────────────────────────────────────────────
// SealedVow — Eidi Receiver Page
// Route: /eidi/:id
//
// Thin wrapper — all experience logic lives in EidiEnvelope.
// This page only handles:
//   1. Extracting the ID from the URL
//   2. Validating format before rendering
//   3. 404 for invalid/missing IDs
// ─────────────────────────────────────────────────────────────────────

function getEidiId(): string | null {
  const match = window.location.pathname.match(/^\/eidi\/([A-Z0-9]{6})$/i);
  return match ? match[1].toUpperCase() : null;
}

export const EidiReceiverPage: React.FC = () => {
  const id = getEidiId();

  // Invalid key format — don't hit the API at all
  if (!id || !isValidEidiKey(id)) {
    return (
      <div style={{
        minHeight:      '100vh',
        background:     '#050505',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        fontFamily:     'Georgia, serif',
        textAlign:      'center',
        padding:        '24px',
        color:          '#D4AF37',
      }}>
        <p style={{ fontSize: 40, marginBottom: 16 }}>🌙</p>
        <p style={{ fontSize: 13, color: 'rgba(247,230,167,0.5)', maxWidth: 260, lineHeight: 1.7 }}>
          This Eidi link doesn't exist or has expired.
        </p>
        <a
          href="/"
          style={{ marginTop: 32, fontSize: 10, color: 'rgba(212,175,55,0.4)', letterSpacing: '0.3em', textTransform: 'uppercase', textDecoration: 'none' }}
        >
          ← SealedVow
        </a>
      </div>
    );
  }

  return <EidiEnvelope eidiId={id} />;
};