import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { Story } from '../models/Story';
import { Conversation, Message } from '../models/Message';
import { Video } from '../models/Video';
import { Event } from '../models/Event';
import { MarketplaceListing } from '../models/MarketplaceListing';

// ── Assets ────────────────────────────────────────────────────────────────────

const AVATARS = [
  'https://i.pravatar.cc/150?img=1',  // demo
  'https://i.pravatar.cc/150?img=5',  // alice
  'https://i.pravatar.cc/150?img=8',  // bob
  'https://i.pravatar.cc/150?img=11', // carol
  'https://i.pravatar.cc/150?img=15', // david
  'https://i.pravatar.cc/150?img=20', // emma
  'https://i.pravatar.cc/150?img=25', // frank
  'https://i.pravatar.cc/150?img=32', // grace
  'https://i.pravatar.cc/150?img=44', // henry
  'https://i.pravatar.cc/150?img=57', // iris
];

const IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=700&q=80', // mountain
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=700&q=80', // forest
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=700&q=80', // valley
  'https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=700&q=80', // trees
  'https://images.unsplash.com/photo-1518791841217-8f162f1912da?w=700&q=80', // cat
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=700&q=80', // dog
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&q=80', // food
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=80', // restaurant
  'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=700&q=80', // paris
  'https://images.unsplash.com/photo-1538970272646-f61fabb3a8a2?w=700&q=80', // tokyo
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=700&q=80', // travel
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=700&q=80', // café
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=700&q=80', // workout
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=700&q=80', // yoga
  'https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=700&q=80', // friends
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=700&q=80', // party
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=700&q=80', // concert
  'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=700&q=80', // apples
  'https://images.unsplash.com/photo-1464219551459-ac14ae01fbe0?w=700&q=80', // beach
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=700&q=80', // sunset
];

const POST_TEMPLATES = [
  // Travel
  { content: "Just landed in Tokyo 🇯🇵 The city is absolutely electric at night. First time here and I'm already in love — the food, the lights, the people! Where should I go first?", imageIdx: 9, feeling: '😍 loved', location: 'Tokyo, Japan' },
  { content: "Paris never disappoints 🗼 Sat by the Seine for two hours just watching the world go by. Sometimes travel teaches you to slow down.", imageIdx: 8, location: 'Paris, France' },
  { content: "Weekend beach trip was exactly what I needed 🌊 Salt water fixes everything. Back to reality Monday...", imageIdx: 18 },
  { content: "Golden hour at the valley 🌄 Woke up at 5am for this shot. Worth every second of lost sleep.", imageIdx: 2, feeling: '😊 happy' },
  { content: "Mountain hiking day 3 complete! My legs hate me but my soul is full 🏔️ #adventure #hiking #nature", imageIdx: 0, location: 'Rocky Mountains' },
  { content: "Forest bathing is a real thing and I'm fully converted 🌲 Two hours in the woods and I feel like a new person.", imageIdx: 1 },
  { content: "Sunset chasing should be a professional sport. I'd be world champion 🌅", imageIdx: 19 },
  { content: "The ocean has a way of making your problems feel small 🌊 Needed this reset badly.", imageIdx: 18, feeling: '🙏 grateful' },

  // Food
  { content: "Made homemade pasta from scratch for the first time 🍝 It took 3 hours and looked nothing like the tutorial but honestly? It slapped.", imageIdx: 6, feeling: '🥳 celebrating' },
  { content: "This restaurant has been on my list for 2 years. Finally made it. The tasting menu was 9 courses and I finished every single one 🍴", imageIdx: 7, location: 'The French Laundry' },
  { content: "Sunday morning coffee ritual ☕ Some things are non-negotiable.", imageIdx: 11 },
  { content: "Tried making sourdough bread again. This time it actually rose!! Week 6 of this obsession 🍞", imageIdx: 17 },
  { content: "Meal prepped for the whole week 💪 Future me is going to be so grateful. Present me is exhausted.", imageIdx: 6 },

  // Fitness & Wellness
  { content: "6 months of consistent training and I finally hit my goal weight 🏋️ Not about the number — about how strong and alive I feel every single day.", imageIdx: 12, feeling: '💪 motivated' },
  { content: "Morning yoga before the city wakes up. The silence is sacred 🧘", imageIdx: 13, feeling: '🙏 grateful' },
  { content: "PR on deadlifts today 💥 The gym is therapy and the results are just the side effect.", imageIdx: 12 },
  { content: "Half marathon done ✅ 13.1 miles. 2 hours 4 minutes. A year ago I could barely run 1K. Time and consistency change everything.", feeling: '🥳 celebrating', location: 'Central Park, NYC' },

  // Life & Thoughts
  { content: "Turned 30 today 🎂 Honestly? The best thing that's happened to me. I care less about the wrong things and so much more about the right ones.", feeling: '🥳 celebrating' },
  { content: "Had a conversation with my 80-year-old neighbor today. She told me she wished she'd worried less and laughed more. Taking notes.", feeling: '🤔 thoughtful' },
  { content: "Reminder: you don't have to have it all figured out. Nobody does. We're all just winging it with varying levels of confidence 😅" },
  { content: "Cleaned out my apartment today and donated 4 boxes of stuff. Why does getting rid of things feel so liberating? Less really is more.", feeling: '😊 happy' },
  { content: "Book recommendation: just finished 'The Midnight Library' and I'm still thinking about it 3 days later 📚 Some stories change the way you see choices." },
  { content: "Called my parents just to chat today, not for any reason. Watched the silence on both ends turn into an hour of stories. Do this more.", feeling: '😍 loved' },
  { content: "Sometimes the best plan is no plan. Drove with no destination today and stumbled across the most beautiful little town 🏡" },
  { content: "The art of doing nothing is underrated. Spent Sunday on the couch, zero guilt. My brain needed the downtime.", feeling: '😊 happy' },

  // Friends & Social
  { content: "Friend group reunion after 2 years 🥂 Some friendships don't need maintenance — you just pick up right where you left off.", imageIdx: 14, feeling: '🥳 celebrating' },
  { content: "Birthday dinner for my best friend of 15 years 🎉 So grateful for the people who've seen all your versions and stayed.", imageIdx: 15, feeling: '😍 loved' },
  { content: "Live music last night was unreal 🎵 There's something about watching someone pour their soul into their art that resets something in you.", imageIdx: 16, location: 'Blue Note Jazz Club' },
  { content: "House party at my place tonight turned into a 6-hour deep conversation about everything and nothing. Those are the best kinds.", imageIdx: 15 },

  // Work & Growth
  { content: "Just shipped a feature I've been building for 3 months 🚀 The feeling of watching something you built go live never gets old.", feeling: '🥳 celebrating' },
  { content: "Gave my first public talk today 😤 My hands were shaking the whole time. But I did it. Next time will be better.", feeling: '💪 motivated' },
  { content: "Switched careers at 34. Everyone told me it was crazy. Six months in — it was the sanest thing I've ever done.", feeling: '😊 happy' },
  { content: "Rejected from a job I really wanted today. Spent an hour feeling sorry for myself, then updated my portfolio. Onto the next one 💪" },

  // Pets
  { content: "This is Oliver. He has claimed every single pillow in the house and somehow I'm okay with it 🐱", imageIdx: 4 },
  { content: "Adopted this boy from the shelter 3 weeks ago and I genuinely don't know what I did without him 🐶 His name is Biscuit and he's perfect.", imageIdx: 5, feeling: '😍 loved' },
  { content: "My cat has been sitting on my laptop keyboard for 20 minutes. Productivity: zero. Happiness: immeasurable 🐈", imageIdx: 4 },
  { content: "Biscuit discovered the garden today and lost his entire mind 🌱 Pure joy in dog form.", imageIdx: 5 },

  // Tech & Interests
  { content: "Started learning to code 6 months ago. Built my first full web app today 💻 It's ugly and barely works but it's MINE.", feeling: '🥳 celebrating' },
  { content: "The more I learn, the more I realize how much I don't know. Comfortable with that feeling now — it means I'm growing 🧠" },
  { content: "Unplugged for 48 hours this weekend. No phone, no social media. It felt terrifying and then incredibly peaceful. Try it." },
  { content: "Started journaling again. Three pages, stream of consciousness, every morning. It's the cheapest therapy that actually works 📝", feeling: '🙏 grateful' },

  // Misc / Funny
  { content: "Accidentally made eye contact with a pigeon for way too long today and now I think we have an understanding 🐦" },
  { content: "My Spotify Wrapped is 90% lo-fi hip hop and 10% embarrassing early 2000s pop. I stand by all of it." },
  { content: "Caught myself narrating my own life in third person while cooking dinner. 'And then he added the garlic...' I need more human contact 😂" },
  { content: "Plot twist: the 'quick errand' took 3 hours. Every. Single. Time. This is my villain origin story." },
  { content: "Pro tip: if you want to feel productive, reorganize your desk. Your actual to-do list hasn't moved but somehow you feel better 📋" },
  { content: "Ordered 'just a salad' at lunch and spent $28. Salads have no business being that expensive. And it was good. I'm furious." },
  { content: "Walked into the store for one thing. Left with eleven things. Not the one thing. Classic." },
  { content: "The audacity of Mondays. Genuinely cannot believe it's already another week. Time is a flat circle and we're all just here 😤" },

  // 40 more to reach 100 total
  { content: "Finally finished the renovation 🏠 Eight months of dust, chaos, and questionable decisions. Totally worth it.", imageIdx: 0 },
  { content: "Cooked for 20 people at Thanksgiving this year. Survived. Barely. Never again until next year. 🦃" },
  { content: "Ran into an old friend at the airport. We hadn't spoken in 7 years. Two hours later we'd solved most of our problems 😂", feeling: '😊 happy' },
  { content: "Learning guitar at 35 is humbling but I just played a full song without stopping 🎸 Month 4 of this chaos." },
  { content: "Watched the sunrise this morning for the first time in years. Some things you forget how good they are until you do them again 🌅", imageIdx: 19 },
  { content: "My sourdough starter turned 1 year old today. I've kept it alive longer than most of my plants. Proud parent 🍞" },
  { content: "Spent the day volunteering at the food bank. Life-changing perspective shift. Do it if you haven't." },
  { content: "Finished my first triathlon! 🏊🚴🏃 Did not look graceful. Did not care. Got the medal.", feeling: '🥳 celebrating', location: 'Ironman 70.3' },
  { content: "Just negotiated a 20% raise. Months of research, one 15-minute conversation. Know your worth. Ask for it. 💰", feeling: '🥳 celebrating' },
  { content: "Moved to a new city alone at 27. One year later — best decision I ever made and I only cried about it twice 🏙️", imageIdx: 9 },
  { content: "The gym was empty at 6am and it felt like the whole place was mine. This is why morning workouts are a religion 💪", imageIdx: 12, feeling: '💪 motivated' },
  { content: "Made fresh pasta from scratch with my grandmother's recipe. The smell alone sent me back 30 years 🍝", imageIdx: 6, feeling: '🙏 grateful' },
  { content: "Therapist said 'it sounds like you already know the answer' and she was right and I hate that 😅" },
  { content: "Reading 52 books in a year seemed crazy. Finished book 47 today. You really can do most things if you just do them daily 📚" },
  { content: "First solo travel trip: Tokyo for 10 days. Every fear I had was wrong. Every expectation was beaten. Go 🇯🇵", imageIdx: 9, location: 'Tokyo, Japan', feeling: '😍 loved' },
  { content: "Found my old journal from 10 years ago. Half the things I was afraid of never happened. Half the things I hoped for did. Time is wild." },
  { content: "My plant collection has officially taken over the apartment 🌿 I am not okay and everything is beautiful.", imageIdx: 2, feeling: '😊 happy' },
  { content: "Gave my two weeks notice today 🙏 Terrifying. Exciting. The right call. Sometimes you just know." },
  { content: "Camping off-grid for a week with no phone. Came back a completely different person. Or maybe the same person but cleaner inside 🏕️", imageIdx: 1 },
  { content: "My niece said 'you're my favourite because you're silly' and honestly that's the review I needed 👧❤️", feeling: '😍 loved' },
  { content: "Three years sober today 🎉 What started as a hard choice became the best chapter of my life. One day at a time.", feeling: '🥳 celebrating' },
  { content: "Renovated my home office and productivity tripled. Turns out your environment is doing 40% of the work 💻", imageIdx: 0 },
  { content: "Met my internet friend IRL for the first time after 4 years. Exactly who I expected. Better than I hoped 🤝", feeling: '😊 happy' },
  { content: "Bought a road bike on a whim. First 50km done. My legs are destroyed and I already bought a helmet 🚴", feeling: '💪 motivated' },
  { content: "Cooked a full Korean BBQ dinner at home. The prep took 3 hours. The eating took 20 minutes. Zero regrets 🥩🔥", imageIdx: 7 },
  { content: "Wrote a letter to myself 5 years ago and opened it today. I handled most of it. Some of it handled me. Try this." },
  { content: "My dog learned to open the fridge. This is partly impressive and mostly a problem 🐕", imageIdx: 5 },
  { content: "Watched the northern lights for the first time tonight 🌌 The photos don't do it justice. Nothing does. Just go.", imageIdx: 19, location: 'Tromsø, Norway', feeling: '😍 loved' },
  { content: "Left corporate. Started freelancing. Month 6: made more than my old salary in a single month. The fear was worth it.", feeling: '🥳 celebrating' },
  { content: "Brunch with people who make you feel lighter. That's it. That's the tweet. 🥂", imageIdx: 14, feeling: '😊 happy' },
  { content: "Signed up for a pottery class because I needed something that had nothing to do with screens. It's harder than it looks and I love it 🏺" },
  { content: "Road trip with no itinerary: drove 1400km in 4 days, saw 6 cities, got lost twice, found one amazing diner 🚗", location: 'Pacific Coast Highway' },
  { content: "Adopted a senior cat. Everyone said get a kitten. I'm so glad I didn't. 11 years old, maximum dignity, maximum nap 🐱", imageIdx: 4, feeling: '😍 loved' },
  { content: "The best investment I made this year was in sleep. Wild that we treat rest like laziness. 8 hours changed everything 💤" },
  { content: "First art piece I've finished in 5 years 🎨 Didn't matter that it wasn't perfect. Mattered that I started.", feeling: '🥳 celebrating' },
  { content: "My kids asked me to explain the internet today and I realised I cannot. Parent of the year 👨‍👩‍👧", feeling: '😂 haha' },
  { content: "Deleted Instagram for 30 days. Came back calmer, more creative, slightly bored. The boredom was the point 📵" },
  { content: "Coffee shop I've worked from for 3 years is closing. Said goodbye to the barista who knew my order before I spoke. These small relationships matter 😢", imageIdx: 11 },
  { content: "Submitted my novel manuscript today after 4 years of work ✍️ Don't care about publication right now. I finished. That's the win.", feeling: '🥳 celebrating' },
  { content: "Sometimes the most radical thing you can do is take a full day off, eat good food, and go to bed early. Radical rest 🛌" },
];

const COMMENT_BANK = [
  "This is beautiful! 😍",
  "Okay I'm so jealous right now 😩",
  "This made my day ❤️",
  "Need the full story!!",
  "Goals honestly 🙏",
  "So proud of you! 🎉",
  "This is everything 👏",
  "I felt this deeply",
  "You're living the dream",
  "Tag me next time!! 😤",
  "This is the content I'm here for",
  "Screenshotted this for motivation",
  "Wait this is hilarious 😂",
  "Can confirm, was there, it was incredible",
  "Sending love your way ❤️",
  "Where is this?? Need to go asap",
  "The caption + the photo = perfect",
  "Didn't expect to need this today but here we are",
  "Following for more of this energy",
  "Okay but WHERE did you get that",
];

const REACTION_TYPES = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'] as const;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSome<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function daysAgo(days: number, jitterHours = 12): Date {
  const jitter = (Math.random() - 0.5) * jitterHours * 3600 * 1000;
  return new Date(Date.now() - days * 24 * 3600 * 1000 + jitter);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

  console.log('🔗 Connecting to MongoDB…');
  await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected\n');

  // ── Wipe ALL existing data then reseed from scratch ──────────────────────
  await Promise.all([
    User.deleteMany({}), Post.deleteMany({}), Comment.deleteMany({}),
    Story.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({}),
    Video.deleteMany({}), Event.deleteMany({}), MarketplaceListing.deleteMany({}),
  ]);
  console.log('🧹 Cleared all existing data');

  // ── 1. Users ─────────────────────────────────────────────────────────────
  const userDefs = [
    { username: 'demo',      email: 'demo@example.com',   firstName: 'Demo',    lastName: 'User',    bio: 'Demo account — feel free to explore everything!', location: 'San Francisco, CA', isVerified: true, isOnline: true },
    { username: 'alice_j',   email: 'alice@example.com',  firstName: 'Alice',   lastName: 'Johnson', bio: 'Photographer & world traveler 📸✈️', location: 'New York, NY' },
    { username: 'bob_smith', email: 'bob@example.com',    firstName: 'Bob',     lastName: 'Smith',   bio: 'Full-stack dev by day, home chef by night 💻🍳', location: 'Austin, TX' },
    { username: 'carol_w',   email: 'carol@example.com',  firstName: 'Carol',   lastName: 'White',   bio: 'Fitness coach & wellness advocate 💪', location: 'Los Angeles, CA' },
    { username: 'david_b',   email: 'david@example.com',  firstName: 'David',   lastName: 'Brown',   bio: 'Music producer & vinyl collector 🎵', location: 'Nashville, TN' },
    { username: 'emma_d',    email: 'emma@example.com',   firstName: 'Emma',    lastName: 'Davis',   bio: 'Chef, food blogger, professional eater 🍴', location: 'Chicago, IL' },
    { username: 'frank_m',   email: 'frank@example.com',  firstName: 'Frank',   lastName: 'Miller',  bio: 'Startup founder | coffee snob | dog dad ☕🐕', location: 'Seattle, WA' },
    { username: 'grace_l',   email: 'grace@example.com',  firstName: 'Grace',   lastName: 'Lee',     bio: 'UX designer & plant lady 🌿', location: 'Portland, OR' },
    { username: 'henry_k',   email: 'henry@example.com',  firstName: 'Henry',   lastName: 'Kim',     bio: 'Architect who draws for fun and profit 🏛️', location: 'Boston, MA' },
    { username: 'iris_p',    email: 'iris@example.com',   firstName: 'Iris',    lastName: 'Park',    bio: 'Yoga instructor & mindfulness writer 🧘', location: 'Denver, CO' },
  ];

  const users: any[] = [];
  for (let i = 0; i < userDefs.length; i++) {
    const doc = new User({
      ...userDefs[i],
      password: 'Password1',
      avatar: AVATARS[i] ?? AVATARS[0],
    });
    await doc.save();
    users.push(doc);
  }
  console.log(`👤 Created ${users.length} users`);

  // ── 2. Friendships (dense social graph) ───────────────────────────────────
  const [demo, alice, bob, carol, david, emma, frank, grace, henry, iris] = users;

  const friendPairs = [
    // demo is friends with everyone for maximum feed content
    [demo, alice], [demo, bob], [demo, carol], [demo, david],
    [demo, emma], [demo, frank], [demo, grace], [demo, henry], [demo, iris],
    // Others also interconnected
    [alice, bob], [alice, carol], [alice, grace],
    [bob, frank], [bob, henry],
    [carol, emma], [carol, iris],
    [david, frank], [david, henry],
    [emma, grace], [emma, iris],
    [frank, henry], [grace, iris],
  ];

  for (const [a, b] of friendPairs) {
    await Promise.all([
      User.findByIdAndUpdate(a._id, { $addToSet: { friends: b._id } }),
      User.findByIdAndUpdate(b._id, { $addToSet: { friends: a._id } }),
    ]);
  }
  console.log(`🤝 Created ${friendPairs.length} friendships`);

  // ── 3. Posts — 100 posts spread over 30 days ─────────────────────────────
  const postDocs: any[] = [];

  for (let i = 0; i < POST_TEMPLATES.length; i++) {
    const tmpl = POST_TEMPLATES[i];
    const author = users[i % users.length];
    const reactors = pickSome(users.filter((u: any) => u._id.toString() !== author._id.toString()), 1, 7);

    const post = new Post({
      author: author._id,
      content: tmpl.content,
      media: (tmpl as any).imageIdx !== undefined
        ? [{ url: IMAGES[(tmpl as any).imageIdx], type: 'image' }]
        : [],
      visibility: 'public',
      location: (tmpl as any).location,
      feeling: (tmpl as any).feeling,
      reactions: reactors.map((r: any) => ({
        user: r._id,
        type: pick(REACTION_TYPES as unknown as string[]),
        createdAt: new Date(),
      })),
      viewCount: Math.floor(Math.random() * 1200) + 50,
      createdAt: daysAgo(Math.floor(i * 30 / POST_TEMPLATES.length), 8), // spread over 30 days
    });
    await post.save();
    postDocs.push(post);
  }
  console.log(`📝 Created ${postDocs.length} posts`);

  // ── 4. Comments on a third of posts ───────────────────────────────────────
  let commentCount = 0;
  for (const post of postDocs) {
    if (Math.random() > 0.35) continue; // skip ~35%
    const commenters = pickSome(users, 1, 4);
    for (const commenter of commenters) {
      const comment = await Comment.create({
        post: post._id,
        author: commenter._id,
        content: pick(COMMENT_BANK),
        createdAt: new Date(post.createdAt.getTime() + Math.random() * 3600 * 1000 * 6),
      });
      await Post.findByIdAndUpdate(post._id, { $push: { comments: comment._id } });
      commentCount++;

      // 25% chance of a reply
      if (Math.random() < 0.25) {
        const replier = pick(users.filter((u: any) => u._id.toString() !== commenter._id.toString()));
        const reply = await Comment.create({
          post: post._id,
          author: replier._id,
          content: pick(COMMENT_BANK),
          parentComment: comment._id,
          createdAt: new Date(comment.createdAt.getTime() + Math.random() * 1800 * 1000),
        });
        await Comment.findByIdAndUpdate(comment._id, { $push: { replies: reply._id } });
        commentCount++;
      }
    }
  }
  console.log(`💬 Created ${commentCount} comments`);

  // ── 5. Stories ────────────────────────────────────────────────────────────
  const storyTexts = [
    'Have an amazing day! ✨', 'Living my best life 🌟', 'Good vibes only 🙏',
    'Grateful for everything ❤️', 'Smiling today 😊', 'Hello from here 👋',
    'Make it count 💪', 'Chase the light 🌅', 'Stay curious 🧠', 'Be kind 🌿',
  ];
  await Story.insertMany(
    users.map((u: any, i: number) => ({
      author: u._id,
      media: { url: IMAGES[i % IMAGES.length], type: 'image' },
      text: storyTexts[i % storyTexts.length],
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      isActive: true,
    }))
  );
  console.log(`📸 Created ${users.length} stories`);

  // ⚠️ 2026-09-07: the original list here (Google's `gtv-videos-bucket`) now
  // returns 403 Forbidden on every file — confirmed via the browser Network
  // tab, not a CORS/network-block issue (the response even carries
  // Access-Control-Allow-Origin: *), the bucket itself has locked down
  // public access since. Swapped to Cloudinary's own official public demo
  // assets and MDN's documentation sample videos instead — both have a much
  // longer track record of staying open for exactly this kind of use, and
  // the Cloudinary ones in particular run on the same CDN this app's real
  // uploads already use. I could not verify network reachability for
  // either from the sandbox this fix was made in (no outbound network
  // access there) — if `npm run seed` + reloading Watch still shows a
  // failed request in the Network tab, report the new status code so the
  // list below can be corrected again.
  const VIDEOS = [
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
    'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    // ⚠️ 2026-09-07: 'bumblebee.mp4' at this path 404s — that filename was
    // a guess (made without network access to verify) and it was wrong.
    // Rather than guess a second unverified name, reusing 'friday.mp4' —
    // already confirmed loading — is the safe choice. If a genuinely
    // distinct 6th clip is wanted, verify the exact filename in a browser
    // first (MDN's own cc0-videos listing) before swapping this back in.
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
  ];
  const VIDEO_CAPTIONS = [
    'Quick clip from today 🎬', 'This made my whole week 😂', 'POV: it\'s finally the weekend',
    'Can\'t stop watching this 🔥', 'Filmed this on a whim, kinda love it', 'Rainy day mood 🌧️',
    'When the trail finally opens up 🏞️', 'Little behind-the-scenes moment', 'Testing out the new setup',
    'This is exactly the energy I needed today ✨', 'Saved this one for later, worth the wait',
    'Nothing beats a good road trip playlist 🚗',
  ];

  const VIDEO_COUNT = 12; // keep the same seed volume even though the URL pool above shrank to 6 known-good sources
  const videoDocs: any[] = [];
  for (let i = 0; i < VIDEO_COUNT; i++) {
    const author = users[i % users.length];
    const reactors = pickSome(users.filter((u: any) => u._id.toString() !== author._id.toString()), 0, 6);
    const commenters = pickSome(users, 0, 3);

    const video = new Video({
      author: author._id,
      url: VIDEOS[i % VIDEOS.length],
      // Portrait placeholder thumbnail — Cloudinary-uploaded videos derive
      // a real poster frame at upload time (see CreateVideoModal.tsx), but
      // seed data has no Cloudinary asset behind it, so a stock photo
      // stands in.
      thumbnail: `https://picsum.photos/seed/watch${i}/400/700`,
      caption: VIDEO_CAPTIONS[i % VIDEO_CAPTIONS.length],
      visibility: 'public',
      reactions: reactors.map((r: any) => ({
        user: r._id,
        type: pick(REACTION_TYPES as unknown as string[]),
        createdAt: new Date(),
      })),
      comments: commenters.map((c: any) => ({
        author: c._id,
        content: pick(COMMENT_BANK),
        createdAt: new Date(),
      })),
      viewCount: Math.floor(Math.random() * 5000) + 100,
      createdAt: daysAgo(Math.floor((i * 20) / VIDEO_COUNT), 8),
    });
    await video.save();
    videoDocs.push(video);
  }
  console.log(`🎬 Created ${videoDocs.length} videos`);

  // ── Events ───────────────────────────────────────────────────────────────
  // Cover images reuse the existing IMAGES pool (stock photos already
  // proven to load) — see the Watch seed-bucket lesson above (2026-09-07
  // (6)/(7)): don't hotlink a new, unverified external asset host when a
  // known-good one is already in use elsewhere in this file.
  const EVENT_DEFS = [
    { title: 'Weekend Hiking Meetup', description: 'Casual group hike, all paces welcome. Bring water!', location: 'Griffith Park, Los Angeles, CA', daysFromNow: 3 },
    { title: 'Product Launch Party', description: 'Celebrating the v2 launch with the whole team 🎉', location: 'Downtown Loft, Austin, TX', daysFromNow: 7 },
    { title: 'Community Coffee Meetup', description: 'Casual coffee & conversation, new faces always welcome.', location: 'Blue Bottle Coffee, San Francisco, CA', daysFromNow: 10 },
    { title: 'Live Music Night', description: 'Local bands, good drinks, better company 🎸', location: 'The Echo Lounge, Nashville, TN', daysFromNow: 14 },
    { title: 'Photography Walk', description: 'Bring a camera (phone counts!) — golden hour city walk.', location: 'Millennium Park, Chicago, IL', daysFromNow: 18 },
    { title: 'Yoga in the Park', description: 'Beginner-friendly morning flow, mats provided.', location: 'Washington Park, Denver, CO', daysFromNow: 21 },
  ];

  const eventDocs: any[] = [];
  for (let i = 0; i < EVENT_DEFS.length; i++) {
    const def = EVENT_DEFS[i];
    const host = users[i % users.length];
    const attendeePool = users.filter((u: any) => u._id.toString() !== host._id.toString());
    const going = pickSome(attendeePool, 1, 5);
    const interested = pickSome(attendeePool.filter((u: any) => !going.includes(u)), 0, 3);
    const startAt = new Date(Date.now() + def.daysFromNow * 24 * 3600 * 1000);

    const event = new Event({
      host: host._id,
      title: def.title,
      description: def.description,
      coverImage: `https://picsum.photos/seed/event${i}/800/400`,
      location: def.location,
      startAt,
      endAt: new Date(startAt.getTime() + 2 * 3600 * 1000),
      visibility: 'public',
      attendees: [
        ...going.map((u: any) => ({ user: u._id, status: 'GOING', respondedAt: new Date() })),
        ...interested.map((u: any) => ({ user: u._id, status: 'INTERESTED', respondedAt: new Date() })),
      ],
    });
    await event.save();
    eventDocs.push(event);
  }
  console.log(`📅 Created ${eventDocs.length} events`);

  // ── Marketplace ──────────────────────────────────────────────────────────
  // Listing photos reuse the existing IMAGES pool for the same reason as
  // Events' cover images above — known-good hosted URLs, not a fresh
  // hotlink target.
  const LISTING_DEFS = [
    { title: 'Mountain Bike, barely used', description: 'Great condition, upgraded brakes. Selling because I moved.', price: 350, category: 'OTHER', condition: 'LIKE_NEW', location: 'Denver, CO' },
    { title: 'Vintage Leather Sofa', description: 'Solid wood frame, some wear on the arms but very comfortable.', price: 220, category: 'FURNITURE', condition: 'GOOD', location: 'Austin, TX' },
    { title: 'iPhone 13, unlocked', description: '128GB, battery health 89%. Comes with original box and charger.', price: 400, category: 'ELECTRONICS', condition: 'GOOD', location: 'San Francisco, CA' },
    { title: "Kids' Winter Coat Bundle (size 6-7)", description: '3 coats, all in great shape, outgrown quickly.', price: 25, category: 'CLOTHING', condition: 'GOOD', location: 'Chicago, IL' },
    { title: 'Standing Desk, electric', description: 'Dual motor, memory presets. Selling as I switched jobs and no longer WFH.', price: 180, category: 'HOME_GARDEN', condition: 'LIKE_NEW', location: 'Nashville, TN' },
    { title: '2015 Honda Civic', description: '92k miles, clean title, well maintained, new tires last year.', price: 8900, category: 'VEHICLES', condition: 'GOOD', location: 'Los Angeles, CA' },
  ];

  const listingDocs: any[] = [];
  for (let i = 0; i < LISTING_DEFS.length; i++) {
    const def = LISTING_DEFS[i];
    const seller = users[(i + 3) % users.length];
    const listing = new MarketplaceListing({
      seller: seller._id,
      title: def.title,
      description: def.description,
      price: def.price,
      category: def.category,
      condition: def.condition,
      location: def.location,
      images: [IMAGES[i % IMAGES.length], IMAGES[(i + 1) % IMAGES.length]],
      status: i === 0 ? 'SOLD' : 'ACTIVE', // one sold listing to exercise that state on first run
    });
    await listing.save();
    listingDocs.push(listing);
  }
  console.log(`🛒 Created ${listingDocs.length} marketplace listings`);

  // ── 6. Sample conversation ────────────────────────────────────────────────
  const conv = await Conversation.create({
    participants: [demo._id, alice._id],
    isGroup: false,
    lastMessageAt: new Date(),
  });

  const msgThreads = [
    { sender: alice._id, content: "Hey Demo! Welcome to PluseConnect 👋 How's it going?",          minsAgo: 12 },
    { sender: demo._id,  content: "Alice! Great to be here 😊 The feed looks amazing already.",  minsAgo: 10 },
    { sender: alice._id, content: "Right?! Make sure you check out the stories, they're so fun", minsAgo: 9  },
    { sender: demo._id,  content: "Just added mine! Did you see the virtual scroll on the feed? So smooth 🔥", minsAgo: 7 },
    { sender: alice._id, content: "Yes!! Loads instantly no matter how far you scroll. Impressive tech 💻", minsAgo: 5  },
    { sender: demo._id,  content: "Let me know if you want to grab coffee and catch up properly ☕", minsAgo: 2  },
    { sender: alice._id, content: "100%! This weekend? 🙌",                                       minsAgo: 1  },
  ];

  let lastMsg: any;
  for (const m of msgThreads) {
    lastMsg = await Message.create({
      conversation: conv._id,
      sender: m.sender,
      content: m.content,
      createdAt: new Date(Date.now() - m.minsAgo * 60 * 1000),
    });
  }
  await Conversation.findByIdAndUpdate(conv._id, { lastMessage: lastMsg._id, lastMessageAt: lastMsg.createdAt });
  console.log('💌 Created sample conversation');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  👤 Users:         ${users.length}`);
  console.log(`  📝 Posts:         ${postDocs.length}  (enough to test virtual scroll)`);
  console.log(`  💬 Comments:      ${commentCount}`);
  console.log(`  📸 Stories:       ${users.length}`);
  console.log(`  🎬 Videos:        ${videoDocs.length}`);
  console.log(`  📅 Events:        ${eventDocs.length}`);
  console.log(`  🛒 Listings:      ${listingDocs.length}`);
  console.log(`  🤝 Friendships:   ${friendPairs.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  📧 Email:         demo@example.com');
  console.log('  🔑 Password:      Password1');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message ?? err);
  mongoose.disconnect().finally(() => process.exit(1));
});
