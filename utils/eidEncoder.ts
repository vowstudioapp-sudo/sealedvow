/*
────────────────────────────────────────────
SealedVow — Eid Link Encoder

Purpose
Convert Eid form data into encoded share link.

Used by:
EidPreparationForm.tsx
────────────────────────────────────────────
*/

export interface EidEncodedPayload {
    recipient?: string
    senderName?: string
    blessing?: string
    eidiAmount?: string
    relationship?: string
  }
  
  export function encodeEidData(data: EidEncodedPayload): string {
  
    try {
  
      const json = JSON.stringify(data)
  
      const encoded = btoa(
        encodeURIComponent(json)
      )
  
      return encoded
  
    } catch (err) {
  
      console.error("Eid encoding failed", err)
  
      return ""
  
    }
  
  }