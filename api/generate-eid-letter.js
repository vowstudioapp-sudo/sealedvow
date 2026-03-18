import { guardPost, rateLimit } from './lib/middleware.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  const { limited } = await rateLimit(req, {
    keyPrefix: 'eid_letter_generation',
    windowSeconds: 60,
    max: 10,
  });

  if (limited) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const origin = req.headers.origin || (host ? `${protocol}://${host}` : null);

    if (!origin) {
      throw new Error('Unable to resolve API origin');
    }

    const response = await fetch(`${origin}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.origin ? { origin: req.headers.origin } : {}),
      },
      body: JSON.stringify({
        action: 'generateEidLetter',
        payload: req.body || {},
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate Eid letter.' }));
      return res.status(response.status).json(error);
    }

    const json = await response.json();
    return res.status(200).json(json);
  } catch (error) {
    console.error('[generate-eid-letter] failed:', error);
    return res.status(500).json({ error: 'Failed to generate Eid letter.' });
  }
}
