# PulseConnect — Full-Stack Socialbook-Style Social Network

PulseConnect is a modern, high-performance, full-stack social media application engineered to replicate the seamless user experience and rich feature set of SocialApp. Designed with scalability and responsiveness in mind, it handles real-time interactions, data-heavy feeds, and fluid navigation for a production-ready environment.

Core Features

    Interactive Social Feed: Create, edit, and delete text and media posts, engage with threaded comments, and interact using a Socialbook-style multi-emoji reaction system.

    Real-Time Communications: Instant messaging, live notifications, and instantaneous feed updates driven by bidirectional WebSocket connections.

    Rich User Profiles: Customizable personal spaces featuring user bios, profile avatars, media galleries, and dynamic friend or follower relationship management.

    Optimized Performance: Utilizes virtual scrolling algorithms to render thousands of posts in long-form feeds smoothly without layout jank or performance degradation.

Technology Stack

    Frontend: React and TypeScript, paired with responsive CSS layout frameworks for multi-device support.

    API Architecture: GraphQL for precise, robust data fetching, mutations, and real-time subscription streaming.

    Backend & Database: Node-based server architecture integrated with MongoDB for flexible schema design and rapid document retrieval.

    Real-Time Layer: WebSockets for instantaneous messaging and push updates.

Engineering Highlights

    End-to-end type safety enforced via TypeScript across both client-side components and server operations.

    Optimized data-loading strategies, including pagination and GraphQL query batching, to minimize network bandwidth consumption.

    Modular, production-grade architecture built with clean separation of concerns, making it ready for horizontal scaling and containerized deployment.
---

## 🗂️ Project Structure

```
pluseconnect/
├── backend/                   # Node.js + Apollo GraphQL API
│   └── src/
│       ├── config/
│       │   └── database.ts        # MongoDB connection
│       ├── models/
│       │   ├── User.ts            # User schema
│       │   ├── Post.ts            # Post + media + reactions
│       │   ├── Comment.ts         # Nested comments
│       │   ├── Message.ts         # Conversations + messages
│       │   ├── Notification.ts    # Notification system
│       │   └── Story.ts           # 24h stories (TTL index)
│       ├── graphql/
│       │   ├── typedefs/          # Full GraphQL schema
│       │   ├── resolvers/
│       │   │   ├── auth.resolvers.ts
│       │   │   ├── post.resolvers.ts
│       │   │   ├── user.resolvers.ts
│       │   │   ├── message.resolvers.ts
│       │   │   ├── subscription.resolvers.ts
│       │   │   └── other.resolvers.ts  # Comments, notifs, stories
│       │   └── context.ts         # Auth + PubSub context
│       ├── scripts/
│       │   └── seed.ts            # Demo data seeder
│       └── index.ts               # Express + Apollo + WS server
│
├── frontend/                  # React + Vite SPA
│   └── src/
│       ├── lib/
│       │   ├── apollo.ts          # Apollo client + WS split link
│       │   └── graphql.ts         # All GQL queries/mutations/subs
│       ├── store/
│       │   └── index.ts           # Zustand: auth, UI, notifications
│       ├── utils/index.ts         # Helpers, formatters, constants
│       ├── components/
│       │   ├── Feed/
│       │   │   └── Feed.tsx       # Virtual scroll feed + live updates
│       │   ├── Post/
│       │   │   ├── PostCard.tsx   # Post with reactions, media, menu
│       │   │   ├── CreatePost.tsx # Composer with visibility picker
│       │   │   └── CommentSection.tsx  # Nested comments
│       │   ├── Stories/
│       │   │   └── StoriesBar.tsx # Story rings + full-screen viewer
│       │   ├── Chat/
│       │   │   └── ChatPanel.tsx  # Floating chat window
│       │   ├── Sidebar/
│       │   │   ├── Navbar.tsx     # Top nav + search + notifications
│       │   │   ├── LeftSidebar.tsx
│       │   │   └── RightSidebar.tsx
│       │   └── UI/
│       │       ├── Avatar.tsx     # Avatar with online indicator
│       │       └── Skeleton.tsx   # Shimmer loaders
│       └── pages/
│           ├── Home.tsx           # Feed page + layout
│           ├── Auth.tsx           # Login + Register
│           ├── Profile.tsx        # User profile page
│           └── Messages.tsx       # Full messenger page
│
└── shared/                    # Shared TypeScript types
```

---

## ⚡ Tech Stack

### Backend
| Tech | Role |
|------|------|
| **Node.js + Express** | HTTP server |
| **Apollo Server 4** | GraphQL API |
| **graphql-ws** | WebSocket subscriptions |
| **Mongoose** | MongoDB ODM |
| **graphql-subscriptions** | PubSub for real-time events |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT authentication |
| **Zod** | Input validation |
| **DataLoader** | N+1 query batching |

### Frontend
| Tech | Role |
|------|------|
| **React 18** | UI framework |
| **Vite** | Build tool |
| **@apollo/client** | GraphQL + subscriptions |
| **graphql-ws** | WebSocket transport |
| **@tanstack/react-virtual** | Virtual scrolling |
| **Zustand** | Global state |
| **Framer Motion** | Animations |
| **Tailwind CSS** | Styling |
| **React Router v6** | Routing |
| **Radix UI** | Accessible primitives |
| **react-hot-toast** | Toast notifications |
| **date-fns** | Date formatting |
| **Lucide React** | Icons |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional, for distributed PubSub)

### 1. Clone & Install

```bash
git clone <repo>
cd pluseconnect
npm run setup
```

### 2. Configure Environment

```bash
# backend/.env (already created)
MONGODB_URI=mongodb://localhost:27017/pluseconnect
JWT_SECRET=your-super-secret-key
PORT=4000
FRONTEND_URL=http://localhost:5173

NODE_ENV=development
PORT=4000

# Your Atlas connection string
MONGODB_URI=mongodb+srv://mathewanm_db_user:<db_password>@cluster0.p3auebr.mongodb.net/pluseconnect?retryWrites=true&serverSelectionTimeoutMS=5000

# CHANGE THIS in production — at least 32 random characters
JWT_SECRET=change-me-to-a-long-random-secret-in-production
JWT_EXPIRES_IN=7d

# Frontend URL (used for CORS)
FRONTEND_URL=http://localhost:5173

# Cloudinary (photo/video upload) — from cloudinary.com/console dashboard
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret


### 3. Seed Demo Data

```bash
cd backend
npm run seed
# 👤 Created 10 users
# 🤝 Created 22 friendships
# 📝 Created 49 posts
# 💬 Created 58 comments
# 📸 Created 10 stories
# 💌 Created sample conversation
# Login: demo@example.com / password123
```

### 4. Start Development

```bash
# From root — starts both backend and frontend
npm run dev

# Or separately:
npm run dev:backend   # http://localhost:4000/graphql
npm run dev:frontend  # http://localhost:5173
```

---

## 🔑 Key Features

### Real-Time: WebSockets (dev) vs Polling (production on Vercel)

This app supports both, and which one is actually active depends on where it's running — this is architectural, not a bug:

- **`backend/src/index.ts`** (the standalone dev server — `npm run dev`, or self-hosted on a normal long-running box) runs a real WebSocket server (`ws` + `graphql-ws`) alongside the HTTP server, listening on `/graphql`. Subscriptions here are genuine push-based real-time.
- **`backend/api/`** (the Vercel serverless deployment) has **no WebSocket server** — serverless functions are short-lived request-in/response-out, they can't hold a persistent WS connection open, so this was never built for that entrypoint.

The frontend decides which mode to use via `subscriptionsEnabled` in `frontend/src/lib/apollo.ts`:
```js
subscriptionsEnabled = VITE_ENABLE_SUBSCRIPTIONS === 'true' || isDevServer || isLocalhost
```
So local dev gets real WebSocket subscriptions; the live Vercel deployment falls back to polling unless `VITE_ENABLE_SUBSCRIPTIONS=true` is explicitly set (which it shouldn't be there, since no WS server exists to connect to).

**Polling intervals in production** (`POLL_INTERVAL_MS` in `frontend/src/lib/apollo.ts`):

| What | Interval |
|---|---|
| New chat messages | 3s |
| Conversations list | 8s |
| Feed new-posts check | 12s |

Chat feels close to real-time (3s) but isn't a true push — it's the same UI either way, so this is invisible day-to-day, but worth knowing if you're debugging a "why didn't this update instantly" question on the live site specifically.

**Future exploration:** getting genuine WebSocket subscriptions in production would need either (a) a separate always-on process outside this Vercel serverless setup — e.g. a small Node server on Railway/Render/Fly.io just for the WS layer — or (b) looking into Vercel's own realtime/Edge WebSocket support, which has been evolving and may now cover this use case. Either is a real infrastructure decision, not a quick code change, so it's flagged here for whenever that becomes worth prioritizing rather than attempted speculatively.

- **Live feed** — new posts appear as toast banners
- **Instant messaging** — chat with typing indicators
- **Live notifications** — friend requests, likes, comments
- **Online presence** — green dots update in real time

### Performance
- **Virtual scroll** with `@tanstack/react-virtual` — renders only visible posts/messages, handles 10,000+ items
- **Cursor-based pagination** — efficient infinite scroll
- **Apollo cache** — smart normalization + merge policies
- **Optimistic updates** — messages appear instantly before server confirms

### Facebook-Like Features
- 📖 **News Feed** — posts from friends, infinite scroll
- 📸 **Stories** — 24h stories with ring UI and full-screen viewer
- ❤️ **Reactions** — Like/Love/Haha/Wow/Sad/Angry with hover picker
- 💬 **Comments** — nested replies, threaded
- 👥 **Friends** — requests, accept/decline, suggestions
- 🔔 **Notifications** — all activity, real-time badge
- 💌 **Messenger** — floating chat panel + full-page messages
- 👤 **Profiles** — cover photo, bio, friends grid, posts tab
- 🌙 **Dark mode** — full dark theme
- 🔍 **Search** — users by name/username

### Data Architecture
- **6 MongoDB models** with proper indexes
- **TTL index** on Stories (auto-expire after 24h)
- **Cursor-based** feed pagination
- **PubSub events** for all subscription types
- **JWT auth** on both HTTP and WebSocket connections

---

## 📡 GraphQL API

### Key Queries
```graphql
query { feed(cursor: String, limit: Int) { posts hasMore nextCursor } }
query { me { id fullName avatar } }
query { stories { user hasUnviewed stories { id media } } }
query { conversations { id unreadCount lastMessage } }
query { notifications(limit: 15) { type message isRead } }
```

### Key Mutations
```graphql
mutation { createPost(input: { content, media, visibility }) { id } }
mutation { reactToPost(postId: ID!, type: ReactionType!) { reactionSummary } }
mutation { sendMessage(input: { conversationId, content }) { id } }
mutation { sendFriendRequest(userId: ID!) { id } }
```

### Subscriptions
```graphql
subscription { newPost { id content author { fullName } } }
subscription { newMessage(conversationId: ID!) { id content sender } }
subscription { typingStatus(conversationId: ID!) { userId isTyping } }
subscription { newNotification { type message sender { fullName } } }
```

---

## 🏗️ Architecture Decisions

**Virtual Scroll**: The feed uses `@tanstack/react-virtual` with dynamic measurement. Each `PostCard` is measured after mount so the virtualizer handles variable heights correctly. Overscan of 3 items prevents blank flash on fast scroll.

**Apollo Split Link**: HTTP for queries/mutations, WebSocket for subscriptions. The split is determined by operation type at link creation time.

**Cursor Pagination**: Uses base64-encoded ISO timestamps as cursors. MongoDB query: `{ createdAt: { $lt: decodedCursor } }`. Apollo cache merge policy deduplicates appended pages.

**Subscription Namespacing**: Conversation-specific subs use `${EVENT_NAME}.${conversationId}` channels to avoid broadcasting to all users.

**Optimistic Messages**: Messages are inserted optimistically with a temp ID; Apollo reconciles when the real response arrives.

---

## 🐛 Known Gaps / Bug Log

Running log of gaps found during review, kept up to date as issues are found and fixed. Newest entries at the top. Full details for each fix are below this summary — the table is just for quickly finding one.

### Todo list (current)

- [x] Messages page's "New message" pencil icon had no `onClick` handler — fixed (2026-08-23 (1))
- [x] Friends page — replaced the "Coming Soon" placeholder with a real page (2026-08-23 (2))
- [x] Notification click-through — fixed (2026-08-23 (3))
- [x] Photos tab had no way to delete a post; upload had no real server-side validation — both fixed (2026-08-23 (4))
- [x] Reaction picker popup closed before you could click it — fixed (2026-08-23 (5))
- [x] Duplicated chat logic extracted into a shared hook — fixed (2026-08-23 (6))
- [x] Apollo Server v4 EOL upgraded to v5 — fixed (2026-08-23 (6))
- [x] Saved page — real bookmarking, replaced the "Coming Soon" placeholder (2026-08-24 (1))
- [x] Settings page — privacy, notifications, password change, dark mode, real backend behind all of it (2026-08-24 (2))
- [x] "Add Story" (+) had no `onClick` handler; text-only stories were blocked by an overly strict schema constraint — both fixed (2026-08-24 (3))
- [x] Edit Cover Photo / Edit Profile Photo buttons had no `onClick` handlers — fixed (2026-08-24 (4))
- [x] "Edit post" and "Edit profile" buttons had no handlers; Cloudinary uploads were 401ing on every request — all fixed (2026-08-24 (5))
- [x] Settings page: unreadable selected-option text; toggle switches visually misaligned — fixed (2026-08-24 (6))
- [ ] Three nav destinations remain: Watch, Marketplace, Events — bigger builds needing new data models (video feed, listings, RSVPs), scoping in progress.

### Open items

- [ ] Build real Watch / Marketplace / Events pages — currently "Coming Soon" placeholders (see 2026-08-22 (1)). No backend schema exists yet for any of these.
- [ ] No automated test currently guards against a populated-list/ref field silently returning `null`, or against the Mongoose single-nested-subdocument default-object gotcha that caused entry 2026-08-22 (10). Worth a resolver-level integration test suite at some point — `GET_USER` with a seeded user that has friends, `feed`/`post` with a seeded post that has tags, `sendMessage` with a `recipientId` (no prior conversation), and a message with no `media` attached.
- [ ] **Verify your Vercel project's Node.js runtime is set to 20.x or later.** Apollo Server 5 requires Node ≥20 — this is a project-level dashboard setting Claude cannot see or change remotely. If it's currently pinned to 18.x, the backend will fail to boot after this deploy. Check: Vercel dashboard → backend project → Settings → General → Node.js Version.
- [ ] **Explore real WebSocket subscriptions in production** (currently polling on Vercel — see the "Real-Time" section above for why). Two directions worth evaluating when this becomes a priority: a separate always-on WS process (Railway/Render/Fly.io), or Vercel's own evolving realtime/Edge WebSocket support. Not urgent — polling is functionally invisible to users today — but flagged so it doesn't get re-investigated from scratch later.

### At a glance

| # | Date | Issue | Status |
|---|------|-------|--------|
| 2026-08-24 (6) | Aug 24 | Settings page unreadable text + misaligned toggles — traced to an incomplete Tailwind color palette | ✅ Fixed |
| 2026-08-24 (5) | Aug 24 | "Edit post"/"Edit profile" had no handlers; Cloudinary uploads 401ing (bad signed param); Create Story modal cut off | ✅ Fixed |
| 2026-08-24 (4) | Aug 24 | Edit Cover Photo / Edit Profile Photo buttons had no handlers | ✅ Fixed |
| 2026-08-24 (3) | Aug 24 | "Add Story" (+) had no handler; text-only stories were blocked by schema | ✅ Fixed |
| 2026-08-24 (2) | Aug 24 | Settings page built for real — privacy, notifications, password, dark mode | ✅ Fixed |
| 2026-08-24 (1) | Aug 24 | Saved page built for real — bookmarking a post now actually does something | ✅ Fixed |
| 2026-08-23 (6) | Aug 23 | Chat logic duplication extracted into a shared hook; Apollo Server 4 (EOL) upgraded to 5 | ✅ Fixed |
| 2026-08-23 (5) | Aug 23 | Reaction picker popup on Like closed before you could click an emoji | ✅ Fixed |
| 2026-08-23 (4) | Aug 23 | Photos tab had no delete option; upload had no real server-side validation | ✅ Fixed |
| 2026-08-23 (3) | Aug 23 | Notification click-through — likes/comments went nowhere; no post detail page existed at all | ✅ Fixed |
| 2026-08-23 (2) | Aug 23 | Friends page built out for real (was a "Coming Soon" placeholder) | ✅ Fixed |
| 2026-08-23 (1) | Aug 23 | Messages page "New message" pencil icon had no handler | ✅ Fixed |
| 2026-08-22 (10) | Aug 22 | `Message.media` Mongoose subdocument defaulted to `{}`, causing "Internal server error" on every text-only chat message | ✅ Fixed |
| 2026-08-22 (9) | Aug 22 | GraphQL errors were never logged server-side in production | ✅ Fixed |
| 2026-08-22 (8) | Aug 22 | Regression: entry (7)'s routing fix broke `/graphql` and `/health` | ✅ Fixed |
| 2026-08-22 (7) | Aug 22 | Root cause of the CORS saga: Vercel's bracket catch-all only matches single-segment paths | ✅ Fixed |
| 2026-08-22 (6) | Aug 22 | Chat close-button investigation, notification not removed after accept/decline, chat input not clearing | ✅ Fixed |
| 2026-08-22 (5) | Aug 22 | Profile "Photos" tab was a hardcoded placeholder | ✅ Fixed |
| 2026-08-22 (4) | Aug 22 | Photo upload CORS error masked a server crash | ✅ Fixed |
| 2026-08-22 (3) | Aug 22 | Profile "Message" button passed a user id instead of a conversation id | ✅ Fixed |
| 2026-08-22 (2) | Aug 22 | `Post.tags` had no field resolver (same bug class as `User.friends`) | ✅ Fixed |
| 2026-08-22 (1) | Aug 22 | 6 nav links had no matching routes, silently bounced to Home | ✅ Interim fix (placeholders) |
| 2026-08-21 (4) | Aug 21 | Media upload moved off local disk to Cloudinary | ✅ Fixed |
| 2026-08-21 (3) | Aug 21 | Check-in used the native `window.prompt()` | ✅ Fixed |
| 2026-08-21 (2) | Aug 21 | Friend request notifications had no Accept/Decline; Photo/Video composer was decorative | ✅ Fixed |
| 2026-08-21 (1) | Aug 21 | Profile avatar off-center; Friends tab empty despite correct count | ✅ Fixed |

<details>
<summary><strong>Full entry details</strong> (click to expand)</summary>

### 2026-08-24 (6) — Settings page: unreadable text and misaligned toggles, both traced to one root cause

**Symptom (reported with a screenshot):** on the Settings page, the selected privacy option ("Public") showed white text that was nearly impossible to read against its background, and the notification toggle switches looked visually misaligned.

**Root cause — an incomplete Tailwind color palette, not a one-off styling mistake.** `tailwind.config.js`'s `brand` color only defined shades `50, 100, 500, 600, 700`. Several components used `dark:bg-brand-900/20` for a "selected/active" highlight — but since `brand-900` doesn't exist, Tailwind's compiler can't generate CSS for it and silently drops the class entirely. That left only `bg-brand-50` (the light-mode class, a very pale near-white blue, `#eff6ff`) actually applying — in *both* light and dark mode, since it has no `dark:` prefix to scope it. Combined with `dark:text-white` (which **does** generate fine, since white is always available), the result was white text sitting on a near-white background in dark mode: exactly the unreadable combination in the screenshot. This wasn't isolated to Settings — the same `bg-brand-50 dark:bg-brand-900/20` pattern was copy-pasted into `Friends.tsx` and `CreateStoryModal.tsx` too, so those had the identical latent bug, just not yet reported.

The toggle switches were a separate issue: the positioning math was actually exact (44px track, 20px knob, 2px margin on every side, in both states) — but the track had no `overflow-hidden`, so the knob's drop shadow could visually bleed past the pill's rounded corners, reading as "misaligned" even though the underlying position was correct.

**Fix:**
1. `tailwind.config.js` — completed the `brand` color scale (`200`–`950`), fixing the root cause for all three files that relied on shades which didn't exist, rather than patching each usage site individually. Verified by compiling and grepping the actual output CSS for the new color value, confirming Tailwind now generates real rules where it previously silently dropped them.
2. `frontend/src/pages/Settings.tsx`'s `Toggle` component — added `overflow-hidden` to the track so any shadow bleed clips cleanly to the pill shape, and simplified the knob's position math to be equally exact but easier to verify at a glance (same rendered result: 2px margin on every side, in both states).

**Files touched:** `frontend/tailwind.config.js`, `frontend/src/pages/Settings.tsx`

**Status:** ✅ Fixed, typechecked clean, verified with a real production build — confirmed the new color literally appears in the compiled CSS output, not just that the config parses.

### 2026-08-24 (5) — Edit post, Edit profile, a broken Cloudinary signature, and a cut-off modal

Four issues reported together in one round.

**1. "Edit post" had no handler.** Same pattern as several other buttons this session — fully styled, did nothing. The backend `updatePost(id, content)` mutation already existed (flagged as a related finding back in entry (1)). Added an inline edit mode directly on the post card: clicking "Edit post" swaps the content into an editable textarea in place, with Cancel/Save — no separate modal needed since it's just editing text that's already visible. `post.isEdited` already had an "(edited)" label wired up in the UI from before; it just starts showing up now that posts can actually be edited.

**2. "Edit profile" had no handler.** `frontend/src/components/Profile/EditProfileModal.tsx` (new) — first/last name, bio (with a character counter), location, website. All backed by the existing `updateProfile` mutation, which already supported every one of these fields — this was purely a missing UI. One small UX touch: if someone types `example.com` instead of `https://example.com`, it's normalized automatically rather than failing the backend's URL validation with a confusing error.

**3. Cloudinary uploads returning 401 "Invalid Signature" on every upload.** This one was a real regression from the "no server-side upload validation" fix a few sessions back (2026-08-23 (4)). That fix added `max_file_size` as a *signed* parameter — but confirmed via Cloudinary's own docs, `max_file_size` is only a valid option inside **Upload Presets**, not a parameter you can pass on a raw signed `/upload` call. Cloudinary silently excluded it when recomputing the signature to verify the request, while our server had included it when generating the signature — the two never matched, so every single upload failed with "Invalid Signature," photo posts and stories alike.
   - *Fix:* removed `max_file_size` from the signed params entirely (keeping `allowed_formats`, which — confirmed in Cloudinary's own error message reconstructing the correct string — genuinely does work as a signed raw-upload parameter). To avoid simply losing server-side size enforcement again, added a new `POST /api/upload/verify` step: after Cloudinary accepts the upload, the client reports the actual size back to our server, which deletes the asset via the Admin API (secret key, never exposed to the browser) and rejects it if it's over the limit. A tampered client can't bypass this the way it could bypass the old client-only check, since the deletion decision is made server-side.

**4. Create Story modal cut off at the bottom, Share button inaccessible.** The modal's photo/video preview used a fixed `aspect-[9/16]` on a 360px-wide box (~640px tall) plus header/tabs/controls/footer, comfortably exceeding `90vh` on any reasonably-sized screen — and the container used `overflow-hidden`, so the excess just got clipped instead of becoming scrollable.
   - *Fix:* restructured into header (pinned) → scrollable middle section (preview + controls) → footer (pinned), and capped the preview at `max-h-[45vh]` so it shrinks on shorter viewports instead of staying a fixed height regardless of screen size. The Share button is now always visible.

**Files touched:** `backend/src/routes/upload.ts`, `frontend/src/utils/index.ts`, `frontend/src/components/Stories/CreateStoryModal.tsx`, `frontend/src/lib/graphql.ts`, `frontend/src/components/Post/PostCard.tsx`, `frontend/src/components/Profile/EditProfileModal.tsx` (new), `frontend/src/pages/Profile.tsx`

**Status:** ✅ All four fixed, typechecked clean, verified with real production builds on both projects.

### 2026-08-24 (4) — Edit Cover Photo / Edit Profile Photo now work

**What was there before:** both buttons rendered fully styled, with icons and hover states — and neither had an `onClick` handler at all. Same class of gap as several others found this session (Save post, New message, Edit post). The backend's `updateProfile` mutation already existed for text fields (bio, location, etc.) but had no `avatar`/`coverPhoto` fields to update either — the photo-upload path genuinely didn't exist anywhere, frontend or backend.

**Fix:**
1. Added `avatar`/`coverPhoto` (both optional URLs) to `UpdateProfileInput` and its Zod validation — the resolver already did a generic `$set: data`, so no resolver code changes were needed once the schema accepted them.
2. Wired both buttons to the same Cloudinary upload flow the post composer already uses (`uploadMedia()`) — pick a file, upload it, then call `updateProfile` with the resulting URL.
3. Added a small camera-icon button directly on the avatar (the more standard place people expect to click to change a profile photo), in addition to fixing the existing "Edit cover photo" button in place.
4. The online-status green dot and the new camera button would have overlapped in the same corner on your own profile — the dot now only shows on other people's profiles, where the camera button doesn't exist anyway.

No `refetchQueries` needed — `updateProfile`'s own mutation response already returns the updated fields, and Apollo's normalized cache updates the same `User` entity the profile page is already reading from.

**Files touched:** `backend/src/graphql/typedefs/index.ts`, `backend/src/lib/validation.ts`, `frontend/src/lib/graphql.ts`, `frontend/src/pages/Profile.tsx`

**Status:** ✅ Fixed, typechecked clean, verified with a real production build.

### 2026-08-24 (3) — "Add Story" now works; text-only stories were also being blocked by an overly strict schema

**Two issues, reported together:**

1. **Clicking the "+" on your own story badge did nothing** — `StoriesBar.tsx`'s "Add your story" element was a plain `<div>` with no click handler at all.
2. **Friends' stories disappearing after a day** — this turned out to be **correct, intended behavior**, not a bug: the seed script sets `expiresAt` to exactly 24 hours from whenever it's run, matching how Stories work on Instagram/Facebook/Snapchat everywhere. The seeded stories genuinely expired on schedule. Re-running `npm run seed` generates fresh ones — no code change needed or appropriate here, since "expires after 24h" is the entire point of a Story.

**What the Add Story fix uncovered:** `CreateStoryInput.mediaUrl`/`mediaType` were required (`String!`), and `Story.media` itself was non-nullable — meaning a text-only story (just a colored background and some text) could never actually be created, even though `text`/`backgroundColor` fields existed on the type and the story *viewer* already had full rendering logic for a text-only story with no media. The creation path just couldn't reach it. Additionally, `Story.ts`'s Mongoose schema marked `media.url`/`media.type` as `required: true`, which is what had been silently preventing the exact same "empty object default" bug that hit `Message.media` back in entry 2026-08-22 (10) — required fields meant Mongoose validation would reject an incomplete document rather than silently saving a broken one, but it also meant text-only stories were flatly impossible.

**Fix:**
1. `backend/src/models/Story.ts` — `media` relaxed to optional, wrapped as an explicit sub-schema with `default: undefined` (same fix pattern as `Message.media`, applied proactively this time rather than after a bug report).
2. `Story.media` (GraphQL) made nullable; `CreateStoryInput.mediaUrl`/`mediaType` made optional; resolver now requires *either* media or non-empty text, not always media.
3. `frontend/src/components/Stories/CreateStoryModal.tsx` (new) — lets you create a photo/video story (uploaded via the same Cloudinary flow as everything else) or a text-only story with a background color picker, live preview matching what the viewer will actually show.

**Files touched:** `backend/src/models/Story.ts`, `backend/src/graphql/typedefs/index.ts`, `backend/src/graphql/resolvers/other.resolvers.ts`, `frontend/src/lib/graphql.ts`, `frontend/src/components/Stories/StoriesBar.tsx`, `frontend/src/components/Stories/CreateStoryModal.tsx` (new)

**Status:** ✅ Fixed, typechecked clean, verified with a real production build.

### 2026-08-24 (2) — Settings page built for real

**What was there before:** a "Coming Soon" placeholder. `User.privacySettings` and `User.notificationSettings` already existed as Mongoose schema fields with sensible defaults, but were completely unexposed — no GraphQL type, no query, no mutation, nothing. There was also no way to change your password at all anywhere in the app.

**What this adds:**

*Backend:*
1. `PrivacySettings`/`NotificationSettings` GraphQL types, exposed on `User` — but only populated when the viewer **is** the account being queried (`me`, essentially). Anyone else querying returns `null` for these fields, same as if they didn't exist — settings aren't part of a public profile.
2. `updatePrivacySettings` / `updateNotificationSettings` mutations — partial updates only touch the field you actually pass, using dotted-path `$set` (`privacySettings.profileVisibility`) rather than overwriting the whole sub-object, so changing one setting can't accidentally reset its sibling to a schema default.
3. `changePassword(currentPassword, newPassword)` — verifies the current password via the existing `comparePassword` method before allowing the change, and re-fetches a real (non-lean) Mongoose document rather than reusing the lean `context.user`, since the password-hashing `pre('save')` hook only runs on `.save()`.

*Frontend:* `frontend/src/pages/Settings.tsx` (new) — Privacy (profile/posts visibility, three-way radio), Notifications (email/push toggles), Appearance (dark mode — reuses the existing store toggle rather than duplicating it), Change Password (with a show/hide toggle and clear validation messages), and Log Out. All settings changes are optimistic (update the UI immediately, revert with a toast if the mutation fails) rather than waiting on a round-trip for a simple toggle.

**Files touched:** `backend/src/models/User.ts` (no schema change needed — fields already existed), `backend/src/graphql/typedefs/index.ts`, `backend/src/graphql/resolvers/auth.resolvers.ts`, `backend/src/lib/validation.ts`, `frontend/src/lib/graphql.ts`, `frontend/src/pages/Settings.tsx` (new), `frontend/src/App.tsx`

**Status:** ✅ Fixed, typechecked clean, verified with a real production build.

### 2026-08-24 (1) — Saved page built for real

**What was there before:** a "Coming Soon" placeholder, and — found while investigating — `PostCard.tsx`'s post menu already had a "Save post" button rendered, with **no `onClick` handler at all**. Same class of gap as the "New message" pencil icon and the Photos tab delete button before those got fixed: UI that looked finished but did nothing, and zero backend support behind it (no field on `User`, no mutation, no query).

**What this adds:**

*Backend:*
1. `User.savedPosts: [ObjectId]` — a plain array of post ids, not subdocuments (there's nothing else to store per save, so no need for the extra structure — and no per-save timestamp, which shapes the pagination approach below).
2. `Post.isSaved: Boolean!` field resolver — computed per viewing user, same pattern as `myReaction`.
3. `savePost(postId)` / `unsavePost(postId)` mutations — idempotent either direction via `$addToSet`/`$pull`.
4. `savedPosts(cursor, limit)` query, same `FeedConnection` shape as `feed`/`userPosts`/`userPhotos` for a consistent pagination pattern — but since there's no per-save timestamp to cursor on (just an array of ids), this one cursors on a plain numeric offset instead of the date-based cursor the others use. `$addToSet` appends, so the array's natural order is oldest-saved-first; reversed for a most-recently-saved-first feed.

*Frontend:* wired the existing "Save post" button in `PostCard.tsx` (toggles to "Remove from Saved" with a filled bookmark icon, optimistic UI via `cache.modify`) and built `frontend/src/pages/Saved.tsx` (new), which reuses `PostCard` directly rather than building separate rendering logic — same approach as the Photos tab and the post detail page.

**Related finding, fixed separately:** `PostCard.tsx`'s "Edit post" button had the exact same problem — no `onClick` handler — but the backend `updatePost(id, content)` mutation already existed. Flagged here as out of scope for this entry; wired up shortly after in 2026-08-24 (5).

**Files touched:** `backend/src/models/User.ts`, `backend/src/graphql/typedefs/index.ts`, `backend/src/graphql/resolvers/post.resolvers.ts`, `frontend/src/lib/graphql.ts`, `frontend/src/components/Post/PostCard.tsx`, `frontend/src/pages/Saved.tsx` (new), `frontend/src/App.tsx`

**Status:** ✅ Fixed, typechecked clean, verified with a real production build.

### 2026-08-23 (6) — Chat logic deduplicated into a shared hook; Apollo Server upgraded to v5

Two unrelated cleanup items tackled together at the user's request, both from the "smaller, deferred items" list.

**1. Chat logic duplication.** `ChatPanel.tsx` (floating popup) and `Messages.tsx` (full page) each independently implemented message fetching, sending (including the pending-conversation flow from 2026-08-22 (3)), typing indicators, and subscriptions — nearly 1,000 combined lines with heavy overlap, flagged as a risk during the 2026-08-23 cleanup pass but deliberately left alone at the time since both implementations had just been stabilized through a long debugging session.

Extracted into `frontend/src/hooks/useConversationChat.ts`, used by both call sites. Rendering (very different between a compact popup and a full virtualized page) stayed in each component — only the actual chat *logic* moved. A few behavioral differences between the two original implementations were deliberately preserved rather than silently merged away: the popup uses a 40-message page size, the full page uses 50; the popup only marks messages read while open and not minimized, the full page always does. Both are now explicit hook parameters instead of hard-coded per file.

One real bug surfaced *while* extracting this, not before: the full Messages page relied on switching conversations via `handleSelectConv` explicitly resetting typing/draft state, while the popup got the same effect for free by fully remounting (via a changing `key` prop) every time the conversation changed. Once both shared one hook instance, that reset needed to be explicit and correct for *both* callers — including the edge case of switching from one not-yet-created "pending" conversation straight to a different pending recipient, where the conversation id never changes (both are `null`) so a naive reset keyed only on conversation id would miss it. Fixed by keying the reset on both conversation id and recipient id.

Verified with `tsc` + a real `vite build`, not just typechecking.

**2. Apollo Server 4 → 5.** Flagged as EOL (since January 26, 2026) back during the dependency cleanup pass. Confirmed via Apollo's own migration docs and package registry:
- `@apollo/server` bumped `^4.10.0` → `^5.5.1`; its `graphql` peer dependency requirement bumped `^16.8.1` → `^16.11.0` to match.
- The Express integration moved out of the core package in v5 — `@apollo/server/express4` no longer exists. Installed the new standalone `@as-integrations/express4` package (same `expressMiddleware` export, same API, just relocated) and updated both entrypoints (`backend/api/_app.ts`, `backend/src/index.ts`) to import from it.
- `engines.node` in `backend/package.json` bumped `>=18.x` → `>=20.x`, matching Apollo Server 5's actual runtime requirement.

Verified beyond just `tsc`: compiled the backend to real JS and, since a live MongoDB connection isn't available in this environment, ran a standalone smoke test that builds the actual production schema and resolvers, constructs a real `ApolloServer` instance, and calls `.start()` — all of which succeeded without a database, confirming the Apollo-specific parts of the upgrade work end-to-end against this project's real schema, not just a toy example.

**Requires action on your end:** Apollo Server 5 needs Node.js ≥20 *at runtime*, not just to build. This is a Vercel project dashboard setting (Settings → General → Node.js Version) that isn't visible or changeable from here — if your backend project is currently pinned to Node 18.x, it will fail to boot after this deploys until that setting is updated.

**Files touched:** `frontend/src/hooks/useConversationChat.ts` (new), `frontend/src/components/Chat/ChatPanel.tsx`, `frontend/src/pages/Messages.tsx`, `backend/package.json`, `backend/api/_app.ts`, `backend/src/index.ts`

**Status:** ✅ Both fixed and typechecked clean, verified with real builds (frontend `vite build`, backend compiled + smoke-tested against the real schema). ⚠️ Needs the Vercel Node.js version check above before redeploying.

### 2026-08-23 (5) — Reaction picker closed before you could click it

**Symptom (reported by user):** hovering the Like button on a post shows the emoji reaction picker, but it disappears too fast to actually click an emoji — needed more time once hovering over the popup itself.

**Root cause:** `frontend/src/components/Post/PostCard.tsx`'s hover-intent logic used one `ref` (`reactionTimer`) to track a pending "show" timeout, but the "hide" timeout — started when the mouse left the Like button — was a bare `setTimeout(...)` whose return value was never stored anywhere. That makes it **uncancelable**: moving the mouse from the button toward the picker (crossing the small gap between them) started a countdown to close that nothing could stop, not even the picker's own `onMouseEnter` handler, since that handler was clearing a *different*, already-irrelevant timer reference. The picker could vanish before the pointer ever reached it, or close the instant you tried to move toward an emoji.

**Fix:** both the show and hide timeouts now share the same ref consistently, with each one clearing whatever's currently pending before scheduling itself. Concretely:
- Entering the Like button clears any pending timer, then schedules **show** after 500ms.
- Leaving the Like button clears any pending timer, then schedules **hide** after 400ms (up from 300ms).
- Entering the picker itself now correctly cancels that pending hide — it stays open indefinitely while the pointer is over it.
- Leaving the picker re-arms the same reliable hide-after-400ms behavior.

Also added a cleanup on unmount so a pending hide timer can't fire `setState` after the component's gone (e.g. navigating away mid-hover).

**Files touched:** `frontend/src/components/Post/PostCard.tsx`

**Status:** ✅ Fixed, typechecked clean, and verified with a real production build.

### 2026-08-23 (4) — Photos tab: delete a photo, deletes the post; real server-side upload validation

**Two separate things reported together, both fixed:**

**1. No way to delete a post from the Photos tab.** You could delete a post from the feed/Posts tab (`PostCard`'s own menu), but the Photos tab (built in 2026-08-22 (5)) only ever let you view/open tiles — no delete option existed there at all, even though a photo tile *is* a post under the hood. Since a post can have several photos (`Post.media` is an array), "delete this photo" doesn't map to "remove one image, keep the rest" — there's no partial-edit concept here — so this matches what was asked: deleting a photo tile deletes the *entire post* it belongs to, exactly like deleting it from the feed would. Reuses the same `DELETE_POST` mutation and cache-eviction pattern `PostCard.tsx` already uses, with an inline confirm-on-the-tile step (consistent with the rest of the app avoiding native `window.confirm`-style dialogs) that also warns you when a post has multiple photos, since deleting removes all of them together.

**Found and fixed a related edge case while implementing this:** deleting a post evicts it from Apollo's normalized cache, but two *other* already-cached lists that could also reference the same post — the Profile page's own Posts tab, and the main Home feed — weren't being re-fetched, so switching to either after a delete could leave a dangling `null` reference in the list and crash `PostCard` trying to render it. Added a defensive `.filter(Boolean)` in both places.

**2. No real server-side upload validation.** Flagged as an open item back in 2026-08-22's Cloudinary migration — file type/size checks in `CreatePost.tsx` only ever ran in the browser, so anyone could skip the UI entirely and call Cloudinary directly with a signature obtained from our `/api/upload/signature` route, uploading any file type or size. Fixed by adding `allowed_formats` and `max_file_size` as **signed parameters** in that route — Cloudinary itself enforces them server-side once they're part of the signature, so tampering with either value client-side just invalidates the signature rather than bypassing the check. The existing client-side checks stay as-is; they're now a fast-fail UX nicety layered on top of enforcement that can't be skipped, rather than the only enforcement that existed.

**Files touched:** `backend/src/routes/upload.ts`, `frontend/src/utils/index.ts`, `frontend/src/pages/Profile.tsx`, `frontend/src/components/Feed/Feed.tsx`

**Status:** ✅ Both fixed, typechecked clean, and verified with a real production build on both projects.

### 2026-08-23 (3) — Notification click-through: likes/comments now navigate somewhere

**What was there before:** clicking a friend-request notification worked (Confirm/Delete buttons, added back in 2026-08-22 (6)), but clicking anything else — a "X liked your post" or "X commented on your post" notification — did nothing. The backend already stored the right data for this (`Notification.entityId` / `entityType`, correctly set to the post's id on both `POST_LIKE` and `POST_COMMENT`/`COMMENT_REPLY` creation), it just had nowhere to send you: **there was no single-post detail page anywhere in the app.** `GET_POST` existed in the schema and was even already defined as a frontend query constant, but nothing had ever called it — flagged as a loose end all the way back in entry 2026-08-22 (2).

**Fix:**
1. `frontend/src/pages/PostDetail.tsx` (new) — a real `/post/:id` page, reusing the existing `GET_POST` query and the existing `PostCard`/`CommentSection` components rather than building new rendering logic. Handles loading and not-found states.
2. `PostCard` got one small addition: an `initiallyExpanded` prop so the comment thread is open by default when you arrive here — someone clicking "commented on your post" wants to see the comment immediately, not click "Comment" again to reveal what they came for. Feed usage is unaffected (defaults to `false`, same as before).
3. `frontend/src/components/Sidebar/Navbar.tsx` — notification rows are now clickable (previously only the Accept/Decline buttons inside a `FRIEND_REQUEST` notification had a click handler; the row itself did nothing). Routes by type: `FRIEND_REQUEST`/`FRIEND_ACCEPT` → the sender's profile, anything with `entityType: 'post'` → the new post detail page, anything else (e.g. `STORY_VIEW`, `MESSAGE` — types that don't have a destination page yet) → falls back to the sender's profile rather than doing nothing. Also marks the notification read on click, via the `markNotificationRead` mutation that already existed in the schema but had never been called from the frontend.

**Files touched:** `frontend/src/lib/graphql.ts`, `frontend/src/pages/PostDetail.tsx` (new), `frontend/src/components/Post/PostCard.tsx`, `frontend/src/components/Sidebar/Navbar.tsx`, `frontend/src/App.tsx`

**Status:** ✅ Fixed, typechecked clean, and verified with a real production build on both projects.

### 2026-08-23 (2) — Friends page: first of the six nav placeholders built out for real

**What was there before:** a "Coming Soon" placeholder (from 2026-08-22 (1)) — no real page, and no backend query/mutation support for a friends-management UI beyond what already existed for the notification dropdown's accept/decline buttons.

**What this adds:**

*Backend:*
1. `Query.friendRequests: [FriendRequest!]!` (new `FriendRequest { from: User!, sentAt: DateTime! }` type) — the current user's incoming pending requests with sender details. Previously the only way to see a friend request at all was the notification dropdown; the underlying data (`User.friendRequests`) was already stored, just never exposed as its own query.
2. `Query.sentFriendRequests: [User!]!` — the other side of the same feature: people the current user has sent a still-pending request to. Needed for a "Sent" view with a cancel option, which didn't exist anywhere before.
3. `Mutation.cancelFriendRequest(userId: ID!): Boolean!` — lets the *sender* withdraw a request. This is genuinely new capability, not just a new query: the existing `declineFriendRequest` only ever removes a request from the *caller's own* incoming list, so it only works for the recipient — there was no way for the sender to cancel a request they'd sent.

*Frontend:* `frontend/src/pages/Friends.tsx` (new), three tabs:
- **All Friends** — searchable list (reuses the existing `GET_USER(id)` query's `friends` field, same one the Profile page already uses), Message and Remove actions per person.
- **Requests** — incoming requests with Confirm/Delete (reuses the same `acceptFriendRequest`/`declineFriendRequest` mutations already wired up in the notification dropdown), plus a Sent Requests section with Cancel.
- **Suggestions** — reuses the existing `suggestedFriends` query (was already built, just never had a dedicated browsing page) with an Add Friend action.

The "Message" button reuses the same `openChatWithUser` pending-conversation flow already shipped for the Profile page and the Messages page's "New message" popover, so starting a chat from a friend's card behaves identically to those two entry points.

**Files touched:** `backend/src/graphql/typedefs/index.ts`, `backend/src/graphql/resolvers/user.resolvers.ts`, `frontend/src/lib/graphql.ts`, `frontend/src/pages/Friends.tsx` (new), `frontend/src/App.tsx`

**Status:** ✅ Fixed, typechecked clean, and verified with a real production build (`vite build` / `tsc`) on both projects — not just type-level checking.

### 2026-08-23 (1) — Messages page "New message" pencil icon now works

**Symptom:** the pencil icon in the Chats panel header (top of `/messages`) had no `onClick` handler at all — clicking it did nothing. Flagged as an open item back in entry 2026-08-22 (3), which fixed the equivalent bug on the Profile page's "Message" button but explicitly scoped this second entry point out as its own follow-up.

**Fix:** brought `frontend/src/pages/Messages.tsx` up to the same capability as the floating chat popup (`ChatPanel.tsx`):
1. Clicking the pencil opens a popover with a debounced people-search (reusing the existing `SEARCH_USERS` query, same pattern as the navbar's search).
2. Picking someone who already has a conversation with you just opens it (a plain client-side lookup against the already-loaded `GET_CONVERSATIONS` list — no duplicate conversations).
3. Picking someone new opens the chat pane in the same "pending" state used elsewhere in the app: no `conversationId` yet, message history/typing/read-receipts are skipped, and the first message sent uses `sendMessage({ recipientId })` to lazily create the conversation server-side (this backend capability already existed from a previous fix — it just had no second way to trigger it from this page). Once that first send succeeds, the view promotes to the real conversation the normal way.

This is the same pending-conversation pattern already shipped for the Profile page's "Message" button, just extended to this page's own local state rather than the global chat-popup store, since `Messages.tsx` manages its own conversation state independently of `ChatPanel.tsx`.

**Files touched:** `frontend/src/pages/Messages.tsx`

**Status:** ✅ Fixed and typechecked clean.

### 2026-08-22 (10) — Found it: `Message.media` Mongoose subdocument defaulted to `{}` instead of staying absent

**Symptom:** The "Internal server error" toast that had been hunted across several previous entries. Thanks to entry (9)'s logging fix finally being live, the real error surfaced: `Cannot return null for non-nullable field MessageMedia.url.` at path `sendMessage.media.url`.

**Root cause — a genuine pre-existing bug, unrelated to any of the routing/CORS work from entries (7)/(8)/(9).** `backend/src/models/Message.ts` defined `media` using Mongoose's shorthand nested-object syntax: `media: { url: String, type: String, name: String, size: Number }`. Mongoose treats this as a **single nested subdocument** and — this is a well-known Mongoose gotcha — automatically defaults it to an empty object `{}` on every document, even when `media` is never explicitly set. So every plain text message (no attachment at all — which is most messages) was actually being saved with `media: { url: undefined, type: undefined, ... }`, a real non-null object with empty fields inside, instead of `media` being genuinely absent.

When GraphQL resolved that field, it saw a non-null `media` object and tried to complete `MessageMedia.url: String!` (non-nullable in the schema) against `undefined` — which GraphQL treats as a hard error, not a soft null. Because `Message.media` itself is nullable, the null only propagated up to that one field rather than killing the whole response, which is exactly why some messages still appeared to "work" (the mutation's `errors` array killed the client-side promise, triggering the fallback/retry UI, while the message had genuinely already been saved to the database — a partial-failure state that looked like inconsistent behavior from the outside).

**Why this took so long to find:** the error was masked to a generic message for the client (correct, for security) and — until entry (9)'s fix — silently dropped everywhere else too, so there was no error to search logs for at all. It also wasn't something code review alone could catch, since the bug lives in Mongoose's *default value behavior* for a schema shape that looks completely reasonable on its face.

**Fix:**
1. `backend/src/models/Message.ts` — wrapped `media` as an explicit sub-schema (`new Schema({...}, { _id: false })`) with `default: undefined`, which stops Mongoose from auto-instantiating the empty object at all. New messages now correctly store `media` as genuinely absent when none is attached.
2. `backend/src/graphql/resolvers/message.resolvers.ts` — added a defensive `Message.media` resolver (`parent.media?.url ? parent.media : null`) so any message **already** sitting in the database with the broken empty-object shape (every "hello"/"test" message sent during this whole debugging saga) stops erroring too, without needing a database migration.

**Bonus finding while auditing for the same bug elsewhere:** `backend/src/models/Comment.ts`'s `media` field already uses this exact correct pattern (`type: new Schema(...), default: null`) — so this fix had already been applied once in the codebase, just inconsistently, and got missed for `Message`. Checked `Post.media` (an array, defaults safely to `[]`, not affected) and `Story.media` (fields are marked Mongoose `required: true`, so a Story literally can't be saved without real media values, sidestepping the issue by construction) — neither needed a change.

**Files touched:** `backend/src/models/Message.ts`, `backend/src/graphql/resolvers/message.resolvers.ts`

**Status:** ✅ Fixed and typechecked clean. This should resolve the "Internal server error" toast and the associated "input doesn't clear" symptom from entry (6) — that was never actually a text-clearing bug, it was `sendMessage` failing and the UI correctly (if silently) restoring the typed text on failure.

### 2026-08-22 (9) — GraphQL errors were completely invisible in production logs

**Symptom:** An "Internal server error" toast kept appearing, but there was nothing to debug it with: the Network tab showed the `/graphql` request as a normal `200 OK` (expected — GraphQL returns errors inside the response body with a 200 status, not as an HTTP error code), and Vercel's function logs showed nothing related when searching for "error" (only an unrelated Node.js deprecation warning that happened to contain that word in its own text).

**Root cause — a pre-existing gap, not something introduced this session.** Both `backend/api/_app.ts` and `backend/src/index.ts` already had a `formatError` handler that correctly masks unexpected errors to a generic "Internal server error" message for the client in production (good — you don't want to leak internal details to the browser). But the `console.error(...)` call logging the *real* error was wrapped in `if (isDev) ...` — meaning in production, the real error was masked for the client **and never logged anywhere at all**. There was no way to see what actually went wrong, from either side.

This is why extensive code review couldn't pin down the actual bug — there wasn't a way to *see* it yet, only to guess at it.

**Fix:** the real error (message, GraphQL path, error code, and full stack trace) is now always logged server-side via `console.error`, in every environment — only the message returned *to the client* stays masked in production. This is the standard split: log everything internally, expose nothing sensitive externally.

**Files touched:** `backend/api/_app.ts`, `backend/src/index.ts`

**Status:** ✅ Logging fixed and typechecked clean. **The original resolver bug causing the "Internal server error" toast is still unidentified** — it will show up clearly in Vercel's logs (search for `[GraphQL Error]`) the next time it happens, now that it's actually being recorded. Redeploy this fix, reproduce the issue again, and check the logs — that'll have the real answer.

### 2026-08-22 (8) — Regression: the routing fix in (7) broke `/graphql` and `/health`

**Symptom:** After deploying entry (7)'s fix, the app started showing an "Internal server error" toast, and chat/messaging appeared broken.

**Root cause — I introduced this one myself.** Entry (7) renamed `backend/api/[...path].ts` → `backend/api/index.ts` and added a rewrite so `/api/:path*` resolves to it. But the *existing* rewrites for the short aliases were left pointing at their old destinations:
```json
{ "source": "/graphql", "destination": "/api/graphql" },
{ "source": "/health", "destination": "/api/health" }
```
Those destinations (`/api/graphql`, `/api/health`) used to resolve via the bracket catch-all file that entry (7) deleted. With it gone, and with no guarantee that Vercel re-evaluates the rewrite list a second time against an already-rewritten destination, those two aliases had nowhere to resolve to — likely 404ing the same way `/api/upload/signature` did in entry (7), except this time hitting routes the whole app depends on (GraphQL itself).

**Fix:** pointed all three rewrites directly at the one function (`/api/index`) instead of at intermediate destinations:
```json
{ "source": "/graphql", "destination": "/api/index" },
{ "source": "/health", "destination": "/api/index" },
{ "source": "/api/:path*", "destination": "/api/index" }
```
This removes any dependency on whether Vercel chains/re-evaluates rewrites — every rule now points at the same real function in one hop. It works because Express itself already registers both the prefixed and bare forms of these routes (`app.use(['/api/graphql', '/graphql'], ...)`, `app.get(['/api/health', '/health'], ...)` in `_app.ts`), and Vercel preserves the original request URL when invoking the function, so Express's own internal routing correctly handles whichever path the browser actually requested once the request arrives.

**On the "chat input doesn't clear" report from the same testing pass:** reviewed the code again and it's unchanged from the fix in entry (6) — `setText('')` still runs synchronously the instant Send is clicked, before any network call. That fix is correct and typechecks clean. Given the "Internal server error" toast (an exact match for our backend's generic error string) was showing at the same time, the most likely explanation is that this testing pass happened against a build that either predates entry (6)'s frontend fix, or was caught mid-regression from this exact routing bug — **not** a new bug in the input-clearing logic itself. Needs to be re-verified after redeploying with this fix.

**Files touched:** `backend/vercel.json`

**Status:** ✅ Fixed and typechecked clean. Same as always — **needs a redeploy**, and this time please redeploy both the backend (for this fix) and confirm the frontend is also on the latest build (for entry (6)'s input-clearing/notification-delete/close-button fixes), since it's not yet confirmed whether the input-clearing issue is still happening on genuinely current code.

### 2026-08-22 (7) — Real root cause of the persistent CORS error: Vercel's bracket catch-all only matches single-segment paths

**Symptom:** Uploading a photo kept failing with an identical CORS error across three rounds of backend fixes: `blocked by CORS policy: ... No 'Access-Control-Allow-Origin' header is present`, with the preflight `OPTIONS` request to `/api/upload/signature` returning **404**.

**Why the earlier fixes (entries in this log from earlier the same day) didn't resolve it:** they were all correct fixes for real, separate problems (the crash-path CORS gap, the origin-rejection CORS gap) — but none of those code paths were ever actually being hit. A 404 on the OPTIONS preflight means the request never reached Express/`cors()` at all; it was being rejected by Vercel's own routing layer, before any of our application code ran.

**Actual root cause:** `backend/api/[...path].ts` used Vercel's bracket-filename catch-all convention (`[...path].ts`) to route all of `/api/*` to one function. Confirmed directly against Vercel's own team via their GitHub discussions (vercel/vercel#8343, vercel/vercel#6730): **this convention only reliably matches a single path segment for plain Node.js serverless functions** (i.e. projects not using the Next.js framework — which this backend isn't). `/api/health` (one segment: `health`) matched and worked. `/api/upload/signature` (two segments: `upload`, `signature`) didn't match and 404'd, purely because of segment count — nothing to do with CORS, the origin allowlist, or whether the code had been deployed (it had — this was verified directly from the Vercel dashboard's Source tab partway through debugging this).

This was hard to pin down specifically because the symptom (a CORS error in the browser) pointed away from the real cause (a Vercel routing gap) — a 404 with no `Access-Control-Allow-Origin` header is indistinguishable, from the browser's perspective, from an actual CORS rejection.

**Fix:** replaced the bracket catch-all with the pattern Vercel's own team recommends for this exact situation:
1. Renamed `backend/api/[...path].ts` → `backend/api/index.ts` (a static filename, not a dynamic segment).
2. Added an explicit rewrite in `backend/vercel.json`: `{ "source": "/api/:path*", "destination": "/api/index" }`, using Vercel's supported named-wildcard syntax (`:path*`, matches zero or more segments) rather than relying on filename-based inference. `:path*` correctly matches `/api/graphql`, `/api/health`, and `/api/upload/signature` uniformly, regardless of segment count.
3. Updated the `functions` config block to reference `api/index.ts`.

The function's own code didn't need to change — it always just forwarded `req`/`res` straight into the Express app, which does its own internal routing once the request actually arrives. The bug was entirely about *whether Vercel would route the request to this file in the first place*.

**Files touched:** `backend/api/index.ts` (renamed from `backend/api/[...path].ts`), `backend/vercel.json`

**Status:** ✅ Fixed and typechecked clean. **Requires a redeploy to take effect** — same as always, nothing here helps until it's actually live.

### 2026-08-22 (6) — Three chat/notification issues from the user's testing pass

**Symptom (reported by user, testing at `/messages`):**
1. Clicking the chat icon in the navbar opens the Messages page, but there's no way to close it.
2. Accepting or declining a friend request notification doesn't remove it from the notification list.
3. After sending a message, the chat input field doesn't clear.

**1. No way to close the Messages page.** `frontend/src/pages/Messages.tsx` is a full route (`/messages`), not a modal/popup — the only way "out" was clicking a different nav icon, which isn't an obvious "close" affordance if you think of it as a window you opened. *Fix:* added an X button next to the "New message" pencil icon in the Chats panel header that navigates back to Home (`frontend/src/pages/Messages.tsx`).

**2. Friend request notification not removed after accept/decline.** Root cause: accepting/declining only ever swapped the buttons for a status label in local React state (`handledRequests`) — the underlying `Notification` document in the database was never touched. So the moment `GET_NOTIFICATIONS` refetched (which already happens after every accept/decline) or the dropdown was closed and reopened, the exact same unread notification came back with its Confirm/Delete buttons intact, since nothing had actually changed server-side. There was a `markNotificationRead` mutation already in the schema, but nothing called it, and there was no way to delete a notification outright. *Fix:* added a `deleteNotification(id: ID!): Boolean!` mutation (`backend/src/graphql/resolvers/other.resolvers.ts`, `typedefs/index.ts`) and call it right after a successful accept/decline (`frontend/src/components/Sidebar/Navbar.tsx`) — the notification is now actually gone, not just visually swapped.

**3. Chat input doesn't clear after sending.** The code already called `setText('')` immediately on send in both chat implementations (`Messages.tsx` and the floating `ChatPanel.tsx`/`ChatWindow`) — that part was correct. The real bug: `catch { setText(content); }` silently restores the typed text on **any** send failure, with zero indication anything went wrong. Given the backend has had confirmed CORS/deployment connectivity issues earlier in this session, the most likely explanation is that sends were actually failing and getting silently restored — which looks exactly like "the input won't clear" from the outside, when the real problem is a failed request being swallowed. *Fix:* both `handleSend` implementations now show a toast (`Message failed to send — check your connection`, or the specific GraphQL error) on failure instead of failing silently. This doesn't fix an underlying connectivity problem if one still exists, but it means a failed send is now visibly a failed send instead of looking like a UI bug — worth confirming whether this was actually the CORS issue from entry (4) once that's resolved.

**Files touched:** `backend/src/graphql/resolvers/other.resolvers.ts`, `backend/src/graphql/typedefs/index.ts`, `frontend/src/lib/graphql.ts`, `frontend/src/components/Sidebar/Navbar.tsx`, `frontend/src/pages/Messages.tsx`, `frontend/src/components/Chat/ChatPanel.tsx`

**Status:** ✅ All three fixed and typechecked clean. #3 is a symptom fix (surfacing the error) — if sends are still actually failing due to the unresolved CORS/deployment issue, the underlying cause is tracked in entry (4).

### 2026-08-22 (5) — Profile "Photos" tab was a hardcoded placeholder

**Symptom (reported by user):** Photos clearly exist on a profile (visible in the Posts tab), but the Photos tab always shows nothing.

**Root cause:** `frontend/src/pages/Profile.tsx`'s Photos tab wasn't broken so much as never built — it was a static `<p>Photos from posts will appear here.</p>` with no query behind it at all, same class of gap as the earlier "Coming Soon" nav placeholders. Unlike those, this one was worth building for real since it's small, self-contained, and sits inside a page where every other tab already works — leaving it as a placeholder there was more confusing than helpful.

**Fix — added a real photo grid backed by actual data:**
1. `backend/src/graphql/typedefs/index.ts` / `post.resolvers.ts` — added a `userPhotos(userId, cursor, limit)` query, same shape and pagination as the existing `userPosts`, but filtered to `{ 'media.0': { $exists: true } }` at the database level (posts with at least one photo/video). Filtering here rather than fetching `userPosts` and filtering client-side keeps pagination correct — a page of "posts with photos" isn't skewed by text-only posts silently eating slots in the limit. Reuses the exact same visibility rules as `userPosts` (owner sees everything, friends see PUBLIC+FRIENDS, everyone else sees PUBLIC only), so it doesn't leak anything the Posts tab wouldn't already show.
2. `frontend/src/lib/graphql.ts` — added `GET_USER_PHOTOS`, requesting only the fields the grid needs (not the full post fragment, since we're flattening many posts' media into thumbnails, not rendering post cards).
3. `frontend/src/pages/Profile.tsx` — Photos tab now flattens every post's `media[]` into a responsive thumbnail grid, videos get a play-icon overlay, tiles open the original file in a new tab, includes a loading skeleton, an empty state, and a "Load more" button using the same cursor-pagination pattern as the Posts tab.

**Files touched:** `backend/src/graphql/typedefs/index.ts`, `backend/src/graphql/resolvers/post.resolvers.ts`, `frontend/src/lib/graphql.ts`, `frontend/src/pages/Profile.tsx`

**Status:** ✅ Fixed and typechecked clean.

### 2026-08-22 (4) — Photo upload CORS error on Vercel masked the real failure

**Symptom (reported by user):** Uploading a photo in production threw a browser CORS error: `Access to fetch at 'https://<backend>.vercel.app/api/upload/signature' ... has been blocked by CORS policy: ... No 'Access-Control-Allow-Origin' header is present`.

**Root cause — not actually a CORS misconfiguration.** `backend/api/[...path].ts` (the Vercel serverless entrypoint) wraps the whole Express app in a `try/catch`. If `getApp()` throws for **any** reason during startup, the `catch` block sends back a 500 response — but since Express (and its `cors()` middleware) never got a chance to run, that response has **zero CORS headers on it, regardless of what `FRONTEND_URL` is set to.** The browser then reports this exactly as "no Access-Control-Allow-Origin header," which looks identical to a real CORS misconfiguration but is actually masking a server-startup crash. Since this route was newly added (Cloudinary), the most likely culprit is the deployed backend not yet having redeployed to pick up the new `cloudinary` dependency, or another env-var/startup issue — **check the Vercel function logs for the backend project to see the actual error** (search for `❌ Failed to initialize app:`).

**Fix:** `backend/api/[...path].ts`'s error handler now sets `Access-Control-Allow-Origin` (echoing the request's `Origin` header) before sending the 500, and includes the real error message in the JSON body (`detail`). This doesn't change behavior for any request that succeeds — it only affects the failure path, and it means any future startup crash (bad env var, missing dependency, DB connection failure, etc.) shows up as a real, readable error in the browser's network tab instead of a misleading CORS message that sends you looking in the wrong place.

**What to check on your live deployment right now:**
1. Redeploy the backend on Vercel — the new `cloudinary` dependency needs a fresh `npm install`, which only happens on a new deployment, not automatically for existing ones.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in the backend's Vercel project → Settings → Environment Variables, then redeploy (env var changes need a redeploy to take effect).
3. Double-check `FRONTEND_URL` on the backend project exactly matches your deployed frontend origin (`https://pulse-connect-indol.vercel.app`, no trailing slash — comma-separate if there's more than one, e.g. a preview + production URL).
4. After redeploying with the fix above, if it fails again the browser will now show the *actual* error instead of a CORS message — check the response body / Vercel function logs for specifics.

**Files touched:** `backend/api/[...path].ts`

**Status:** ✅ Error handling fixed and typechecked clean. **Requires a redeploy on your end to take effect and reveal the real underlying error, if any remains.**

### 2026-08-22 (3) — Profile page "Message" button opened nothing for anyone you hadn't already messaged

**Symptom (found while investigating the user's "chat window has no close button" report):** Clicking "Message" on someone's profile did nothing visible — no chat window appeared, no error. Investigating this turned out to be unrelated to the close button at all.

**Root cause:** `frontend/src/pages/Profile.tsx`'s Message button called `openChat(profile.id)` — passing the **user's** id. But `ChatPanel` looks up the chat window by matching that id against your existing conversations (`conversations.find(c => c.id === activeChatId)`), which expects a **conversation** id, not a user id. Unless you'd coincidentally already messaged that exact person before (vanishingly unlikely — Mongo ObjectIds don't collide with each other), the lookup always failed and `ChatPanel` silently returned `null` — nothing rendered, no error, just apparent silence. (`RightSidebar.tsx`'s "online friends" list, by contrast, already passed a real `conversation.id`, so chats opened from there worked correctly — this bug was isolated to the Profile page entry point.)

**Fix — added proper support for starting a new conversation, rather than a workaround:**
1. `backend/src/graphql/resolvers/message.resolvers.ts` — added a `Message.conversation` field resolver (same missing-resolver pattern as `User.friends` and `Post.tags`); needed so the frontend can learn the new conversation's id right after the first message creates it.
2. `frontend/src/store/index.ts` — the UI store's chat state now distinguishes "open an existing conversation" (`openChat(conversationId)`, unchanged, still what `RightSidebar` uses) from "open a chat with this *person*, conversation may not exist yet" (new `openChatWithUser(recipient)`).
3. `frontend/src/components/Chat/ChatPanel.tsx` — when opened via `openChatWithUser`, checks `conversationWithUser` for an existing conversation first; if found, normalizes to the regular flow. If not, renders the chat window in a "pending" state (`conversationId: null`) — message history/typing/read-receipts are skipped, and the first message sent uses `sendMessage({ recipientId })` (the backend already supported lazily creating a conversation this way — it just had no way to be triggered from the UI). Once that first message succeeds, the window is promoted to the real conversation id.
4. `frontend/src/pages/Profile.tsx` — Message button now calls `openChatWithUser({...})` with the profile's info instead of the broken `openChat(profile.id)`.

**Files touched:** `backend/src/graphql/resolvers/message.resolvers.ts`, `frontend/src/lib/graphql.ts`, `frontend/src/store/index.ts`, `frontend/src/components/Chat/ChatPanel.tsx`, `frontend/src/pages/Profile.tsx`

**Status:** ✅ Fixed and typechecked clean. **Note:** this does not yet close out the user's original "close button" report — see "Open items" below.

### 2026-08-22 (2) — `Post.tags` — same "unpopulated list, no field resolver" bug as `User.friends`

**Symptom:** Not yet user-visible — caught during a proactive gap audit, not reported by the user. `tags: [User!]` on `Post` had no GraphQL field resolver, and only the single-post `post(id)` query populated it (`.populate('tags', ...)`); the `feed`, `exploreFeed`, and `userPosts` queries all left it as raw ObjectIds. Because `User!` list elements are non-nullable, this would have silently nulled out the whole `tags` array anywhere else it was queried — identical failure mode to the `User.friends` bug fixed on 2026-08-21. It hadn't surfaced yet only because the frontend's feed fragment doesn't currently request `tags` at all.

**Fix:** added a `Post.tags` field resolver (`backend/src/graphql/resolvers/post.resolvers.ts`) that batch-loads via the existing `userLoader` DataLoader — same pattern as `User.friends` and `Reaction.user` — so it now resolves correctly no matter which query returned the post, instead of depending on every query author remembering to add `.populate('tags')`.

**Note — related but out of scope:** the frontend has no UI to actually tag people when creating a post, and `GET_POST` (the query that already requests `tags`) isn't used anywhere — there's no single-post detail page/route. Fixing the resolver closes the backend correctness gap; building tagging UI and a post detail page is separate feature work.

**Files touched:** `backend/src/graphql/resolvers/post.resolvers.ts`

**Status:** ✅ Fixed, typechecked clean.

### 2026-08-22 (1) — Friends / Watch / Marketplace / Saved / Events / Settings nav links went nowhere

**Symptom (found during gap audit, confirmed against the UI):** Both the top navbar (`Navbar.tsx`'s `NAV_TABS`) and left sidebar (`LeftSidebar.tsx`'s `NAV_ITEMS`) link to `/friends`, `/watch`, `/marketplace`, `/saved`, `/events`, and `/settings`. None of these routes exist in `App.tsx`, which only defines `/`, `/profile/:username`, and `/messages` plus a catch-all `<Route path="*" element={<Navigate to="/" replace />} />`. Clicking any of the six silently redirected back to Home — no 404, no explanation, just an unexplained bounce that looks like a bug even though technically "nothing crashed."

**Root cause:** these are genuinely unbuilt features, not just a missing route wire-up — there's no backend GraphQL schema support for marketplace listings, videos, events, or saved posts either. The nav was built ahead of the features it points to.

**Fix (interim):** added `frontend/src/pages/ComingSoon.tsx`, a reusable placeholder page (keeps the app shell/nav via `AppLayout`, shows an icon + short description + a "Back to Home" button), and routed all six paths to it in `App.tsx`. This stops the silent failure — visiting any of these now clearly tells the person the feature isn't built yet instead of looking broken.

**Not done, and intentionally so:** actually building these six features (schema, resolvers, pages) is substantial new feature work, not a bug fix — logged as its own open item below rather than attempted here.

**Files touched:** `frontend/src/pages/ComingSoon.tsx` (new), `frontend/src/App.tsx`

**Status:** ✅ Interim fix (placeholder pages) done and typechecked clean. Real features remain unbuilt — see "Open items" below.

### 2026-08-21 (4) — Media upload moved off local disk to Cloudinary (production-ready on Vercel)

**Context:** Entry (2) below shipped a working Photo/Video upload pipeline, but explicitly flagged it as **not production-ready** — it used `multer` to write files to this server's local disk, which doesn't persist on Vercel serverless (ephemeral, per-invocation filesystem, no shared volume). This entry replaces that implementation with real cloud object storage, closing that gap.

**What changed:** Switched to **Cloudinary** using the same signed direct-upload pattern real platforms use (Facebook, Instagram, etc.) — the browser uploads the file bytes straight to Cloudinary; our backend never receives them at all, it only issues a short-lived signature proving the request came from a logged-in user.

1. `backend/src/config/cloudinary.ts` (new) — configures the Cloudinary SDK from `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` env vars. Missing config logs a warning and disables uploads instead of crashing the whole server.
2. `backend/src/routes/upload.ts` (rewritten) — was a `multer` disk-storage file receiver at `POST /api/upload`; is now a signature issuer at `POST /api/upload/signature` (still behind `requireAuthHeader`). Returns `{ signature, timestamp, folder, apiKey, cloudName }`, nothing else.
3. `frontend/src/utils/index.ts`'s `uploadMedia()` — now a two-step flow: fetch a signature from our backend, then `POST` the file directly to `https://api.cloudinary.com/v1_1/<cloud>/auto/upload` with that signature. Returns Cloudinary's `secure_url` (CDN-backed) instead of a URL pointing at our own server.
4. `backend/src/index.ts` — dropped `express.static('/uploads')` (nothing to serve locally anymore) and the unused `path` import.
5. `backend/api/_app.ts` — the upload signature route is now mounted here too. It was deliberately **not** mounted before because the old disk-based route couldn't survive on serverless; the new one has no disk dependency at all, so it's safe on Vercel.
6. Removed the now-unused `multer`/`@types/multer` dependencies from `backend/package.json`.

**What you need to do to enable it:** sign up for Cloudinary, grab your **Cloud Name / API Key / API Secret** from the Console dashboard, and set them as env vars — `backend/.env` locally, and Vercel Project Settings → Environment Variables for production. See `backend/.env.example` for the exact variable names. `CLOUDINARY_API_SECRET` must only ever be set server-side.

**Files touched:** `backend/src/config/cloudinary.ts` (new), `backend/src/routes/upload.ts`, `backend/src/index.ts`, `backend/api/_app.ts`, `backend/package.json`, `backend/.env.example`, `frontend/src/utils/index.ts`, `.gitignore`

**Status:** ✅ Fixed, typechecked clean on both `frontend` and `backend`. Requires Cloudinary credentials to be set before upload will actually work — without them the signature endpoint returns a clear 503 instead of a silent failure.

### 2026-08-21 (3) — Check-in used the browser's native `window.prompt()`

**Symptom (reported by user):** Clicking "Check in" in the post composer popped up the browser's default `prompt()` dialog to ask for a location. Flagged as bad UX — native prompts can't be styled, block the main thread, look inconsistent across browsers, and don't fit the app's design language.

**Root cause:** `frontend/src/components/Post/CreatePost.tsx`'s "Check in" button called `window.prompt('Enter your location:')` directly instead of using an in-app UI — a placeholder implementation that was never replaced with a real component. Everything else in the composer (Feeling picker, Visibility picker) already used custom `framer-motion` popovers; check-in was the odd one out.

**Fix:** replaced it with an inline popover matching the existing Feeling/Visibility picker pattern — a small `MapPin`-icon text field with a confirm button, opened directly under the "Check in" button. It autofocuses on open, submits on Enter, closes on outside-click or Escape, and prefills with the current location when reopened to edit it. No native dialogs involved.

**Files touched:** `frontend/src/components/Post/CreatePost.tsx`

**Status:** ✅ Fixed, typechecked clean.

### 2026-08-21 (2) — Friend request notifications had no Accept/Decline action; Photo/Video composer button was decorative

**Symptom (reported by user):** Two separate issues from the same screenshot/testing pass:
1. The bell icon showed a new friend request notification, but there was no way to accept or decline it from the dropdown — clicking the notification did nothing.
2. The "Photo/Video" button in the post composer had no effect when clicked. Asked whether this was a database limitation.

**Root causes:**
1. **Notification dropdown was read-only** (`frontend/src/components/Sidebar/Navbar.tsx`): each notification just rendered `n.message` as text. The backend already had working `acceptFriendRequest` and `declineFriendRequest` mutations (used elsewhere on the Profile page), and the frontend already had an `ACCEPT_FRIEND_REQUEST` mutation defined — but neither was wired into the notification list, and `DECLINE_FRIEND_REQUEST` wasn't even defined on the frontend at all.
   - *Fix:* added `DECLINE_FRIEND_REQUEST` to `lib/graphql.ts`, and added Confirm/Delete buttons under any `FRIEND_REQUEST`-type notification that call the accept/decline mutations, refetch notifications, and swap to an "Accepted"/"Declined" status inline.
2. **Photo/Video button had no `onClick` at all** (`frontend/src/components/Post/CreatePost.tsx`) — it was pure UI chrome. This is **not a database limitation**: `Post.media` was already a fully-modeled array (`url`, `type`, `thumbnail`, `width`, `height`, `duration`) in both the Mongoose schema and the GraphQL schema, `createPost` already accepted a `media` array and would happily save it, and `PostCard.tsx` already had full rendering logic for image/video grids. The entire pipeline existed except for two things: nothing on the frontend ever opened a file picker or called `createPost` with `media` populated, and — the actual missing piece — **there was no upload endpoint anywhere to turn a picked file into a URL**. `multer` was sitting in `backend/package.json` as an unused dependency; a `scalar Upload` was declared in the GraphQL schema but never given a resolver or used by any mutation.
   - *Fix (v1):* added a REST upload endpoint using `multer` disk storage, serving files back out via `express.static('/uploads')`. **Superseded by entry (4) above**, which replaces local disk storage with Cloudinary so this actually works in production on Vercel.

**Files touched:** `frontend/src/lib/graphql.ts`, `frontend/src/components/Sidebar/Navbar.tsx`, `frontend/src/components/Post/CreatePost.tsx`, `frontend/src/utils/index.ts`, `backend/src/lib/authMiddleware.ts` (new), `backend/src/index.ts`

**Status:** ✅ Notification accept/decline fixed and typechecked. Photo/Video upload: see entry (4) for the production-ready version.

### 2026-08-21 (1) — Profile page: avatar off-center + Friends tab empty despite correct count

**Symptom:** On `/profile/:username`, the avatar photo rendered small and shifted toward the top-left corner of its circular frame instead of filling it, and the Friends tab showed "No friends to show" even though the header correctly read "9 friends".

**Root causes:**
1. **Avatar sizing mismatch** (`frontend/src/components/UI/Avatar.tsx`): the `xl` size variant rendered at `64px` (`w-16 h-16`), but `Profile.tsx` wrapped it in a hard-coded `112px` (`w-28 h-28`) frame div with no flex centering. The smaller avatar was left-aligned inside the larger frame instead of filling or centering within it.
   - *Fix:* resized the `xl` variant to `112px` (`w-28 h-28`) to match the frame, and changed the frame div in `Profile.tsx` to size itself to its content (`inline-flex`, no hard-coded `w-28 h-28`) instead of double-hard-coding dimensions in two places.
2. **`User.friends` GraphQL field had no resolver** (`backend/src/graphql/resolvers/auth.resolvers.ts`): the schema declares `friends: [User!]`, but with `.lean()` queries `parent.friends` is just an array of raw Mongo `ObjectId`s, not populated documents. With no field resolver, GraphQL's default resolver returned those raw ObjectIds and tried to resolve each one as a full `User`. Every non-nullable `User` field (`username: String!`, `firstName: String!`, `isOnline: Boolean!`, etc.) resolved to `null` on an ObjectId, which per GraphQL null-propagation rules nulled out the entire `friends` list — while `friendsCount` (a separate resolver that just does `parent.friends?.length`) stayed correct since it only needs the array length, not populated docs.
   - *Fix:* added a `friends` field resolver on `User` that batch-loads real user docs via the existing (previously unused for this purpose) `loaders.userLoader` DataLoader, avoiding an N+1 query.

**Files touched:** `frontend/src/components/UI/Avatar.tsx`, `frontend/src/pages/Profile.tsx`, `backend/src/graphql/resolvers/auth.resolvers.ts`

**Status:** ✅ Fixed, typechecked clean on both `frontend` and `backend`.

</details>
