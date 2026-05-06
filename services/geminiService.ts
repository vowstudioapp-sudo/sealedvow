import { CoupleData, SacredLocation } from "../types.ts";

/**
 * All AI calls are proxied through /api/ai (Vercel serverless function).
 * Provider-agnostic: Gemini primary, OpenAI fallback.
 * The API keys never touch the client.
 *
 * Prompt templates are constructed SERVER-SIDE in /api/lib/prompt-templates.js.
 * The client sends raw data only — never the full prompt.
 */
const callAPI = async (action: string, payload: Record<string, any>): Promise<any> => {
  console.log("FETCHING /api/ai");
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  console.log("API RESPONSE:", response);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API call failed: ${response.status}`);
  }

  return response.json();
};

/* ------------------------------------------------------------------ */
/* LETTER GENERATION                                                    */
/* Sends raw couple data to server. Server builds prompt from templates */
/* ------------------------------------------------------------------ */

export const generateLoveLetter = async (data: CoupleData): Promise<string> => {
  // H7: throw on failure so callers (RefineStage) can show a real error UI
  // with retry + "write it myself". Previously this swallowed all errors and
  // returned a hardcoded occasion fallback string ("Another year. I'd choose
  // this again..." etc), which the user couldn't distinguish from a real AI
  // letter. That silent-degradation made AI failures invisible to both
  // users (received generic copy as if it were their letter) and operators
  // (no error in client-side logs).
  const result = await callAPI('generateLoveLetter', {
    coupleData: {
      senderName: data.senderName,
      recipientName: data.recipientName,
      occasion: data.occasion,
      sharedMoment: data.sharedMoment,
      timeShared: data.timeShared,
      senderRawThoughts: data.senderRawThoughts,
      relationshipIntent: data.relationshipIntent,
    },
  });
  const payload = result?.data ?? result;
  const text = payload?.text;
  if (!text || typeof text !== 'string') {
    throw new Error('AI returned an empty letter. Please try again or write it yourself.');
  }
  return text;
};

export const generateCoupleMyth = async (data: CoupleData): Promise<string> => {
  try {
    const result = await callAPI('generateCoupleMyth', {
      coupleData: {
        senderName: data.senderName,
        recipientName: data.recipientName,
        sharedMoment: data.sharedMoment,
      },
    });
    const payload = result?.data ?? result;
    return payload?.text || null;
  } catch (error) {
    return "A story written not in ink, but in the quiet moments shared between two souls.";
  }
};

export const generateCinematicVideo = async (data: CoupleData): Promise<string | null> => {
  console.warn('[Gemini] Video generation is disabled for launch.');
  return null;
};

export const generateSacredLocation = async (memory: string, manualLink?: string): Promise<SacredLocation | null> => {
  try {
    const result = await callAPI('generateSacredLocation', { memory, manualLink });
    const payload = result?.data ?? result;
    return payload?.location || null;
  } catch (error) {
    console.error("Location generation failed", error);
    return {
      placeName: memory ? memory.substring(0, 30) + (memory.length > 30 ? "..." : "") : "A Special Place",
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(memory || 'Romantic Place')}`,
      description: "A coordinate etched in time, preserved in memory."
    };
  }
};

export const generateAudioLetter = async (text: string): Promise<Uint8Array | null> => {
  try {
    const result = await callAPI('generateAudioLetter', { text });
    const payload = result?.data ?? result;
    if (payload?.audio) {
      return decodeBase64(payload.audio);
    }
    return null;
  } catch (error) {
    return null;
  }
};

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
