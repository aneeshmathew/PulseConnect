# PulseConnect Frontend — Development Blueprint

> **Purpose of this file:** this is the single source of truth for *where the frontend actually stands* — what's built, what's verified working, what's stubbed out, and what's next. It's written so that any agentic model (or human) picking up the project cold can get a complete, accurate picture without reading the codebase first. For tech stack, folder structure, setup instructions, and GraphQL API reference, see [`README.md`](../README.md) — this file is intentionally scoped to *progress*, not project mechanics.
>
> **Repo split note (2026-09-13):** this file was split out of a single-repo monorepo's `docs/DEVELOPMENT.md`, which tracked frontend and backend progress together. Sections 1–6 below have been rescoped to the frontend only. Section 7 (Change History) is kept in full, unfiltered, since most entries during the monorepo period touched both sides of a feature the same day — some line items reference backend resolver/model work that now lives in [`pulseconnect-backend`](../../pulseconnect-backend)'s own copy of this file.

---

## 1. Project Status Snapshot

The frontend is a React + TypeScript SPA (Vite) consuming a GraphQL API. The core social product's UI — feed, posts, comments, reactions, stories, messaging, notifications, friends, profiles, a video feed ("Watch"), events, marketplace, search, settings, and dark mode — is **built and functionally complete**, wired to real GraphQL queries/mutations/subscriptions, not mocked data.

| Area | Status |
|---|---|
| Core social product UI (feed/posts/comments/reactions/stories/friends/profiles/messaging/notifications/search/settings) | ✅ Complete |
| Watch (video feed / reels) UI | ✅ Complete |
| Events UI (RSVPs, attendee lists) | ✅ Complete |
| Marketplace UI (buy/sell listings) | ✅ Complete |
| Real-time in production (Vercel) | ⚠️ Degraded by design — see §4 |
| Automated test suite | 🟡 In progress — covers Feed, Profile, Watch(page), Events(page + card), Settings, apollo.ts pagination merges, CommentSection, useConversationChat, PostCard, Auth, stores. Marketplace has no dedicated frontend tests yet. CI wiring intentionally out of scope. See §3 |
| Production build (chunk-size fix) | ✅ Verified — confirmed clean |

**In one sentence:** every page a user can currently navigate to renders against real data — there are no silently-broken, fake, or "Coming Soon" placeholder pages left in the app as of this review pass (2026-09-13).

---

## 2. Completed Features (verified against code)

Each item below reflects a working frontend UI wired to a real GraphQL operation, not a placeholder.

### Auth
- [x] Login / Register pages, JWT session persistence, forced logout on invalid/expired token or unreachable server

### Feed & Posts
- [x] Create / edit / delete text + media posts, with a visibility picker
- [x] Cursor-based infinite scroll pagination
- [x] Virtual-scrolled feed (`@tanstack/react-virtual`) — dynamic row measurement, handles large lists
- [x] Multi-emoji reactions (Like/Love/Haha/Wow/Sad/Angry) with hover picker
- [x] Live feed updates (new posts appear as toast banners — WS in dev, polling in prod)
- [x] Post detail page (`/post/:id`), reached via notification click-through

### Comments
- [x] Nested comments with one level of replies, fetched per-post on demand via a dedicated query — **not** bundled into feed queries
- [x] Emoji picker in the comment composer (custom 12-emoji grid, no external library)

### Stories
- [x] Story ring UI + full-screen viewer, text-only and media stories both supported
- [x] "Add Story" composer

### Messaging
- [x] Full messenger page (`/messages`, `/messages/:conversationId`) + floating chat panel
- [x] Typing indicators, optimistic message send (temp ID reconciled on server response)
- [x] "New message" composer (pencil icon → real flow)
- [x] Shared chat logic extracted into `useConversationChat` hook (dedup of prior duplicated logic)

### Notifications
- [x] Real-time badge + list (friend requests, likes, comments)
- [x] Click-through navigation to the relevant post/profile
- [x] Accept/Decline actions directly on friend-request notifications

### Friends
- [x] Real Friends page (requests, accept/decline, suggestions) — replaced original "Coming Soon" placeholder

### Profiles
- [x] Cover photo + avatar upload/edit (via Cloudinary), bio, posts tab, friends grid
- [x] Real Photos tab (was hardcoded placeholder) with delete support
- [x] "Message" button opens/creates the correct conversation

### Watch (video feed / reels)
- [x] Swipeable, scroll-snap vertical feed with tap-to-play (autoplay deliberately removed per request)
- [x] Upload composer
- [x] Error state for genuine load failures (distinct from "just paused")

### Events
- [x] Upcoming-events grid + detail page with attendee avatars, create/edit modal, cover photo upload
- [x] RSVP UI (GOING/INTERESTED/DECLINED, add/change-in-place/cancel)

### Marketplace
- [x] Category-filtered browse grid + listing detail page with an image gallery, create-listing modal (multi-photo upload)
- [x] "Message Seller" reuses the existing `openChatWithUser` / messaging system rather than a parallel contact-seller flow

### Saved & Settings
- [x] Real Saved (bookmarks) page — replaced placeholder
- [x] Real Settings page — privacy, notifications, password change, dark mode, all backed by real mutations

### Search & UX polish
- [x] User search by name/username (navbar)
- [x] Full dark mode theme
- [x] Route-level code splitting (`React.lazy`) + vendor chunk splitting — fixes the original 500kB+ single-bundle build warning

---

## 3. Pending / Not Started

- [ ] **Marketplace frontend test coverage** — Events has full frontend test coverage (`EventCard.test.tsx`, `Events.test.tsx`); Marketplace was built the same way but has no dedicated tests yet. Same shape of work needed: `ListingCard.test.tsx` / `MarketplacePage.test.tsx`.
- [x] **Automated frontend test suite — started 2026-09-10, expanded 2026-09-10/11/13.** Vitest + React Testing Library + `@apollo/client/testing`'s `MockedProvider`: real components/hooks/pages/stores exercised against mocked GraphQL responses, not shallow rendering. Infra: `vitest.config.ts`, `tests/setup.ts` (jest-dom matchers + RTL cleanup).
  - [x] `CommentSection` (`tests/components/CommentSection.test.tsx`)
  - [x] `useConversationChat` (`tests/hooks/useConversationChat.test.tsx`)
  - [x] `PostCard` reaction picker (`tests/components/PostCard.test.tsx`)
  - [x] `Auth` page (`tests/pages/Auth.test.tsx`)
  - [x] Zustand stores (`tests/store/store.test.ts`)
  - [x] `apollo.ts` (`tests/lib/apollo.test.ts`) — `errorLink` and the `feed`/`watchFeed`/`upcomingEvents`/`messages` cache `merge` functions
  - [x] `Feed` container (`tests/components/Feed.test.tsx`)
  - [x] `ProfilePage` (`tests/pages/Profile.test.tsx`)
  - [x] `WatchPage` (`tests/pages/Watch.test.tsx`)
  - [x] `EventsPage` (`tests/pages/Events.test.tsx`) — including "Load more" pagination against the app's real `cacheTypePolicies`
  - [x] `EventCard` (`tests/components/EventCard.test.tsx`)
  - [x] `SettingsPage` (`tests/pages/Settings.test.tsx`)
  - **Verified running locally (2026-09-13)** — 73/74 passed on the full suite, with the one failure (`Events.test.tsx`'s "Load more" test using a cache that didn't match production) fixed same day. This environment still can't `npm install`, so anything dated after 2026-09-13 is reviewed by hand until actually run.

---

## 4. Known Limitations (by design, not bugs)

- **Real-time in production is polling, not WebSockets.** The deployed backend's serverless entrypoint can't hold a persistent WS connection open. `subscriptionsEnabled` in `src/lib/apollo.ts` auto-detects this and falls back to polling in production: chat messages every 3s, conversations list every 8s, feed new-posts check every 12s. This is invisible day-to-day (chat still feels close to real-time) but is the answer if something "should have updated instantly but didn't" on the live deployment specifically. See the [backend repo](../../pulseconnect-backend)'s docs for the server-side reasoning.
  - **Future path, not yet started:** contingent on the backend running a WS server somewhere (see backend docs) — the frontend side of this is just flipping `VITE_ENABLE_SUBSCRIPTIONS=true` once one exists.

---

## 5. Open Risks / Needs Verification

- [x] **Production build (chunk-size fix).** **Verified 2026-09-10** — confirmed clean, the chunk-size warning no longer applies.
- [ ] **Watch seed data was replaced once already** (on the backend side — Google's demo video bucket got locked down mid-project, 2026-09-07 (6)) — if seed videos ever start failing again in your local dev environment, re-run the backend's `npm run seed` first before assuming it's a frontend regression.

---

## 6. Architecture Decisions

These are the non-obvious "why it's built this way" decisions worth knowing before changing related code (full tech stack and structure are in `README.md`):

- **Virtual Scroll**: the feed uses `@tanstack/react-virtual` with dynamic measurement — each `PostCard` is measured after mount so the virtualizer handles variable heights correctly. Overscan of 3 items prevents blank flash on fast scroll.
- **Apollo Split Link**: HTTP for queries/mutations, WebSocket for subscriptions, split by operation type at link creation time.
- **Cursor Pagination**: base64-encoded ISO timestamps as cursors, matching the backend's format. Apollo cache merge policies (`cacheTypePolicies` in `apollo.ts`) deduplicate appended pages for `feed`, `watchFeed`, `upcomingEvents`, and `marketplaceListings`.
- **Subscription Namespacing**: conversation-specific subscriptions use `${EVENT_NAME}.${conversationId}` channels to avoid broadcasting to every connected user.
- **Optimistic Messages**: messages are inserted optimistically with a temp ID; Apollo reconciles once the real server response arrives.
- **Comments are fetched separately from posts, on demand** — see §2 "Comments" above. This was the direct root cause of a comments-not-showing bug (2026-09-07 (11)) before the separate query existed; keep this pattern in mind if adding new comment-dependent UI.

---

## 7. Change History (condensed, full monorepo history)

One line per fix/addition, newest first, since 2026-08-21. Kept short on purpose — this is an index so a familiar-sounding bug can be recognized fast, not a forensic record. Kept unfiltered from the pre-split monorepo history: many entries touch both frontend and backend code from the same day's feature work — where an entry is backend-only (a resolver/model/test fix with no frontend change), it's kept here for continuity but the actual code now lives in [`pulseconnect-backend`](../../pulseconnect-backend). Ask Claude to search this repo's git history directly if you need the full root-cause story behind any entry.

| # | Date | Issue | Status |
|---|------|-------|--------|
| 2026-09-13 (6) | Sep 13 | *(backend)* `npm run build` failed after 2026-09-13 (5)'s `cacheTypePolicies` extraction: `tsc` flagged `feed`'s `keyArgs: false` as widened to plain `boolean`. Fixed by explicitly annotating `cacheTypePolicies: TypePolicies` | ✅ Fixed |
| 2026-09-13 (5) | Sep 13 | Running the frontend suite for real caught a problem with `Events.test.tsx`'s own "Load more" test: `MockedProvider` builds its own bare `InMemoryCache` with no field policies by default, so pagination tests weren't exercising the real merge policy. Fixed by extracting `cacheTypePolicies` in `apollo.ts` and having the test build its own `InMemoryCache` from it | ✅ Fixed |
| 2026-09-13 (4) | Sep 13 | *(backend)* `Event.myRsvp`'s attendee lookup broke once `attendees.user` was populated into a full User object | ✅ Fixed |
| 2026-09-13 (3) | Sep 13 | Built Marketplace UI (category-filtered browse grid, listing detail page, create-listing modal with multi-photo upload) — the last remaining "Coming Soon" placeholder. Deleted `ComingSoon.tsx` since Marketplace was its last remaining usage | ✅ Added |
| 2026-09-13 (2) | Sep 13 | Built Events UI (upcoming-events grid, detail page, RSVP). Full frontend test coverage added same day (`EventCard.test.tsx`, `Events.test.tsx`) | ✅ Added |
| 2026-09-13 (1) | Sep 13 | *(backend)* Pagination-cache bug: neither `watchFeed` nor `upcomingEvents`/`marketplaceListings` had an Apollo cache `merge` policy, so `fetchMore()` silently *replaced* the list instead of appending. Added a shared `paginatedConnectionMerge()` helper in `apollo.ts` | ✅ Fixed |
| 2026-09-11 (6) | Sep 11 | *(backend)* Notification race conditions and a Mongoose subdocument spread bug (`Story.media`) | ✅ Fixed |
| 2026-09-11 (5) | Sep 11 | *(backend)* Test config fix — inlined all `graphql`-related packages through Vite's module graph | ✅ Fixed |
| 2026-09-11 (4) | Sep 11 | *(backend)* Removed redundant `setup` script | ✅ Cleaned up |
| 2026-09-11 (3) | Sep 11 | *(backend)* Fixed a dual CJS/ESM `graphql` module resolution hazard breaking all backend tests | ✅ Fixed |
| 2026-09-11 (2) | Sep 11 | Closed the remaining frontend test-coverage gap: Feed container, ProfilePage, WatchPage, SettingsPage | ✅ Added |
| 2026-09-11 (1) | Sep 11 | *(monorepo)* Root `package.json` had no `test` script for running both workspaces at once | ✅ Fixed |
| 2026-09-10 (6) | Sep 10 | Expanded frontend test suite: PostCard reaction picker, Auth pages, zustand stores, apollo.ts errorLink + cache merge | ✅ Added |
| 2026-09-10 (5) | Sep 10 | *(backend)* Video/Watch test coverage; fixed a pagination bug that could silently truncate the feed when a deleted account's video was in the fetch window | ✅ Added / Fixed |
| 2026-09-10 (4) | Sep 10 | Started frontend test suite (Vitest + React Testing Library + MockedProvider): CommentSection, useConversationChat | ✅ Added |
| 2026-09-10 (3) | Sep 10 | *(backend)* Expanded backend test suite: auth, reactions, comments, notifications, stories | ✅ Added |
| 2026-09-10 (2) | Sep 10 | *(backend)* Started the backend test suite; found and fixed a `Conversation.participants` populated-ref bug | ✅ Added / Fixed |
| 2026-09-10 (1) | Sep 10 | *(backend)* Verified Vercel Node.js runtime (24.x) and production build chunk-size fix | ✅ Verified |
| 2026-09-07 (12) | Sep 7 | Removed offline-logout toast per request (now silent); deleted stray `sol1.js` scratch file | ✅ Fixed |
| 2026-09-07 (11) | Sep 7 | Comments: couldn't post, none showed, emoji did nothing — CommentSection relied on a field feed queries never fetch | ✅ Fixed |
| 2026-09-07 (10) | Sep 7 | Noisy expected-auth-error logging; no handling for an unreachable backend; 500kB+ build chunk warning | ✅ Fixed |
| 2026-09-07 (9) | Sep 7 | Watch: liking a video threw "Something went wrong" — `VideoComment.id` resolved to null | ✅ Fixed |
| 2026-09-07 (8) | Sep 7 | Watch: no visible gap between stacked reels — cards touched edge-to-edge | ✅ Fixed |
| 2026-09-07 (7) | Sep 7 | *(backend)* One MDN seed URL 404'd (bad guess); autoplay removed entirely — Watch videos now play on tap only | ✅ Fixed |
| 2026-09-07 (6) | Sep 7 | *(backend)* Watch seed videos 403ing — Google's demo bucket locked down public access; re-seed required | ✅ Fixed |
| 2026-09-07 (5) | Sep 7 | Watch: a real video load failure was indistinguishable from "just paused" — no error surfaced anywhere | ✅ Fixed |
| 2026-09-07 (4) | Sep 7 | Watch: no play affordance on a paused video; username hard to read over bright frames | ✅ Fixed |
| 2026-09-07 (3) | Sep 7 | Navbar profile dropdown had Dark Mode toggle + Log Out duplicated from Settings/left sidebar | ✅ Fixed |
| 2026-09-07 (2) | Sep 7 | Watch (video feed / reels) built out — new upload composer, swipeable feed | ✅ Fixed |
| 2026-09-07 (1) | Sep 7 | Stale login after reload; mobile nav pushed Log Out off-screen | ✅ Fixed |
| 2026-08-24 (6) | Aug 24 | Settings page unreadable text + misaligned toggles — traced to an incomplete Tailwind color palette | ✅ Fixed |
| 2026-08-24 (5) | Aug 24 | "Edit post"/"Edit profile" had no handlers; Cloudinary uploads 401ing (bad signed param); Create Story modal cut off | ✅ Fixed |
| 2026-08-24 (4) | Aug 24 | Edit Cover Photo / Edit Profile Photo buttons had no handlers | ✅ Fixed |
| 2026-08-24 (3) | Aug 24 | "Add Story" (+) had no handler; text-only stories were blocked by schema | ✅ Fixed |
| 2026-08-24 (2) | Aug 24 | Settings page built for real — privacy, notifications, password, dark mode | ✅ Fixed |
| 2026-08-24 (1) | Aug 24 | Saved page built for real — bookmarking a post now actually does something | ✅ Fixed |
| 2026-08-23 (6) | Aug 23 | Chat logic duplication extracted into a shared hook | ✅ Fixed |
| 2026-08-23 (5) | Aug 23 | Reaction picker popup on Like closed before you could click an emoji | ✅ Fixed |
| 2026-08-23 (4) | Aug 23 | Photos tab had no delete option; upload had no real server-side validation | ✅ Fixed |
| 2026-08-23 (3) | Aug 23 | Notification click-through — likes/comments went nowhere; no post detail page existed at all | ✅ Fixed |
| 2026-08-23 (2) | Aug 23 | Friends page built out for real (was a "Coming Soon" placeholder) | ✅ Fixed |
| 2026-08-23 (1) | Aug 23 | Messages page "New message" pencil icon had no handler | ✅ Fixed |
| 2026-08-22 (10) | Aug 22 | *(backend)* `Message.media` Mongoose subdocument defaulted to `{}`, causing "Internal server error" on every text-only chat message | ✅ Fixed |
| 2026-08-22 (9) | Aug 22 | *(backend)* GraphQL errors were never logged server-side in production | ✅ Fixed |
| 2026-08-22 (8) | Aug 22 | *(backend)* Regression: entry (7)'s routing fix broke `/graphql` and `/health` | ✅ Fixed |
| 2026-08-22 (7) | Aug 22 | *(backend)* Root cause of the CORS saga: Vercel's bracket catch-all only matches single-segment paths | ✅ Fixed |
| 2026-08-22 (6) | Aug 22 | Chat close-button investigation, notification not removed after accept/decline, chat input not clearing | ✅ Fixed |
| 2026-08-22 (5) | Aug 22 | Profile "Photos" tab was a hardcoded placeholder | ✅ Fixed |
| 2026-08-22 (4) | Aug 22 | Photo upload CORS error masked a server crash | ✅ Fixed |
| 2026-08-22 (3) | Aug 22 | Profile "Message" button passed a user id instead of a conversation id | ✅ Fixed |
| 2026-08-22 (2) | Aug 22 | *(backend)* `Post.tags` had no field resolver (same bug class as `User.friends`) | ✅ Fixed |
| 2026-08-22 (1) | Aug 22 | 6 nav links had no matching routes, silently bounced to Home | ✅ Interim fix (placeholders) |
| 2026-08-21 (4) | Aug 21 | *(backend)* Media upload moved off local disk to Cloudinary | ✅ Fixed |
| 2026-08-21 (3) | Aug 21 | Check-in used the native `window.prompt()` | ✅ Fixed |
| 2026-08-21 (2) | Aug 21 | Friend request notifications had no Accept/Decline; Photo/Video composer was decorative | ✅ Fixed |
| 2026-08-21 (1) | Aug 21 | Profile avatar off-center; Friends tab empty despite correct count | ✅ Fixed |
