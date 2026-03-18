import React, { useEffect, useRef, useState } from "react";

type Props = {
  relationship?: string;
};

type FormData = {
  recipient: string;
  senderName: string;
  blessing: string;
  eidiAmount: string;
  tone: "emotional" | "formal" | "playful" | "respectful";
};

export default function EidPreparationForm({ relationship }: Props) {
  const [step, setStep] = useState(1);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [mode, setMode] = useState<"assist" | "self">("assist");
  const [isToneOpen, setIsToneOpen] = useState(false);
  const [loaderLabel, setLoaderLabel] = useState<null | "preview" | "seal" | "craft" | "refine">(null);
  const [loaderProgress, setLoaderProgress] = useState(0);
  const loaderIntervalRef = useRef<number | null>(null);

  const [formData, setFormData] = useState<FormData>({
    recipient: "",
    senderName: "",
    blessing: "",
    eidiAmount: "",
    tone: "emotional",
  });
  const [generatedLetter, setGeneratedLetter] = useState("");
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);

  const update = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isElderChild = relationship === "elder-child";
  const isParentChild = relationship === "parent-child";
  const hasSubtypeStep = isElderChild || isParentChild;
  const maxStep = hasSubtypeStep ? 6 : 5;

  const next = () => setStep((s) => Math.min(s + 1, maxStep));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const hasRequiredFields = () =>
    formData.senderName.trim() !== "" && formData.recipient.trim() !== "";

  async function generateLetter(data: {
    relationship?: string;
    subtype?: string | null;
    senderName: string;
    recipient: string;
    tone: FormData["tone"];
    customMessage: string;
  }) {
    console.log("CALLING API");
    console.log("ENDPOINT:", "/api/generate-eid-letter");
    console.log("REQUEST PAYLOAD:", data);

    try {
      const res = await fetch("/api/generate-eid-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to generate letter" }));
        throw new Error(error.error || "Failed to generate letter");
      }

      const result = await res.json();
      console.log("API RESPONSE:", result);
      return result;
    } catch (err) {
      console.error("API FAILED:", err);
      throw err;
    }
  }

  const ensureGeneratedLetter = async () => {
    if (generatedLetter.trim()) return generatedLetter;
    if (!hasRequiredFields()) {
      alert("Please fill all required fields");
      return "";
    }

    const letter = formData.blessing;
    setGeneratedLetter(letter);
    return letter;
  };

  const craftMessage = async () => {
    if (!hasRequiredFields()) {
      alert("Please fill all required fields");
      return;
    }

    setIsGeneratingLetter(true);
    setLoaderLabel("craft");
    setLoaderProgress(0);
    try {
      const result = await generateLetter({
        relationship,
        subtype,
        senderName: formData.senderName,
        recipient: formData.recipient,
        tone: formData.tone,
        customMessage: formData.blessing,
      });

      const letter = result.letter || formData.blessing;
      setFormData(prev => ({ ...prev, blessing: letter }));
      setGeneratedLetter(letter);
    } catch (_err) {
      alert("Crafting failed. Please try again.");
    } finally {
      setIsGeneratingLetter(false);
      setLoaderLabel(null);
    }
  };

  const refineMessage = async () => {
    if (!hasRequiredFields()) {
      alert("Please fill all required fields");
      return;
    }

    if (!formData.blessing.trim()) {
      alert("Write a message first.");
      return;
    }

    setIsGeneratingLetter(true);
    setLoaderLabel("refine");
    setLoaderProgress(0);
    try {
      const result = await generateLetter({
        relationship,
        subtype,
        senderName: formData.senderName,
        recipient: formData.recipient,
        tone: formData.tone,
        customMessage: formData.blessing,
      });

      const letter = result.letter || formData.blessing;
      setFormData(prev => ({ ...prev, blessing: letter }));
      setGeneratedLetter(letter);
    } catch (_err) {
      alert("Refine failed. Please try again.");
    } finally {
      setIsGeneratingLetter(false);
      setLoaderLabel(null);
    }
  };

  useEffect(() => {
    if (!loaderLabel) {
      if (loaderIntervalRef.current !== null) {
        window.clearInterval(loaderIntervalRef.current);
        loaderIntervalRef.current = null;
      }
      setLoaderProgress(0);
      return;
    }

    if (loaderIntervalRef.current !== null) {
      window.clearInterval(loaderIntervalRef.current);
      loaderIntervalRef.current = null;
    }

    loaderIntervalRef.current = window.setInterval(() => {
      setLoaderProgress(prev => {
        if (prev >= 90) return prev;
        return Math.min(90, prev + 3 + Math.random() * 4);
      });
    }, 180);

    return () => {
      if (loaderIntervalRef.current !== null) {
        window.clearInterval(loaderIntervalRef.current);
        loaderIntervalRef.current = null;
      }
    };
  }, [loaderLabel]);

  useEffect(() => {
    const handleClick = (e: any) => {
      if (!e.target.closest('[data-tone-dropdown="true"]')) {
        setIsToneOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const generateLink = async () => {
    if (!hasRequiredFields()) {
      alert("Please fill all required fields");
      return;
    }

    setLoaderLabel("seal");
    setLoaderProgress(0);
    const letter = await ensureGeneratedLetter();
    const payload = {
      ...formData,
      blessing: letter,
      relationship,
      subtype,
    };

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const url = `${window.location.origin}/eid?r=${encoded}`;

    await navigator.clipboard.writeText(url);
    alert("Link copied ✨");
    setLoaderProgress(100);
    window.setTimeout(() => setLoaderLabel(null), 300);
  };

  const previewLink = async () => {
    try {
      if (!hasRequiredFields()) {
        alert("Please fill all required fields");
        return;
      }

      const previewWindow = window.open("about:blank", "_blank");
      setLoaderLabel("preview");
      setLoaderProgress(0);

      const needsCraft =
        mode === "assist" &&
        !generatedLetter.trim() &&
        !formData.blessing.trim();

      if (needsCraft) {
        setIsGeneratingLetter(true);
        try {
          const result = await generateLetter({
            relationship,
            subtype,
            senderName: formData.senderName,
            recipient: formData.recipient,
            tone: formData.tone,
            customMessage: formData.blessing,
          });
          const letter = result.letter || formData.blessing;
          setFormData(prev => ({ ...prev, blessing: letter }));
          setGeneratedLetter(letter);
        } finally {
          setIsGeneratingLetter(false);
        }
      }

      const letter = await ensureGeneratedLetter();
      const payload = {
        ...formData,
        blessing: letter,
        relationship,
        subtype,
      };

      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const url = `${window.location.origin}/eid?preview=1&r=${encoded}`;

      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, "_blank");
      }
      setLoaderProgress(100);
      window.setTimeout(() => setLoaderLabel(null), 300);
    } catch (err) {
      console.error("Preview failed:", err);
      alert("Preview failed");
      setLoaderLabel(null);
    }
  };

  const getRecipientPlaceholder = (relationship?: string) => {
    switch (relationship) {
      case "parent-child":
        return "Your child’s name";
      case "child-parent":
        return "Your parent’s name";
      case "elder-child":
        return "Their name";
      case "sibling":
        return "Your sibling’s name";
      case "friend":
        return "Your friend’s name";
      default:
        return "Their name";
    }
  };

  const getSenderPlaceholder = () => {
    if (relationship === "elder-child") {
      if (subtype === "uncle") return "Chachu / Mamu";
      if (subtype === "aunt") return "Khala / Phuppi";
      if (subtype === "grandparent") return "Dada / Nani";
      return "Your name";
    }

    if (relationship === "parent-child") {
      if (subtype === "father") return "Abu";
      if (subtype === "mother") return "Ammi";
    }

    return "Your name";
  };

  const getMessagePlaceholder = () => {
    if (relationship === "elder-child") {
      if (subtype === "uncle") return "Write something playful and loving…";
      if (subtype === "aunt") return "Write something warm and caring…";
      if (subtype === "grandparent") return "Give them your blessings…";
      return "Write a kind message…";
    }

    if (relationship === "child-parent") return "Say what you’ve never properly said…";
    if (relationship === "parent-child") return "Tell them how proud you are…";
    if (relationship === "sibling") return "Mix love with a little teasing…";
    if (relationship === "friend") return "Keep it fun and real…";

    return "Write something meaningful…";
  };

  const isSubtypeStep = hasSubtypeStep && step === 1;

  return (
    <div style={styles.page}>
      {loaderLabel && (
        <div style={styles.loaderOverlay} role="status" aria-live="polite">
          <div style={styles.loaderCard}>
            <div style={styles.ringWrap}>
              <svg width="130" height="130" viewBox="0 0 130 130" style={styles.ringSvg}>
                <circle
                  cx="65"
                  cy="65"
                  r="54"
                  stroke="rgba(212,175,55,0.18)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="65"
                  cy="65"
                  r="54"
                  stroke="#D4AF37"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={339.292}
                  strokeDashoffset={339.292 - (339.292 * Math.min(100, Math.max(0, loaderProgress))) / 100}
                  style={{ transition: "stroke-dashoffset 180ms ease-out" }}
                />
              </svg>

              <div style={styles.loaderCenter}>
                <img src="/logo-gold.webp" alt="VOW" style={styles.loaderLogo} />
              </div>
            </div>

            <div style={styles.loaderText}>
              <p style={styles.loaderTitle}>
                {loaderLabel === "preview"
                  ? "Generating preview…"
                  : loaderLabel === "seal"
                    ? "Sealing your link…"
                    : loaderLabel === "craft"
                      ? "Crafting your message…"
                      : "Refining your words…"}
              </p>
              <p style={styles.loaderSub}>
                {formData.recipient.trim() ? `For ${formData.recipient.trim()}` : "One moment"}
              </p>
            </div>

            <div style={styles.loaderBarWrap}>
              <div style={styles.loaderBarBg}>
                <div style={{ ...styles.loaderBarFill, width: `${Math.min(100, Math.max(0, loaderProgress))}%` }} />
              </div>
              <div style={styles.loaderPct}>{Math.round(loaderProgress)}%</div>
            </div>
          </div>
        </div>
      )}
      <div style={styles.card}>
        <p style={styles.step}>Step {step} of {maxStep}</p>

        {isSubtypeStep && (
          <>
            <h2 style={styles.title}>Who are you to them?</h2>
            {isElderChild && (
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <button
                  style={styles.secondary}
                  onClick={() => { setSubtype("uncle"); next(); }}
                >
                  Uncle
                </button>
                <button
                  style={styles.secondary}
                  onClick={() => { setSubtype("aunt"); next(); }}
                >
                  Aunt
                </button>
                <button
                  style={styles.secondary}
                  onClick={() => { setSubtype("grandparent"); next(); }}
                >
                  Grandparent
                </button>
                <button
                  style={styles.secondary}
                  onClick={() => { setSubtype("other"); next(); }}
                >
                  Other
                </button>
              </div>
            )}
            {isParentChild && (
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <button
                  style={styles.secondary}
                  onClick={() => { setSubtype("father"); next(); }}
                >
                  Father
                </button>
                <button
                  style={styles.secondary}
                  onClick={() => { setSubtype("mother"); next(); }}
                >
                  Mother
                </button>
              </div>
            )}
          </>
        )}

        {(!hasSubtypeStep && step === 1) || (hasSubtypeStep && step === 2) ? (
          <>
            <h2 style={styles.title}>Who is this for?</h2>
            <input
              style={styles.input}
              placeholder={getRecipientPlaceholder(relationship)}
              value={formData.recipient}
              onChange={(e) => update("recipient", e.target.value)}
            />
          </>
        ) : null}

        {(!hasSubtypeStep && step === 2) || (hasSubtypeStep && step === 3) ? (
          <>
            <h2 style={styles.title}>Who is sending this?</h2>
            <input
              style={styles.input}
              placeholder={getSenderPlaceholder()}
              value={formData.senderName}
              onChange={(e) => update("senderName", e.target.value)}
            />
          </>
        ) : null}

        {(!hasSubtypeStep && step === 3) || (hasSubtypeStep && step === 4) ? (
          <>
            <h2 style={styles.title}>Your Eid message</h2>
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setMode('assist')}
                className={`px-4 py-2 rounded-full text-xs ${
                  mode === 'assist'
                    ? 'bg-[#D4AF37] text-black'
                    : 'border border-[#D4AF37]/30 text-[#D4AF37]'
                }`}
              >
                ✨ SealedVow helps you write
              </button>

              <button
                type="button"
                onClick={() => setMode('self')}
                className={`px-4 py-2 rounded-full text-xs ${
                  mode === 'self'
                    ? 'bg-[#D4AF37] text-black'
                    : 'border border-[#D4AF37]/30 text-[#D4AF37]'
                }`}
              >
                ✍️ Write your own
              </button>
            </div>

            <textarea
              style={{ ...styles.input, height: 120 }}
              placeholder={
                mode === 'assist'
                  ? "Share a feeling, memory, or something meaningful…"
                  : "Tell them how proud you are..."
              }
              value={formData.blessing}
              onChange={(e) => {
                update("blessing", e.target.value);
                setGeneratedLetter("");
              }}
            />

            {mode === 'assist' && (
              <button
                type="button"
                onClick={craftMessage}
                className="mt-3 px-5 py-2 rounded-full text-xs bg-[#D4AF37] text-black"
                disabled={isGeneratingLetter}
              >
                {isGeneratingLetter ? "Crafting..." : "Craft message ✨"}
              </button>
            )}

            {mode === 'self' && formData.blessing && (
              <button
                type="button"
                onClick={refineMessage}
                className="mt-3 px-5 py-2 rounded-full text-xs border border-[#D4AF37]/40 text-[#D4AF37]"
                disabled={isGeneratingLetter}
              >
                {isGeneratingLetter ? "Refining..." : "Refine it ✨"}
              </button>
            )}

            <div className="relative mt-4" data-tone-dropdown="true">
              <button
                type="button"
                onClick={() => setIsToneOpen(!isToneOpen)}
                className="w-full px-4 py-3 rounded-xl border border-[#D4AF37]/30 bg-black/40 flex justify-between items-center"
              >
                <span className="capitalize">{formData.tone}</span>
                <span className="text-[#D4AF37]">▾</span>
              </button>

              {isToneOpen && (
                <div className="absolute z-50 w-full mt-2 rounded-xl bg-[#0C0A09] border border-[#D4AF37]/20 shadow-xl overflow-hidden">
                  {['emotional', 'formal', 'playful', 'respectful'].map((tone) => (
                    <div
                      key={tone}
                      onClick={() => {
                        update("tone", tone);
                        setIsToneOpen(false);
                      }}
                      className={`px-4 py-3 cursor-pointer transition capitalize ${
                        formData.tone === tone
                          ? 'text-[#D4AF37] bg-[#D4AF37]/10'
                          : 'text-white/80 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]'
                      }`}
                    >
                      {tone}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}

        {(!hasSubtypeStep && step === 4) || (hasSubtypeStep && step === 5) ? (
          <>
            <h2 style={styles.title}>Add Eidi (optional)</h2>
            <input
              style={styles.input}
              placeholder="₹ 5000"
              value={formData.eidiAmount}
              onChange={(e) => update("eidiAmount", e.target.value)}
            />
          </>
        ) : null}

        {((!hasSubtypeStep && step === 5) || (hasSubtypeStep && step === 6)) ? (
          <>
            <h2 style={styles.title}>Ready to send 🌙</h2>

            <div style={styles.summary}>
              <p><strong>To:</strong> {formData.recipient}</p>
              <p><strong>From:</strong> {formData.senderName}</p>
              <p><strong>Tone:</strong> {formData.tone}</p>
              <p><strong>Message:</strong> {generatedLetter || formData.blessing}</p>
              <p><strong>Eidi:</strong> {formData.eidiAmount || "None"}</p>
            </div>

            <button style={styles.secondary} onClick={previewLink} disabled={isGeneratingLetter}>
              {isGeneratingLetter ? "Generating..." : "Preview Experience 👁"}
            </button>

            <button style={styles.primary} onClick={generateLink} disabled={isGeneratingLetter}>
              {isGeneratingLetter ? "Generating..." : "Seal & Copy Link ✨"}
            </button>
          </>
        ) : null}

        <div style={styles.nav}>
          {step > 1 && (
            <button style={styles.secondary} onClick={back}>
              Back
            </button>
          )}
          {!isSubtypeStep && step < maxStep && (
            <button style={styles.primary} onClick={next}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050505",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Georgia, serif",
    padding: 20,
  },
  card: {
    width: 360,
    padding: 28,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: 16,
    backdropFilter: "blur(10px)",
  },
  loaderOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.82)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 22,
  },
  loaderCard: {
    width: 360,
    maxWidth: "100%",
    borderRadius: 18,
    background: "rgba(12,10,9,0.92)",
    border: "1px solid rgba(212,175,55,0.18)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
    padding: 22,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  ringWrap: {
    position: "relative",
    width: 130,
    height: 130,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: {
    transform: "rotate(-90deg)",
    filter: "drop-shadow(0 0 16px rgba(212,175,55,0.18))",
  },
  loaderCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderLogo: {
    width: 52,
    height: 52,
    opacity: 0.95,
  },
  loaderText: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  loaderTitle: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color: "#D4AF37",
    fontWeight: 800,
  },
  loaderSub: {
    margin: 0,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontStyle: "italic",
  },
  loaderBarWrap: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  loaderBarBg: {
    flex: 1,
    height: 2,
    borderRadius: 999,
    background: "rgba(212,175,55,0.18)",
    overflow: "hidden",
  },
  loaderBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "#D4AF37",
    transition: "width 180ms ease-out",
  },
  loaderPct: {
    width: 44,
    textAlign: "right",
    fontSize: 10,
    fontWeight: 800,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
    color: "rgba(212,175,55,0.9)",
  },
  step: {
    fontSize: 10,
    color: "rgba(212,175,55,0.5)",
    letterSpacing: "0.3em",
    marginBottom: 12,
  },
  title: {
    color: "#D4AF37",
    marginBottom: 16,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid rgba(212,175,55,0.2)",
    background: "transparent",
    color: "#fff",
    outline: "none",
    fontSize: 14,
  },
  nav: {
    marginTop: 24,
    display: "flex",
    justifyContent: "space-between",
  },
  primary: {
    padding: "10px 18px",
    background: "#D4AF37",
    border: "none",
    borderRadius: 8,
    color: "#000",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondary: {
    padding: "10px 18px",
    background: "transparent",
    border: "1px solid rgba(212,175,55,0.3)",
    borderRadius: 8,
    color: "#D4AF37",
    cursor: "pointer",
  },
  summary: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 20,
    lineHeight: 1.6,
  },
  modeToggle: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 14,
  },
  modeBtn: {
    padding: "10px 12px",
    background: "transparent",
    border: "1px solid rgba(212,175,55,0.3)",
    borderRadius: 10,
    color: "#D4AF37",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    textAlign: "center",
  },
  modeBtnActive: {
    padding: "10px 12px",
    background: "rgba(212,175,55,0.14)",
    border: "1px solid rgba(212,175,55,0.55)",
    borderRadius: 10,
    color: "#D4AF37",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
  helper: {
    marginTop: 4,
    marginBottom: -4,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: "0.02em",
  },
};
