# PulseConnect — Development Blueprint

> **Purpose of this file:** this is the single source of truth for *where the project actually stands* — what's built, what's verified working, what's stubbed out, and what's next. It's written so that any agentic model (or human) picking up the project cold can get a complete, accurate picture without reading the codebase first. For tech stack, folder structure, setup instructions, and GraphQL API reference, see [`README.md`](../README.md) — this file is intentionally scoped to *progress*, not project mechanics.
---

## 1. Project Status Snapshot

PulseConnect is a full-stack Socialbook-style social network (React + TypeScript + GraphQL + MongoDB). The core social product — feed, posts, comments, reactions, stories, messaging, notifications, friends, profiles, a video feed ("Watch"), search, settings, and dark mode — is **built and functionally complete**, backed by a real GraphQL API and MongoDB schema, not mocked data.

| Area | Status |
|---|---|
| Core social product (feed/posts/comments/reactions/stories/friends/profiles/messaging/notifications/search/settings) | ✅ Complete |
| Watch (video feed / reels) | ✅ Complete |
| Events (RSVPs, attendee lists) | ✅ Complete |
| Marketplace (buy/sell listings) | ✅ Complete |
| Real-time in production (Vercel) | ⚠️ Degraded by design — see §4 |
| Automated test suite | 🟡 In progress — backend coverage complete for all resolver groups (incl. video/Watch/Events). Frontend now also covers Feed, Profile, Watch(page), Events(page + card), Settings, apollo.ts pagination merges, on top of CommentSection, useConversationChat, PostCard, Auth, stores. Marketplace has no dedicated tests yet. CI wiring intentionally out of scope. See §3 |
| Vercel Node.js runtime | ✅ Verified — running 24.x (≥20 required by Apollo Server 5) |
| Production build (chunk-size fix) | ✅ Verified — confirmed clean |

**In one sentence:** everything a user can currently navigate to works for real — there are no silently-broken, fake, or "Coming Soon" placeholder features left in the app as of this review pass (2026-09-13); Events and Marketplace were the last two, and both are now fully built with real backend schemas/resolvers and frontend pages, plus a real pagination-cache bug (`fetchMore` silently replacing instead of appending) that was caught and fixed for Watch/Events/Marketplace all at once rather than shipped three times over.

---

## 2. Completed Features (verified against code)

Each item below reflects a real GraphQL resolver + MongoDB model + working frontend UI, not a placeholder. Where something is a partial implementation or a deliberate simplification, that's called out.

### Auth & Users
- [x] Register / Login with JWT (`auth.resolvers.ts`), password hashing via bcryptjs
- [x] Auth on both HTTP and WebSocket connections
- [x] `me` query, session persistence, forced logout on invalid/expired token or unreachable server

### Feed & Posts
- [x] Create / edit / delete text + media posts, with a visibility picker
- [x] Cursor-based pagination (base64-encoded ISO timestamp cursors)
- [x] Virtual-scrolled feed (`@tanstack/react-virtual`) — dynamic row measurement, handles large lists
- [x] Multi-emoji reactions (Like/Love/Haha/Wow/Sad/Angry) with hover picker
- [x] Live feed updates (new posts appear as toast banners — WS in dev, polling in prod)
- [x] Post detail page (`/post/:id`), reached via notification click-through
- [x] `Post.tags` field resolver (was missing; fixed 2026-08-22 (2))

### Comments
- [x] Nested comments with one level of replies, own dedicated query (`GET_POST_COMMENTS`) fetched per-post on demand — **not** bundled into feed queries (deliberate: avoids fetching full comment threads for every post in a paginated feed)
- [x] Emoji picker in the comment composer (custom 12-emoji grid, no external library)

### Stories
- [x] 24h stories with TTL-indexed auto-expiry (`expireAfterSeconds: 0` on `expiresAt`)
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
- [x] Dedicated `Video` model/schema + resolvers (reactions, comments)
- [x] Swipeable, scroll-snap vertical feed with tap-to-play (autoplay deliberately removed per request)
- [x] Upload composer
- [x] Error state for genuine load failures (distinct from "just paused")

### Events
- [x] Dedicated `Event` model/schema + resolvers — RSVP (GOING/INTERESTED/DECLINED, add/change-in-place/cancel), visibility scoping (PUBLIC/FRIENDS/PRIVATE) matching Post/Video's model, host-only update/delete, host notification on RSVP (`EVENT_RSVP`, self-RSVP correctly suppressed)
- [x] Upcoming-events grid + detail page with attendee avatars, create/edit modal, cover photo upload
- [x] Seeded demo events

### Marketplace
- [x] Dedicated `MarketplaceListing` model/schema + resolvers — category/condition/status enums, multi-photo listings (up to 10), seller-only update/delete/mark-sold/relist. No FRIENDS/PRIVATE visibility concept by design — a marketplace is inherently public to the whole community
- [x] Category-filtered browse grid + listing detail page with an image gallery, create-listing modal (multi-photo upload)
- [x] "Message Seller" reuses the existing `openChatWithUser` / messaging system rather than a parallel contact-seller flow — a question about a listing is an ordinary DM
- [x] Seeded demo listings (including one pre-marked `SOLD` to exercise that state on first run)

### Saved & Settings
- [x] Real Saved (bookmarks) page — replaced placeholder
- [x] Real Settings page — privacy, notifications, password change, dark mode, all backed by real mutations

### Search & UX polish
- [x] User search by name/username (navbar)
- [x] Full dark mode theme
- [x] Route-level code splitting (`React.lazy`) + vendor chunk splitting — fixes the original 500kB+ single-bundle build warning

### Infrastructure
- [x] Media upload via Cloudinary (moved off local disk — required for Vercel's read-only filesystem)
- [x] DataLoader for N+1 batching
- [x] Zod input validation
- [x] Production-safe GraphQL error logging (expected client errors like `UNAUTHENTICATED` log one compact line; unexpected errors keep full stack traces)
- [x] Graceful handling of an unreachable backend (forced logout + redirect, silent per latest request — see changelog 2026-09-07 (12))

---

## 3. Pending / Not Started

- [ ] **Marketplace test coverage** — Events has full backend + frontend test coverage (see below); Marketplace was built the same way but has no dedicated tests yet. Same shape of work as Events' `event.test.ts`/`EventCard.test.tsx`/`Events.test.tsx` — `marketplace.test.ts` (ownership on update/delete/markSold/relist, category-filtered pagination, ACTIVE-only public feed vs. ACTIVE+SOLD `userListings`) plus frontend coverage for `ListingCard`/`MarketplacePage`.
- [x] **Automated test suite — started 2026-09-10, expanded 2026-09-10 (twice), 2026-09-13.** Backend test infrastructure is in place (Vitest + `mongodb-memory-server`, tests run real resolvers against a real in-memory MongoDB via `graphql()` — not mocks). Coverage now spans every resolver group, including video/Watch and Events. This is a workspaces monorepo (root `package.json` → `backend`/`frontend`/`shared`) — the root now has `npm test` (runs both workspaces), `npm run test:backend`, and `npm run test:frontend`, so `npm test` from the repo root is the normal way to run everything; each workspace's own `npm test` still works standalone.
  - [x] Populated-ref regression coverage (`User.friends` / `Post.tags` / `Conversation.participants` bug class) — `user-friends.test.ts`, `post-tags.test.ts`, and the `Conversation.participants` case folded into `send-message.test.ts` (see §7 2026-09-10 (2) for the bug that surfaced there).
  - [x] Mongoose single-nested-subdocument default-object gotcha (`Message.media`) — `message-media.test.ts`.
  - [x] `sendMessage` with a `recipientId` and no prior conversation (find-or-create, no duplicates, either-sends-first) — `send-message.test.ts`.
  - [x] Auth: register (incl. case-insensitive email/username uniqueness, password never leaked, bcrypt hashing verified at rest), login (correct/incorrect credentials, no user-enumeration on a non-existent email), `me` (authenticated + unauthenticated) — `auth.test.ts`.
  - [x] Reactions: add/change-in-place/no-duplicate-notification-on-change, no self-notification — `reactions-comments.test.ts`.
  - [x] Comments: top-level + nested replies, `repliesCount`, notification on comment, 404 on a non-existent post — `reactions-comments.test.ts`.
  - [x] Notifications: scoped-to-recipient listing, unread count, mark-read and delete both rejecting a non-owner — `notifications.test.ts`.
  - [x] Stories: text-only and media creation, the empty-story rejection, friend-scoped + expiry-filtered `stories` query grouping with self-first ordering, `hasUnviewed` flipping after `viewStory` — `stories.test.ts`.
  - [x] Video/Watch (`video.test.ts`): `createVideo` + URL validation, `watchFeed` visibility scoping (PUBLIC only) and pagination, reactions (add/change/remove), `commentOnVideo`, `deleteVideo` ownership, `incrementVideoView`, and `userVideos` friend/stranger/owner visibility scoping. See §7 2026-09-10 (5) for a real pagination bug found and fixed while writing this file.
  - [x] Events (`event.test.ts`): `createEvent` defaults/validation (title required, `endAt >= startAt`, auth required), `upcomingEvents` visibility+time scoping and soonest-first pagination (incl. the same deleted-host widening-fetch safety net as Watch), RSVP add/change-in-place/cancel, host notification on RSVP with self-RSVP correctly suppressed (a bug caught and fixed while writing the resolver itself, `updateEvent`/`deleteEvent` ownership, and `userEvents` owner/friend/stranger visibility scoping.
 - **CI wiring is intentionally out of scope** — tests run locally via `npm test`, by design, not on push/PR.

  **Frontend — started 2026-09-10, expanded 2026-09-10.** Vitest + React Testing Library + `@apollo/client/testing`'s `MockedProvider`, mirroring the backend's approach: real components/hooks/pages/stores exercised against mocked GraphQL responses, not shallow rendering. Infra: `frontend/vitest.config.ts`, `frontend/tests/setup.ts` (jest-dom matchers + RTL cleanup).
  - [x] `CommentSection` (`tests/components/CommentSection.test.tsx`) — direct regression coverage for the exact bug in §7's 2026-09-07 (11) entry (comments depending on a field no query ever fetched): loading → real data via `GET_POST_COMMENTS`, the empty state, posting a comment through `CREATE_COMMENT` and seeing it appear after the refetch, and expanding a reply.
  - [x] `useConversationChat` (`tests/hooks/useConversationChat.test.tsx`) — the hook itself, not just a component wrapping it (see §7 2026-08-23 (6), the reason it was extracted in the first place): sending in an existing conversation, sending the very first message to a `recipientId` and promoting to the server-created conversation id, a no-op on empty/whitespace input, and a failed send restoring the typed text + surfacing a toast instead of silently clearing.
  - [x] `PostCard` reaction picker (`tests/components/PostCard.test.tsx`) — regression coverage for §7's 2026-08-23 (5) entry (the picker closing before the pointer reached it), driven with fake timers against the actual 500ms open / 400ms close delays, plus clicking an emoji through a real mutation mock.
  - [x] `Auth` page (`tests/pages/Auth.test.tsx`) — `LoginPage` (email trim/lowercase, server-error display, submit-button disabled state) and `RegisterPage`'s client-side `validateForm` (empty-form errors, the overlapping-password-rules overwrite behavior, mismatched passwords, invalid username characters, per-field error-clear-on-edit, and a full valid submission).
  - [x] Zustand stores (`tests/store/store.test.ts`) — `useAuthStore` (setAuth/setUser/logout, including the Apollo cache being cleared on logout), `useUIStore` (dark mode toggling the document root class, sidebar, the open/pending-recipient chat state machine), `useNotificationStore`.
  - [x] `apollo.ts` (`tests/lib/apollo.test.ts`) — `errorLink` (the exact fix in §7's 2026-09-07 (1) entry: both `token` and `auth-storage` cleared together on `UNAUTHENTICATED`, the already-on-`/login` guard, non-auth GraphQL errors left alone, and the connection-failure-vs-ordinary-HTTP-error distinction for network errors) and the `feed`/`watchFeed`/`upcomingEvents`/`messages` cache `merge` functions (append + de-dupe by ref, `messages` scoped per `conversationId`), exercised through the real `writeQuery`/`readQuery` cache API. `errorLink` was made an export (previously module-private) purely so it could be imported here — no behavior change. See §7 2026-09-13 (1) for the `watchFeed`/`upcomingEvents`/`marketplaceListings` merge-policy bug this regression-tests.
  - [x] `Feed` container (`tests/components/Feed.test.tsx`) — the list/container logic itself, not `PostCard` (already covered): initial-load skeletons, rendering a loaded page plus the "end of feed" message, infinite-scroll `fetchMore` actually appending a second page (exercised through a real `InMemoryCache` mirroring the app's `feed` merge policy, not a shallow mock), and the new-post subscription banner appearing + clearing on refresh. `PostCard`/`CreatePost`/`StoriesBar` and `@tanstack/react-virtual` itself are stubbed since none of them are what this file is testing.
  - [x] `ProfilePage` (`tests/pages/Profile.test.tsx`) — loading skeleton, the "user not found" state, the default Posts tab (incl. owner-only "Edit profile"), the About/Friends tabs, and a visitor sending a friend request through `SEND_FRIEND_REQUEST` (button disables and relabels once sent). `AppLayout`, `PostCard`, and `EditProfileModal` are stubbed to isolate Profile's own tab/data logic from the shared authenticated shell.
  - [x] `WatchPage` (`tests/pages/Watch.test.tsx`) — loading placeholder, the empty state, rendering a loaded video list with the first video marked active, and opening/closing the upload modal. `AppLayout`, `VideoCard`, and `CreateVideoModal` are stubbed; jsdom's missing `IntersectionObserver` is polyfilled with a no-op stub since WatchPage constructs one on mount.
  - [x] `EventsPage` (`tests/pages/Events.test.tsx`) — loading state, empty state, rendering a loaded list, opening/closing the create-event modal, and "Load more" pagination via `fetchMore``AppLayout`, `EventCard`, and `CreateEventModal` are stubbed, same pattern as `WatchPage`'s test.
  - [x] `EventCard` (`tests/components/EventCard.test.tsx`) — renders title/location/counts, sends the right RSVP mutation on click (and correctly cancels instead of re-sending when toggling the same status off), hides the host-only options menu from non-hosts, and lets the host delete with a confirm guard. Note: since `EventCard` takes `event` as a plain prop rather than a live query result, a successful RSVP mutation in isolation won't reactively repaint the card's own counts the way it does inside the real app (where `EventsPage`'s query is what re-renders) — so these tests assert the mutation fires with the right variables and completes without error, the same convention `PostCard.test.tsx` already uses for this exact limitation, rather than asserting a refreshed count.
  - [x] `SettingsPage` (`tests/pages/Settings.test.tsx`) — loading state, rendering fetched privacy/notification settings, optimistic privacy-visibility updates, a notification toggle reverting on mutation failure, the dark-mode toggle, the password-change form's disabled-until-filled state and successful submission (form clears), and logout navigating to `/login`.

---

## 4. Known Limitations (by design, not bugs)

- **Real-time in production is polling, not WebSockets.** Vercel's serverless functions can't hold a persistent WS connection open, so `backend/api/` (the Vercel entrypoint) has no WS server at all — only `backend/src/index.ts` (the standalone dev/self-hosted server) does. The frontend auto-detects this via `subscriptionsEnabled` in `frontend/src/lib/apollo.ts` and falls back to polling in production: chat messages every 3s, conversations list every 8s, feed new-posts check every 12s. This is invisible day-to-day (chat still feels close to real-time) but is the answer if something "should have updated instantly but didn't" on the live deployment specifically.
  - **Future path, not yet started:** either (a) run a small always-on Node process just for the WS layer (Railway/Render/Fly.io), or (b) evaluate Vercel's own evolving realtime/Edge WebSocket support. This is a real infrastructure decision, not a quick code change — flagged so it isn't re-investigated from scratch later, not because it's urgent.

---

## 5. Open Risks / Needs Verification

- [x] **Vercel Node.js runtime version.** Apollo Server 5 requires Node ≥20. **Verified 2026-09-10: set to 24.x** — no action needed, backend will boot correctly on the current deploy.
- [x] **Production build (chunk-size fix).** **Verified 2026-09-10** — confirmed clean, the chunk-size warning no longer applies.
- [ ] **Watch seed data was replaced once already** (Google's demo video bucket got locked down mid-project, 2026-09-07 (6)) — if seed videos ever start failing again, re-run `npm run seed` first before assuming it's a code regression.

---

## 6. Architecture Decisions

These are the non-obvious "why it's built this way" decisions worth knowing before changing related code (full tech stack and structure are in `README.md`):

- **Virtual Scroll**: the feed uses `@tanstack/react-virtual` with dynamic measurement — each `PostCard` is measured after mount so the virtualizer handles variable heights correctly. Overscan of 3 items prevents blank flash on fast scroll.
- **Apollo Split Link**: HTTP for queries/mutations, WebSocket for subscriptions, split by operation type at link creation time.
- **Cursor Pagination**: base64-encoded ISO timestamps as cursors; MongoDB query is `{ createdAt: { $lt: decodedCursor } }`. Apollo cache merge policy deduplicates appended pages.
- **Subscription Namespacing**: conversation-specific subscriptions use `${EVENT_NAME}.${conversationId}` channels to avoid broadcasting to every connected user.
- **Optimistic Messages**: messages are inserted optimistically with a temp ID; Apollo reconciles once the real server response arrives.
- **Comments are fetched separately from posts, on demand** — see §2 "Comments" above. This was the direct root cause of a comments-not-showing bug (2026-09-07 (11)) before the separate query existed; keep this pattern in mind if adding new comment-dependent UI.

---

## 7. Change History (condensed)

One line per fix/addition, newest first, since 2026-08-21. Kept short on purpose — this is an index so a familiar-sounding bug can be recognized fast, not a forensic record. Ask Claude to search the codebase/git history directly if you need the full root-cause story behind any entry.