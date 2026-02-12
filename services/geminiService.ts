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

/* ------------------------------------------------------------------ */
/* STRUCTURAL MATRIX — One template per occasion                       */
/* Each has: structure, word budget, must-include, forbidden list       */
/* ------------------------------------------------------------------ */

interface OccasionContract {
  structure: string;
  wordRange: [number, number];
  paragraphs: number;
  mustInclude: string[];
  forbidden: string[];
  tone: string;
}

const OCCASION_CONTRACTS: Record<Occasion, OccasionContract> = {
  valentine: {
    structure: `
      Paragraph 1: Present-day feeling. No backstory, no "from the moment". Start with right now.
      Paragraph 2: One specific detail about them — a habit, a trait, something you noticed recently.
      Paragraph 3: A simple forward-looking line. Not an eternal promise. Just what you want next.`,
    wordRange: [130, 160],
    paragraphs: 3,
    mustInclude: ['one sensory or real-world detail', 'one direct "I love" statement'],
    forbidden: ['destiny', 'universe', 'soulmate', 'forever and always', 'stars aligned', 'meant to be', 'other half'],
    tone: 'intimate, modern, real. Like talking to them on a quiet night.',
  },
  anniversary: {
    structure: `
      Paragraph 1: Reference passage of time directly — the years, months, or seasons.
      Paragraph 2: What changed. How you grew. What you learned.
      Paragraph 3: A specific shared memory.
      Paragraph 4: Where you're headed. Steady, not dramatic.`,
    wordRange: [150, 180],
    paragraphs: 4,
    mustInclude: ['a time marker (years/months/seasons)', 'acknowledgment of growth or change'],
    forbidden: ['from the moment I saw you', 'fairy tale', 'love story', 'chapter', 'journey together', 'happily ever after'],
    tone: 'mature, steady, layered. Like someone who has been through things and is still here.',
  },
  'just-because': {
    structure: `
      Paragraph 1: Casual opening. No grand setup. Just start talking.
      Paragraph 2: A small appreciation or random thought about them.`,
    wordRange: [80, 100],
    paragraphs: 2,
    mustInclude: ['something ordinary — chai, a laugh, a random text, a habit'],
    forbidden: ['big declarations', 'heavy romantic escalation', 'eternal', 'always', 'I cannot imagine life without'],
    tone: 'spontaneous, relaxed, human. Should feel like a long text message, not a letter.',
  },
  apology: {
    structure: `
      First sentence: Acknowledge fault directly. Name the action. No softening.
      Paragraph 1: What you did and why it was wrong. No justifications.
      Paragraph 2: What you will do differently. Be specific.
      Optional Paragraph 3: One line about what they mean to you. Brief.`,
    wordRange: [90, 120],
    paragraphs: 3,
    mustInclude: ['direct ownership of specific action', 'one concrete behavior change commitment'],
    forbidden: ['if I hurt you', 'you misunderstood', 'I was just trying to', 'but you also', 'self-pity', 'romantic escalation', 'you complete me'],
    tone: 'accountable, calm, grounded. No begging. No drama. Just clarity.',
  },
  'long-distance': {
    structure: `
      Paragraph 1: Physical absence mentioned clearly. Where you are. What is missing.
      Paragraph 2: A specific memory triggered by the distance — something you saw or heard that reminded you.
      Paragraph 3: Looking forward to reunion. Realistic, not dramatic.`,
    wordRange: [120, 150],
    paragraphs: 3,
    mustInclude: ['concrete distance reference — a room, a city, silence after a call, an empty side of bed'],
    forbidden: ['dramatic longing metaphors', 'oceans between us', 'miles cannot separate', 'my heart aches', 'counting every second'],
    tone: 'quiet longing, not dramatic ache. Like writing from a hotel room at night.',
  },
  'thank-you': {
    structure: `
      Paragraph 1: Clear appreciation for a specific action or pattern they do.
      Paragraph 2: Why it mattered. What it meant. How it made you feel.`,
    wordRange: [80, 110],
    paragraphs: 2,
    mustInclude: ['a specific action, event, or behavior being thanked'],
    forbidden: ['romantic escalation', 'love declarations unless relevant', 'flowery adjectives', 'you are my everything', 'I do not deserve you'],
    tone: 'sincere, simple, direct. Like thanking someone who actually helped you.',
  },
};

/* ------------------------------------------------------------------ */
/* VOW BRAND LOCK — Applied to ALL occasions                           */
/* ------------------------------------------------------------------ */

const BRAND_LOCK = `
ABSOLUTE RULES — NEVER VIOLATE:
- Short to medium sentences. Average 10-15 words per sentence.
- No metaphors. Zero. Not even "subtle" ones.
- No cosmic language: destiny, universe, stars, fate, celestial, cosmic.
- No dramatic monologues. No rhetorical questions.
- No abstract nouns: journey, chapter, story, canvas, tapestry, symphony.
- No literary language: "intertwined", "blossomed", "woven", "etched".
- Sound like a real person speaking honestly, not a writer performing.
- No formal sign-off. No "Yours truly". No "With all my love". Just end naturally.
- Every paragraph must contain at least one specific, concrete detail.
- If the letter reads like literature or poetry, rewrite it more simply.

LUXURY = RESTRAINT. Less is more. Simple is premium.`;

/* ------------------------------------------------------------------ */
/* LETTER GENERATION                                                    */
/* ------------------------------------------------------------------ */

export const generateLoveLetter = async (data: CoupleData): Promise<string> => {
  const contract = OCCASION_CONTRACTS[data.occasion] || OCCASION_CONTRACTS.valentine;
  const hasSenderWords = data.senderRawThoughts && data.senderRawThoughts.trim().split(/\s+/).length >= 5;

  // Extract key phrases from sender's raw thoughts for enforceable preservation
  const senderKeyPhrases = hasSenderWords
    ? data.senderRawThoughts!.trim()
        .split(/[.!?\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 10)
        .slice(0, 6)
    : [];

  const senderVoiceBlock = hasSenderWords
    ? `
SENDER'S OWN WORDS (CRITICAL — preserve these):
"""
${data.senderRawThoughts}
"""

VOICE PRESERVATION RULES:
- Preserve the sender's exact key phrases verbatim. Do not paraphrase them.
- Do not replace their nouns or verbs unless grammatically required.
- Do not introduce new adjectives they did not use.
- Do not add emotional claims the sender did not make.
- Do not elevate casual language into literary language.
- If the sender wrote "I miss your stupid laugh" — that exact phrase stays.
- Only reorganize into paragraph structure. Minimal polish.
`
    : '';

  const prompt = `You are writing a short personal letter from ${data.senderName} to ${data.recipientName}.

OCCASION: ${data.occasion.toUpperCase().replace('-', ' ')}
RELATIONSHIP CONTEXT: ${data.relationshipIntent || 'romantic partner'}
TIME TOGETHER: ${data.timeShared || 'some time'}
A SHARED MEMORY: ${data.sharedMoment || 'time spent together'}

${senderVoiceBlock}

STRUCTURE (follow exactly):
${contract.structure}

WORD COUNT: ${contract.wordRange[0]}–${contract.wordRange[1]} words. Hard limit. Not one word more.
PARAGRAPHS: Exactly ${contract.paragraphs} paragraphs separated by exactly one blank line.
No extra blank lines. No bullet points. No markdown. No headers.
TONE: ${contract.tone}

MUST INCLUDE:
${contract.mustInclude.map(r => `- ${r}`).join('\n')}

FORBIDDEN (never use these words or patterns):
${contract.forbidden.map(f => `- "${f}"`).join('\n')}

FORMAT RULE: Each paragraph separated by exactly one blank line. No other formatting.
SENTENCE RULE: Average sentence length must be under 15 words. If a sentence exceeds 20 words, split it.

${BRAND_LOCK}

Write the letter now. Only the letter text. No title, no greeting like "Dear X", no sign-off. Just the raw paragraphs.`;

  // Pass enforcement metadata to server for structural validation
  const enforcement = {
    occasion: data.occasion,
    wordRange: contract.wordRange,
    paragraphs: contract.paragraphs,
    forbidden: contract.forbidden,
    // Enforceable data fields — server checks these appear in output
    requiredFields: {
      sharedMoment: data.sharedMoment || '',
      timeShared: data.occasion === 'anniversary' ? (data.timeShared || '') : '',
      senderKeyPhrases,
    },
  };

  try {
    const result = await callAPI('generateLoveLetter', { prompt, enforcement });
    return result.text;
  } catch (error) {
    const fallbacks: Record<Occasion, string> = {
      valentine: "I keep thinking about you today. Not for any big reason. Just because you're you, and that's enough.",
      anniversary: "Another year. I'd choose this again. Every part of it.",
      'just-because': "No reason for this. Just wanted you to know I was thinking about you.",
      apology: "I messed up. I know that. I'm not going to make excuses. I just want to do better.",
      'long-distance': "It's quiet here without you. I keep reaching for my phone just to hear your voice.",
      'thank-you': "I don't say this enough. But thank you. For everything you do that I forget to notice.",
    };
    return fallbacks[data.occasion] || fallbacks.valentine;
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