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
        const { prompt, enforcement } = payload;
        
        // ── GLOBAL FORBIDDEN WORDS ──
        const GLOBAL_FORBIDDEN = [
          'destiny', 'universe', 'soulmate', 'tapestry', 'intertwined', 'celestial',
          'symphony', 'canvas', 'journey together', 'stars aligned', 'meant to be',
          'other half', 'etched', 'blossomed', 'woven', 'beacon', 'chapter of',
          'fairy tale', 'happily ever after', 'two souls'
        ];
        
        // ── STRUCTURAL VALIDATOR ──
        const validate = (text) => {
          const violations = [];
          const words = text.split(/\s+/).filter(Boolean);
          const wordCount = words.length;
          const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
          const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
          const avgSentenceLength = sentences.length > 0 
            ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length 
            : 0;
          const lowerText = text.toLowerCase();
          
          // Combine global + occasion-specific forbidden
          const allForbidden = [...GLOBAL_FORBIDDEN, ...(enforcement?.forbidden || [])];
          const foundForbidden = allForbidden.filter(word => lowerText.includes(word.toLowerCase()));
          if (foundForbidden.length > 0) {
            violations.push(`FORBIDDEN_WORDS: ${foundForbidden.join(', ')}`);
          }
          
          // Word count — hard ceiling
          const [minWords, maxWords] = enforcement?.wordRange || [80, 200];
          if (wordCount > maxWords + 10) violations.push(`TOO_LONG: ${wordCount} words (max ${maxWords})`);
          if (wordCount < minWords - 15) violations.push(`TOO_SHORT: ${wordCount} words (min ${minWords})`);
          
          // Paragraph count
          const expectedParagraphs = enforcement?.paragraphs || 3;
          if (paragraphs.length !== expectedParagraphs && Math.abs(paragraphs.length - expectedParagraphs) > 1) {
            violations.push(`PARAGRAPH_COUNT: ${paragraphs.length} (expected ${expectedParagraphs})`);
          }
          
          // Average sentence length — kills poetic drift
          if (avgSentenceLength > 18) {
            violations.push(`SENTENCES_TOO_LONG: avg ${Math.round(avgSentenceLength)} words (max 18)`);
          }
          
          // Required data fields must appear in output
          if (enforcement?.requiredFields) {
            const { sharedMoment, timeShared, senderKeyPhrases } = enforcement.requiredFields;
            
            // Shared moment — at least partial match (3+ word overlap)
            if (sharedMoment && sharedMoment.length > 10) {
              const momentWords = sharedMoment.toLowerCase().split(/\s+/).filter(w => w.length > 3);
              const matchCount = momentWords.filter(w => lowerText.includes(w)).length;
              if (matchCount < Math.min(3, momentWords.length)) {
                violations.push('MISSING_SHARED_MOMENT');
              }
            }
            
            // Time shared — for anniversary
            if (timeShared && timeShared.length > 0) {
              const timeWords = timeShared.toLowerCase().split(/\s+/).filter(w => w.length > 2);
              const matchCount = timeWords.filter(w => lowerText.includes(w)).length;
              if (matchCount === 0) {
                violations.push('MISSING_TIME_SHARED');
              }
            }
            
            // Sender key phrases — at least half should appear
            if (senderKeyPhrases && senderKeyPhrases.length > 0) {
              const preserved = senderKeyPhrases.filter(phrase => {
                const phraseWords = phrase.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                return phraseWords.filter(w => lowerText.includes(w)).length >= Math.ceil(phraseWords.length * 0.5);
              });
              if (preserved.length < Math.ceil(senderKeyPhrases.length * 0.5)) {
                violations.push(`SENDER_VOICE_LOST: only ${preserved.length}/${senderKeyPhrases.length} phrases preserved`);
              }
            }
          }
          
          // Check for markdown/formatting contamination
          if (text.includes('**') || text.includes('##') || text.includes('- ') || text.includes('* ')) {
            violations.push('MARKDOWN_CONTAMINATION');
          }
          
          return { valid: violations.length === 0, violations, avgSentenceLength, wordCount, paragraphCount: paragraphs.length };
        };
        
        // ── GENERATE → VALIDATE → RETRY LOOP ──
        const generateLetter = async (attempt = 1) => {
          let fullPrompt = prompt;
          
          if (attempt === 2) {
            fullPrompt += '\n\nCRITICAL: Your previous output violated constraints. Write MORE SIMPLY. Shorter sentences. No metaphors. No markdown. Exact paragraph count required.';
          } else if (attempt === 3) {
            fullPrompt += '\n\nFINAL ATTEMPT. Write like a normal person texting. Ultra simple. Short sentences. No fancy words. No poetry.';
          }
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-05-20',
            contents: fullPrompt,
            config: { temperature: Math.max(0.5, 0.75 - (attempt - 1) * 0.12) }
          });
          
          let text = (response.text || '').trim();
          
          // Strip markdown if present
          text = text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').replace(/^[-*]\s+/gm, '');
          
          const check = validate(text);
          
          console.log(`[Letter] Attempt ${attempt}: ${check.wordCount} words, ${check.paragraphCount} paragraphs, avg sentence ${Math.round(check.avgSentenceLength)} words, violations: ${check.violations.join(', ') || 'none'}`);
          
          // Retry on hard violations
          if (!check.valid && attempt < 3) {
            return generateLetter(attempt + 1);
          }
          
          return { text, check };
        };
        
        let { text: letterText, check } = await generateLetter();
        
        // ── SIMPLIFIER PASS ──
        // If sentences are too long even after retries, run a dedicated simplification
        if (check.avgSentenceLength > 16 && letterText.length > 0) {
          try {
            const simplifyResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-preview-05-20',
              contents: `Rewrite this letter more simply. Break long sentences into shorter ones. Remove any decorative language. Keep the same meaning and specific details. Do not add new content.\n\n${letterText}`,
              config: { temperature: 0.4 }
            });
            const simplified = (simplifyResponse.text || '').trim().replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
            
            // Only use simplified version if it's better
            const simplifiedCheck = validate(simplified);
            if (simplifiedCheck.avgSentenceLength < check.avgSentenceLength && !simplifiedCheck.violations.some(v => v.startsWith('FORBIDDEN'))) {
              letterText = simplified;
              console.log(`[Letter] Simplifier improved: avg sentence ${Math.round(check.avgSentenceLength)} → ${Math.round(simplifiedCheck.avgSentenceLength)} words`);
            }
          } catch (e) {
            // Simplifier failed — use original, it's still acceptable
            console.log('[Letter] Simplifier pass failed, using original');
          }
        }
        
        result = { text: letterText || "I was just sitting here thinking about us. I'm glad we have this." };
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