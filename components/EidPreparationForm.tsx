import React, { useState } from "react";
import { encodeEidData } from "../utils/eidEncoder";

/*
────────────────────────────────────────────
SealedVow — Eid Sender Preparation Form

Route Example:
/eid/parent
/eid/sibling
/eid/friend

Responsibilities
1. Collect sender inputs
2. Generate encoded Eid link
3. Allow user to copy/share link
────────────────────────────────────────────
*/

interface Props {
  relationship?: string;
}

interface EidFormData {
  recipient: string;
  senderName: string;
  blessing: string;
  eidiAmount: string;
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#061810",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    fontFamily: "Georgia, serif",
  } as React.CSSProperties,

  card: {
    width: "100%",
    maxWidth: 420,
    background: "linear-gradient(145deg,#0f4a37,#0a2e1e)",
    border: "1px solid rgba(201,168,76,0.25)",
    borderRadius: 14,
    padding: "36px 30px",
    color: "#e8c97a",
  } as React.CSSProperties,

  title: {
    textAlign: "center" as const,
    fontSize: 22,
    marginBottom: 30,
  },

  label: {
    fontSize: 10,
    letterSpacing: "0.3em",
    textTransform: "uppercase" as const,
    opacity: 0.6,
    marginBottom: 6,
    display: "block",
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid rgba(201,168,76,0.2)",
    background: "rgba(0,0,0,0.3)",
    color: "#f5e9c4",
    fontSize: 14,
    marginBottom: 18,
    outline: "none",
  } as React.CSSProperties,

  textarea: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid rgba(201,168,76,0.2)",
    background: "rgba(0,0,0,0.3)",
    color: "#f5e9c4",
    fontSize: 14,
    marginBottom: 18,
    outline: "none",
    resize: "vertical" as const,
    minHeight: 90,
  } as React.CSSProperties,

  button: {
    width: "100%",
    padding: "14px",
    borderRadius: 100,
    border: "none",
    background: "#c9a84c",
    color: "#061810",
    fontWeight: "bold",
    letterSpacing: "0.25em",
    textTransform: "uppercase" as const,
    fontSize: 11,
    cursor: "pointer",
  } as React.CSSProperties,

  linkBox: {
    marginTop: 20,
    background: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(201,168,76,0.2)",
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    wordBreak: "break-all" as const,
    color: "#f5e9c4",
  } as React.CSSProperties,
};

export default function EidPreparationForm({ relationship }: Props) {

  const [form, setForm] = useState<EidFormData>({
    recipient: "",
    senderName: "",
    blessing: "",
    eidiAmount: "",
  });

  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  function updateField(field: keyof EidFormData, value: string) {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }));
  }

  function generateLink() {

    const payload = {
      ...form,
      relationship,
    };

    const encoded = encodeEidData(payload);

    const link = `${window.location.origin}/eid?r=${encoded}`;

    setGeneratedLink(link);
  }

  async function copyLink() {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      alert("Link copied!");
    } catch {
      alert("Could not copy link.");
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.title}>
          Create your Eid message 🌙
        </div>

        {/* Receiver name */}
        <label style={styles.label}>
          Recipient name
        </label>
        <input
          style={styles.input}
          placeholder="Ammi"
          value={form.recipient}
          onChange={e => updateField("recipient", e.target.value)}
        />

        {/* Sender name */}
        <label style={styles.label}>
          Your name
        </label>
        <input
          style={styles.input}
          placeholder="Ajmal"
          value={form.senderName}
          onChange={e => updateField("senderName", e.target.value)}
        />

        {/* Blessing */}
        <label style={styles.label}>
          Eid blessing
        </label>
        <textarea
          style={styles.textarea}
          placeholder="May Allah fill your life with peace and barakah..."
          value={form.blessing}
          onChange={e => updateField("blessing", e.target.value)}
        />

        {/* Eidi */}
        <label style={styles.label}>
          Eidi amount
        </label>
        <input
          style={styles.input}
          placeholder="5000"
          value={form.eidiAmount}
          onChange={e => updateField("eidiAmount", e.target.value)}
        />

        {/* Generate */}
        <button
          style={styles.button}
          onClick={generateLink}
        >
          Generate Link ✦
        </button>

        {generatedLink && (
          <>
            <div style={styles.linkBox}>
              {generatedLink}
            </div>

            <button
              style={{ ...styles.button, marginTop: 10 }}
              onClick={copyLink}
            >
              Copy Link
            </button>
          </>
        )}

      </div>
    </div>
  );
}