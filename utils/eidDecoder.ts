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
    relationship?: string
  }
  
  export function decodeEidData(): DecodedEidData | null {
    try {
      const params = new URLSearchParams(window.location.search)
  
      const encoded = params.get("r")
  
      if (!encoded) return null
  
      const decoded = decodeURIComponent(atob(encoded))
  
      return JSON.parse(decoded)
    } catch (err) {
      console.error("Failed to decode Eid data:", err)
      return null
    }
  }