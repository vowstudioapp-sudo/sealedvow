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
import admin from 'firebase-admin';
import { getSessionUser } from './lib/auth.js';
import { rateLimit } from './lib/middleware.js';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

import * as _gemini from '../lib/ai/providers/geminiProvider.js';
import * as _openai from '../lib/ai/providers/openaiProvider.js';
import { validateLetter, validateBasicText, cleanOutput, GLOBAL_FORBIDDEN } from '../lib/ai/validator.js';
import { buildLetterPrompt, buildMythPrompt } from './lib/prompt-templates.js';

// ===============================
// PER-REQUEST AI CALL GUARD
// Module-scoped counter is reset at the top of every handler invocation.
// Vercel serverless invokes one request per container instance at a time,
// so this is safe across warm reuses.
// ===============================
let aiCallCount = 0;
const MAX_AI_CALLS = 8;

function guardAICall() {
  if (aiCallCount >= MAX_AI_CALLS) {
    throw new Error('AI call limit exceeded per request');
  }
  aiCallCount++;
}

// Wrapped provider namespaces — existing handlers call gemini.generateText etc.
// and automatically route through the guard without handler modification.
const gemini = {
  generateText:            (...args) => { guardAICall(); return _gemini.generateText(...args); },
  generateImage:           (...args) => { guardAICall(); return _gemini.generateImage(...args); },
  generateAudio:           (...args) => { guardAICall(); return _gemini.generateAudio(...args); },
  generateTextWithSearch:  (...args) => { guardAICall(); return _gemini.generateTextWithSearch(...args); },
};

const openai = {
  generateText: (...args) => { guardAICall(); return _openai.generateText(...args); },
};

// ===============================
// ALLOWED ACTIONS
// ===============================
const ALLOWED_ACTIONS = [
  'generateLoveLetter',
  'generateEidLetter',
  'generateCoupleMyth',
  'generateSacredLocation',
  'generateAudioLetter',
];

// Actions that can fall back to OpenAI (text-only)
const TEXT_ACTIONS = ['generateLoveLetter', 'generateEidLetter', 'generateCoupleMyth', 'generateSacredLocation'];

// ===============================
// DISTRIBUTED RATE LIMITING (Redis/Vercel KV)
// ===============================
const RATE_LIMIT_WINDOW = 60; // seconds
const MAX_REQUESTS = 10; // per IP per minute

function getClientIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ===============================
// CORS
// ===============================
const ALLOWED_ORIGINS = [
  "https://www.sealedvow.com",
  "https://sealedvow.com",
  "https://sealedvow.vercel.app",
  "http://localhost:5173",      // Vite default port
  "http://localhost:3000",      // Alternative port
  "http://127.0.0.1:5173",      // Explicit IP
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

async function safeKV(fn, fallback = null) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function isSafeObject(obj, depth = 0) {
  if (depth > 3) return false;
  if (typeof obj !== 'object' || obj === null) return true;
  return Object.values(obj).every(v => isSafeObject(v, depth + 1));
}

function isReasonableSize(obj) {
  try {
    return JSON.stringify(obj).length < 10000;
  } catch {
    return false;
  }
}

// ===============================
// ACTION HANDLERS
// ===============================

async function handleLoveLetter(payload, userUid) {
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

  const cacheKey = `ai_result:${userUid}:${promptHash}`;
  const lockKey = `ai_lock:${userUid}:${promptHash}`;
  const recentKey = `ai_recent:${userUid}:${promptHash}`;

  // Check cache first
  const cached = await safeKV(() => kv.get(cacheKey));
  if (cached) {
    console.log("[AI Cache] returning cached result");
    return typeof cached === "string" ? JSON.parse(cached) : cached;
  }

  const recent = await safeKV(() => kv.get(recentKey));
  if (recent) {
    return { text: recent };
  }

  let lockAcquired = false;
  try {
    const lock = await safeKV(() => kv.set(lockKey, "1", { nx: true, ex: 30 }));
    lockAcquired = !!lock;

    // If another request is generating the same prompt
    if (!lock) {
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 400));
        const cachedRetry = await safeKV(() => kv.get(cacheKey));
        if (cachedRetry) {
          console.log("[AI Cache] reused concurrent result");
          return typeof cachedRetry === "string" ? JSON.parse(cachedRetry) : cachedRetry;
        }
      }
      // DO NOT generate again — signal concurrent-generation to the route handler
      // so it can return a proper 409 + retryAfter (not a 200 with placeholder
      // text that the UI would render as the user's actual letter).
      const err = new Error('CONCURRENT_GENERATION');
      err.code = 'CONCURRENT_GENERATION';
      throw err;
    }

    // ── SINGLE OPENAI CALL ──
    const raw = await withTimeout(
      openai.generateText(prompt, { temperature: 0.7, maxTokens: 600 }),
      8000
    );
    let text = cleanOutput(raw) || null;
    const check = text ? validateLetter(text, enforcement) : { violations: [], stats: {} };
    console.log(`[Letter] OpenAI single attempt: ${text ? check.stats.wordCount : 0} words, violations: ${check.violations?.join(', ') || 'none'}`);

    const result = { text: text || null };

    try {
      await safeKV(() => kv.set(cacheKey, result, { ex: 3600 }));
      if (result.text) {
        await safeKV(() => kv.set(recentKey, result.text, { ex: 30 }));
      }
    } catch (e) {
      console.warn("[AI Cache] failed to store result:", e.message);
    }

    return result;
  } finally {
    if (lockAcquired) {
      try {
        await safeKV(() => kv.del(lockKey));
      } catch {}
    }
  }
}

function buildEidLetterPrompt(payload = {}) {
  const {
    relationship,
    subtype,
    senderName,
    recipient,
    tone,
    customMessage,
  } = payload;

  return `You are writing a deeply personal Eid letter between two real people.

This is NOT a greeting card.
This is NOT a formal message.

It should feel like something someone would actually write late at night, thinking about the person.

RULES:
- Use natural, human language
- Avoid cliches like:
  "On this auspicious occasion"
  "May this festival bring joy"
- No over-formality
- No repetition
- No generic blessings

EMOTIONAL DIRECTION:
Use relationship context:

Parent to Child:
- tone: pride, quiet love, dua
- style: simple, grounded, not dramatic

Child to Parent:
- tone: gratitude, respect, emotional warmth

Elder to Child:
- tone: caring, protective, soft guidance

Sibling:
- tone: light, slightly playful, but meaningful

Friend:
- tone: casual but heartfelt

STRUCTURE:
- 4 to 6 short paragraphs
- natural flow (no forced sections)
- end softly, not dramatically

INPUT VARIABLES:
- senderName: ${senderName || 'Someone'}
- recipient: ${recipient || 'Someone'}
- relationship: ${relationship || 'unknown'}
- subtype: ${subtype || 'none'}
- customMessage: ${customMessage || 'none'}
- tone: ${tone || 'none'}

OUTPUT:
ONLY return the letter text.
No quotes.
No formatting.
No headings.`;
}

async function handleEidLetter(payload) {
  console.log('ENTERED generateEidLetter');
  const prompt = buildEidLetterPrompt(payload);
  console.log('TRY GEMINI');
  const text = cleanOutput(await withTimeout(
    gemini.generateText(prompt, { temperature: 0.85 }),
    8000
  ));

  return { letter: text || null };
}

async function handleCoupleMyth(payload) {
  const prompt = payload.prompt || (payload.coupleData ? buildMythPrompt(payload.coupleData) : null);
  if (!prompt) throw new Error('Missing prompt or coupleData for myth generation');
  const raw = await gemini.generateText(prompt, { temperature: 0.8 });
  return { text: raw || null };
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
  if (!payload.text || payload.text.length > 2000) {
    throw new Error('Invalid audio text length');
  }
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
  const raw = await withTimeout(
    openai.generateText(prompt, { temperature: 0.7, maxTokens: 400 }),
    8000
  );
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
  const raw = await withTimeout(
    openai.generateText(prompt, { temperature: 0.8, maxTokens: 100 }),
    8000
  );
  if (!raw) return null;
  const text = cleanOutput(raw);
  return validateBasicText(text) ? { text } : null;
}

async function fallbackEidLetter(payload) {
  const prompt = buildEidLetterPrompt(payload);
  const raw = await withTimeout(
    openai.generateText(prompt, { temperature: 0.85, maxTokens: 350 }),
    8000
  );
  if (!raw) return null;
  return { letter: cleanOutput(raw) };
}

async function fallbackSacredLocation(payload) {
  const { memory, manualLink } = payload;
  if (manualLink) {
    const desc = await withTimeout(
      openai.generateText(
        `Write a 1 sentence poetic description of "${memory}" as a romantic setting.`,
        { maxTokens: 60 }
      ),
      8000
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
  generateEidLetter: handleEidLetter,
  generateCoupleMyth: handleCoupleMyth,
  generateSacredLocation: handleSacredLocation,
  generateAudioLetter: handleAudioLetter,
};

const FALLBACK_HANDLERS = {
  generateLoveLetter: fallbackLoveLetter,
  generateEidLetter: fallbackEidLetter,
  generateCoupleMyth: fallbackCoupleMyth,
  generateSacredLocation: fallbackSacredLocation,
};

// ===============================
// MAIN HANDLER
// ===============================

export default async function handler(req, res) {
  console.log('AI ROUTE HIT');
  // CORS
  const origin = getAllowedOrigin(req.headers.origin);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // ── GLOBAL KILL SWITCH ──
  // Flip process.env.AI_DISABLED=true to instantly disable every AI call
  // without redeploying (safety valve for cost runaway / provider incident).
  if (process.env.AI_DISABLED === 'true') {
    return res.status(503).json({ ok: false, error: 'AI temporarily disabled' });
  }

  // ── RESET PER-REQUEST AI CALL COUNTER ──
  aiCallCount = 0;

  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(415).json({ ok: false, error: 'Unsupported Media Type' });
  }

  const sessionUser = await getSessionUser(req);
  req.user = sessionUser;

  const { action, payload } = req.body || {};
  const userUid = req.user?.uid || null;
  const actorKey = userUid || `ip:${getClientIP(req)}`;
  const sessionId = typeof req.body?.sessionId === 'string'
    ? req.body.sessionId
    : typeof payload?.sessionId === 'string'
    ? payload.sessionId
    : null;
  const type = payload?.type;
  const prompt = payload?.prompt;
  void type;

  // Session is optional pre-payment. When provided, enforce ownership only.
  // Pre-payment AI generation (PreparationForm/RefineStage) hits this route
  // before shared/{sessionId} exists, so we no longer require it. Auth gate
  // is the session cookie above (req.user.uid) when present.
  if (sessionId) {
    const sessionSnap = await admin.database().ref(`shared/${sessionId}`).get();

    if (sessionSnap.exists() && userUid) {
      const session = sessionSnap.val() || {};

      if (session.senderUid !== userUid) {
        return res.status(403).json({ ok: false, error: 'Unauthorized access to this session' });
      }
    }
  }

  // ── EXPENSIVE-ACTION DAILY LIMIT (audio — 3 per day per user) ──
  const EXPENSIVE_ACTIONS = ['generateAudioLetter'];
  if (EXPENSIVE_ACTIONS.includes(req.body?.action)) {
    const { limited: expensiveLimited } = await rateLimit(req, {
      keyPrefix: `ai_expensive_${actorKey}`,
      windowSeconds: 86400,
      max: 3,
    });
    if (expensiveLimited) {
      return res.status(429).json({ ok: false, error: 'Daily limit reached for this feature' });
    }
  }

  // ── PROMPT VALIDATION ──
  // Accept either a pre-built prompt or structured coupleData (handlers build
  // the prompt themselves). Length check only applies when prompt is present.
  const hasPrompt = typeof prompt === 'string' && prompt.length > 0;
  const hasCoupleData = typeof payload?.coupleData === 'object' && payload.coupleData !== null;

  if (!hasPrompt && !hasCoupleData) {
    return res.status(400).json({ ok: false, error: 'Missing input for AI generation' });
  }

  if (hasPrompt && prompt.length > 2000) {
    return res.status(400).json({ ok: false, error: 'Prompt too long' });
  }

  if (payload?.coupleData && !isSafeObject(payload.coupleData)) {
    return res.status(400).json({ ok: false, error: 'Invalid input structure' });
  }

  if (payload?.coupleData && !isReasonableSize(payload.coupleData)) {
    return res.status(400).json({ ok: false, error: 'Input too large' });
  }

  const safePayload = {
    prompt: typeof payload?.prompt === 'string' ? payload.prompt : undefined,
    coupleData: typeof payload?.coupleData === 'object' ? payload.coupleData : undefined,
    type: payload?.type,
    sessionId,
  };

  // ── PER-UID RATE LIMIT (fail-closed + tracked rollback) ──
  // Why fail-closed: previous fallback of `1` silently disabled the rate
  // limit during KV outages, allowing unbounded AI cost during incidents.
  // Why `incremented` flag: we only roll back the quota if the increment
  // actually succeeded — guards against negative counters when KV is unstable.
  const RATE_LIMIT_MAX = 10;
  const RATE_LIMIT_WINDOW_SECONDS = 3600;
  const successRateKey = `ai_rate_success:${actorKey}`;

  let incremented = false;

  const updatedCount = await safeKV(() => kv.incr(successRateKey), null);

  if (updatedCount === null) {
    console.warn('[AI] KV unavailable for ai_rate_success — skipping hourly quota tracking');
  }

  incremented = updatedCount !== null;

  if (updatedCount !== null && updatedCount === 1) {
    await safeKV(() => kv.expire(successRateKey, RATE_LIMIT_WINDOW_SECONDS));
  }

  if (updatedCount !== null && updatedCount > RATE_LIMIT_MAX) {
    return res.status(429).json({ ok: false, error: 'AI usage limit reached.' });
  }

  console.log('[AI] Request', { uid: userUid, sessionId });

  console.log('PROD ENV CHECK:', {
    GEMINI: !!process.env.GEMINI_API_KEY,
    OPENAI: !!process.env.OPENAI_API_KEY,
  });

  console.log('ACTION RECEIVED:', req.body?.action);

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ ok: false, error: 'Invalid action' });
  }

  // ── PAYLOAD SIZE CAP (cost protection) ──
  try {
    const rawSize = JSON.stringify(payload || {}).length;

    // 50KB maximum request payload
    if (rawSize > 50000) {
      return res.status(400).json({ ok: false, error: "Payload too large." });
    }
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid payload." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ ok: false, error: 'Server configuration error.' });
  }

  // ── PRIMARY: Gemini (with handler-level timeout) ──
  try {
    const timeoutError = new Error('HANDLER_TIMEOUT');
    timeoutError.code = 'HANDLER_TIMEOUT';

    const result = await Promise.race([
      PRIMARY_HANDLERS[action](safePayload, userUid),
      new Promise((_, reject) =>
        setTimeout(() => reject(timeoutError), 25000)
      )
    ]);
    return res.status(200).json({ ok: true, data: result });
  } catch (primaryError) {
    console.error('[AI] Error', primaryError.message);
    console.error(`[API] ${action} failed (Gemini):`, primaryError.message);

    // Concurrent-generation short-circuit: surface a proper 409 instead of
    // attempting a fallback (the user is mid-generation already).
    if (primaryError.code === 'CONCURRENT_GENERATION') {
      if (incremented) await safeKV(() => kv.decr(successRateKey));

      return res.status(409).json({
        ok: false,
        error: 'CONCURRENT_GENERATION',
        retryAfter: 5
      });
    }

    // ── FALLBACK: OpenAI (text actions only) ──
    if (TEXT_ACTIONS.includes(action) && process.env.OPENAI_API_KEY && FALLBACK_HANDLERS[action]) {
      console.log(`[Fallback] Attempting OpenAI for ${action}...`);
      try {
        console.log('TRY OPENAI');
        const fallbackResult = await FALLBACK_HANDLERS[action](safePayload, userUid);
        if (fallbackResult) {
          console.log(`[Fallback] OpenAI succeeded for ${action}`);
          return res.status(200).json({ ok: true, data: fallbackResult });
        }
      } catch (fallbackError) {
        console.error('[AI] Error', fallbackError.message);
        console.error(`[Fallback] OpenAI also failed for ${action}:`, fallbackError.message);
      }
    }

    // Both primary and fallback failed — refund the quota since the user got
    // nothing for it. Only roll back if the increment actually succeeded.
    if (incremented) {
      await safeKV(() => kv.decr(successRateKey));
    }

    return res.status(500).json({ ok: false, error: 'AI generation failed. Please try again.' });
  }
}