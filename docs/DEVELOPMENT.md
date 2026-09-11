# PulseConnect — Development Blueprint

> **Purpose of this file:** this is the single source of truth for *where the project actually stands* — what's built, what's verified working, what's stubbed out, and what's next. It's written so that any agentic model (or human) picking up the project cold can get a complete, accurate picture without reading the codebase first. For tech stack, folder structure, setup instructions, and GraphQL API reference, see [`README.md`](../README.md) — this file is intentionally scoped to *progress*, not project mechanics.
>

---

## 1. Project Status Snapshot

PulseConnect is a full-stack Socialbook-style social network (React + TypeScript + GraphQL + MongoDB). The core social product — feed, posts, comments, reactions, stories, messaging, notifications, friends, profiles, a video feed ("Watch"), search, settings, and dark mode — is **built and functionally complete**, backed by a real GraphQL API and MongoDB schema, not mocked data.

| Area | Status |
|---|---|
| Core social product (feed/posts/comments/reactions/stories/friends/profiles/messaging/notifications/search/settings) | ✅ Complete |
| Watch (video feed / reels) | ✅ Complete |
| Marketplace | ❌ Not started — nav link + placeholder page only |
| Events | ❌ Not started — nav link + placeholder page only |
| Real-time in production (Vercel) | ⚠️ Degraded by design — see §4 |
| Automated test suite | 🟡 In progress — backend coverage complete for all resolver groups (incl. video/Watch). Frontend covers CommentSection, useConversationChat, PostCard, Auth, stores, apollo.ts; Feed/Profile/Watch(page)/Settings still untested. CI wiring intentionally out of scope. See §3 |
| Vercel Node.js runtime | ✅ Verified — running 24.x (≥20 required by Apollo Server 5) |
| Production build (chunk-size fix) | ✅ Verified — confirmed clean |

**In one sentence:** everything a user can currently navigate to either works for real or clearly says "Coming Soon" — there are no silently-broken or fake/decorative features left in the app as of the last review pass (2026-09-07); both outstanding deploy risks have since been confirmed clear, the backend resolver test suite is now complete (including a real pagination bug found and fixed along the way), and frontend coverage spans the highest-value components/pages/logic with Feed/Profile/Watch(page)/Settings remaining (2026-09-10).

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

- [ ] **Marketplace** — nav link + `ComingSoon` placeholder only. No backend schema, no model, no resolvers exist yet. Same class of work as Watch was before 2026-09-07 (2).
- [ ] **Events** — same situation as Marketplace: placeholder only, nothing backing it.
- [x] **Automated test suite — started 2026-09-10, expanded 2026-09-10 (twice).** Backend test infrastructure is in place (Vitest + `mongodb-memory-server`, tests run real resolvers against a real in-memory MongoDB via `graphql()` — not mocks). Coverage now spans every resolver group, including video/Watch:
  - [x] Populated-ref regression coverage (`User.friends` / `Post.tags` / `Conversation.participants` bug class) — `user-friends.test.ts`, `post-tags.test.ts`, and the `Conversation.participants` case folded into `send-message.test.ts` (see §7 2026-09-10 (2) for the bug that surfaced there).
  - [x] Mongoose single-nested-subdocument default-object gotcha (`Message.media`) — `message-media.test.ts`.
  - [x] `sendMessage` with a `recipientId` and no prior conversation (find-or-create, no duplicates, either-sends-first) — `send-message.test.ts`.
  - [x] Auth: register (incl. case-insensitive email/username uniqueness, password never leaked, bcrypt hashing verified at rest), login (correct/incorrect credentials, no user-enumeration on a non-existent email), `me` (authenticated + unauthenticated) — `auth.test.ts`.
  - [x] Reactions: add/change-in-place/no-duplicate-notification-on-change, no self-notification — `reactions-comments.test.ts`.
  - [x] Comments: top-level + nested replies, `repliesCount`, notification on comment, 404 on a non-existent post — `reactions-comments.test.ts`.
  - [x] Notifications: scoped-to-recipient listing, unread count, mark-read and delete both rejecting a non-owner — `notifications.test.ts`.
  - [x] Stories: text-only and media creation, the empty-story rejection, friend-scoped + expiry-filtered `stories` query grouping with self-first ordering, `hasUnviewed` flipping after `viewStory` — `stories.test.ts`.
  - [x] Video/Watch (`video.test.ts`): `createVideo` + URL validation, `watchFeed` visibility scoping (PUBLIC only) and pagination, reactions (add/change/remove), `commentOnVideo`, `deleteVideo` ownership, `incrementVideoView`, and `userVideos` friend/stranger/owner visibility scoping. See §7 2026-09-10 (5) for a real pagination bug found and fixed while writing this file.
  - **Could not run in this environment** (no network access here to `npm install` the new test dependencies) — all 9 spec files reviewed by hand for correctness against the actual schema/resolvers/models; run `npm install && npm test` from `backend/` to execute for real before relying on these as a safety net.
  - **CI wiring is intentionally out of scope** — tests run locally via `npm test`, by design, not on push/PR.

  **Frontend — started 2026-09-10, expanded 2026-09-10.** Vitest + React Testing Library + `@apollo/client/testing`'s `MockedProvider`, mirroring the backend's approach: real components/hooks/pages/stores exercised against mocked GraphQL responses, not shallow rendering. Infra: `frontend/vitest.config.ts`, `frontend/tests/setup.ts` (jest-dom matchers + RTL cleanup).
  - [x] `CommentSection` (`tests/components/CommentSection.test.tsx`) — direct regression coverage for the exact bug in §7's 2026-09-07 (11) entry (comments depending on a field no query ever fetched): loading → real data via `GET_POST_COMMENTS`, the empty state, posting a comment through `CREATE_COMMENT` and seeing it appear after the refetch, and expanding a reply.
  - [x] `useConversationChat` (`tests/hooks/useConversationChat.test.tsx`) — the hook itself, not just a component wrapping it (see §7 2026-08-23 (6), the reason it was extracted in the first place): sending in an existing conversation, sending the very first message to a `recipientId` and promoting to the server-created conversation id, a no-op on empty/whitespace input, and a failed send restoring the typed text + surfacing a toast instead of silently clearing.
  - [x] `PostCard` reaction picker (`tests/components/PostCard.test.tsx`) — regression coverage for §7's 2026-08-23 (5) entry (the picker closing before the pointer reached it), driven with fake timers against the actual 500ms open / 400ms close delays, plus clicking an emoji through a real mutation mock.
  - [x] `Auth` page (`tests/pages/Auth.test.tsx`) — `LoginPage` (email trim/lowercase, server-error display, submit-button disabled state) and `RegisterPage`'s client-side `validateForm` (empty-form errors, the overlapping-password-rules overwrite behavior, mismatched passwords, invalid username characters, per-field error-clear-on-edit, and a full valid submission).
  - [x] Zustand stores (`tests/store/store.test.ts`) — `useAuthStore` (setAuth/setUser/logout, including the Apollo cache being cleared on logout), `useUIStore` (dark mode toggling the document root class, sidebar, the open/pending-recipient chat state machine), `useNotificationStore`.
  - [x] `apollo.ts` (`tests/lib/apollo.test.ts`) — `errorLink` (the exact fix in §7's 2026-09-07 (1) entry: both `token` and `auth-storage` cleared together on `UNAUTHENTICATED`, the already-on-`/login` guard, non-auth GraphQL errors left alone, and the connection-failure-vs-ordinary-HTTP-error distinction for network errors) and the `feed`/`messages` cache `merge` functions (append + de-dupe by ref, `messages` scoped per `conversationId`), exercised through the real `writeQuery`/`readQuery` cache API. `errorLink` was made an export (previously module-private) purely so it could be imported here — no behavior change.
  - [ ] **Not yet covered — remaining frontend gap:** the Feed page/list container itself (as opposed to `PostCard`, which is covered), Profile, Watch (the frontend page — the backend video resolvers it calls are now fully covered), and Settings.
  - **Could not run in this environment**, same reason as the backend suite — reviewed by hand; run `npm install && npm test` from `frontend/` to execute for real.

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

| # | Date | Issue | Status |
|---|------|-------|--------|
| 2026-09-10 (6) | Sep 10 | Expanded frontend test suite further: PostCard reaction picker, Auth pages, zustand stores, apollo.ts errorLink + cache merge | ✅ Added |
| 2026-09-10 (5) | Sep 10 | Backend video/Watch test coverage; found and fixed a pagination bug that could silently truncate the feed when a deleted account's video was in the fetch window | ✅ Added / Fixed |
| 2026-09-10 (4) | Sep 10 | Started frontend test suite (Vitest + React Testing Library + MockedProvider): CommentSection, useConversationChat | ✅ Added |
| 2026-09-10 (3) | Sep 10 | Expanded backend test suite: auth, reactions, comments, notifications, stories | ✅ Added |
| 2026-09-10 (2) | Sep 10 | Started the backend test suite (Vitest + in-memory MongoDB); found and fixed a new `Conversation.participants` populated-ref bug in the process | ✅ Added / Fixed |
| 2026-09-10 (1) | Sep 10 | Verified the two open deploy risks: Vercel Node.js runtime (24.x) and production build (chunk-size fix) | ✅ Verified |
| 2026-09-07 (12) | Sep 7 | Removed offline-logout toast per request (now silent); deleted stray `sol1.js` scratch file | ✅ Fixed |
| 2026-09-07 (11) | Sep 7 | Comments: couldn't post, none showed, emoji did nothing — CommentSection relied on a field feed queries never fetch | ✅ Fixed |
| 2026-09-07 (10) | Sep 7 | Noisy expected-auth-error logging; no handling for an unreachable backend; 500kB+ build chunk warning | ✅ Fixed |
| 2026-09-07 (9) | Sep 7 | Watch: liking a video threw "Something went wrong" — `VideoComment.id` resolved to null | ✅ Fixed |
| 2026-09-07 (8) | Sep 7 | Watch: no visible gap between stacked reels — cards touched edge-to-edge | ✅ Fixed |
| 2026-09-07 (7) | Sep 7 | One MDN seed URL 404'd (bad guess); autoplay removed entirely — Watch videos now play on tap only | ✅ Fixed |
| 2026-09-07 (6) | Sep 7 | Watch seed videos 403ing — Google's demo bucket locked down public access; re-seed required | ✅ Fixed |
| 2026-09-07 (5) | Sep 7 | Watch: a real video load failure was indistinguishable from "just paused" — no error surfaced anywhere | ✅ Fixed |
| 2026-09-07 (4) | Sep 7 | Watch: no play affordance on a paused video; username hard to read over bright frames | ✅ Fixed |
| 2026-09-07 (3) | Sep 7 | Navbar profile dropdown had Dark Mode toggle + Log Out duplicated from Settings/left sidebar | ✅ Fixed |
| 2026-09-07 (2) | Sep 7 | Watch (video feed / reels) built out — new `Video` model/schema/resolvers, upload composer, swipeable feed | ✅ Fixed |
| 2026-09-07 (1) | Sep 7 | Stale login after reload (`requireAuth` uncoded error + half-cleared auth state); mobile nav pushed Log Out off-screen | ✅ Fixed |
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