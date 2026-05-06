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

  // M6: refusal patterns are anchored to the first N characters of trimmed
  // text. Refusals always lead an LLM response; legitimate letters that
  // happen to contain refusal verbs deeper in the body should not match.
  const REFUSAL_CHECK_LENGTH = 50;

  /**
   * M6: detect prompt-scaffolding / role-marker / refusal-pattern / JSON-shape /
   * executable-HTML leakage in AI output. Returns array of violation strings
   * (empty = clean).
   *
   * Each category emits AT MOST ONE violation per call (first-hit-per-category
   * via `.find()`). One PROMPT_LEAK or one REFUSAL is enough to know the output
   * is poisoned — emitting 14 violations from one poisoned dump produces
   * unreadable logs without adding signal.
   *
   * Refusal patterns are VERB-SPECIFIC (require an actual refusal verb after
   * "cannot" / "sorry, but" / "unable to"). This avoids false positives on
   * "I cannot wait" or "I'm sorry, but I love you" — the verb suffix is the
   * primary distinguisher between an LLM refusal and legitimate love-letter
   * prose. Refusals are additionally anchored to the first 50 chars.
   */
  export function detectPromptLeakage(text) {
    if (!text || typeof text !== 'string') return [];
    const violations = [];

    // ----- Prompt scaffolding (B1) — case-sensitive substrings, full text.
    // These tokens appear in api/lib/prompt-templates.js and would never
    // legitimately appear in generated prose. Distinctive enough that case
    // matters (lowercase "user_data" wouldn't be a leak — uppercase is).
    const SCAFFOLDING = [
      'USER_DATA:',
      'STRUCTURE (follow',
      'WORD COUNT:',
      'MUST INCLUDE:',
      'FORMAT RULE:',
      'SENTENCE RULE:',
      'ABSOLUTE RULES',
      'LUXURY = RESTRAINT',
      'VOICE PRESERVATION',
      'Paragraph 1:', 'Paragraph 2:', 'Paragraph 3:', 'Paragraph 4:',
      'BRAND_LOCK',
      'OCCASION_CONTRACTS',
    ];
    const scaffoldingHit = SCAFFOLDING.find(m => text.includes(m));
    if (scaffoldingHit) {
      violations.push(`PROMPT_LEAK: ${scaffoldingHit}`);
    }

    // ----- Role markers (B2) — case-insensitive, anchored to start-of-string
    // or newline. Vendor-specific tokens (im_start etc.) and chat-template
    // role lines.
    const ROLE_PATTERNS = [
      /(^|\n)\s*system\s*:/i,
      /(^|\n)\s*assistant\s*:/i,
      /(^|\n)\s*user\s*:/i,
      /<\|im_start\|>/i,
      /<\|im_end\|>/i,
      /<\|endoftext\|>/i,
    ];
    const roleHit = ROLE_PATTERNS.find(re => re.test(text));
    if (roleHit) {
      violations.push(`ROLE_MARKER: ${roleHit.source}`);
    }

    // ----- JSON-shape leakage (B3).
    if (/^\s*\{/.test(text)) {
      violations.push('JSON_LEAK: output starts with {');
    }
    // Distinctive field names from JSON.stringify(safeData) that wouldn't
    // appear in natural prose with quotes around them.
    const FIELD_LEAKS = [
      '"senderName"', '"recipientName"',
      '"senderRawThoughts"', '"relationshipIntent"',
    ];
    const fieldHit = FIELD_LEAKS.find(m => text.includes(m));
    if (fieldHit) {
      violations.push(`FIELD_LEAK: ${fieldHit}`);
    }

    // ----- Refusal patterns (B5) — VERB-SPECIFIC, anchored to first 50 chars.
    //
    // ⚠️ IMPORTANT — DO NOT BROADEN THESE PATTERNS.
    //
    // Do NOT simplify to bare "cannot" / "sorry, but" / "unable to" checks.
    // Legitimate emotional prose frequently uses these openings:
    //   - "I cannot let this end"
    //   - "I cannot imagine life without you"
    //   - "I'm sorry, but I want you to know"
    //   - "I am unable to find the words"
    // The verb-specific suffix (fulfill/generate/provide/assist/help/comply/do)
    // is what distinguishes an LLM refusal from legitimate love-letter phrasing.
    // Removing it would break apology-occasion letters and emotional declarations.
    // Keep the verb whitelist tight — refusal-action verbs only.
    //
    // 50-char anchoring is belt-and-suspenders: refusals always lead the response;
    // anchoring also keeps regex computation bounded for long letters.
    const prefix = text.slice(0, REFUSAL_CHECK_LENGTH).toLowerCase();
    const REFUSAL_PATTERNS = [
      // "as an AI" / "as a language model" — anywhere in prefix
      /as an ai\b/,
      /as a language model/,
      // "I cannot/can't FULFILL/GENERATE/HELP/etc." — verb-specific
      /i (?:cannot|can'?t) (?:fulfill|generate|help|assist|comply|provide)/,
      // "I'm sorry, but I cannot/can't/won't VERB" — full refusal phrase
      /i'?m sorry,?\s+but i (?:cannot|can'?t|won'?t) (?:fulfill|generate|do|provide|help|assist)/,
      /i am sorry,?\s+but i (?:cannot|can'?t|won'?t) (?:fulfill|generate|do|provide|help|assist)/,
      // "I'm unable to FULFILL/GENERATE/etc." — verb-specific
      /i'?m unable to (?:fulfill|generate|do|provide|comply|help|assist)/,
      /i am unable to (?:fulfill|generate|do|provide|comply|help|assist)/,
    ];
    const refusalHit = REFUSAL_PATTERNS.find(re => re.test(prefix));
    if (refusalHit) {
      violations.push(`REFUSAL: ${refusalHit.source}`);
    }

    // ----- Executable HTML tags worth rejecting (B7) — script/iframe only.
    //
    // ⚠️ DO NOT expand to generic HTML detection. Letters legitimately contain:
    //   - "<3" (heart emoji)
    //   - quoted angle brackets in dialogue: 'and he whispered "<stay>"'
    //   - emoji-like bracket syntax in informal writing
    // Only flag tags that EXECUTE in a browser. The renderer is plain-text
    // today (React auto-escape), so even <script> renders as literal characters
    // — this check is forward-looking insurance for if rendering ever changes.
    if (/<script\b/i.test(text) || /<iframe\b/i.test(text)) {
      violations.push('HTML_TAG: script/iframe');
    }

    return violations;
  }

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

    // M6: prompt leakage / role markers / refusals / JSON shape / executable HTML.
    const leakage = detectPromptLeakage(text);
    violations.push(...leakage);

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
    const hasLeakage = detectPromptLeakage(text).length > 0;
    return !hasForbidden && !hasLeakage && text.length >= minLength && text.length <= maxLength;
  }