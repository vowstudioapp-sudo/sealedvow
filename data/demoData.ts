import { CoupleData } from '../types';

export interface DemoEntry {
  slug: string;
  data: CoupleData;
}

export const DEMO_DATA: Record<string, CoupleData> = {

  // ═══════════════════════════════════════════════════════════
  // 1. ANNIVERSARY — Pallav → Pragya
  // ═══════════════════════════════════════════════════════════
  anniversary: {
    senderName: 'Pallav',
    recipientName: 'Pragya',
    occasion: 'anniversary',
    theme: 'velvet',
    writingMode: 'assisted',
    timeShared: '4 years together',
    relationshipIntent: 'The person I chose, and keep choosing.',
    sharedMoment: 'That one rainy evening in Jaipur when the power went out and we talked till 3am by candlelight.',
    myth: 'Four years. One promise kept every single day.',
    finalLetter: `Pragya,

Four years ago, I didn't know what I was getting into. I just knew I didn't want to leave.

You've seen the worst version of me — the anxious one, the overthinking one, the one who forgets things but remembers your coffee order in his sleep. And you stayed. Not because it was easy. Because you decided to.

I don't say it enough: you changed how I see mornings. Before you, they were just alarms and traffic. Now they're the first few seconds where I reach over and know you're there.

I still think about that rainy night in Jaipur. No electricity. Just candles and your voice and the kind of quiet that makes you say things you've been holding in for months. That was the night I knew this wasn't temporary.

I'm not perfect. But I'm yours. That's the only title I care about.

Happy anniversary. Not because the calendar says so — but because every day with you feels like one.

Always,
Pallav`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=450p7goxZqg',
    userImageUrl: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80', caption: 'That first trip together', angle: -5, xOffset: -20, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&q=80', caption: 'Rainy evening walks', angle: 3, xOffset: 30, yOffset: -15 },
      { url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&q=80', caption: 'Coffee mornings', angle: -8, xOffset: -40, yOffset: 25 },
      { url: 'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=600&q=80', caption: 'Watching the sunset', angle: 6, xOffset: 15, yOffset: -30 },
      { url: 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=600&q=80', caption: 'Late night conversations', angle: -3, xOffset: -10, yOffset: 5 },
      { url: 'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=600&q=80', caption: 'Our favorite spot', angle: 7, xOffset: 25, yOffset: -20 },
    ],
    sacredLocation: {
      placeName: 'Nahargarh Fort, Jaipur',
      description: 'Where we watched the city light up below us and promised to keep showing up.',
      googleMapsUri: 'https://maps.google.com/?q=Nahargarh+Fort+Jaipur',
      latLng: { lat: 26.9376, lng: 75.8154 },
    },
    locationMemory: 'The fort where we sat on that wall and you told me what love actually means to you.',
    coupons: [
      { id: 'c1', title: 'One Uninterrupted Sunday', description: 'No phone. No plans. Just us and nowhere to be.', icon: '☀️', isOpen: false },
      { id: 'c2', title: 'Your Favorite Dinner, Made By Me', description: 'I will cook. You will judge. Deal.', icon: '🍽️', isOpen: false },
      { id: 'c3', title: 'A Drive With No Destination', description: 'Your playlist. My driving. No GPS.', icon: '🚗', isOpen: false },
    ],
    hasGift: true,
    giftType: 'voyage',
    giftTitle: 'Weekend in Udaipur',
    giftNote: 'Two nights. Lake view. No laptops. Just us remembering why we started.',
    giftLink: 'https://www.booking.com',
  },

  // ═══════════════════════════════════════════════════════════
  // 2. VALENTINES — Rahul → Richa
  // ═══════════════════════════════════════════════════════════
  valentines: {
    senderName: 'Rahul',
    recipientName: 'Richa',
    occasion: 'valentine',
    theme: 'crimson',
    writingMode: 'assisted',
    timeShared: '2 years, 3 months',
    relationshipIntent: 'You are the reason I stopped being afraid of permanence.',
    sharedMoment: 'When you held my hand during the turbulence on that Goa flight and whispered "I got you" like it was nothing.',
    myth: 'Two hearts. One flight that changed everything.',
    finalLetter: `Richa,

I used to think Valentine's Day was performative. Roses that die, cards that say what someone else wrote, dinners where you dress up to sit across from someone you already know.

Then I met you.

Now I understand. It's not about the day. It's about having someone worth pausing for. Someone who makes you want to say out loud what you usually keep inside.

So here it is: I love the way you argue with auto drivers. I love that you cry at dog reels but pretend you didn't. I love that you remember the name of every waiter who's ever been kind to us.

You make ordinary things sacred. A Tuesday. A cup of chai. A flight to Goa where you grabbed my hand and said three words that rearranged my entire nervous system.

I don't need a special day to tell you this. But I'll take any excuse.

You are my favorite person in any room.

Yours,
Rahul`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=lp-EO5I60KA',
    userImageUrl: 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76cb?w=600&q=80', caption: 'Beach sunsets', angle: -4, xOffset: -15, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1529542407532-fadda4e66a36?w=600&q=80', caption: 'Dancing in the rain', angle: 5, xOffset: 25, yOffset: -10 },
      { url: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=600&q=80', caption: 'Our first dinner', angle: -7, xOffset: -35, yOffset: 20 },
      { url: 'https://images.unsplash.com/photo-1499678329028-101435549a4e?w=600&q=80', caption: 'Road trips', angle: 3, xOffset: 20, yOffset: -25 },
      { url: 'https://images.unsplash.com/photo-1531747118685-ca8fa6e08806?w=600&q=80', caption: 'Lazy Sundays', angle: -2, xOffset: -5, yOffset: 15 },
    ],
    sacredLocation: {
      placeName: 'Baga Beach, Goa',
      description: 'Where we walked barefoot at midnight and you told me your biggest fear.',
      googleMapsUri: 'https://maps.google.com/?q=Baga+Beach+Goa',
      latLng: { lat: 15.5551, lng: 73.7514 },
    },
    locationMemory: 'That midnight walk on Baga where the waves were louder than our thoughts.',
    coupons: [
      { id: 'c1', title: 'Breakfast in Bed', description: 'Paranthas, chai, and no alarm clock.', icon: '🥞', isOpen: false },
      { id: 'c2', title: 'Movie Night — Your Pick', description: 'Even if it\'s that one again. Yes, that one.', icon: '🎬', isOpen: false },
      { id: 'c3', title: 'One Full Day of No Complaints', description: 'About anything. Even the thermostat.', icon: '🤐', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'The Necklace You Looked At Twice',
    giftNote: 'You thought I didn\'t notice. I did.',
    giftLink: 'https://www.amazon.in',
  },

  // ═══════════════════════════════════════════════════════════
  // 3. FRIENDSHIP — Ajmal → Yash
  // ═══════════════════════════════════════════════════════════
  friendship: {
    senderName: 'Ajmal',
    recipientName: 'Yash',
    occasion: 'just-because',
    theme: 'midnight',
    writingMode: 'assisted',
    timeShared: '7 years of chaos',
    relationshipIntent: 'The one person who never needed a reason to show up.',
    sharedMoment: 'When you drove 4 hours at 2am because I called and said nothing — you just knew.',
    myth: 'Seven years. One phone call that said everything without a word.',
    finalLetter: `Yash,

I don't write letters. You know that. But some things should exist outside of WhatsApp forwards and Instagram stories.

You're the only person who's seen me break down and didn't try to fix it. You just sat there. In the car. At 2am. Four hours from your house. Because I called, said nothing, and you drove anyway.

That's not friendship. That's something they don't have a word for.

We've built companies that failed, eaten meals we couldn't afford, laughed at things that weren't funny to anyone else. You've never once made me feel like I owed you something for being there.

I owe you anyway. Not money. Not favors. Just this: the acknowledgment that my life is better because you're in it. Louder, messier, more honest.

You're not my brother by blood. You're my brother by every choice that matters.

No occasion. Just overdue honesty.

— Ajmal`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=RBumgq5yVrA',
    userImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&q=80', caption: 'The road trips', angle: -6, xOffset: -20, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600&q=80', caption: 'Late night food runs', angle: 4, xOffset: 30, yOffset: -10 },
      { url: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76cb?w=600&q=80', caption: 'Beach weekends', angle: -3, xOffset: -30, yOffset: 20 },
      { url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80', caption: 'Celebrating small wins', angle: 7, xOffset: 15, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=600&q=80', caption: 'Every stupid plan we made', angle: -5, xOffset: -10, yOffset: 5 },
    ],
    coupons: [
      { id: 'c1', title: 'One Business Idea I\'ll Actually Listen To', description: 'Full attention. No eye-rolling. 30 whole minutes.', icon: '💡', isOpen: false },
      { id: 'c2', title: 'Your Next Trip — I\'m In', description: 'Wherever. Whenever. No excuses this time.', icon: '✈️', isOpen: false },
      { id: 'c3', title: 'One Honest Conversation', description: 'About the things we keep dodging. No jokes. Just real.', icon: '🤝', isOpen: false },
    ],
    hasGift: false,
  },

  // ═══════════════════════════════════════════════════════════
  // 4. I AM SORRY — Shireen → Ayesha
  // ═══════════════════════════════════════════════════════════
  sorry: {
    senderName: 'Shireen',
    recipientName: 'Ayesha',
    occasion: 'apology',
    theme: 'obsidian',
    writingMode: 'assisted',
    timeShared: '12 years of sisterhood',
    relationshipIntent: 'You deserved better from me. This is me admitting it.',
    sharedMoment: 'When we sat in your kitchen after the fight and neither of us spoke for twenty minutes — but neither of us left.',
    myth: 'Twelve years. One silence that held more love than any apology.',
    userImageUrl: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80', caption: 'The kitchen conversations', angle: -4, xOffset: -25, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1509099652299-30938b0aebe0?w=600&q=80', caption: 'Walking through everything together', angle: 5, xOffset: 20, yOffset: -15 },
      { url: 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=600&q=80', caption: 'Laughing through the chaos', angle: -6, xOffset: -15, yOffset: 20 },
      { url: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&q=80', caption: 'The bond that survives everything', angle: 3, xOffset: 30, yOffset: -5 },
      { url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80', caption: 'Every celebration, side by side', angle: -2, xOffset: -10, yOffset: 25 },
    ],
    finalLetter: `Ayesha,

I've been rehearsing this in my head for weeks. Every version sounds like an excuse. So I'm throwing away the script.

I hurt you. Not by accident. By carelessness. By assuming you'd always understand, always forgive, always be the bigger person. That's not fair. It never was.

You called me out and I got defensive. That was wrong. You weren't attacking me — you were telling me the truth. And I punished you for it by going silent.

Twelve years. You've held my secrets, my breakdowns, my worst days. You showed up at the hospital when my mother was sick before I even finished the sentence. You babysat my anxiety like it was your job.

And I couldn't handle one honest conversation.

I'm not asking you to pretend it didn't happen. I'm asking you to let me earn back what I damaged. Slowly. Without shortcuts.

You are the most important person in my life outside of blood. And even blood hasn't shown up the way you have.

I'm sorry. Not the kind that wants to move on. The kind that wants to do better.

With everything I have,
Shireen`,
    coupons: [
      { id: 'c1', title: 'One Weekend — Just Us', description: 'Like before. Chai, gossip, and pretending we\'re 22.', icon: '💛', isOpen: false },
      { id: 'c2', title: 'The Conversation We Need To Have', description: 'No running. No deflecting. I\'ll listen first.', icon: '🫂', isOpen: false },
    ],
    hasGift: false,
  },

  // ═══════════════════════════════════════════════════════════
  // 5. THANK YOU — Arjun → Mother
  // ═══════════════════════════════════════════════════════════
  thankyou: {
    senderName: 'Arjun',
    recipientName: 'Ma',
    occasion: 'thank-you',
    theme: 'pearl',
    writingMode: 'assisted',
    timeShared: '26 years of being your son',
    relationshipIntent: 'Everything I am started in your kitchen.',
    sharedMoment: 'When I got my first salary and you refused the money but kept the envelope in your cupboard for three years.',
    myth: 'Twenty-six years. One envelope that told the whole story.',
    finalLetter: `Ma,

You won't expect this. You'll probably read it twice, cry once, and then call me to ask if I've eaten. That's exactly who you are.

I've never said this properly: thank you. Not for the big things — you already know those. For the small ones you think no one noticed.

Thank you for ironing my shirt the night before my first interview even though I told you I'd do it myself. You knew I wouldn't.

Thank you for pretending my first salary was enough to be proud of. I saw you keep that envelope. I never told you. But I saw.

Thank you for waking up at 5am every day of my board exams to make sure there was food before I asked. You never complained. Not once.

Thank you for loving me in a language that doesn't need words — just paranthas at the right time and questions I didn't want to answer but needed to hear.

I'm not the son who says these things. But I'm trying to become one.

You didn't just raise me. You built me. And everything good in me has your fingerprints on it.

Your son,
Arjun`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=nGt_JDJT9wI',
    userImageUrl: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=600&q=80', caption: 'Home cooked meals', angle: -5, xOffset: -20, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1484665754804-74b091211472?w=600&q=80', caption: 'Morning chai routine', angle: 4, xOffset: 25, yOffset: -15 },
      { url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80', caption: 'Every small celebration', angle: -7, xOffset: -30, yOffset: 20 },
      { url: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76cb?w=600&q=80', caption: 'Weekend walks', angle: 6, xOffset: 15, yOffset: -25 },
      { url: 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=600&q=80', caption: 'The quiet moments', angle: -3, xOffset: -5, yOffset: 5 },
      { url: 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=600&q=80', caption: 'Always there', angle: 2, xOffset: 35, yOffset: -10 },
    ],
    coupons: [
      { id: 'c1', title: 'A Day Where You Don\'t Cook', description: 'I\'m ordering in. You\'re sitting down. Non-negotiable.', icon: '🍛', isOpen: false },
      { id: 'c2', title: 'That Temple Trip You Keep Mentioning', description: 'Booked. Planned. You just show up.', icon: '🛕', isOpen: false },
      { id: 'c3', title: 'A Photo Together — A Real One', description: 'Not a selfie. A proper one. Framed.', icon: '📸', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'New Phone — The One You Said Was "Too Expensive"',
    giftNote: 'Nothing is too expensive for the person who gave me everything for free.',
    giftLink: 'https://www.amazon.in',
  },

  // ═══════════════════════════════════════════════════════════
  // 6. MISSING YOU — Maya → Raj
  // ═══════════════════════════════════════════════════════════
  missingyou: {
    senderName: 'Maya',
    recipientName: 'Raj',
    occasion: 'long-distance',
    theme: 'midnight',
    writingMode: 'assisted',
    timeShared: '14 months across timezones',
    relationshipIntent: 'Distance hasn\'t weakened this. It just made me louder about it.',
    sharedMoment: 'When we stayed on a silent video call for three hours — not talking, just existing in the same screen while doing different things.',
    myth: 'Fourteen months apart. One screen. No words needed.',
    finalLetter: `Raj,

It's 2:47am here. 11:17am where you are. I know because I've memorized your timezone like it's my own address.

I miss you in ways that don't photograph well. Not the cinematic kind. The ordinary kind. The kind where I open the fridge and think about how you'd judge my leftovers. The kind where I laugh at something and reach for my phone before I remember you're asleep.

People keep saying long distance is hard. They're wrong. Long distance isn't hard — it's specific. It's knowing exactly what you're missing. The weight of your hand. The sound you make when you're thinking. The way you say "hmm" when you're not really listening but don't want to admit it.

I keep that three-hour video call in my memory like a photograph. We didn't speak. You were working. I was reading. And somehow that silence across 5,000 miles felt more intimate than anything I've experienced in person.

I don't need you here every day. I need you to know that you're here anyway. In every decision I make, every city I walk through, every morning I wake up and check if you've texted.

The distance is temporary. What I feel is not.

Missing you like breathing,
Maya`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=elsh3J5lJ6g',
    userImageUrl: 'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=600&q=80', caption: 'Video calls at 2am', angle: -4, xOffset: -20, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&q=80', caption: 'Coffee on both sides', angle: 5, xOffset: 25, yOffset: -10 },
      { url: 'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=600&q=80', caption: 'The last sunset before you left', angle: -6, xOffset: -35, yOffset: 20 },
      { url: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76cb?w=600&q=80', caption: 'Marine Drive nights', angle: 3, xOffset: 15, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80', caption: 'When distance felt small', angle: -2, xOffset: -10, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=600&q=80', caption: 'Counting the days', angle: 7, xOffset: 30, yOffset: -5 },
    ],
    sacredLocation: {
      placeName: 'Marine Drive, Mumbai',
      description: 'Where we sat on the rocks the night before you left and didn\'t say goodbye because we both knew we\'d cry.',
      googleMapsUri: 'https://maps.google.com/?q=Marine+Drive+Mumbai',
      latLng: { lat: 18.9432, lng: 72.8235 },
    },
    locationMemory: 'The rocks at Marine Drive. The night before your flight. We sat there until the city went quiet.',
    coupons: [
      { id: 'c1', title: 'Next Visit — I\'m Cooking', description: 'Your comfort food. In my tiny kitchen. No shortcuts.', icon: '🍳', isOpen: false },
      { id: 'c2', title: 'One Full Weekend — Phones Off', description: 'When you\'re back. No friends, no plans. Just catching up on 14 months.', icon: '📵', isOpen: false },
    ],
    hasGift: false,
  },
};

export const DEMO_SLUGS = Object.keys(DEMO_DATA);

export function getDemoData(slug: string): CoupleData | null {
  return DEMO_DATA[slug] || null;
}