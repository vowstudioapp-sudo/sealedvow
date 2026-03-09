// ============================================================
// EID DEMO DATA — all 6 relationship demos
// Ported directly from Vow-Eidi.html EXP object
// Used exclusively by EidExperience.tsx
// ============================================================

export interface EidMemory {
  icon: string;
  caption: string;
}

export interface EidDua {
  icon: string;
  text: string;
}

export interface EidDemo {
  recipient: string;
  sender: string;
  moonAwaits: string;
  envFrom: string;
  envSenderSub: string;
  blessing: string;
  letterHeading: string;
  letterMeta: string;
  letterBody: string;
  letterSign: string;
  memTitle: string;
  memSub: string;
  memories: EidMemory[];
  duaTitle: string;
  duaSub: string;
  duas: EidDua[];
  eidiLabel: string;
  eidiFrom: string;
  eidiAmount: string;
  eidiMsg: string;
  closingMain: string;
  closingSender: string;
  senderName: string;  // used in viral chain screen
}

export const EID_DEMOS: Record<string, EidDemo> = {

  'child-parent': {
    recipient: 'Ammi',
    sender: 'Fahad',
    moonAwaits: 'Ammi, a message and eidi awaits you 🌙',
    envFrom: 'A sealed message — especially for you',
    envSenderSub: 'From Fahad ✦ Eid Mubarak',
    blessing: 'May Allah fill your home with peace,\nyour heart with gratitude,\nand your life with barakah.',
    letterHeading: 'Eid Mubarak, Ammi',
    letterMeta: 'From Fahad · Eid ul-Fitr 2026',
    letterBody: `<p>Every Eid, I look for the right words. And every Eid, I realise there aren't enough. So I'll just say what I feel — simply, honestly.</p>
<p>You are the reason our Eids feel special. Not the clothes, not the food — you. The way you wake up before everyone else. The way the whole house smells different on Eid morning because of what you've cooked through the night.</p>
<p>I don't think I've ever properly thanked you for all of that. So today — on this blessed day — I want to say it clearly: <em>JazakAllah Khair, Ammi. For everything.</em></p>
<p>May Allah give you long life, good health, and peace in your heart. May He reward you for every sacrifice you made for us. Eid Mubarak. Your smile today is all I need. 🌙</p>`,
    letterSign: '— Fahad',
    memTitle: 'Our Eid Traditions',
    memSub: 'The moments that make it real',
    memories: [
      { icon: '🍳', caption: 'Eid morning in the kitchen — your sheer khurma no one can replicate' },
      { icon: '🕌', caption: 'Walking to the masjid together while the city is still quiet' },
      { icon: '🍛', caption: 'Your biryani that the whole family waits for all year' },
      { icon: '🤲', caption: 'You asking Allah for all of us — before you ever asked for yourself' },
      { icon: '👗', caption: 'Getting us all dressed and presentable before you thought of yourself' },
      { icon: '🌙', caption: 'Every Eid ending with your dua — the one that always made us cry' },
    ],
    duaTitle: 'My Duas For You',
    duaSub: 'From my heart to yours, Ammi',
    duas: [
      { icon: '🌙', text: 'May Allah grant you long health and keep pain far away from you' },
      { icon: '✨', text: 'May your heart always stay peaceful — you have given so much, may you only receive now' },
      { icon: '🤲', text: 'May Allah accept all your prayers and keep His barakah on you always' },
      { icon: '💛', text: 'May every Eid find you happier and healthier than the last' },
      { icon: '🌸', text: 'May Allah reward you for every sacrifice you made without ever being asked' },
    ],
    eidiLabel: 'Something for you, Ammi 🌙',
    eidiFrom: 'Eidi from Fahad',
    eidiAmount: '₹2,000',
    eidiMsg: '"A small gift with a big dua. May it bring a smile to your face, Ammi. 🌙"',
    closingMain: 'May every Eid bring us closer together.\nMay Allah keep our family united,\nhealthy, and full of His blessings.',
    closingSender: 'Fahad — with all his love 🤍',
    senderName: 'Fahad',
  },

  'parent-child': {
    recipient: 'Zara',
    sender: 'Ammi & Abu',
    moonAwaits: 'Zara, something from Ammi & Abu 🌙',
    envFrom: 'With love — from your parents',
    envSenderSub: 'From Ammi & Abu ✦ Eid Mubarak',
    blessing: 'May Allah always keep you\nunder His protection,\nhappy, healthy, and full of His noor.',
    letterHeading: 'Eid Mubarak, Zara!',
    letterMeta: 'From Ammi & Abu · Eid ul-Fitr 2026',
    letterBody: `<p>Eid Mubarak, beta. Today your Ammi and Abu just want to say one thing — watching you grow up into the person you are is the greatest gift we could have asked for.</p>
<p>You make our home feel complete. On every Eid, when we see you dressed up and smiling — nothing else matters. That image stays with us the whole year.</p>
<p>We don't always say these things. But we feel them every single day. May Allah keep you happy, keep you safe, and keep you always close to us. 🌙</p>
<p>Now go enjoy your Eid. You've earned it, beta.</p>`,
    letterSign: '— Ammi & Abu',
    memTitle: 'Our Eid Moments Together',
    memSub: 'The ones we carry all year',
    memories: [
      { icon: '👗', caption: 'Getting you dressed on Eid morning — always our favourite part of the day' },
      { icon: '📸', caption: 'The family photo on Eid — you always made a face, we always kept it' },
      { icon: '🍽️', caption: 'You at the head of the table, already asking what\'s for dessert' },
      { icon: '🤲', caption: 'Watching you pray — quietly, on your own — that moment stays with us' },
      { icon: '🌙', caption: 'Your first proper Eid salaam — so small, so serious, so perfectly done' },
      { icon: '💛', caption: 'Every Eid hug — the kind that says everything words cannot' },
    ],
    duaTitle: 'Our Duas For You',
    duaSub: 'From Ammi & Abu — always',
    duas: [
      { icon: '🌙', text: 'May Allah keep you happy in this world and the next — always' },
      { icon: '🤲', text: 'May every door of good open for you and every hardship turn to ease' },
      { icon: '💛', text: 'May you always know how deeply, completely, unconditionally you are loved' },
      { icon: '✨', text: 'May Allah protect you wherever you go and bring you always home safely' },
      { icon: '🌸', text: 'May every Eid find you closer to everything good you are working towards' },
    ],
    eidiLabel: 'Your Eidi is here, beta 🌙',
    eidiFrom: 'Eidi from Ammi & Abu',
    eidiAmount: '₹1,000',
    eidiMsg: '"Not as much as our love — but it comes with every dua we have. Eid Mubarak, Zara. 🌙"',
    closingMain: 'You are our everything, Zara.\nMay every Eid find you\nhappier than the last.',
    closingSender: 'Ammi & Abu — forever and always 🤍',
    senderName: 'Ammi & Abu',
  },

  'elder-child': {
    recipient: 'Zohain',
    sender: 'Tabish Chacha',
    moonAwaits: 'Zohain, a message and eidi awaits you 🌙',
    envFrom: 'A sealed message for you, Zohain',
    envSenderSub: 'From Tabish Chacha ✦ Eid Mubarak',
    blessing: 'May Allah fill your life with joy,\nyour path with ease,\nand every Eid bring more smiles\nto your face than the last.',
    letterHeading: 'Eid Mubarak, Zohain!',
    letterMeta: 'From Tabish Chacha · Eid ul-Fitr 2026',
    letterBody: `<p>Eid Mubarak, beta! Every Eid your Chacha thinks about you — about how fast you're growing up, how proud it makes me feel just to watch you become the person you are.</p>
<p>You know what I remember most? Every Eid when you were little — running around in new clothes, asking "Chacha, where's my eidi?" before even saying salaam. 😄 Those memories make me smile every single time.</p>
<p>Now you're older — but in my eyes you'll always be that same little Zohain. And your Chacha's dua for you will never change — <em>may Allah make your life full of success, happiness, and His blessings.</em></p>
<p>Be a good human. Work hard. Make your parents proud — they deserve it more than anyone. And know that your Chacha is always, always in your corner. No matter what. 🌙</p>
<p>Now go enjoy your Eid — and don't forget to do your eidi wala salaam properly! 😄</p>`,
    letterSign: '— Tabish Chacha',
    memTitle: 'Our Eid Memories',
    memSub: 'The moments Chacha still smiles about',
    memories: [
      { icon: '👔', caption: 'New Eid clothes — you\'d always ask to wear them the night before' },
      { icon: '🕌', caption: 'Walking to Eid namaz together while the streets were still quiet' },
      { icon: '💵', caption: 'Running to Chacha for eidi before anyone else even woke up' },
      { icon: '🍽️', caption: 'Family lunch that went on for hours — the way Eid should feel' },
      { icon: '😄', caption: 'Your laugh that could fill up any room — still the same as always' },
      { icon: '🤝', caption: 'Eid milans with the whole family — the noise, the love, the chaos' },
    ],
    duaTitle: "Chacha's Duas For You",
    duaSub: 'Straight from the heart, Zohain',
    duas: [
      { icon: '🌙', text: 'May Allah give you success in everything you put your hands to' },
      { icon: '✨', text: 'May your parents always be proud of you — you have what it takes, beta' },
      { icon: '💪', text: 'May Allah give you strength, wisdom, and a good heart as you grow' },
      { icon: '🤲', text: 'May every door of good open up for you and every hardship pass quickly' },
      { icon: '🌸', text: 'May we celebrate many more Eids together — healthy, happy, and close as family' },
    ],
    eidiLabel: 'Chacha ne bheja hai — sirf tumhare liye 🌙',
    eidiFrom: 'Eidi from Tabish Chacha',
    eidiAmount: '₹500',
    eidiMsg: '"Thodi si eidi, aur bahut saari duaein. Eid Mubarak Zohain! 🌙"',
    closingMain: 'May every Eid remind you\nhow loved you are, Zohain.\nYour Chacha is always proud of you.',
    closingSender: 'Tabish Chacha — with lots of love & dua 🤲',
    senderName: 'Tabish Chacha',
  },

  'sibling': {
    recipient: 'Sara',
    sender: 'Amir Bhai',
    moonAwaits: 'Sara, something is waiting for you 🌙',
    envFrom: "Yes it's from your annoying Bhai 😄",
    envSenderSub: 'From Amir Bhai ✦ Eid Mubarak',
    blessing: 'May Allah always keep you happy,\nprotected, and surrounded by good people.\n(And may you always be nice to your Bhai 😄)',
    letterHeading: 'Eid Mubarak, Sara! 🌙',
    letterMeta: 'From your Bhai · Eid ul-Fitr 2026',
    letterBody: `<p>Okay fine. I'll say the nice things once a year. Today is that day. Don't get used to it. 😄</p>
<p>Honestly Sara — growing up with you wasn't always easy. You were annoying. You still are. But I also know that you're one of the kindest, most genuine people I know. And I'm proud to call you my little sister.</p>
<p>You work hard, you care deeply, and you handle things that most people would fall apart over. I see that even when I don't say it. Your Bhai notices. 🌙</p>
<p>May this Eid bring you everything you've been wishing for. And may you always have a Bhai as amazing as me. 😄 Eid Mubarak, Sara. For real.</p>`,
    letterSign: '— Amir Bhai (your favourite person, admit it)',
    memTitle: 'Our Sibling Eid Moments',
    memSub: "The ones we'll laugh about forever",
    memories: [
      { icon: '👗', caption: 'Fighting over who looks better in Eid clothes — you always won, I\'ll admit it' },
      { icon: '💵', caption: 'Comparing eidi amounts and deciding who got more — every single year' },
      { icon: '😂', caption: 'That one time you cried at Eid because your outfit didn\'t match' },
      { icon: '🍛', caption: 'Sneaking into the kitchen before everyone woke up and finishing the sheer khurma' },
      { icon: '📸', caption: 'The family photo where we both made the same face — still cannot explain it' },
      { icon: '🤝', caption: 'But at the end of every Eid — always together, always us' },
    ],
    duaTitle: "Bhai's Duas For You",
    duaSub: 'I mean it, every single word',
    duas: [
      { icon: '🌙', text: 'May Allah give you a life full of happiness — you deserve every bit of it' },
      { icon: '💪', text: "May every hardship you're facing right now turn into something good very soon" },
      { icon: '🤍', text: 'May we celebrate many more Eids together — healthy, happy, and always close' },
      { icon: '✨', text: 'May Allah protect you and keep you surrounded by people who deserve you' },
      { icon: '😄', text: 'And may you always have a Bhai this amazing. Ameen. (Say ameen.)' },
    ],
    eidiLabel: "Your Bhai's eidi — open it 😄",
    eidiFrom: 'Eidi from Amir Bhai',
    eidiAmount: '₹200',
    eidiMsg: '"Don\'t spend it all in one place. Happy Eid Sara — love you (don\'t tell anyone) 😄🌙"',
    closingMain: 'Eid Mubarak Sara.\nBeing your Bhai is one of\nthe best things that ever happened to me.',
    closingSender: 'Amir Bhai — your annoying but loving brother 😄🤍',
    senderName: 'Amir Bhai',
  },

  'friend': {
    recipient: 'Hamza',
    sender: 'Bilal',
    moonAwaits: 'Hamza, your friend has something for you 🌙',
    envFrom: "Open it yaar — it's from Bilal",
    envSenderSub: 'From Bilal ✦ Eid Mubarak',
    blessing: 'May Allah bless you, your family,\nand give you all the good things\nyou\'ve been working towards.',
    letterHeading: 'Eid Mubarak Hamza! 🌙',
    letterMeta: 'From Bilal · Eid ul-Fitr 2026',
    letterBody: `<p>Bhai Eid Mubarak! Sent you this properly this year because a WhatsApp "Eid Mubarak 🌙" felt like not enough for someone like you.</p>
<p>Honestly yaar — it's rare to have a friend who's genuinely happy when things go right for you. You're that friend. And I don't think I say it enough but having you around is something I'm genuinely grateful for.</p>
<p>This year has been a lot for both of us. But we're here, we're good, and it's Eid. May Allah make the next year even better for you — in every single way. 🌙</p>
<p>Now go eat biryani and enjoy your day. Eid Mubarak, yaar. For real. 😄</p>`,
    letterSign: '— Bilal (your best friend, obviously)',
    memTitle: 'Our Eid Memories',
    memSub: 'The ones only we remember',
    memories: [
      { icon: '🕌', caption: 'Eid namaz together — every year without fail, the tradition continues' },
      { icon: '🍛', caption: "Jumping between houses for biryani — yours, mine, whoever's was best that day" },
      { icon: '😂', caption: 'That Eid we were late for namaz and ran in our new clothes 😭' },
      { icon: '🎉', caption: 'Every Eid Milan where we always ended up in the same corner talking' },
      { icon: '☕', caption: 'The post-Eid chai that always turned into a 3-hour conversation' },
      { icon: '🤝', caption: 'Eleven Eids in. Same friend. Same loyalty. Always.' },
    ],
    duaTitle: 'My Duas For You',
    duaSub: 'Said with full sincerity, Hamza',
    duas: [
      { icon: '🌙', text: "May Allah bless everything you're building right now — you're closer than you think" },
      { icon: '✨', text: "May this year bring you the things you've been quietly waiting for" },
      { icon: '🤲', text: "May our friendship stay strong — few people have a friend like you, and I know I'm lucky" },
      { icon: '💪', text: 'May every hardship pass quickly and every good thing multiply' },
      { icon: '😄', text: 'And may the biryani at your place this Eid be the best it has ever been' },
    ],
    eidiLabel: 'A little something from your yaar 🌙',
    eidiFrom: 'Eidi from Bilal',
    eidiAmount: '₹100',
    eidiMsg: '"Symbolic hai yaar 😄 But the dua is fully real. Eid Mubarak Hamza! 🌙"',
    closingMain: 'Eid Mubarak Hamza.\nMay this Eid be the start\nof a great year for you.',
    closingSender: 'Bilal — your friend, always 🤝🌙',
    senderName: 'Bilal',
  },

  'relative-family': {
    recipient: 'the family',
    sender: 'Khalid Bhai',
    moonAwaits: 'A special Eidi for the whole family 🌙',
    envFrom: 'From Khalid Bhai — for everyone',
    envSenderSub: 'From Khalid Bhai ✦ Eid Mubarak',
    blessing: 'May Allah bless every child\nin this family with happiness,\nhealth, and His endless mercy.',
    letterHeading: 'Eid Mubarak — to the whole family!',
    letterMeta: 'From Khalid Bhai · Eid ul-Fitr 2026',
    letterBody: `<p>Eid Mubarak to everyone! This year I couldn't be there in person, but that doesn't mean the eidi stops. 😄</p>
<p>I've been thinking about all the kids and how fast they're growing up — each one of them is special to me. So I wanted to do something a little different this year.</p>
<p>Each child has their own eidi waiting. Tell them to tap their pouch and open it. May Allah bless every single one of them. 🌙</p>
<p>To Bhai and Bhabhi — thank you for keeping this door open every year. You don't know what it means to someone far away.</p>`,
    letterSign: '— Khalid Bhai',
    memTitle: 'Family Eids We Remember',
    memSub: 'The chaos, the love, all of it',
    memories: [
      { icon: '🏠', caption: 'The whole family together — the noise alone was worth everything' },
      { icon: '🍛', caption: "That legendary biryani — everyone claims the recipe, nobody agrees" },
      { icon: '💵', caption: 'The kids lined up for eidi — smallest to tallest, every single year' },
      { icon: '🤝', caption: 'The Eid Milan that somehow always went on until midnight' },
      { icon: '📸', caption: 'The group photo where someone was always blinking — we kept it anyway' },
      { icon: '🌙', caption: 'Late night chai on the rooftop — the city quiet, the family loud' },
    ],
    duaTitle: 'My Duas For This Family',
    duaSub: 'Each one of you, always',
    duas: [
      { icon: '🌙', text: 'May Allah keep every child in this family safe, happy, and full of His blessings' },
      { icon: '🤲', text: "May this family always stay united — distance doesn't change that" },
      { icon: '✨', text: 'May every Eid bring us closer — in person or not, we are always family' },
      { icon: '💛', text: 'May Bhai and Bhabhi be rewarded for every door they have kept open' },
      { icon: '🌸', text: 'May the kids grow up knowing they are loved — from near and from far' },
    ],
    eidiLabel: 'One eidi for each child 🌙',
    eidiFrom: 'Eidi from Khalid Bhai',
    eidiAmount: '₹300 each',
    eidiMsg: '"Duur se — lekin dil se. Eid Mubarak! 🌙"',
    closingMain: 'Eid Mubarak to every single one of you.\nDistance means nothing.\nYou are always in my heart.',
    closingSender: 'Khalid Bhai — with love from far away 🌙',
    senderName: 'Khalid Bhai',
  },
};