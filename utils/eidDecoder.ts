/*
────────────────────────────────────────────
SealedVow — Eid Link Decoder

Purpose
Decode encoded Eid message data from URL.

Example link:
/eid?r=eyJyZWNpcGllbnQiOiJBbW1pIiwic2VuZGVyTmFtZSI6IkFqbWFsIn0
────────────────────────────────────────────
*/

export interface DecodedEidData {
    recipient?: string
    senderName?: string
    blessing?: string
    eidiAmount?: string
    receiverPhoneNumber?: string
    relationship?: string
    subtype?: string
    mode?: 'assist' | 'self'
  }
  
  export function decodeEidData(): DecodedEidData | null {
    try {
      const params = new URLSearchParams(window.location.search)
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
  
      const encoded = params.get("r")
      const fallback = window.sessionStorage.getItem("eidDecodedData")
  
      if (!encoded && !fallback) return null
  
    // IMPORTANT:
    // sessionStorage fallback is only for receiver links that were normalized to `/eid`
    // without `r` query. It must NOT override demo routes like `/demo/eid/*`.
    const canUseFallback = path === '/eid'

    if (!encoded && fallback && canUseFallback) {
        return JSON.parse(fallback)
      }

      const binary = atob(encoded || "")
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      const decoded = new TextDecoder('utf-8').decode(bytes)
  
      return JSON.parse(decoded)
    } catch (err) {
      console.error("Failed to decode Eid data:", err)
      return null
    }
  }
