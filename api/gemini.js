import { GoogleGenAI, Modality } from "@google/genai";

// Server-side only — never exposed to client
const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Allowed actions (whitelist to prevent abuse)
const ALLOWED_ACTIONS = [
  'generateLoveLetter',
  'generateCoupleMyth',
  'generateFutureProphecy',
  'generateValentineImage',
  'generateSacredLocation',
  'generateAudioLetter',
  // 'generateCinematicVideo' — disabled for launch (timeout risk in serverless)
];

// ===============================
// RATE LIMITING (in-memory, per-instance)
// ===============================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15;      // 15 requests per minute per IP

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  return false;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ===============================
// ALLOWED ORIGINS
// ===============================
const ALLOWED_ORIGINS = [
  'https://sealedvow.com',
  'https://www.sealedvow.com',
  'https://sealedvow.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function getAllowedOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  // Allow Vercel preview deployments
  if (requestOrigin.endsWith('.vercel.app')) return requestOrigin;
  return null;
}

export default async function handler(req, res) {
  // CORS — restricted to allowed origins
  const origin = getAllowedOrigin(req.headers.origin);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit check
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIP)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { action, payload } = req.body;

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: missing API key' });
  }

  try {
    const ai = getAI();
    let result;

    switch (action) {
      case 'generateLoveLetter': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-05-20',
          contents: prompt,
          config: { temperature: 0.8 }
        });
        result = { text: response.text || "I was just sitting here thinking about us. I'm glad we have this." };
        break;
      }

      case 'generateCoupleMyth': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-05-20',
          contents: prompt,
        });
        result = { text: response.text || "Two paths that crossed in the chaos, finding a quiet rhythm that silenced the noise around them." };
        break;
      }

      case 'generateFutureProphecy': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-05-20',
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });
        result = { items: JSON.parse(response.text || '[]') };
        break;
      }

      case 'generateValentineImage': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-preview-image-generation',
          contents: prompt,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
          }
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
        result = { image: imageData };
        break;
      }

      case 'generateSacredLocation': {
        const { memory, manualLink } = payload;

        if (manualLink) {
          const poeticResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-05-20",
            contents: `Write a 1 sentence poetic description of "${memory}" as a romantic setting. Abstract and emotional.`
          });
          result = {
            location: {
              placeName: memory,
              googleMapsUri: manualLink,
              description: poeticResponse.text || "A coordinate etched in time."
            }
          };
          break;
        }

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-05-20",
          contents: `Search for the real-world location mentioned in this memory: "${memory}". Return the specific place name.`,
          config: { tools: [{ googleSearch: {} }] },
        });

        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        let mapUri = "";
        let placeName = "";

        if (grounding) {
          for (const chunk of grounding) {
            if (chunk.web?.uri) {
              if (chunk.web.uri.includes('maps.google') || chunk.web.uri.includes('google.com/maps')) {
                mapUri = chunk.web.uri;
                placeName = chunk.web.title || placeName;
                break;
              }
              if (!mapUri) {
                mapUri = chunk.web.uri;
                placeName = chunk.web.title || placeName;
              }
            }
          }
        }

        if (!placeName) {
          placeName = response.text?.replace(/\.$/, '') || "Special Place";
        }
        if (!mapUri || !mapUri.includes('maps')) {
          mapUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
        }

        const poeticResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-05-20",
          contents: `Write a 1 sentence poetic description of ${placeName} as a romantic setting. Abstract and emotional.`
        });

        result = {
          location: {
            placeName,
            googleMapsUri: mapUri,
            description: poeticResponse.text || "A coordinate etched in time."
          }
        };
        break;
      }

      case 'generateAudioLetter': {
        const { text } = payload;
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
        result = { audio: base64Audio || null };
        break;
      }
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error(`[API] ${action} failed:`, error);
    return res.status(500).json({ error: 'AI generation failed', details: error.message });
  }
}