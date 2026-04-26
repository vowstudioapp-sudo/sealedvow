import { CoupleData } from '../types';

export interface DemoEntry {
  slug: string;
  data: CoupleData;
}

export const DEMO_DATA: Record<string, CoupleData> = {

  // ═══════════════════════════════════════════════════════════
  // 1. ANNIVERSARY — Karan → Richa
  // ═══════════════════════════════════════════════════════════
  anniversary: {
    senderName: 'Karan',
    recipientName: 'Richa',
    occasion: 'anniversary',
    theme: 'velvet',
    writingMode: 'assisted',
    timeShared: '4 years together',
    relationshipIntent: 'The person I chose, and keep choosing.',
    sharedMoment: 'That evening overlooking the sea in Goa...',
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
    finalLetter: `Richa,

Four years ago, I didn't know what I was getting into. I just knew I didn't want to leave.

You've seen the worst version of me — the anxious one, the overthinking one, the one who forgets things but remembers your coffee order in his sleep. And you stayed. Not because it was easy. Because you decided to.

I don't say it enough: you changed how I see mornings. Before you, they were just alarms and traffic. Now they're the first few seconds where I reach over and know you're there.

I still think about that night in Goa. No noise but the waves. Just the salt in the air and your voice and the kind of quiet that makes you say things you've been holding in for months. That was the night I knew this wasn't temporary.

I'm not perfect. But I'm yours. That's the only title I care about.

Happy anniversary. Not because the calendar says so — but because every day with you feels like one.

Always,
Karan`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=450p7goxZqg',
    sacredLocation: {
      placeName: 'Chapora Fort, Goa',
      description: 'Where we watched the city light up below us and promised to keep showing up.',
      googleMapsUri: 'https://maps.google.com/?q=15.6046,73.7369',
      latLng: { lat: 15.6046, lng: 73.7369 },
    },
    locationMemory: 'That fort where we sat watching the waves...',
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
  // 2. BIRTHDAY — Noor → Zara
  // ═══════════════════════════════════════════════════════════
  birthday: {
    senderName: 'Noor',
    recipientName: 'Zara',
    occasion: 'birthday',
    theme: 'velvet',
    writingMode: 'assisted',
    timeShared: '8 years of growing up together',
    relationshipIntent: 'The person who made every year worth remembering.',
    sharedMoment: 'When you surprised me at the airport at midnight on my 21st — I still don\'t know how you knew my flight.',
    myth: 'Eight birthdays. One friend who never forgot.',
    userImageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&q=80', caption: 'The birthday you threw in your hostel room with a Rs 200 cake', angle: -6, xOffset: -30, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80', caption: 'That breakfast you made at 6am because you couldn\'t wait', angle: 8, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1523301343968-6a6ebf63c672?w=600&q=80', caption: 'The rooftop where we watched the sun come up on your 25th', angle: -4, xOffset: -45, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1513128034602-7814ccaddd4e?w=600&q=80', caption: 'Your face when you saw the airport surprise', angle: 10, xOffset: 25, yOffset: -35 },
      { url: 'https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?w=600&q=80', caption: 'Every year, you make the ordinary feel like a celebration', angle: -7, xOffset: -10, yOffset: 45 },
    ],
    finalLetter: `Zara,

Every year I try to write something for your birthday. And every year I end up sending a two-line WhatsApp message because I can't figure out how to say what I actually mean.

Not this time.

You are the person who showed up at the airport at midnight on my 21st birthday. I still don't know how you found out my flight time. I didn't tell anyone. But there you were — holding a cake that was already half-melted and grinning like you'd pulled off a heist.

That's who you are. You don't just remember birthdays. You turn them into proof that someone is paying attention.

Eight years. You've celebrated me when I didn't feel worth celebrating. You've made me laugh on days I was determined to be miserable. You've reminded me, over and over, that growing older is only sad if you're doing it with the wrong people.

I'm not doing it with the wrong people. I'm doing it with you.

Happy birthday, Zara. Not because the date says so. Because you deserve to hear it loudly, properly, and in more than two lines.

With all my love,
Noor`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=nSDgHBxUbVQ',
    coupons: [
      { id: 'c1', title: 'One Day — Your Rules', description: 'Whatever you want to do. I follow. No complaints.', icon: '👑', isOpen: false },
      { id: 'c2', title: 'A Proper Photo Album', description: 'Printed. Not digital. Eight years in one book.', icon: '📖', isOpen: false },
      { id: 'c3', title: 'Midnight Cake — Every Year', description: 'A promise. No matter where we are.', icon: '🎂', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'The Perfume You Kept Saying You\'d Buy "Someday"',
    giftNote: 'Someday is today. Happy birthday.',
    giftLink: 'https://www.nykaa.com/perfume-and-body/c/3',
  },

  // ═══════════════════════════════════════════════════════════
  // 3. FRIENDSHIP — Ajmal → Yash
  // ═══════════════════════════════════════════════════════════
  justbecause: {
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
  apology: {
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
  // 5. EID — Fahad → Ammi
  // ═══════════════════════════════════════════════════════════
  eid: {
    senderName: 'Fahad',
    recipientName: 'Ammi',
    occasion: 'eid',
    theme: 'midnight',
    writingMode: 'assisted',
    timeShared: 'Every Eid, every year, every prayer',
    relationshipIntent: 'The woman who taught me what Eid actually means.',
    sharedMoment: 'When you called me after Fajr on my first Eid away from home and recited the same dua you\'ve said over me since I was five.',
    myth: 'Every Eid. One dua. One voice. One home.',
    userImageUrl: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1590076215667-875d4ef2d7de?w=600&q=80', caption: 'The kitchen on Eid morning — your hands covered in flour and love', angle: -5, xOffset: -30, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=600&q=80', caption: 'The clothes you ironed the night before — always perfect', angle: 7, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1466442929976-97f336a657be?w=600&q=80', caption: 'Walking to the masjid together — my favorite part of every Eid', angle: -4, xOffset: -45, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1567591370504-cd227a1f00c0?w=600&q=80', caption: 'Your biryani. Nobody else even comes close.', angle: 9, xOffset: 25, yOffset: -35 },
      { url: 'https://images.unsplash.com/photo-1532635241-17e820acc59f?w=600&q=80', caption: 'That Fajr phone call on my first Eid away — I still have it saved', angle: -8, xOffset: -10, yOffset: 45 },
    ],
    finalLetter: `Ammi,

Eid Mubarak.

But not the WhatsApp forward kind. The real kind. The kind I should have written years ago.

Every Eid of my life has started the same way — your voice. First it was waking me up for Fajr when I was too small to set an alarm. Then it was the phone call when I moved away. Same dua. Same softness. Same feeling that no matter how far I go, Eid still starts with you.

I think about your kitchen on Eid morning. The sheer khurma that takes you three hours because you refuse to take shortcuts. The way the whole house smells like celebration before the sun is fully up.

You taught me that Eid isn't about new clothes or money in envelopes. It's about gratitude. For health. For family. For one more year of being together.

This year, the eidi is from me to you. Not because I can repay what you've given me — that's impossible. But because you deserve to know that everything you poured into those Eid mornings built the person writing this letter.

Eid Mubarak, Ammi. From your son who finally learned to say it properly.

With all my love and duas,
Fahad`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=LG31_cJVJNw',
    coupons: [
      { id: 'c1', title: 'Eid Lunch — I\'m Hosting', description: 'You sit. I cook. The whole family comes to my place this year.', icon: '🍽️', isOpen: false },
      { id: 'c2', title: 'A Trip to the Dargah You\'ve Been Wanting to Visit', description: 'Booked. Both of us. No excuses.', icon: '🕌', isOpen: false },
      { id: 'c3', title: 'Your New Phone — The One You Won\'t Buy Yourself', description: 'Eid gift. Non-returnable.', icon: '📱', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'Your First Eidi From Me',
    giftNote: 'For everything you gave me that money can never repay.',
    giftLink: '',
  },

  // ═══════════════════════════════════════════════════════════
  // 6. THANK YOU — Arjun → Mother
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
  // EID SUB-DEMOS — 6 relationship types (ported from Vow-Eidi.html)
  // ═══════════════════════════════════════════════════════════

  // 1. Child → Parent — Fahad → Ammi
  'eid-child-parent': {
    senderName: 'Fahad',
    recipientName: 'Ammi',
    occasion: 'eid',
    theme: 'evergreen',
    writingMode: 'assisted',
    timeShared: 'Every Eid, every year, every prayer',
    relationshipIntent: 'The woman who taught me what Eid actually means.',
    sharedMoment: 'When you called me after Fajr on my first Eid away from home and recited the same dua you have said over me since I was five.',
    myth: 'Every Eid. One dua. One voice. One home.',
    userImageUrl: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1590076215667-875d4ef2d7de?w=600&q=80', caption: 'Eid morning in the kitchen — your sheer khurma no one can replicate', angle: -5, xOffset: -30, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=600&q=80', caption: 'Walking to the masjid together while the city is still quiet', angle: 7, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1466442929976-97f336a657be?w=600&q=80', caption: 'Your biryani that the whole family waits for all year', angle: -4, xOffset: -45, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1532635241-17e820acc59f?w=600&q=80', caption: 'You asking Allah for all of us — before you ever asked for yourself', angle: 9, xOffset: 25, yOffset: -35 },
    ],
    finalLetter: `Ammi,

Eid Mubarak.

Not the WhatsApp forward kind. The real kind.

Every Eid of my life has started the same way — your voice. First it was waking me up for Fajr when I was too small to set an alarm. Then it was the phone call when I moved away. Same dua. Same softness. Same feeling that no matter how far I go, Eid still starts with you.

I think about your kitchen on Eid morning. The sheer khurma that takes three hours because you refuse shortcuts. The way the whole house smells like celebration before the sun is fully up.

You taught me that Eid is not about new clothes or money in envelopes. It is about gratitude. For health. For family. For one more year together.

I don't think I've ever properly thanked you for all of that. So today — on this blessed day — I want to say it clearly: JazakAllah Khair, Ammi. For everything.

May Allah give you long life, good health, and peace in your heart. May He reward you for every sacrifice you made for us.

Eid Mubarak. Your smile today is all I need. 🌙

— Fahad`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=LG31_cJVJNw',
    coupons: [
      { id: 'c1', title: 'Eid Lunch — I am Hosting', description: 'You sit. I cook. The whole family comes to my place this year.', icon: '🍽️', isOpen: false },
      { id: 'c2', title: 'A Trip to the Dargah', description: 'Booked. Both of us. No excuses.', icon: '🕌', isOpen: false },
      { id: 'c3', title: 'Your New Phone', description: 'Eid gift. Non-returnable.', icon: '📱', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'Your First Eidi From Me — ₹2,000',
    giftNote: 'A small gift with a big dua. May it bring a smile to your face, Ammi. 🌙',
    giftLink: '',
  },

  // 2. Parent → Child — Ammi & Abu → Zara
  'eid-parent-child': {
    senderName: 'Ammi & Abu',
    recipientName: 'Zara',
    occasion: 'eid',
    theme: 'evergreen',
    writingMode: 'assisted',
    timeShared: 'Every Eid since the day you were born',
    relationshipIntent: 'Watching you grow up into the person you are is the greatest gift we could have asked for.',
    sharedMoment: 'When you came downstairs on Eid morning in that white dress and we both went quiet because we could not believe how much you had grown.',
    myth: 'Every Eid. One daughter who made every one worth celebrating.',
    userImageUrl: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=600&q=80', caption: 'Getting you dressed on Eid morning — always our favourite part of the day', angle: -6, xOffset: -25, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=600&q=80', caption: 'The family photo on Eid — you always made a face, we always kept it', angle: 8, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=80', caption: 'You at the table, already asking what is for dessert', angle: -3, xOffset: -45, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80', caption: 'Watching you pray — quietly, on your own — that moment stays with us', angle: 10, xOffset: 25, yOffset: -35 },
    ],
    finalLetter: `Eid Mubarak, beta.

Today your Ammi and Abu just want to say one thing — watching you grow up into the person you are is the greatest gift we could have asked for.

You make our home feel complete. On every Eid, when we see you dressed up and smiling — nothing else matters. That image stays with us the whole year.

We don't always say these things. But we feel them every single day.

May Allah keep you happy, keep you safe, and keep you always close to us. 🌙

Now go enjoy your Eid. You have earned it, beta.

— Ammi & Abu`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=LG31_cJVJNw',
    coupons: [
      { id: 'c1', title: 'One Weekend — All of Us Together', description: 'No phones at the table. Just family. Your choice of restaurant.', icon: '🏠', isOpen: false },
      { id: 'c2', title: 'That Thing You Have Been Wanting', description: 'Tell us. No questions asked this Eid.', icon: '🎁', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'Eidi from Ammi & Abu — ₹1,000',
    giftNote: 'Not as much as our love — but it comes with every dua we have. Eid Mubarak, Zara. 🌙',
    giftLink: '',
  },

  // 3. Elder → Child — Tabish Chacha → Zohain
  'eid-elder-child': {
    senderName: 'Tabish Chacha',
    recipientName: 'Zohain',
    occasion: 'eid',
    theme: 'evergreen',
    writingMode: 'assisted',
    timeShared: 'Every Eid since you were old enough to ask for eidi',
    relationshipIntent: 'Watching you from the sidelines — and being proud every single time.',
    sharedMoment: 'When you scored that century and looked up at the stands first — straight at me — before you looked anywhere else.',
    myth: 'Every Eid. One boy who became someone worth watching.',
    userImageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=80', caption: 'New Eid clothes — you would always ask to wear them the night before', angle: -5, xOffset: -25, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&q=80', caption: 'Walking to Eid namaz while the streets were still quiet', angle: 7, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80', caption: 'Running to Chacha for eidi before anyone else even woke up', angle: -4, xOffset: -40, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=600&q=80', caption: 'Your laugh that could fill up any room — still the same as always', angle: 9, xOffset: 20, yOffset: -35 },
    ],
    finalLetter: `Eid Mubarak, beta!

Every Eid your Chacha thinks about you — about how fast you are growing up, how proud it makes me feel just watching you become the person you are.

You know what I remember most? Every Eid when you were little — running around in new clothes, asking "Chacha where is my eidi?" before even saying salaam. Those memories make me smile every time.

Be a good human. Work hard. Make your parents proud — they deserve it more than anyone. And know that your Chacha is always, always in your corner. No matter what. 🌙

Now go enjoy your Eid — and don't forget your eidi wala salaam!

Thodi si eidi, aur bahut saari duaein.

— Tabish Chacha`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=LG31_cJVJNw',
    coupons: [
      { id: 'c1', title: 'One Proper Conversation', description: 'Just us. About whatever you are figuring out right now. I have time.', icon: '☕', isOpen: false },
      { id: 'c2', title: 'The Book I Keep Meaning to Give You', description: 'It changed how I think. Might do the same for you.', icon: '📖', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'Eidi from Chacha — ₹500',
    giftNote: 'Thodi si rakam, aur bahut saari duaein. Eid Mubarak Zohain! 🌙',
    giftLink: '',
  },

  // 4. Sibling → Sibling — Amir Bhai → Sara
  'eid-sibling': {
    senderName: 'Amir Bhai',
    recipientName: 'Sara',
    occasion: 'eid',
    theme: 'evergreen',
    writingMode: 'assisted',
    timeShared: 'Every Eid since we were small enough to share the same argument',
    relationshipIntent: 'You are my most embarrassing secret and my favourite person.',
    sharedMoment: 'When Ammi caught us eating the sheer khurma at midnight before Eid and we both blamed each other and then finished the bowl anyway.',
    myth: 'Every Eid. One sister I would never admit I love this much.',
    userImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80', caption: 'Fighting over who looks better in Eid clothes — you always won, I will admit it', angle: -6, xOffset: -30, yOffset: 10 },
      { url: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=600&q=80', caption: 'Comparing eidi amounts and deciding who got more — every single year', angle: 8, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600&q=80', caption: 'That one time you cried at Eid because your outfit did not match', angle: -3, xOffset: -45, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&q=80', caption: 'But at the end of every Eid — always together, always us', angle: 10, xOffset: 25, yOffset: -35 },
    ],
    finalLetter: `Okay fine. I will say the nice things once a year. Today is that day. Do not get used to it. 😄

Honestly Sara — growing up with you was not always easy. You were annoying. You still are. But I also know that you are one of the kindest, most genuine people I know. And I am proud to call you my little sister.

You work hard, you care deeply, and you handle things that most people would fall apart over. I see that even when I do not say it. Your Bhai notices. 🌙

May this Eid bring you everything you have been wishing for. And may you always have a Bhai as amazing as me. 😄

Eid Mubarak, Sara. For real.

Don't spend it all in one place. Love you (don't tell anyone). 😄🌙

— Amir Bhai (your favourite person, admit it)`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=LG31_cJVJNw',
    coupons: [
      { id: 'c1', title: 'One Favour — No Questions', description: 'Redeemable once. Expires never. Use wisely.', icon: '🤝', isOpen: false },
      { id: 'c2', title: 'I Will Not Embarrass You', description: 'For one full family gathering. One.', icon: '🤐', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'Eidi from Bhai — ₹200',
    giftNote: "Don't spend it all in one place. Happy Eid Sara — love you (don't tell anyone) 😄🌙",
    giftLink: '',
  },

  // 5. Friend → Friend — Bilal → Hamza
  'eid-friend': {
    senderName: 'Bilal',
    recipientName: 'Hamza',
    occasion: 'eid',
    theme: 'evergreen',
    writingMode: 'assisted',
    timeShared: '11 years of Eid namaz, biryani runs, and bad jokes',
    relationshipIntent: 'You are the friend who shows up. That is everything.',
    sharedMoment: 'That Eid where we went to three different houses, ate at all of them, complained about being full the whole evening, then went back for more at the third house.',
    myth: 'Eleven Eids. One friend who always saves me a seat.',
    userImageUrl: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600&q=80', caption: 'Eid namaz together — every year without fail, the tradition continues', angle: -5, xOffset: -30, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80', caption: 'Three houses. Three full plates. Zero regrets.', angle: 7, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80', caption: 'That Eid we were late for namaz and ran in our new clothes', angle: -4, xOffset: -40, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&q=80', caption: 'Every Eid Milan — always ended up in the same corner talking', angle: 9, xOffset: 20, yOffset: -35 },
    ],
    finalLetter: `Bhai Eid Mubarak!

Sent you this properly this year because a WhatsApp "Eid Mubarak 🌙" felt like not enough for someone like you.

Honestly yaar — it is rare to have a friend who is genuinely happy when things go right for you. You are that friend. And I do not think I say it enough but having you around is something I am genuinely grateful for.

This year has been a lot for both of us. But we are here, we are good, and it is Eid. May Allah make the next year even better for you — in every single way. 🌙

Now go eat biryani and enjoy your day.

Symbolic hai yaar 😄 But the dua is fully real.

Eid Mubarak, Hamza. For real. 😄

— Bilal (your best friend, obviously)`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=LG31_cJVJNw',
    coupons: [
      { id: 'c1', title: 'One Meal — My Treat', description: 'Wherever you want. No splitting. This one is on me.', icon: '🍛', isOpen: false },
      { id: 'c2', title: 'That Plan We Keep Postponing', description: 'This is me committing. Pick a date.', icon: '📅', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'Symbolic Eidi — ₹100',
    giftNote: 'Symbolic hai yaar 😄 But the dua is fully real. Eid Mubarak Hamza! 🌙',
    giftLink: '',
  },

  // 6. Relative → Family — Khalid Bhai → the household
  'eid-relative-family': {
    senderName: 'Khalid Bhai',
    recipientName: 'the family',
    occasion: 'eid',
    theme: 'evergreen',
    writingMode: 'assisted',
    timeShared: 'Every Eid, every house visit, every doorstep lineup',
    relationshipIntent: 'A family that gathers on Eid is a blessing. You are mine.',
    sharedMoment: 'When all the kids lined up at the door before I even finished taking off my shoes — they knew what was in my pocket.',
    myth: 'Every Eid. The same door. The same kids. The same joy.',
    userImageUrl: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=800&q=80',
    memoryBoard: [
      { url: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=600&q=80', caption: 'The whole family together — the noise alone was worth everything', angle: -5, xOffset: -25, yOffset: 15 },
      { url: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=600&q=80', caption: 'That legendary biryani — everyone claims the recipe, nobody agrees', angle: 7, xOffset: 40, yOffset: -20 },
      { url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80', caption: 'The kids lined up for eidi — smallest to tallest, every single year', angle: -4, xOffset: -40, yOffset: 30 },
      { url: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=80', caption: 'The Eid Milan that somehow always went on until midnight', angle: 9, xOffset: 25, yOffset: -35 },
    ],
    finalLetter: `Eid Mubarak to everyone!

This year I could not be there in person, but that does not mean the eidi stops. 😄

I have been thinking about all the kids and how fast they are growing up — each one of them is special to me. So I wanted to do something a little different this year. Each child has their own eidi waiting.

To every child in this house: this eidi comes with duas. For your studies, your health, your happiness. Spend some wisely. Spend some on something silly. That is what Eid money is for.

To Bhai and Bhabhi: thank you for keeping this door open. Every year, without fail. You do not know how much that means.

Eid Mubarak to all of you. May Allah keep this family together, always.

— Khalid Bhai`,
    musicType: 'youtube',
    musicUrl: 'https://www.youtube.com/watch?v=LG31_cJVJNw',
    coupons: [
      { id: 'c1', title: 'Eid Lunch Next Year — At My Place', description: 'I am hosting. All of you. No excuses.', icon: '🏠', isOpen: false },
      { id: 'c2', title: 'One Trip — All the Kids', description: 'A proper day out. Wherever they vote for.', icon: '🚌', isOpen: false },
    ],
    hasGift: true,
    giftType: 'treasure',
    giftTitle: 'Eidi for Every Child — from Khalid Bhai',
    giftNote: 'One envelope per child. May Allah put barakah in it. 🌙',
    giftLink: '',
  },

    // ═══════════════════════════════════════════════════════════
  // 7. MISSING YOU — Maya → Raj
  // ═══════════════════════════════════════════════════════════
  missingyou: {
    senderName: 'Maya',
    recipientName: 'Raj',
    occasion: 'just-because',
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

export const DEMO_ALIASES: Record<string, string> = {
  sorry: "apology",
  friendship: "justbecause",
};

export function getDemoData(slug: string): CoupleData | null {
  const resolvedSlug = DEMO_ALIASES[slug] || slug;
  return DEMO_DATA[resolvedSlug] || null;
}