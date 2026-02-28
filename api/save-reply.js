import { Redis } from "@upstash/redis";
import admin from "firebase-admin";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
}

const adminDb = admin.database();

const ALLOWED_ORIGINS = [
  "https://www.sealedvow.com",
  "https://sealedvow.com",
  "https://sealedvow.vercel.app"
];

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }

  const RATE_LIMIT_WINDOW = 60;
  const MAX_REQUESTS = 8;

  try {
    const ip = getClientIP(req);
    const key = `reply_rate:${ip}`;
    const current = await kv.incr(key);
    if (current === 1) await kv.expire(key, RATE_LIMIT_WINDOW);

    if (current > MAX_REQUESTS) {
      return res.status(429).json({ error: "Too many requests. Please wait a minute." });
    }
  } catch (kvError) {
    console.error("[ReplyRateLimit] KV unavailable:", kvError.message);
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again." });
  }

  const { sessionKey, replyText } = req.body || {};
  if (!sessionKey || typeof sessionKey !== "string" || !/^[a-z0-9]{8}$/.test(sessionKey)) {
    return res.status(400).json({ error: "Invalid request." });
  }

  if (!replyText || typeof replyText !== "string") {
    return res.status(400).json({ error: "Reply is required." });
  }

  const cleanReply = replyText.trim();
  if (cleanReply.length < 1 || cleanReply.length > 500) {
    return res.status(400).json({ error: "Reply must be between 1 and 500 characters." });
  }

  const sanitizedReply = cleanReply
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  try {
    const sessionRef = adminDb.ref(`shared/${sessionKey}`);
    const result = await sessionRef.transaction(current => {
      if (!current) return;
      if (!current.replyEnabled) return;
      if (current.reply && current.reply.text) return;

      return {
        ...current,
        reply: {
          text: sanitizedReply,
          sealedAt: new Date().toISOString(),
        },
      };
    });

    if (!result.committed || !result.snapshot.val()) {
      return res.status(400).json({ error: "Reply is unavailable for this session." });
    }

    return res.status(200).json({ saved: true });
  } catch (error) {
    console.error("[SaveReply] Error:", error.message);
    return res.status(500).json({ error: "Failed to save reply." });
  }
}
