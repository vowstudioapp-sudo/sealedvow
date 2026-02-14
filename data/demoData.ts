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
    userImageUrl: 'https://images.unsplash.com/photo-1529634597503-139d3726fed5?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80', caption: 'The first morning we didn\'t want to leave', angle: -8, xOffset: -30, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80', caption: 'Walking without a destination — our favorite hobby', angle: 5, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', caption: 'That sunset you made me stop and look at', angle: -3, xOffset: -50, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&q=80', caption: 'Chai at 11pm because neither of us could sleep', angle: 12, xOffset: 20, yOffset: -40 },
      { url: 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=600&q=80', caption: 'The fort where we promised to keep showing up', angle: -6, xOffset: -10, yOffset: 50 },
      { url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&q=80', caption: 'Year three. Still laughing at the same jokes.', angle: 9, xOffset: 60, yOffset: 0 },
    ],
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
    giftLink: 'https://www.makemytrip.com/hotels/hotel-listing/?city=Udaipur',
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
    myth: 'Some people send flowers. He sent the truth.',
    userImageUrl: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80', caption: 'Baga at midnight — waves louder than our thoughts', angle: -5, xOffset: -20, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80', caption: 'The morning you stole my hoodie and never returned it', angle: 8, xOffset: 35, yOffset: -25 },
      { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80', caption: 'You, pretending you didn\'t cry at that dog reel', angle: -10, xOffset: -45, yOffset: 40 },
      { url: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76cb?w=600&q=80', caption: 'Our spot. Every Sunday.', angle: 4, xOffset: 50, yOffset: -10 },
      { url: 'https://images.unsplash.com/photo-1528164344885-47b1492d534c?w=600&q=80', caption: 'The chai stall where you told me your biggest fear', angle: -7, xOffset: 0, yOffset: 55 },
    ],
    finalLetter: `Richa,

I almost didn't write this.

Not because I don't feel it. Because I do. And saying it out loud makes it real in a way I can't take back.

I used to think Valentine's Day was for people who needed a calendar to remind them. Roses that die by Thursday. Cards written by strangers. Dinners where you perform love instead of feeling it.

Then you grabbed my hand on that flight. Turbulence. My knuckles white. And you leaned in and said "I got you" — like it was the most obvious thing in the world.

That's when I understood. Love isn't the big moments. It's the small ones you don't rehearse.

It's the way you argue with auto drivers like you're defending a court case. It's how you cry at dog reels and deny it with mascara still running. It's how you remember the name of every waiter who's ever been kind to us.

You don't just make me a better person. You make me a less afraid one.

Here's what I've been postponing: I need you to know that I think about you in the middle of ordinary moments. Not sunsets. Not songs. Just standing in line at a grocery store, wondering what you'd pick.

I don't need a special day to feel this. But today felt like the right day to finally stop keeping it inside.

If you're reading someone else's letter right now and thinking about the person you haven't told yet — maybe today is your day too.

You are my favorite person in any room. And I'm done being quiet about it.

Yours. Not just today.
Rahul`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=lp-EO5I60KA',
    sacredLocation: {
      placeName: 'Baga Beach, Goa',
      description: 'Where we walked barefoot at midnight and you told me your biggest fear.',
      googleMapsUri: 'https://maps.google.com/?q=Baga+Beach+Goa',
      latLng: { lat: 15.5551, lng: 73.7514 },
    },
    locationMemory: 'That midnight walk on Baga where the waves were louder than our thoughts.',
    coupons: [
      { id: 'c1', title: 'Breakfast in Bed', description: 'Paranthas, chai, and nowhere to be. You stay in bed. I handle the rest.', icon: '🥞', isOpen: false },
      { id: 'c2', title: 'Movie Night — Your Pick', description: 'Even that one you\'ve watched eleven times. I won\'t say a word.', icon: '🎬', isOpen: false },
      { id: 'c3', title: 'One Full Day Without My Phone', description: 'Just you. No scrolling. No notifications. You have my full attention.', icon: '📵', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'The Necklace You Looked At Twice',
    giftNote: 'In that store. You touched it, checked the price, and put it back. You thought I wasn\'t looking. I was.',
    giftLink: 'https://www.caratlane.com/jewellery/necklaces.html',
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
    userImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=600&q=80', caption: 'The road trip that almost killed us but made us brothers', angle: -6, xOffset: -25, yOffset: 20 },
      { url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600&q=80', caption: 'Celebrating nothing. Our specialty.', angle: 7, xOffset: 40, yOffset: -15 },
      { url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80', caption: 'The startup that failed but the friendship didn\'t', angle: -4, xOffset: -40, yOffset: 35 },
      { url: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&q=80', caption: '3am conversations that fixed nothing and everything', angle: 11, xOffset: 30, yOffset: -35 },
      { url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=600&q=80', caption: 'The only person whose bad ideas I still say yes to', angle: -9, xOffset: -5, yOffset: 45 },
    ],
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
    coupons: [
      { id: 'c1', title: 'One Business Idea I\'ll Actually Listen To', description: 'Full attention. No eye-rolling. 30 whole minutes.', icon: '💡', isOpen: false },
      { id: 'c2', title: 'Your Next Trip — I\'m In', description: 'Wherever. Whenever. No excuses this time.', icon: '✈️', isOpen: false },
      { id: 'c3', title: 'One Honest Conversation', description: 'About the things we keep dodging. No jokes. Just real.', icon: '🤝', isOpen: false },
    ],
    hasGift: true,
    giftType: 'spectacle',
    giftTitle: 'Two Tickets — That Marvel Premiere',
    giftNote: 'You\'ve been talking about this for three months. Shut up and go.',
    giftLink: 'https://in.bookmyshow.com/explore/movies-now-showing',
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
    userImageUrl: 'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1513279922550-250c2129b13a?w=600&q=80', caption: 'The kitchen where we fought, cried, and forgave', angle: -5, xOffset: -30, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&q=80', caption: 'Before everything got complicated', angle: 8, xOffset: 45, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1516575150278-77136aed6920?w=600&q=80', caption: 'You showed up at the hospital before I finished the sentence', angle: -3, xOffset: -50, yOffset: 35 },
      { url: 'https://images.unsplash.com/photo-1498019559366-a1cbd07b5160?w=600&q=80', caption: 'Twelve years of secrets safe with you', angle: 10, xOffset: 20, yOffset: -40 },
      { url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80', caption: 'The last time we laughed without thinking about it', angle: -8, xOffset: -15, yOffset: 50 },
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
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=k4V3Mo61fJM',
    coupons: [
      { id: 'c1', title: 'One Weekend — Just Us', description: 'Like before. Chai, gossip, and pretending we\'re 22.', icon: '💛', isOpen: false },
      { id: 'c2', title: 'The Conversation We Need To Have', description: 'No running. No deflecting. I\'ll listen first.', icon: '🫂', isOpen: false },
    ],
    hasGift: true,
    giftType: 'gastronomy',
    giftTitle: 'Dinner at That Place We Used To Go',
    giftNote: 'Table for two. The corner one. Like old times.',
    giftLink: 'https://www.zomato.com/',
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
    userImageUrl: 'https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=600&q=80', caption: 'The kitchen where everything important happened', angle: -4, xOffset: -25, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600&q=80', caption: 'Every morning. 5am. Without being asked.', angle: 7, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1518398046578-8cca57782e17?w=600&q=80', caption: 'That ironed shirt the night before my interview', angle: -8, xOffset: -45, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600&q=80', caption: 'Paranthas at the right time. Always.', angle: 6, xOffset: 30, yOffset: -35 },
      { url: 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=600&q=80', caption: 'The temple trip you keep mentioning — it\'s booked now', angle: -10, xOffset: -10, yOffset: 45 },
      { url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=600&q=80', caption: 'You never complained. Not once. I noticed.', angle: 3, xOffset: 55, yOffset: 5 },
    ],
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
    coupons: [
      { id: 'c1', title: 'A Day Where You Don\'t Cook', description: 'I\'m ordering in. You\'re sitting down. Non-negotiable.', icon: '🍛', isOpen: false },
      { id: 'c2', title: 'That Temple Trip You Keep Mentioning', description: 'Booked. Planned. You just show up.', icon: '🛕', isOpen: false },
      { id: 'c3', title: 'A Photo Together — A Real One', description: 'Not a selfie. A proper one. Framed.', icon: '📸', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'New Phone — The One You Said Was "Too Expensive"',
    giftNote: 'Nothing is too expensive for the person who gave me everything for free.',
    giftLink: 'https://www.amazon.in/s?k=iphone+16',
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
    userImageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80', caption: 'The sky looks the same from both sides. I checked.', angle: -6, xOffset: -30, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?w=600&q=80', caption: 'Three-hour video call. No words. Just us.', angle: 9, xOffset: 45, yOffset: -25 },
      { url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80', caption: 'Your desk. My screen. 5,000 miles of nothing.', angle: -3, xOffset: -40, yOffset: 35 },
      { url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', caption: 'Every city reminds me of something you said', angle: 7, xOffset: 25, yOffset: -40 },
      { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', caption: 'Marine Drive. The night before your flight.', angle: -11, xOffset: -15, yOffset: 50 },
      { url: 'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=600&q=80', caption: 'I still check if you\'ve texted. Every morning.', angle: 5, xOffset: 55, yOffset: 0 },
    ],
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
    hasGift: true,
    giftType: 'voyage',
    giftTitle: 'One-Way Flight Home — Next Month',
    giftNote: 'Stop saying "soon." I booked it.',
    giftLink: 'https://www.makemytrip.com/flights/',
  },
};

export const DEMO_SLUGS = Object.keys(DEMO_DATA);

export function getDemoData(slug: string): CoupleData | null {
  return DEMO_DATA[slug] || null;
}