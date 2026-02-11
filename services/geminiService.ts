import { CoupleData, SacredLocation, Occasion } from "../types.ts";

/**
 * All Gemini calls are proxied through /api/gemini (Vercel serverless function).
 * The API key never touches the client.
 */
const callAPI = async (action: string, payload: Record<string, any>): Promise<any> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API call failed: ${response.status}`);
  }

  return response.json();
};

const OCCASION_PROMPTS: Record<Occasion, string> = {
  valentine: `
    MODE: ROMANTIC & PRESENT.
    Focus on the "now". The quiet joy of being their partner.
    Key themes: Warmth, safety, desire, being "home".
    Tone: Soft, intimate, whispering.
  `,
  anniversary: `
    MODE: NOSTALGIC & EPIC.
    Focus on the "timeline". The years past and the years to come.
    Key themes: Endurance, growth, choosing each other again.
    Tone: Proud, deep, steady.
  `,
  apology: `
    MODE: HUMBLE & RAW.
    Focus on "repair". Own the mistake without making excuses.
    Key themes: Regret, learning, valuing the bond over the ego.
    Tone: Vulnerable, lower-case energy, stripped back. NO flowery language.
  `,
  'just-because': `
    MODE: SPONTANEOUS & OBSERVATIONAL.
    Focus on "small details". The way they drink coffee, their laugh.
    Key themes: Noticing them, appreciation without a calendar reason.
    Tone: Light, affectionate, easy.
  `,
  'long-distance': `
    MODE: LONGING & HOPEFUL.
    Focus on the "distance" vs the "connection".
    Key themes: Counting days, digital intimacy, the physical ache.
    Tone: Melancholic but strong.
  `,
  'thank-you': `
    MODE: GRATITUDE & SERVICE.
    Focus on "what they do". Acknowledge their unseen labor or support.
    Key themes: Being seen, partnership, thankfulness.
    Tone: Sincere, clear, admiring.
  `
};

export const generateLoveLetter = async (data: CoupleData): Promise<string> => {
  const occasionInstruction = OCCASION_PROMPTS[data.occasion] || OCCASION_PROMPTS.valentine;

  const prompt = `Write a letter from ${data.senderName} to ${data.recipientName}. 
  
  ${occasionInstruction}

  Context: ${data.relationshipIntent}. 
  Time shared: ${data.timeShared}.
  A specific memory: ${data.sharedMoment}.
  
  CRITICAL VOICE GUIDELINES:
  - DO NOT use complex metaphors (avoid "tapestry", "intertwined", "celestial", "symphony").
  - Use plain, everyday English. Be raw. 
  - Write shorter sentences. It should sound like someone talking, not a writer writing.
  - Mention the memory "${data.sharedMoment}" naturally.
  - The tone should be honest and vulnerable. No formal closing.
  - Keep it around 140-160 words.`;

  try {
    const result = await callAPI('generateLoveLetter', { prompt });
    return result.text;
  } catch (error) {
    return "I don't really know how to put this into words, but I wanted to try anyway.";
  }
};

export const generateCoupleMyth = async (data: CoupleData): Promise<string> => {
  const prompt = `Write a very short, abstract "myth" about ${data.senderName} and ${data.recipientName} (2 sentences max).
  Imagine they are two forces of nature or stars.
  Do NOT use their names. Use "The One Who [trait]" format or abstract descriptions.
  Based on this memory: "${data.sharedMoment}".
  Style: Ancient, inscription-like, museum plaque.`;

  try {
    const result = await callAPI('generateCoupleMyth', { prompt });
    return result.text;
  } catch (error) {
    return "A story written not in ink, but in the quiet moments shared between two souls.";
  }
};

export const generateFutureProphecy = async (data: CoupleData): Promise<string[]> => {
  const prompt = `Write 3 very short (5-8 words) poetic captions about the future of a couple.
  Vibe: Cinematic, hopeful, quiet luxury.
  Format: JSON array of strings.
  Example: ["Walking the quiet streets of Kyoto", "Building a home in the mountains", "Growing old in the golden light"]`;

  try {
    const result = await callAPI('generateFutureProphecy', { prompt });
    return result.items;
  } catch (error) {
    return ["The Quiet Morning", "The Great Adventure", "The Golden Years"];
  }
};

export const generateValentineImage = async (visualPrompt: string): Promise<string | null> => {
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
  // Video generation disabled for launch — requires async job architecture
  // due to serverless timeout limits. Will be re-enabled with proper queuing.
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