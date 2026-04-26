// ============================================================================
// /api/lib/prompt-templates.js — Server-Side Prompt Construction
//
// OCCASION_CONTRACTS and BRAND_LOCK live here, NOT in the client bundle.
// These define SealedVow's proprietary tone architecture.
// ============================================================================

const OCCASION_CONTRACTS = {
    valentine: {
      structure: `
        Paragraph 1: Present-day feeling. No backstory, no "from the moment". Start with right now.
        Paragraph 2: One specific detail about them — a habit, a trait, something you noticed recently.
        Paragraph 3: A simple forward-looking line. Not an eternal promise. Just what you want next.`,
      wordRange: [130, 160],
      paragraphs: 3,
      mustInclude: ['one sensory or real-world detail', 'one direct "I love" statement'],
      forbidden: ['destiny', 'universe', 'soulmate', 'forever and always', 'stars aligned', 'meant to be', 'other half'],
      tone: 'intimate, modern, real. Like talking to them on a quiet night.',
    },
    anniversary: {
      structure: `
        Paragraph 1: Reference passage of time directly — the years, months, or seasons.
        Paragraph 2: What changed. How you grew. What you learned.
        Paragraph 3: A specific shared memory.
        Paragraph 4: Where you're headed. Steady, not dramatic.`,
      wordRange: [150, 180],
      paragraphs: 4,
      mustInclude: ['a time marker (years/months/seasons)', 'acknowledgment of growth or change'],
      forbidden: ['from the moment I saw you', 'fairy tale', 'love story', 'chapter', 'journey together', 'happily ever after'],
      tone: 'mature, steady, layered. Like someone who has been through things and is still here.',
    },
    'just-because': {
      structure: `
        Paragraph 1: Casual opening. No grand setup. Just start talking.
        Paragraph 2: A small appreciation or random thought about them.`,
      wordRange: [80, 100],
      paragraphs: 2,
      mustInclude: ['something ordinary — chai, a laugh, a random text, a habit'],
      forbidden: ['big declarations', 'heavy romantic escalation', 'eternal', 'always', 'I cannot imagine life without'],
      tone: 'spontaneous, relaxed, human. Should feel like a long text message, not a letter.',
    },
    apology: {
      structure: `
        First sentence: Acknowledge fault directly. Name the action. No softening.
        Paragraph 1: What you did and why it was wrong. No justifications.
        Paragraph 2: What you will do differently. Be specific.
        Optional Paragraph 3: One line about what they mean to you. Brief.`,
      wordRange: [90, 120],
      paragraphs: 3,
      mustInclude: ['direct ownership of specific action', 'one concrete behavior change commitment'],
      forbidden: ['if I hurt you', 'you misunderstood', 'I was just trying to', 'but you also', 'self-pity', 'romantic escalation', 'you complete me'],
      tone: 'accountable, calm, grounded. No begging. No drama. Just clarity.',
    },
    'thank-you': {
      structure: `
        Paragraph 1: Clear appreciation for a specific action or pattern they do.
        Paragraph 2: Why it mattered. What it meant. How it made you feel.`,
      wordRange: [80, 110],
      paragraphs: 2,
      mustInclude: ['a specific action, event, or behavior being thanked'],
      forbidden: ['romantic escalation', 'love declarations unless relevant', 'flowery adjectives', 'you are my everything', 'I do not deserve you'],
      tone: 'sincere, simple, direct. Like thanking someone who actually helped you.',
    },
  };
  
  const BRAND_LOCK = `
  ABSOLUTE RULES — NEVER VIOLATE:
  - Short to medium sentences. Average 10-15 words per sentence.
  - No metaphors. Zero. Not even "subtle" ones.
  - No cosmic language: destiny, universe, stars, fate, celestial, cosmic.
  - No dramatic monologues. No rhetorical questions.
  - No abstract nouns: journey, chapter, story, canvas, tapestry, symphony.
  - No literary language: "intertwined", "blossomed", "woven", "etched".
  - Sound like a real person speaking honestly, not a writer performing.
  - No formal sign-off. No "Yours truly". No "With all my love". Just end naturally.
  - Every paragraph must contain at least one specific, concrete detail.
  - If the letter reads like literature or poetry, rewrite it more simply.
  
  LUXURY = RESTRAINT. Less is more. Simple is premium.`;
  
  /**
   * Builds the complete letter generation prompt from raw couple data.
   * This runs server-side only — the client never sees the templates.
   *
   * @param {Object} data - Raw couple data fields from the client
   * @returns {{ prompt: string, enforcement: Object }}
   */
  export function buildLetterPrompt(data) {
    const contract = OCCASION_CONTRACTS[data.occasion] || OCCASION_CONTRACTS.valentine;
    const hasSenderWords = data.senderRawThoughts && data.senderRawThoughts.trim().split(/\s+/).length >= 5;
  
    const senderKeyPhrases = hasSenderWords
      ? data.senderRawThoughts.trim()
          .split(/[.!?\n]+/)
          .map(s => s.trim())
          .filter(s => s.length > 10)
          .slice(0, 6)
      : [];
  
    const senderVoiceBlock = hasSenderWords
      ? `
  SENDER'S OWN WORDS (CRITICAL — preserve these):
  """
  ${data.senderRawThoughts}
  """
  
  VOICE PRESERVATION RULES:
  - Preserve the sender's exact key phrases verbatim. Do not paraphrase them.
  - Do not replace their nouns or verbs unless grammatically required.
  - Do not introduce new adjectives they did not use.
  - Do not add emotional claims the sender did not make.
  - Do not elevate casual language into literary language.
  - If the sender wrote "I miss your stupid laugh" — that exact phrase stays.
  - Only reorganize into paragraph structure. Minimal polish.
  `
      : '';
  
    const prompt = `You are writing a short personal letter from ${data.senderName} to ${data.recipientName}.
  
  OCCASION: ${(data.occasion || 'valentine').toUpperCase().replace('-', ' ')}
  RELATIONSHIP CONTEXT: ${data.relationshipIntent || 'romantic partner'}
  TIME TOGETHER: ${data.timeShared || 'some time'}
  A SHARED MEMORY: ${data.sharedMoment || 'time spent together'}
  
  ${senderVoiceBlock}
  
  STRUCTURE (follow exactly):
  ${contract.structure}
  
  WORD COUNT: ${contract.wordRange[0]}–${contract.wordRange[1]} words. Hard limit. Not one word more.
  PARAGRAPHS: Exactly ${contract.paragraphs} paragraphs separated by exactly one blank line.
  No extra blank lines. No bullet points. No markdown. No headers.
  TONE: ${contract.tone}
  
  MUST INCLUDE:
  ${contract.mustInclude.map(r => `- ${r}`).join('\n')}
  
  FORBIDDEN (never use these words or patterns):
  ${contract.forbidden.map(f => `- "${f}"`).join('\n')}
  
  FORMAT RULE: Each paragraph separated by exactly one blank line. No other formatting.
  SENTENCE RULE: Average sentence length must be under 15 words. If a sentence exceeds 20 words, split it.
  
  ${BRAND_LOCK}
  
  Write the letter now. Only the letter text. No title, no greeting like "Dear X", no sign-off. Just the raw paragraphs.`;
  
    const enforcement = {
      occasion: data.occasion,
      wordRange: contract.wordRange,
      paragraphs: contract.paragraphs,
      forbidden: contract.forbidden,
      requiredFields: {
        sharedMoment: data.sharedMoment || '',
        timeShared: data.occasion === 'anniversary' ? (data.timeShared || '') : '',
        senderKeyPhrases,
      },
    };
  
    return { prompt, enforcement };
  }
  
  /**
   * Builds the couple myth prompt server-side.
   */
  export function buildMythPrompt(data) {
    return `Write a very short, abstract "myth" about ${data.senderName} and ${data.recipientName} (2 sentences max).
    Imagine they are two forces of nature or stars.
    Do NOT use their names. Use "The One Who [trait]" format or abstract descriptions.
    Based on this memory: "${data.sharedMoment}".
    Style: Ancient, inscription-like, museum plaque.`;
  }
  
  /**
   * Builds the future prophecy prompt server-side.
   */
  export function buildProphecyPrompt() {
    return `Write 3 very short (5-8 words) poetic captions about the future of a couple.
    Vibe: Cinematic, hopeful, quiet luxury.
    Format: JSON array of strings.
    Example: ["Walking the quiet streets of Kyoto", "Building a home in the mountains", "Growing old in the golden light"]`;
  }