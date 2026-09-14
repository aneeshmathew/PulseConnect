# PulseConnect — Frontend

React + TypeScript single-page app for PulseConnect, a full-stack Socialbook-style social network. This repo is the client only — it talks to the [PulseConnect backend](../pulseconnect-backend) over GraphQL (HTTP for queries/mutations, WebSocket for subscriptions in dev). See that repo for the API, database, and server-side docs.

Core Features

    Interactive Social Feed: Create, edit, and delete text and media posts, engage with threaded comments, and interact using a Socialbook-style multi-emoji reaction system.

    Real-Time Communications: Instant messaging, live notifications, and instantaneous feed updates driven by bidirectional WebSocket connections (dev) or polling (production — see below).

    Rich User Profiles: Customizable personal spaces featuring user bios, profile avatars, media galleries, and dynamic friend or follower relationship management.

    Optimized Performance: Utilizes virtual scrolling algorithms to render thousands of posts in long-form feeds smoothly without layout jank or performance degradation.

---

## 🗂️ Project Structure

```
pulseconnect-frontend/
└── src/
    ├── lib/
    │   ├── apollo.ts          # Apollo client + WS split link
    │   └── graphql.ts         # All GQL queries/mutations/subs
    ├── store/
    │   └── index.ts           # Zustand: auth, UI, notifications
    ├── utils/index.ts         # Helpers, formatters, constants
    ├── components/
    │   ├── Feed/
    │   │   └── Feed.tsx       # Virtual scroll feed + live updates
    │   ├── Post/
    │   │   ├── PostCard.tsx   # Post with reactions, media, menu
    │   │   ├── CreatePost.tsx # Composer with visibility picker
    │   │   └── CommentSection.tsx  # Nested comments
    │   ├── Stories/
    │   │   └── StoriesBar.tsx # Story rings + full-screen viewer
    │   ├── Chat/
    │   │   └── ChatPanel.tsx  # Floating chat window
    │   ├── Sidebar/
    │   │   ├── Navbar.tsx     # Top nav + search + notifications
    │   │   ├── LeftSidebar.tsx
    │   │   └── RightSidebar.tsx
    │   └── UI/
    │       ├── Avatar.tsx     # Avatar with online indicator
    │       └── Skeleton.tsx   # Shimmer loaders
    └── pages/
        ├── Home.tsx           # Feed page + layout
        ├── Auth.tsx           # Login + Register
        ├── Profile.tsx        # User profile page
        ├── Watch.tsx          # Video feed / reels
        ├── Events.tsx         # Events grid + detail
        ├── Settings.tsx       # Privacy, notifications, password, dark mode
        └── Messages.tsx       # Full messenger page
```

---

## ⚡ Tech Stack

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
- A running instance of [`pulseconnect-backend`](../pulseconnect-backend) (local dev server or a deployed GraphQL endpoint)

### 1. Clone & Install

```bash
git clone <this-repo-url>
cd pulseconnect-frontend
npm install
```

### 2. Configure Environment

```bash
# .env (copy from .env.example)

# Absolute URL of your backend's GraphQL endpoint. Only read by
# production builds (`vite build`) — `npm run dev` always talks to
# your local backend regardless of what's set here.
VITE_GRAPHQL_URL=https://your-backend.vercel.app/graphql

# Only needed if you enable subscriptions (see below).
VITE_WS_URL=wss://your-backend.example.com/graphql

# Vercel serverless functions can't hold WebSocket connections open,
# so live GraphQL subscriptions don't work against a backend deployed
# via the backend repo's `api/` entrypoint. Leave this false unless
# you've deployed the WebSocket server elsewhere.
VITE_ENABLE_SUBSCRIPTIONS=false
```

### 3. Start Development

```bash
npm run dev   # http://localhost:5173, expects backend on http://localhost:4000
```

Run the [backend](../pulseconnect-backend) locally alongside this (`npm run dev` in that repo) for a full working environment, including seeded demo data and a login of `demo@example.com` / `password123`.

---

## 🔑 Key Features

### Real-Time: WebSockets (dev) vs Polling (production on Vercel)

This app supports both, and which one is active depends on how the backend is deployed — this is architectural, not a bug:

The frontend decides which mode to use via `subscriptionsEnabled` in `src/lib/apollo.ts`:
```js
subscriptionsEnabled = VITE_ENABLE_SUBSCRIPTIONS === 'true' || isDevServer || isLocalhost
```
Local dev gets real WebSocket subscriptions (against the backend's standalone dev server, which runs a real `ws` + `graphql-ws` server). The live Vercel deployment falls back to polling unless `VITE_ENABLE_SUBSCRIPTIONS=true` is explicitly set — see the [backend repo](../pulseconnect-backend) for why its serverless `api/` entrypoint has no WebSocket server at all.

**Polling intervals in production** (`POLL_INTERVAL_MS` in `src/lib/apollo.ts`):

| What | Interval |
|---|---|
| New chat messages | 3s |
| Conversations list | 8s |
| Feed new-posts check | 12s |

Chat feels close to real-time (3s) but isn't a true push — it's the same UI either way, so this is invisible day-to-day, but worth knowing if you're debugging a "why didn't this update instantly" question on the live site specifically.

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
- 🎬 **Watch** — swipeable video feed / reels
- 📅 **Events** — RSVPs, attendee lists
- 🛒 **Marketplace** — browse and list items for sale
- 🌙 **Dark mode** — full dark theme
- 🔍 **Search** — users by name/username

---

## 📡 GraphQL API

This app consumes the schema served by the [backend repo](../pulseconnect-backend). Key operations used by the frontend:

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

Full schema reference lives in the backend repo.

---

## 🏗️ Architecture Decisions (frontend-relevant)

**Virtual Scroll**: The feed uses `@tanstack/react-virtual` with dynamic measurement. Each `PostCard` is measured after mount so the virtualizer handles variable heights correctly. Overscan of 3 items prevents blank flash on fast scroll.

**Apollo Split Link**: HTTP for queries/mutations, WebSocket for subscriptions. The split is determined by operation type at link creation time.

**Cursor Pagination**: Uses base64-encoded ISO timestamps as cursors, matching the backend's cursor format. Apollo cache merge policies (`cacheTypePolicies` in `src/lib/apollo.ts`) deduplicate appended pages for `feed`, `watchFeed`, `upcomingEvents`, and `marketplaceListings`.

**Optimistic Messages**: Messages are inserted optimistically with a temp ID; Apollo reconciles when the real response arrives.

---

## Deployment

This repo deploys to Vercel as its own project (`vercel.json` at the root builds and serves the Vite SPA). Set `VITE_GRAPHQL_URL` / `VITE_WS_URL` / `VITE_ENABLE_SUBSCRIPTIONS` in that Vercel project's Environment Variables to point at your deployed backend.
