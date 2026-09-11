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

| Project | Stack & Highlights |
| :--- | :--- |
| <a href="https://pulse-connect-indol.vercel.app/" target="_blank" rel="noopener noreferrer">**Pulse Connect**</a><br><br>[![Pulse Connect](https://image.thum.io/get/width/1200/crop/900/maxAge/1/noanimate/https://pulse-connect-indol.vercel.app/)](https://pulse-connect-indol.vercel.app/) | ![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)<br><br>• Real-time social engagement and network connection platform.<br>• Built with responsive UI components and modern state management.<br><br>👉 [Live Demo](https://pulse-connect-indol.vercel.app/) |
| <a href="https://blog-foundry-zeta.vercel.app/" target="_blank" rel="noopener noreferrer">**BlogFoundry**</a><br><br>[![BlogFoundry](https://image.thum.io/get/width/1200/crop/900/maxAge/1/noanimate/https://blog-foundry-zeta.vercel.app/)](https://blog-foundry-zeta.vercel.app/) | ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)<br><br>• Full-stack publishing workspace and rich-text blogging platform.<br>• Designed with optimized SEO rendering and clean content workflows.<br><br>👉 [Live Demo](https://blog-foundry-zeta.vercel.app/) |
| <a href="https://moviedb-client.vercel.app/" target="_blank" rel="noopener noreferrer">**MovieDB Client**</a><br><br>[![MovieDB Client](https://image.thum.io/get/width/1200/crop/900/maxAge/1/noanimate/https://moviedb-client.vercel.app/)](https://moviedb-client.vercel.app/) | ![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black) ![REST API](https://img.shields.io/badge/REST_API-0055DA?style=flat-square&logo=fastapi&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)<br><br>• Media exploration platform with dynamic search, filtering, and real-time data fetching.<br>• High-performance pagination and rich visual interface.<br><br>👉 [Live Demo](https://moviedb-client.vercel.app/) |
| <a href="https://task-forge-web-iota.vercel.app/" target="_blank" rel="noopener noreferrer">**TaskForge**</a><br><br>[![TaskForge](https://image.thum.io/get/width/1200/crop/900/maxAge/1/noanimate/https://task-forge-web-iota.vercel.app/)](https://task-forge-web-iota.vercel.app/) | ![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black) ![Redux](https://img.shields.io/badge/Redux-764ABC?style=flat-square&logo=redux&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)<br><br>• Enterprise productivity and task management app.<br>• Features custom drag-and-drop state updates, persistence, and workflow tracking.<br><br>👉 [Live Demo](https://task-forge-web-iota.vercel.app/) |
