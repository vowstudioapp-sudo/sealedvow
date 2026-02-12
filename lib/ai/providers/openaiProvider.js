// ================================================================
// OpenAI Provider (Fallback)
// Pure API calls. No validation. No business rules.
// Uses raw fetch — no SDK dependency.
// ================================================================

const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Generate text content via OpenAI Chat Completions
 */
export async function generateText(prompt, { temperature = 0.7, maxTokens = 500, model, jsonMode = false } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are a concise, natural writer. Follow all instructions exactly. No markdown formatting.' },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenAI HTTP ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}