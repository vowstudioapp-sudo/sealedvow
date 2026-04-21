import { CoupleData, SacredLocation, Occasion } from "../types.ts";

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
  try {
    console.log("SERVICE HIT");
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
    return result.text;
  } catch (error) {
    console.error("AI ERROR:", error);
    const fallbacks: Record<Occasion, string> = {
      anniversary: "Another year. I'd choose this again. Every part of it.",
      'just-because': "No reason for this. Just wanted you to know I was thinking about you.",
      apology: "I messed up. I know that. I'm not going to make excuses. I just want to do better.",
      'long-distance': "It's quiet here without you. I keep reaching for my phone just to hear your voice.",
      'thank-you': "I don't say this enough. But thank you. For everything you do that I forget to notice.",
      eid: "Eid Mubarak. May this day bring you peace, joy, and the warmth of those you love.",
      birthday: "Happy birthday. Another year of you in the world — and I'm grateful for every one of them.",
    };
    return fallbacks[data.occasion] || fallbacks.anniversary;
  }
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
    return result.text;
  } catch (error) {
    return "A story written not in ink, but in the quiet moments shared between two souls.";
  }
};

export const generateFutureProphecy = async (data: CoupleData): Promise<string[]> => {
  try {
    const result = await callAPI('generateFutureProphecy', {
      coupleData: { occasion: data.occasion },
    });
    return result.items;
  } catch (error) {
    return ["The Quiet Morning", "The Great Adventure", "The Golden Years"];
  }
};

export const generateCoupleImage = async (visualPrompt: string): Promise<string | null> => {
  try {
    const result = await callAPI('generateValentineImage', {
      prompt: visualPrompt + " Natural, intimate, unposed photography. Candid moment, soft natural light, warm film grain. No studio lighting."
    });
    return result.image;
  } catch (error) {
    return null;
  }
};

export const generateCinematicVideo = async (data: CoupleData): Promise<string | null> => {
  console.warn('[Gemini] Video generation is disabled for launch.');
  return null;
};

export const generateSacredLocation = async (memory: string, manualLink?: string): Promise<SacredLocation | null> => {
  try {
    const result = await callAPI('generateSacredLocation', { memory, manualLink });
    return result.location;
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
    if (result.audio) {
      return decodeBase64(result.audio);
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
