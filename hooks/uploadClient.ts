// ============================================================================
// hooks/uploadClient.ts — Shared upload client (C7)
//
// Mints + caches an upload token, sends it as X-Upload-Token, and retries
// once on 401/403 with a fresh token. Used by useMediaUploads (cover/memory)
// and useAudioRecorder (audio).
// ============================================================================

let cachedToken: string | null = null;
let cachedExpiresAt: number = 0;

/** Force-clear cached token (e.g., on auth failure response). */
function clearToken() {
  cachedToken = null;
  cachedExpiresAt = 0;
}

async function mintToken(sessionId: string): Promise<string> {
  const response = await fetch('/api/prepare-upload-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to prepare upload session');
  }
  const { uploadToken, expiresAt } = await response.json();
  cachedToken = uploadToken;
  cachedExpiresAt = expiresAt;
  return uploadToken;
}

/**
 * Returns a usable token. Refreshes if missing or expiring within 60s
 * (clock-skew buffer between client and server).
 */
async function ensureToken(sessionId: string): Promise<string> {
  if (!cachedToken || Date.now() > cachedExpiresAt - 60_000) {
    return mintToken(sessionId);
  }
  return cachedToken;
}

interface UploadBody {
  sessionId: string;
  file: string; // data URI
  type: 'cover' | 'memory' | 'audio';
  index?: number;
}

/**
 * POST to /api/upload-media with X-Upload-Token. On 401/403, clears the
 * cached token, mints a fresh one, and retries ONCE. Second failure surfaces
 * to the caller as an Error — no further retry to avoid mint storms.
 */
export async function uploadWithAuth(body: UploadBody): Promise<string> {
  const post = async (token: string) =>
    fetch('/api/upload-media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Token': token,
      },
      body: JSON.stringify(body),
    });

  let token = await ensureToken(body.sessionId);
  let response = await post(token);

  if (response.status === 401 || response.status === 403) {
    clearToken();
    token = await mintToken(body.sessionId);
    response = await post(token);
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || 'Upload failed');
  }

  const result = await response.json();
  return result.url;
}
