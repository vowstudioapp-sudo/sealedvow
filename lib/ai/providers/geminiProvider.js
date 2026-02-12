// ================================================================
// Gemini Provider
// Pure API calls. No validation. No business rules.
// ================================================================

import { GoogleGenAI, Modality } from "@google/genai";

const getClient = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

/**
 * Generate text content
 */
export async function generateText(prompt, { temperature = 0.75, jsonMode = false } = {}) {
  const ai = getClient();
  const config = { temperature };
  if (jsonMode) config.responseMimeType = 'application/json';

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config,
  });

  return response.text || '';
}

/**
 * Generate text with Google Search grounding
 */
export async function generateTextWithSearch(prompt) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  return {
    text: response.text || '',
    grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
  };
}

/**
 * Generate an image
 */
export async function generateImage(prompt) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: { responseModalities: ["TEXT", "IMAGE"] },
  });

  let imageData = null;
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageData = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  }
  return imageData;
}

/**
 * Generate audio (TTS)
 */
export async function generateAudio(text, { voice = 'Kore' } = {}) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ parts: [{ text: `Read this softly and naturally, with pauses: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
}