import React, { useEffect, useRef, useState } from "react";

type EidFormData = {
  recipient: string;
  senderName: string;
  blessing: string;
  eidiAmount: string;
  tone: "emotional" | "formal" | "playful" | "respectful";
  relationship?: string;
  subtype?: string | null;
  mode: "assist" | "self";
};

type Props = {
  relationship?: string;
  onPreview?: (formData: EidFormData) => void;
};

type FormData = {
  recipient: string;
  senderName: string;
  blessing: string;
  eidiAmount: string;
  tone: "emotional" | "formal" | "playful" | "respectful";
};

export default function EidPreparationForm({ relationship, onPreview }: Props) {
  const [step, setStep] = useState(1);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [mode, setMode] = useState<"assist" | "self">("assist");
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
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

  const handleTriggerClick = (text: string) => {
    update("blessing", text);
    setGeneratedLetter("");
    setHasStartedTyping(true);
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
  }, retryCount = 0) {
    console.log("CALLING API (attempt " + (retryCount + 1) + ")");
    console.log("ENDPOINT:", "/api/generate-eid-letter");
    console.log("REQUEST PAYLOAD:", data);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch("/api/generate-eid-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to generate letter" }));
        throw new Error(error.error || "Failed to generate letter");
      }

      const result = await res.json();
      console.log("API RESPONSE:", result);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("API FAILED:", err);

      if (err.name === 'AbortError') {
        if (retryCount < 1) {
          console.log("Timeout - retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          return generateLetter(data, retryCount + 1);
        }
        throw new Error('AI service timeout - please try again');
      }

      if (retryCount < 1 && (err.message.includes('fetch') || err.message.includes('network'))) {
        console.log("Network error - retrying...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        return generateLetter(data, retryCount + 1);
      }

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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Crafting failed. Please try again.";
      alert(errorMsg);
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Refine failed. Please try again.";
      alert(errorMsg);
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

  const handlePreview = async () => {
    try {
      if (!hasRequiredFields()) {
        alert("Please fill all required fields");
        return;
      }

      const needsCraft =
        mode === "assist" &&
        !generatedLetter.trim() &&
        !formData.blessing.trim();

      if (needsCraft) {
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
        } catch (err) {
          setIsGeneratingLetter(false);
          setLoaderLabel(null);
          const errorMsg = err instanceof Error ? err.message : "AI generation failed. Please try again.";
          alert(errorMsg);
          return;
        } finally {
          setIsGeneratingLetter(false);
          setLoaderLabel(null);
        }
      }

      const letter = await ensureGeneratedLetter();
      
      // Call onPreview callback with form data
      if (onPreview) {
        const eidData: EidFormData = {
          ...formData,
          blessing: letter,
          relationship,
          subtype,
          mode,
        };
        onPreview(eidData);
      }
    } catch (err) {
      console.error("Preview failed:", err);
      const errorMsg = err instanceof Error ? err.message : "Preview failed";
      alert(errorMsg);
    }
  };

  const getRecipientPlaceholder = (relationship?: string) => {
    switch (relationship) {
      case "parent-child":
        return "Your child's name";
      case "child-parent":
        return "Your parent's name";
      case "elder-child":
        return "Their name";
      case "sibling":
        return "Your sibling's name";
      case "friend":
        return "Your friend's name";
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

    if (relationship === "child-parent") return "Say what you've never properly said…";
    if (relationship === "parent-child") return "Tell them how proud you are…";
    if (relationship === "sibling") return "Mix love with a little teasing…";
    if (relationship === "friend") return "Keep it fun and real…";

    return "Write something meaningful…";
  };

  const isSubtypeStep = hasSubtypeStep && step === 1;
  const previewText = (generatedLetter || formData.blessing || "").trim();

  const formatTone = (tone: string) => {
    switch (tone) {
      case "emotional": return "Heartfelt & deep";
      case "playful": return "Light & fun";
      case "respectful": return "Warm & respectful";
      case "formal": return "Simple & polite";
      default: return tone;
    }
  };

  const chipStyle: React.CSSProperties = {
    fontSize: 11,
    padding: "6px 10px",
    borderRadius: 20,
    border: "1px solid rgba(212,175,55,0.3)",
    color: "#D4AF37",
    background: "transparent"
  };

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
        {step !== maxStep && (
          <p style={styles.step}>Step {step} of {maxStep}</p>
        )}

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

            {!hasStartedTyping && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 8,
                  fontStyle: "italic"
                }}>
                  Not sure where to start?
                </div>

                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8
                }}>
                  <button
                    type="button"
                    onClick={() => handleTriggerClick("I miss the way you...")}
                    style={triggerStyle}
                  >
                    Something you miss
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTriggerClick("I still remember when we...")}
                    style={triggerStyle}
                  >
                    A memory
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTriggerClick("I always pray that Allah grants you...")}
                    style={triggerStyle}
                  >
                    A dua
                  </button>
                </div>
              </div>
            )}

            <textarea
              style={{ ...styles.input, height: 120 }}
              placeholder={
                mode === 'assist'
                  ? "Start with a feeling or memory..."
                  : "What would you say if they were here?"
              }
              value={formData.blessing}
              onChange={(e) => {
                update("blessing", e.target.value);
                setGeneratedLetter("");
                if (!hasStartedTyping && e.target.value.trim().length > 0) {
                  setHasStartedTyping(true);
                }
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
                <span className="capitalize">{formatTone(formData.tone)}</span>
                <span className="text-[#D4AF37]">▾</span>
              </button>

              {isToneOpen && (
                <div className="absolute z-50 w-full mt-2 rounded-xl bg-[#0C0A09] border border-[#D4AF37]/20 shadow-xl overflow-hidden">
                  {[
                    { value: 'emotional', label: 'Heartfelt & deep' },
                    { value: 'playful', label: 'Light & fun' },
                    { value: 'respectful', label: 'Warm & respectful' },
                    { value: 'formal', label: 'Simple & polite' }
                  ].map((tone) => (
                    <div
                      key={tone.value}
                      onClick={() => {
                        update("tone", tone.value);
                        setIsToneOpen(false);
                      }}
                      className={`px-4 py-3 cursor-pointer transition ${
                        formData.tone === tone.value
                          ? 'text-[#D4AF37] bg-[#D4AF37]/10'
                          : 'text-white/80 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]'
                      }`}
                    >
                      {tone.label}
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
              placeholder="₹ 5000 (or surprise them 😉)"
              value={formData.eidiAmount}
              onChange={(e) => update("eidiAmount", e.target.value)}
            />
          </>
        ) : null}

        {((!hasSubtypeStep && step === 5) || (hasSubtypeStep && step === 6)) ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                fontSize: 32,
                color: "#D4AF37",
                marginBottom: 12,
                filter: "drop-shadow(0 0 10px rgba(212,175,55,0.3))"
              }}>
                🌙
              </div>

              <div style={{
                fontFamily: "Georgia, serif",
                fontSize: 20,
                color: "#D4AF37",
                marginBottom: 16
              }}>
                Your message is ready
              </div>

              <div style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.6,
                marginBottom: 18
              }}>
                For <strong style={{ color: "#fff" }}>{formData.recipient}</strong><br />
                From <strong style={{ color: "#fff" }}>{formData.senderName}</strong>
              </div>

              <div style={{
                width: "100%",
                padding: "16px 18px",
                borderRadius: 12,
                border: "1px solid rgba(212,175,55,0.15)",
                background: "rgba(255,255,255,0.02)",
                fontStyle: "italic",
                fontSize: 13,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.7,
                marginBottom: 14
              }}>
                {previewText
                  ? previewText.split(" ").slice(0, 12).join(" ") + "..."
                  : "Your message will appear here..."}
              </div>

              <div style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "center",
                marginBottom: 16
              }}>
                <span style={chipStyle}>{formatTone(formData.tone)}</span>

                {formData.eidiAmount && (
                  <span style={chipStyle}>
                    Eidi: {formData.eidiAmount}
                  </span>
                )}
              </div>

              <div style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                fontStyle: "italic"
              }}>
                This will be delivered as an experience ✦
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button 
                style={styles.primary} 
                onClick={handlePreview}
                disabled={isGeneratingLetter}
              >
                {isGeneratingLetter ? "Preparing preview..." : "Preview Experience 👁"}
              </button>
            </div>
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

const triggerStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "6px 10px",
  borderRadius: 20,
  border: "1px solid rgba(212,175,55,0.25)",
  background: "transparent",
  color: "#D4AF37",
  cursor: "pointer",
  transition: "all 0.2s ease"
};