// ================================================================
// /api/ai.js — Provider-Agnostic AI Endpoint
//
// Flow: Request → Gemini → Validate → (fail?) → OpenAI → Validate → Response
//
// Providers: lib/ai/providers/gemini.js, lib/ai/providers/openai.js
// Validator: lib/ai/validator.js
// ================================================================

import crypto from "crypto";
import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

import * as gemini from '../lib/ai/providers/geminiProvider.js';
import * as openai from '../lib/ai/providers/openaiProvider.js';
import { validateLetter, validateBasicText, cleanOutput, GLOBAL_FORBIDDEN } from '../lib/ai/validator.js';
import { buildLetterPrompt, buildMythPrompt, buildProphecyPrompt } from './lib/prompt-templates.js';

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

// ── AI TIMEOUT WRAPPER ──
async function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout after ' + ms + 'ms')), ms)
    )
  ]);
}

// ===============================
// ACTION HANDLERS
// ===============================

async function handleLoveLetter(payload) {
  // Build prompt server-side from coupleData if not pre-built
  let { prompt, enforcement } = payload;
  if (!prompt && payload.coupleData) {
    ({ prompt, enforcement } = buildLetterPrompt(payload.coupleData));
  }
  if (!prompt) throw new Error('Missing prompt or coupleData for letter generation');

  // ── PROMPT HASH FOR CACHE + DEDUP ──
  const promptHash = crypto
    .createHash("sha256")
    .update(prompt)
    .digest("hex");

  const cacheKey = `ai_result:${promptHash}`;
  const lockKey = `ai_lock:${promptHash}`;

  // Check cache first
  const cached = await kv.get(cacheKey);
  if (cached) {
    console.log("[AI Cache] returning cached result");
    return typeof cached === "string" ? JSON.parse(cached) : cached;
  }

  // Acquire generation lock
  const lock = await kv.set(lockKey, "1", { nx: true, ex: 30 });

  // If another request is generating the same prompt
  if (!lock) {
    await new Promise(r => setTimeout(r, 500));
    const cachedRetry = await kv.get(cacheKey);
    if (cachedRetry) {
      console.log("[AI Cache] reused concurrent result");
      return typeof cachedRetry === "string" ? JSON.parse(cachedRetry) : cachedRetry;
    }
  }

  // ── GENERATE → VALIDATE → RETRY LOOP (Gemini) ──
  const generate = async (attempt = 1) => {
    let fullPrompt = prompt;
    if (attempt === 2) fullPrompt += '\n\nCRITICAL: Previous output violated constraints. Write MORE SIMPLY. Shorter sentences. No metaphors. No markdown.';
    if (attempt === 3) fullPrompt += '\n\nFINAL ATTEMPT. Write like a normal person texting. Ultra simple. Short sentences. No fancy words.';

    const temp = Math.max(0.5, 0.75 - (attempt - 1) * 0.12);
    const raw = await withTimeout(
      gemini.generateText(fullPrompt, { temperature: temp })
    );
    const text = cleanOutput(raw);
    const check = validateLetter(text, enforcement);

    console.log(`[Letter] Gemini attempt ${attempt}: ${check.stats.wordCount} words, ${check.stats.paragraphCount}p, avg ${check.stats.avgSentenceLength}w/s, violations: ${check.violations.join(', ') || 'none'}`);

    if (!check.valid && attempt < 3) {
      console.log(`[Letter] Retry triggered attempt ${attempt + 1} — violations: ${check.violations.join(', ')}`);
      return generate(attempt + 1);
    }
    return { text, check };
  };

  let { text, check } = await generate();

  // ── SIMPLIFIER PASS ──
  if (check.violations.length > 0 && text.length > 0) {
    try {
      const simplified = cleanOutput(
        await withTimeout(
          gemini.generateText(
            `Rewrite this letter more simply. Break long sentences into shorter ones. Remove decorative language. Keep specific details.\n\n${text}`,
            { temperature: 0.4 }
          )
        )
      );
      const simplifiedCheck = validateLetter(simplified, enforcement);
      if (check.violations.length > 0 && simplifiedCheck.violations.length === 0) {
        text = simplified;
        console.log(`[Letter] Simplifier improved: avg ${check.stats.avgSentenceLength} → ${simplifiedCheck.stats.avgSentenceLength} w/s`);
      }
    } catch (e) {
      console.log('[Letter] Simplifier pass failed, using original');
    }
  }

  const result = { text: text || null };

  try {
    await kv.set(cacheKey, result, { ex: 3600 });
  } catch (e) {
    console.warn("[AI Cache] failed to store result:", e.message);
  }

  try {
    await kv.del(lockKey);
  } catch {}

  return result;
}

async function handleCoupleMyth(payload) {
  const prompt = payload.prompt || (payload.coupleData ? buildMythPrompt(payload.coupleData) : null);
  if (!prompt) throw new Error('Missing prompt or coupleData for myth generation');
  const raw = await gemini.generateText(prompt, { temperature: 0.8 });
  return { text: raw || null };
}

async function handleFutureProphecy(payload) {
  const prompt = payload.prompt || buildProphecyPrompt();
  const raw = await gemini.generateText(prompt, { jsonMode: true });
  let items = [];

  try {
    items = JSON.parse(raw || '[]');
  } catch {
    items = [];
  }

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
  let { prompt, enforcement } = payload;
  if (!prompt && payload.coupleData) {
    ({ prompt, enforcement } = buildLetterPrompt(payload.coupleData));
  }
  if (!prompt) return null;
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
  const prompt = payload.prompt || (payload.coupleData ? buildMythPrompt(payload.coupleData) : null);
  if (!prompt) return null;
  const raw = await openai.generateText(prompt, { temperature: 0.8, maxTokens: 100 });
  if (!raw) return null;
  const text = cleanOutput(raw);
  return validateBasicText(text) ? { text } : null;
}

async function fallbackFutureProphecy(payload) {
  const basePrompt = payload.prompt || buildProphecyPrompt();
  const raw = await openai.generateText(
    basePrompt + '\n\nRespond ONLY with a valid JSON array of strings. No markdown.',
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

  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }

  const { action, payload } = req.body || {};

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // ── DISTRIBUTED RATE LIMITING ──
  try {
    const ip = getClientIP(req);
    const key = `ai_rate:${action}:${ip || 'anon'}`;

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
    // ⚠️ INTENTIONAL SOFT-FAIL — matches middleware.js pattern.
    // If Redis is unavailable, degrade rate limiting but never block AI generation.
    console.warn("[RateLimit] KV unavailable (ai_rate):", kvError.message);
  }

  // ── PAYLOAD SIZE CAP (cost protection) ──
  try {
    const rawSize = JSON.stringify(payload || {}).length;

    // 50KB maximum request payload
    if (rawSize > 50000) {
      return res.status(400).json({ error: "Payload too large." });
    }
  } catch {
    return res.status(400).json({ error: "Invalid payload." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error.' });
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

    return res.status(500).json({ error: 'AI generation failed. Please try again.' });
  }
}