// ─────────────────────────────────────────────────────────────────────
// SealedVow — Eid Demo Data
// 
// Contains 6 relationship-specific demo experiences with unique memories
// Routes: /demo/eid/:relationship
// ─────────────────────────────────────────────────────────────────────

export type EidDemoKey = 
  | 'child-parent'
  | 'sibling'
  | 'friend'
  | 'elder-child'
  | 'parent-child'
  | 'relative-family';

export interface EidMemory {
  icon: string;      // Changed from emoji
  caption: string;   // Changed from text
}

export interface EidDemo {
  recipient: string;
  envFrom: string;
  blessing: string;
  
  letterHeading: string;
  letterMeta: string;
  letterBody: string;
  letterSign: string;
  
  memTitle: string;     // Changed from memoryTitle
  memSub: string;       // Changed from memorySubtitle
  memories: EidMemory[];
  
  duaTitle: string;
  duaSub: string;
  duas: Array<{ icon: string; text: string }>;
  
  eidiLabel: string;
  eidiFrom: string;
  eidiAmount: string;
  eidiMsg: string;
  
  closingMain: string;
  closingSender: string;
  
  senderName: string;
}

export const EID_DEMOS: Record<string, EidDemo> = {
  'child-parent': {
    recipient: 'Ammi',
    envFrom: 'From your son',
    blessing: 'May Allah fill your home with peace,\nyour heart with gratitude,\nand your life with barakah.',
    
    letterHeading: 'Eid Mubarak — to Ammi',
    letterMeta: 'FROM YOUR SON · EID UL-FITR 2026',
    letterBody: `<p>Eid Mubarak, Ammi! I wish I could be there this year, but distance doesn't change how much you mean to me.</p><p>Every Eid memory I have starts and ends with you — your sheer khurma, your dua, the way you made sure we all felt special even when things were tight.</p><p>I know I don't say it enough, but everything I am today is because of your duas and your patience. May Allah reward you for every sacrifice you made for us.</p>`,
    letterSign: "— Your son who's always thinking of you",
    
    memTitle: "What You've Given Us",
    memSub: "The traditions we'll never forget",
    memories: [
      { icon: '🍳', caption: 'Eid morning in the kitchen — your sheer khurma no one can replicate' },
      { icon: '🕌', caption: 'Walking to the masjid together while the city is still quiet' },
      { icon: '🍛', caption: 'Your biryani that the whole family waits for all year' },
      { icon: '🤲', caption: 'You asking Allah for all of us — before you ever asked for yourself' },
      { icon: '👗', caption: 'Getting us all dressed and presentable before you thought of yourself' },
      { icon: '🌙', caption: 'Every Eid ending with your dua — the one that always made us cry' },
    ],
    
    duaTitle: 'My Duas for You',
    duaSub: 'What I pray for when I think of you',
    duas: [
      { icon: '🤲', text: 'May Allah grant you health, peace, and endless joy in this life and the next' },
      { icon: '💝', text: 'May every sacrifice you made for us be rewarded a thousand times over' },
      { icon: '🌟', text: 'May your days be filled with light, your heart with contentment, and your home with barakah' },
    ],
    
    eidiLabel: 'Your Eidi from your son',
    eidiFrom: 'With love',
    eidiAmount: '₹5,000',
    eidiMsg: 'For all the times you gave without asking. For all the duas that carried me through.',
    
    closingMain: 'May this Eid bring you\npeace, joy, and countless blessings.\nAmeen.',
    closingSender: 'From your son',
    senderName: 'Your son',
  },

  'sibling': {
    recipient: 'Sara',
    envFrom: 'From your annoying bhai 😄',
    blessing: 'May Allah bless every child\nin this family with happiness,\nhealth, and His endless mercy.',
    
    letterHeading: 'Eid Mubarak — to Sara',
    letterMeta: 'FROM YOUR ANNOYING BHAI · EID UL-FITR 2026',
    letterBody: `<p>Eid Mubarak, Sara! Remember when we used to fight over who got the biggest eidi envelope? Now we're old enough to BE the ones giving eidi. Crazy how fast time moves.</p><p>I know we don't say this stuff out loud, but you've always had my back — even when I didn't deserve it. From covering for me with Ammi to being the only one who actually gets what it's like in our family, you've been real from day one.</p>`,
    letterSign: "— Your bhai who appreciates you (even if he doesn't show it)",
    
    memTitle: 'Our Eid Chaos',
    memSub: 'The moments only we understand',
    memories: [
      { icon: '🎁', caption: 'Fighting over who gets the biggest eidi envelope every single year' },
      { icon: '📸', caption: 'Forcing awkward family photos before Ammi lets us leave' },
      { icon: '🍬', caption: 'Sneaking mithai from the kitchen when no one was looking' },
      { icon: '👔', caption: "You stealing my favorite Eid outfit and pretending you didn't" },
      { icon: '🚗', caption: 'Late-night drives after all the relatives finally left' },
      { icon: '🤝', caption: "Being the only one who really gets what it's like in our family" },
    ],
    
    duaTitle: 'My Duas for You',
    duaSub: 'What I ask Allah for my sister',
    duas: [
      { icon: '🌟', text: 'May Allah guide you, protect you, and grant you success in everything you do' },
      { icon: '💝', text: 'May your heart always find peace, and may your duas be answered' },
      { icon: '🤲', text: 'May you find happiness in this life and the highest place in Jannah' },
    ],
    
    eidiLabel: 'Your Eidi from bhai',
    eidiFrom: 'From your brother',
    eidiAmount: '₹3,000',
    eidiMsg: 'For being real when it mattered. For having my back when I needed it.',
    
    closingMain: 'May this Eid be filled with\njoy, laughter, and good memories.\nAmeen.',
    closingSender: 'From your bhai',
    senderName: 'Your bhai',
  },

  'friend': {
    recipient: 'Hamza',
    envFrom: 'From your friend',
    blessing: 'May Allah bless you\nwith peace, joy,\nand countless blessings.',
    
    letterHeading: 'Eid Mubarak — to Hamza',
    letterMeta: 'FROM YOUR FRIEND · EID UL-FITR 2026',
    letterBody: `<p>Eid Mubarak, bro! Another year, another Eid text at exactly 12:01 AM. You know the drill.</p><p>Real talk though — thanks for being there through everything. From chand raat shopping chaos to late-night existential conversations during Ramadan, you've been solid. Not everyone has friends who show up the way you do.</p>`,
    letterSign: "— Your friend who's grateful for you",
    
    memTitle: 'Our Eid Adventures',
    memSub: 'The memories we made together',
    memories: [
      { icon: '🌃', caption: 'Chand raat at the mall — fighting through crowds for last-minute shopping' },
      { icon: '🍕', caption: 'Late-night iftar runs when we were too lazy to cook' },
      { icon: '📱', caption: 'Eid Mubarak texts at exactly 12:01 AM every year without fail' },
      { icon: '👟', caption: 'New kicks for Eid — comparing who got the better deal' },
      { icon: '🎮', caption: 'Post-Eid gaming sessions after family obligations ended' },
      { icon: '🤲', caption: 'Making dua for each other when life got heavy' },
    ],
    
    duaTitle: 'My Duas for You',
    duaSub: 'What I ask Allah for my brother',
    duas: [
      { icon: '🌟', text: 'May Allah grant you success in everything you pursue' },
      { icon: '💝', text: 'May your heart find peace and your path be filled with light' },
      { icon: '🤲', text: 'May Allah bless you with happiness in this life and Jannah in the next' },
    ],
    
    eidiLabel: 'Your Eidi from your friend',
    eidiFrom: 'From your brother',
    eidiAmount: '₹2,000',
    eidiMsg: 'For all the times you were there. For being solid when it mattered.',
    
    closingMain: 'May this Eid bring you\npeace, joy, and good times.\nAmeen.',
    closingSender: 'From your friend',
    senderName: 'Your friend',
  },

  'elder-child': {
    recipient: 'Zara',
    envFrom: 'From your Khalid Chachu',
    blessing: 'May Allah bless every child\nin this family with happiness,\nhealth, and His endless mercy.',
    
    letterHeading: 'Eid Mubarak — to Zara',
    letterMeta: 'FROM YOUR KHALID CHACHU · EID UL-FITR 2026',
    letterBody: `<p>Eid Mubarak, beta! I still remember the first Eid when you were tiny enough to fit in one hand. Now look at you — growing up so fast it makes my head spin.</p><p>I see so much potential in you, Zara. The way you ask questions, the way you care about people, the way you light up a room when you walk in — that's special. Don't let anyone tell you otherwise.</p>`,
    letterSign: "— Khalid Chachu (who's very proud of you)",
    
    memTitle: 'Watching You Grow',
    memSub: 'The moments that made me proud',
    memories: [
      { icon: '👶', caption: 'Your first Eid when you were just a tiny bundle in our arms' },
      { icon: '🎨', caption: 'The handmade Eid cards you used to draw for everyone' },
      { icon: '📚', caption: 'Watching you win that school award and seeing your face light up' },
      { icon: '🕌', caption: 'The year you started coming to Eid prayer with us by choice' },
      { icon: '💝', caption: 'The way you always save a piece of your Eid mithai for me' },
      { icon: '🌟', caption: "Seeing you become the amazing person we always knew you'd be" },
    ],
    
    duaTitle: 'My Duas for You',
    duaSub: 'What I ask Allah for your future',
    duas: [
      { icon: '🌟', text: 'May Allah guide you to success in everything you do' },
      { icon: '💝', text: 'May your heart always be filled with kindness and your path with light' },
      { icon: '🤲', text: 'May you grow up to be someone who makes the world better' },
    ],
    
    eidiLabel: 'Your Eidi from Chachu',
    eidiFrom: 'With love from Khalid Chachu',
    eidiAmount: '₹5,000',
    eidiMsg: 'For being the bright light in our family. For making us all so proud.',
    
    closingMain: 'May Allah bless you\nwith a beautiful future.\nAmeen.',
    closingSender: 'From Khalid Chachu',
    senderName: 'Khalid Chachu',
  },

  'parent-child': {
    recipient: 'Noor',
    envFrom: 'From your Abbu',
    blessing: 'May Allah fill your home with peace,\nyour heart with gratitude,\nand your life with barakah.',
    
    letterHeading: 'Eid Mubarak — to Noor',
    letterMeta: 'FROM YOUR ABBU · EID UL-FITR 2026',
    letterBody: `<p>Eid Mubarak, my dear Noor! Every Eid that passes, I'm reminded of how blessed I am to be your father. Watching you grow into the person you are today has been the greatest gift of my life.</p><p>I pray that Allah keeps you safe, guides your steps, and fills your heart with peace. I pray that you find success in this life and the next, and that you never forget how much you are loved.</p>`,
    letterSign: '— Your Abbu who loves you more than words can say',
    
    memTitle: 'My Favorite Eid Moments with You',
    memSub: 'What I treasure most',
    memories: [
      { icon: '🌅', caption: 'Waking you up for Fajr on Eid morning when you were little' },
      { icon: '👔', caption: 'Helping you pick out your first "grown-up" Eid outfit' },
      { icon: '📖', caption: 'Teaching you the Eid takbeer and hearing you recite it perfectly' },
      { icon: '🚗', caption: 'Our drives to visit relatives — just you and me talking about life' },
      { icon: '🤲', caption: 'Seeing you make dua with sincerity in your eyes during Eid salah' },
      { icon: '💝', caption: "Realizing you've grown into someone I'm so incredibly proud of" },
    ],
    
    duaTitle: 'My Duas for You',
    duaSub: 'What I ask Allah for my child',
    duas: [
      { icon: '🌟', text: 'May Allah protect you always and guide you to success' },
      { icon: '💝', text: 'May your life be filled with happiness, peace, and barakah' },
      { icon: '🤲', text: 'May you find the best in this life and the highest place in Jannah' },
    ],
    
    eidiLabel: 'Your Eidi from Abbu',
    eidiFrom: 'With all my love',
    eidiAmount: '₹10,000',
    eidiMsg: 'For being the light of my life. For making me proud every single day.',
    
    closingMain: 'May Allah bless you\nwith everything good.\nAmeen.',
    closingSender: 'From your Abbu',
    senderName: 'Your Abbu',
  },

  'relative-family': {
    recipient: 'The whole family',
    envFrom: 'From Khalid Bhai',
    blessing: 'May Allah bless every child\nin this family with happiness,\nhealth, and His endless mercy.',
    
    letterHeading: 'Eid Mubarak — to the whole family!',
    letterMeta: 'FROM KHALID BHAI · EID UL-FITR 2026',
    letterBody: `<p>Eid Mubarak to everyone! This year I couldn't be there in person, but that doesn't mean the eidi stops. 😊</p><p>I've been thinking about all the kids and how fast they're growing up — each one of them is special to me. So I wanted to do something a little different this year.</p><p>Each child has their own eidi waiting. Tell them to tap their pouch and open it. May Allah bless every single one of them. 🌙</p>`,
    letterSign: '— Khalid Bhai',
    
    memTitle: 'Our Family Eid',
    memSub: 'The traditions that bind us together',
    memories: [
      { icon: '🏠', caption: 'The entire family cramming into one house on Eid morning' },
      { icon: '👨‍👩‍👧‍👦', caption: 'Watching all the cousins run around like they own the place' },
      { icon: '🍽️', caption: 'The massive feast that somehow never runs out no matter how many show up' },
      { icon: '📸', caption: 'Group photos that take 20 minutes because someone always blinks' },
      { icon: '🎁', caption: 'The chaos of distributing eidi to every single kid' },
      { icon: '☕', caption: 'Elders sipping chai and telling the same stories every year' },
    ],
    
    duaTitle: 'My Duas for All of You',
    duaSub: 'What I ask Allah for this family',
    duas: [
      { icon: '🏠', text: 'May Allah keep this family united, happy, and blessed' },
      { icon: '💝', text: 'May every child grow up healthy, successful, and righteous' },
      { icon: '🤲', text: 'May our gatherings always be filled with love, laughter, and barakah' },
    ],
    
    eidiLabel: 'Eidi for the whole family',
    eidiFrom: 'From Khalid Bhai',
    eidiAmount: '₹15,000',
    eidiMsg: 'To be shared among all the kids. May Allah bless each one of them.',
    
    closingMain: 'May Allah keep us all\nclose, happy, and blessed.\nAmeen.',
    closingSender: 'From Khalid Bhai',
    senderName: 'Khalid Bhai',
  },
};

// Export alias for backward compatibility
export const eidDemos = EID_DEMOS;

// ═════════════════════════════════════════════════════════════════════
// DEMO ROUTING — URL to Data Mapping
// ═════════════════════════════════════════════════════════════════════

// Handle URL aliases for backward compatibility
export function getDemoByKey(key: string): EidDemo | null {
  // Direct match
  if (key in EID_DEMOS) {
    return EID_DEMOS[key];
  }
  
  // Aliases (for URL friendliness)
  const aliases: Record<string, EidDemoKey> = {
    'child': 'child-parent',
    'parent': 'parent-child',
    'brother': 'sibling',
    'sister': 'sibling',
    'bro': 'sibling',
    'uncle': 'elder-child',
    'aunt': 'elder-child',
    'nephew': 'elder-child',
    'niece': 'elder-child',
    'cousin': 'relative-family',
    'family': 'relative-family',
    'relative': 'relative-family',
  };
  
  const normalized = key.toLowerCase();
  if (normalized in aliases) {
    return EID_DEMOS[aliases[normalized]];
  }
  
  return null;
}

// Get all demo keys for routing/nav
export function getAllDemoKeys(): EidDemoKey[] {
  return Object.keys(EID_DEMOS) as EidDemoKey[];
}
