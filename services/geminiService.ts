import { GoogleGenAI, Modality } from "@google/genai";
import { CoupleData, SacredLocation, Occasion } from "../types.ts";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  const ai = getAI();
  
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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.8 } // Slightly lowered for more adherence to tone
    });
    return response.text || "I was just sitting here thinking about us. I'm glad we have this.";
  } catch (error) {
    return "I don't really know how to put this into words, but I wanted to try anyway.";
  }
};

export const generateCoupleMyth = async (data: CoupleData): Promise<string> => {
  const ai = getAI();
  const prompt = `Write a very short, abstract "myth" about ${data.senderName} and ${data.recipientName} (2 sentences max).
  Imagine they are two forces of nature or stars.
  Do NOT use their names. Use "The One Who [trait]" format or abstract descriptions.
  Based on this memory: "${data.sharedMoment}".
  Style: Ancient, inscription-like, museum plaque.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Two paths that crossed in the chaos, finding a quiet rhythm that silenced the noise around them.";
  } catch (error) {
    return "A story written not in ink, but in the quiet moments shared between two souls.";
  }
};

export const generateFutureProphecy = async (data: CoupleData): Promise<string[]> => {
  // Generates captions for the gallery
  const ai = getAI();
  const prompt = `Write 3 very short (5-8 words) poetic captions about the future of a couple.
  Vibe: Cinematic, hopeful, quiet luxury.
  Format: JSON array of strings.
  Example: ["Walking the quiet streets of Kyoto", "Building a home in the mountains", "Growing old in the golden light"]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    return ["The Quiet Morning", "The Great Adventure", "The Golden Years"];
  }
};

export const generateValentineImage = async (visualPrompt: string): Promise<string | null> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: visualPrompt + " Natural, intimate, unposed photography. Candid moment, soft natural light, warm film grain. No studio lighting." }] }
    });
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const generateCinematicVideo = async (data: CoupleData): Promise<string | null> => {
  const ai = getAI();
  try {
    const stylePrompt = data.videoStyle || 'cinematic';
    const resolution = data.videoResolution || '720p';
    const aspectRatio = data.videoAspectRatio || '9:16';

    const prompt = `${stylePrompt} style, dreamy, slow-motion shot representing: ${data.sharedMoment}. High luxury, film grain, warm lighting, romantic, abstract, 4k resolution. No text.`;

    // We use fast-generate for speed/reliability in this context
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: resolution,
        aspectRatio: aspectRatio
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
       // Fetch bytes
       const videoResp = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
       const blob = await videoResp.blob();
       
       // Convert to base64 to store in CoupleData (Note: Large videos will fail in URL params, but okay for local session/Firebase)
       return new Promise((resolve) => {
         const reader = new FileReader();
         reader.onloadend = () => resolve(reader.result as string);
         reader.readAsDataURL(blob);
       });
    }
    return null;
  } catch (error) {
    console.error("Veo generation failed", error);
    return null;
  }
};

export const generateSacredLocation = async (memory: string, manualLink?: string): Promise<SacredLocation | null> => {
  const ai = getAI();
  try {
    // If user provided a manual link, we bypass search and just generate description
    if (manualLink) {
        const poeticResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Write a 1 sentence poetic description of "${memory}" as a romantic setting. Abstract and emotional.`
        });
        return {
            placeName: memory, // Use the user's input text as the name
            googleMapsUri: manualLink,
            description: poeticResponse.text || "A coordinate etched in time."
        };
    }

    // Switch to Google Search with Gemini 3 Flash for more robust location finding from unstructured text.
    // This avoids 500 errors often seen with strict Maps grounding on vague queries.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for the real-world location mentioned in this memory: "${memory}". Return the specific place name.`,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    // Extract map data or search result
    let mapUri = "";
    let placeName = "";
    
    // Check grounding chunks
    if (grounding) {
        for (const chunk of grounding) {
            if (chunk.web?.uri) {
                // Prefer Google Maps links
                if (chunk.web.uri.includes('maps.google') || chunk.web.uri.includes('google.com/maps')) {
                    mapUri = chunk.web.uri;
                    placeName = chunk.web.title || placeName;
                    break;
                }
                // Fallback to first search result if not set
                if (!mapUri) {
                    mapUri = chunk.web.uri;
                    placeName = chunk.web.title || placeName;
                }
            }
        }
    }

    // Fallback: If no place name found in grounding, use the generated text
    if (!placeName) {
        placeName = response.text?.replace(/\.$/, '') || "Special Place";
    }

    // Construct Map URI if missing or generic
    if (!mapUri || !mapUri.includes('maps')) {
        mapUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
    }

    // Generate a poetic description for this place
    const poeticResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write a 1 sentence poetic description of ${placeName} as a romantic setting. Abstract and emotional.`
    });

    return {
        placeName: placeName,
        googleMapsUri: mapUri,
        description: poeticResponse.text || "A coordinate etched in time."
    };

  } catch (error) {
    console.error("Location generation failed", error);
    // Graceful fallback on 429 API quota exhausted
    return {
        placeName: memory ? memory.substring(0, 30) + (memory.length > 30 ? "..." : "") : "A Special Place",
        googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(memory || 'Romantic Place')}`,
        description: "A coordinate etched in time, preserved in memory."
    };
  }
};


export const generateAudioLetter = async (text: string): Promise<Uint8Array | null> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this softly and naturally, with pauses: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return decodeBase64(base64Audio);
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