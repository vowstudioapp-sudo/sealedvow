// ================================================================
// VOW Letter Validator
// Provider-agnostic enforcement layer
// ================================================================

export const GLOBAL_FORBIDDEN = [
    'destiny', 'universe', 'soulmate', 'tapestry', 'intertwined', 'celestial',
    'symphony', 'canvas', 'journey together', 'stars aligned', 'meant to be',
    'other half', 'etched', 'blossomed', 'woven', 'beacon', 'chapter of',
    'fairy tale', 'happily ever after', 'two souls'
  ];
  
  /**
   * Validates a generated letter against structural constraints.
   * Returns { valid, violations, stats }
   */
  export function validateLetter(text, enforcement = {}) {
    const violations = [];
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
    const avgSentenceLength = sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
      : 0;
    const lowerText = text.toLowerCase();
  
    // Forbidden words (global + occasion-specific)
    const allForbidden = [...GLOBAL_FORBIDDEN, ...(enforcement.forbidden || [])];
    const foundForbidden = allForbidden.filter(w => lowerText.includes(w.toLowerCase()));
    if (foundForbidden.length > 0) {
      violations.push(`FORBIDDEN_WORDS: ${foundForbidden.join(', ')}`);
    }
  
    // Word count — hard ceiling
    const [minWords, maxWords] = enforcement.wordRange || [80, 200];
    if (wordCount > maxWords + 10) violations.push(`TOO_LONG: ${wordCount} words (max ${maxWords})`);
    if (wordCount < minWords - 15) violations.push(`TOO_SHORT: ${wordCount} words (min ${minWords})`);
  
    // Paragraph count
    const expectedParagraphs = enforcement.paragraphs || 3;
    if (paragraphs.length !== expectedParagraphs && Math.abs(paragraphs.length - expectedParagraphs) > 1) {
      violations.push(`PARAGRAPH_COUNT: ${paragraphs.length} (expected ${expectedParagraphs})`);
    }
  
    // Average sentence length — kills poetic drift
    if (avgSentenceLength > 18) {
      violations.push(`SENTENCES_TOO_LONG: avg ${Math.round(avgSentenceLength)} words (max 18)`);
    }
  
    // Required data fields must appear in output
    if (enforcement.requiredFields) {
      const { sharedMoment, timeShared, senderKeyPhrases } = enforcement.requiredFields;
  
      if (sharedMoment && sharedMoment.length > 10) {
        const momentWords = sharedMoment.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const matchCount = momentWords.filter(w => lowerText.includes(w)).length;
        if (matchCount < Math.min(3, momentWords.length)) {
          violations.push('MISSING_SHARED_MOMENT');
        }
      }
  
      if (timeShared && timeShared.length > 0) {
        const timeWords = timeShared.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matchCount = timeWords.filter(w => lowerText.includes(w)).length;
        if (matchCount === 0) {
          violations.push('MISSING_TIME_SHARED');
        }
      }
  
      if (senderKeyPhrases && senderKeyPhrases.length > 0) {
        const preserved = senderKeyPhrases.filter(phrase => {
          const phraseWords = phrase.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          return phraseWords.filter(w => lowerText.includes(w)).length >= Math.ceil(phraseWords.length * 0.5);
        });
        if (preserved.length < Math.ceil(senderKeyPhrases.length * 0.5)) {
          violations.push(`SENDER_VOICE_LOST: only ${preserved.length}/${senderKeyPhrases.length} phrases preserved`);
        }
      }
    }
  
    // Markdown contamination
    if (text.includes('**') || text.includes('##') || text.includes('- ') || text.includes('* ')) {
      violations.push('MARKDOWN_CONTAMINATION');
    }
  
    return {
      valid: violations.length === 0,
      violations,
      stats: {
        wordCount,
        paragraphCount: paragraphs.length,
        avgSentenceLength: Math.round(avgSentenceLength),
      }
    };
  }
  
  /**
   * Strips markdown formatting from AI output
   */
  export function cleanOutput(text) {
    return text
      .replace(/\*\*/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .trim();
  }
  
  /**
   * Basic validation for non-letter text (myths, prophecies, etc.)
   */
  export function validateBasicText(text, { minLength = 10, maxLength = 500 } = {}) {
    const hasForbidden = GLOBAL_FORBIDDEN.some(w => text.toLowerCase().includes(w));
    return !hasForbidden && text.length >= minLength && text.length <= maxLength;
  }