import React, { useState } from "react";

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

    setIsGeneratingLetter(true);
    try {
      console.log("BUTTON CLICKED");
      let letter = formData.blessing;

      try {
        const result = await generateLetter({
          relationship,
          subtype,
          senderName: formData.senderName,
          recipient: formData.recipient,
          tone: formData.tone,
          customMessage: formData.blessing,
        });

        letter = result.letter || formData.blessing;
      } catch (_err) {
        letter = formData.blessing;
        alert("AI failed. Using your message instead.");
      }

      setGeneratedLetter(letter);
      return letter;
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const generateLink = async () => {
    if (!hasRequiredFields()) {
      alert("Please fill all required fields");
      return;
    }

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
  };

  const previewLink = async () => {
    try {
      if (!hasRequiredFields()) {
        alert("Please fill all required fields");
        return;
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

      window.open(url, "_blank");
    } catch (err) {
      console.error("Preview failed:", err);
      alert("Preview failed");
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
            <textarea
              style={{ ...styles.input, height: 120 }}
              placeholder={getMessagePlaceholder()}
              value={formData.blessing}
              onChange={(e) => {
                update("blessing", e.target.value);
                setGeneratedLetter("");
              }}
            />
            <select
              style={{ ...styles.input, marginTop: 12, height: 48 }}
              value={formData.tone}
              onChange={(e) => update("tone", e.target.value as FormData["tone"])}
            >
              <option value="emotional">Emotional</option>
              <option value="formal">Formal</option>
              <option value="playful">Playful</option>
              <option value="respectful">Respectful</option>
            </select>
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
};
