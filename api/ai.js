// ================================================================
// /api/ai.js — Provider-Agnostic AI Endpoint
//
// Flow: Request → Gemini → Validate → (fail?) → OpenAI → Validate → Response
//
// Providers: lib/ai/providers/gemini.js, lib/ai/providers/openai.js
// Validator: lib/ai/validator.js
// ================================================================

import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

import * as gemini from '../lib/ai/providers/geminiProvider.js';
import * as openai from '../lib/ai/providers/openaiProvider.js';
import { validateLetter, validateBasicText, cleanOutput, GLOBAL_FORBIDDEN } from '../lib/ai/validator.js';

// ===============================
// ALLOWED ACTIONS
// ===============================
const ALLOWED_ACTIONS = [
  'generateLoveLetter',
  'generateCoupleMyth',
  'generateFutureProphecy',
  'generateValentineImage',
  'generateSacredLocation',
  'generateAudioLetter',
];

// Actions that can fall back to OpenAI (text-only)
const TEXT_ACTIONS = ['generateLoveLetter', 'generateCoupleMyth', 'generateFutureProphecy', 'generateSacredLocation'];

// ===============================
// DISTRIBUTED RATE LIMITING (Redis/Vercel KV)
// ===============================
const RATE_LIMIT_WINDOW = 60; // seconds
const MAX_REQUESTS = 10; // per IP per minute

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// ===============================
// CORS
// ===============================
const ALLOWED_ORIGINS = [
  "https://www.sealedvow.com",
  "https://sealedvow.com",
  "https://sealedvow.vercel.app"
];

function getAllowedOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

// ===============================
// ACTION HANDLERS
// ===============================

async function handleLoveLetter(payload) {
  const { prompt, enforcement } = payload;

  // ── GENERATE → VALIDATE → RETRY LOOP (Gemini) ──
  const generate = async (attempt = 1) => {
    let fullPrompt = prompt;
    if (attempt === 2) fullPrompt += '\n\nCRITICAL: Previous output violated constraints. Write MORE SIMPLY. Shorter sentences. No metaphors. No markdown.';
    if (attempt === 3) fullPrompt += '\n\nFINAL ATTEMPT. Write like a normal person texting. Ultra simple. Short sentences. No fancy words.';

    const temp = Math.max(0.5, 0.75 - (attempt - 1) * 0.12);
    const raw = await gemini.generateText(fullPrompt, { temperature: temp });
    const text = cleanOutput(raw);
    const check = validateLetter(text, enforcement);

    console.log(`[Letter] Gemini attempt ${attempt}: ${check.stats.wordCount} words, ${check.stats.paragraphCount}p, avg ${check.stats.avgSentenceLength}w/s, violations: ${check.violations.join(', ') || 'none'}`);

    if (!check.valid && attempt < 3) return generate(attempt + 1);
    return { text, check };
  };

  let { text, check } = await generate();

  // ── SIMPLIFIER PASS ──
  if (check.stats.avgSentenceLength > 16 && text.length > 0) {
    try {
      const simplified = cleanOutput(
        await gemini.generateText(
          `Rewrite this letter more simply. Break long sentences into shorter ones. Remove decorative language. Keep specific details.\n\n${text}`,
          { temperature: 0.4 }
        )
      );
      const simplifiedCheck = validateLetter(simplified, enforcement);
      if (simplifiedCheck.stats.avgSentenceLength < check.stats.avgSentenceLength && !simplifiedCheck.violations.some(v => v.startsWith('FORBIDDEN'))) {
        text = simplified;
        console.log(`[Letter] Simplifier improved: avg ${check.stats.avgSentenceLength} → ${simplifiedCheck.stats.avgSentenceLength} w/s`);
      }
    } catch (e) {
      console.log('[Letter] Simplifier pass failed, using original');
    }
  }

  return { text: text || null };
}

async function handleCoupleMyth(payload) {
  const raw = await gemini.generateText(payload.prompt, { temperature: 0.8 });
  return { text: raw || null };
}

async function handleFutureProphecy(payload) {
  const raw = await gemini.generateText(payload.prompt, { jsonMode: true });
  const items = JSON.parse(raw || '[]');
  return { items: Array.isArray(items) ? items : [] };
}

async function handleValentineImage(payload) {
  const image = await gemini.generateImage(payload.prompt);
  return { image };
}

async function handleSacredLocation(payload) {
  const { memory, manualLink } = payload;

  if (manualLink) {
    const desc = await gemini.generateText(
      `Write a 1 sentence poetic description of "${memory}" as a romantic setting. Abstract and emotional.`
    );
    return { location: { placeName: memory, googleMapsUri: manualLink, description: desc || "A coordinate etched in time." } };
  }

  // Use Google Search grounding to find real location
  const { text: searchText, grounding } = await gemini.generateTextWithSearch(
    `Search for the real-world location mentioned in this memory: "${memory}". Return the specific place name.`
  );

  let mapUri = '';
  let placeName = '';

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

  if (!placeName) placeName = searchText?.replace(/\.$/, '') || 'Special Place';
  if (!mapUri || !mapUri.includes('maps')) {
    mapUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
  }

  const desc = await gemini.generateText(
    `Write a 1 sentence poetic description of ${placeName} as a romantic setting. Abstract and emotional.`
  );

  return { location: { placeName, googleMapsUri: mapUri, description: desc || "A coordinate etched in time." } };
}

async function handleAudioLetter(payload) {
  const audio = await gemini.generateAudio(payload.text);
  return { audio };
}

// ===============================
// OPENAI FALLBACK HANDLERS
// ===============================

async function fallbackLoveLetter(payload) {
  const { prompt, enforcement } = payload;
  const raw = await openai.generateText(prompt, { temperature: 0.7, maxTokens: 400 });
  if (!raw) return null;

  const text = cleanOutput(raw);
  const check = validateLetter(text, enforcement);
  console.log(`[Fallback] OpenAI letter: ${check.stats.wordCount} words, violations: ${check.violations.join(', ') || 'none'}`);

  // Accept if no forbidden words (relax other constraints for fallback)
  if (!check.violations.some(v => v.startsWith('FORBIDDEN'))) {
    return { text };
  }
  return null;
}

async function fallbackCoupleMyth(payload) {
  const raw = await openai.generateText(payload.prompt, { temperature: 0.8, maxTokens: 100 });
  if (!raw) return null;
  const text = cleanOutput(raw);
  return validateBasicText(text) ? { text } : null;
}

async function fallbackFutureProphecy(payload) {
  const raw = await openai.generateText(
    payload.prompt + '\n\nRespond ONLY with a valid JSON array of strings. No markdown.',
    { temperature: 0.8, maxTokens: 200 }
  );
  if (!raw) return null;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const items = JSON.parse(clean);
    return { items: Array.isArray(items) ? items : [] };
  } catch {
    return { items: [] };
  }
}

async function fallbackSacredLocation(payload) {
  const { memory, manualLink } = payload;
  if (manualLink) {
    const desc = await openai.generateText(
      `Write a 1 sentence poetic description of "${memory}" as a romantic setting.`,
      { maxTokens: 60 }
    );
    return { location: { placeName: memory, googleMapsUri: manualLink, description: desc || "A coordinate etched in time." } };
  }
  // No grounding available — return search link
  return {
    location: {
      placeName: memory || 'A Place That Matters',
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(memory || 'special place')}`,
      description: "A coordinate etched in time."
    }
  };
}

// ===============================
// ROUTE MAPS
// ===============================

const PRIMARY_HANDLERS = {
  generateLoveLetter: handleLoveLetter,
  generateCoupleMyth: handleCoupleMyth,
  generateFutureProphecy: handleFutureProphecy,
  generateValentineImage: handleValentineImage,
  generateSacredLocation: handleSacredLocation,
  generateAudioLetter: handleAudioLetter,
};

const FALLBACK_HANDLERS = {
  generateLoveLetter: fallbackLoveLetter,
  generateCoupleMyth: fallbackCoupleMyth,
  generateFutureProphecy: fallbackFutureProphecy,
  generateSacredLocation: fallbackSacredLocation,
};

// ===============================
// MAIN HANDLER
// ===============================

export default async function handler(req, res) {
  // CORS
  const origin = getAllowedOrigin(req.headers.origin);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── DISTRIBUTED RATE LIMITING ──
  try {
    const ip = getClientIP(req);
    const key = `ai_rate:${ip}`;

    const current = await kv.incr(key);

    if (current === 1) {
      await kv.expire(key, RATE_LIMIT_WINDOW);
    }

    if (current > MAX_REQUESTS) {
      return res.status(429).json({
        error: "Too many AI requests. Please wait a minute."
      });
    }

  } catch (kvError) {
    console.error("[RateLimit] KV unavailable:", kvError.message);
    return res.status(503).json({
      error: "Service temporarily unavailable. Please try again."
    });
  }

  const { action, payload } = req.body;

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: missing API key' });
  }

  // ── PRIMARY: Gemini ──
  try {
    const result = await PRIMARY_HANDLERS[action](payload);
    return res.status(200).json(result);
  } catch (primaryError) {
    console.error(`[API] ${action} failed (Gemini):`, primaryError.message);

    // ── FALLBACK: OpenAI (text actions only) ──
    if (TEXT_ACTIONS.includes(action) && process.env.OPENAI_API_KEY && FALLBACK_HANDLERS[action]) {
      console.log(`[Fallback] Attempting OpenAI for ${action}...`);
      try {
        const fallbackResult = await FALLBACK_HANDLERS[action](payload);
        if (fallbackResult) {
          console.log(`[Fallback] OpenAI succeeded for ${action}`);
          return res.status(200).json(fallbackResult);
        }
      } catch (fallbackError) {
        console.error(`[Fallback] OpenAI also failed for ${action}:`, fallbackError.message);
      }
    }

    return res.status(500).json({ error: 'AI generation failed', details: primaryError.message });
  }
}