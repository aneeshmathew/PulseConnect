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
  - [x] Events (`event.test.ts`): `createEvent` defaults/validation (title required, `endAt >= startAt`, auth required), `upcomingEvents` visibility+time scoping and soonest-first pagination (incl. the same deleted-host widening-fetch safety net as Watch), RSVP add/change-in-place/cancel, host notification on RSVP with self-RSVP correctly suppressed (a bug caught and fixed while writing the resolver itself, before this test existed — see §7 2026-09-13 (2)), `updateEvent`/`deleteEvent` ownership, and `userEvents` owner/friend/stranger visibility scoping.
  - **Verified running locally (2026-09-13)** — the full backend suite, including `event.test.ts`, was actually run via `npm test` from `backend/` (not just reviewed by hand): 59/60 passed on the first real run, with the one failure being the exact `myRsvp` populated-vs-raw-id bug described in §7 2026-09-13 (4) — fixed, and the suite should be green on the next run. This environment still has no network access to `npm install`, so any *newly added* spec files continue to be reviewed by hand here until run for real; treat that as the standing caveat for anything dated after 2026-09-13 rather than assuming the whole suite is perpetually unverified.
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
  - [x] `EventsPage` (`tests/pages/Events.test.tsx`) — loading state, empty state, rendering a loaded list, opening/closing the create-event modal, and "Load more" pagination via `fetchMore`, run against a fresh `InMemoryCache` built from the app's real `cacheTypePolicies` (see §7 2026-09-13 (5)) rather than `MockedProvider`'s bare default cache, so it actually exercises the production merge policy end-to-end. `AppLayout`, `EventCard`, and `CreateEventModal` are stubbed, same pattern as `WatchPage`'s test.
  - [x] `EventCard` (`tests/components/EventCard.test.tsx`) — renders title/location/counts, sends the right RSVP mutation on click (and correctly cancels instead of re-sending when toggling the same status off), hides the host-only options menu from non-hosts, and lets the host delete with a confirm guard. Note: since `EventCard` takes `event` as a plain prop rather than a live query result, a successful RSVP mutation in isolation won't reactively repaint the card's own counts the way it does inside the real app (where `EventsPage`'s query is what re-renders) — so these tests assert the mutation fires with the right variables and completes without error, the same convention `PostCard.test.tsx` already uses for this exact limitation, rather than asserting a refreshed count.
  - [x] `SettingsPage` (`tests/pages/Settings.test.tsx`) — loading state, rendering fetched privacy/notification settings, optimistic privacy-visibility updates, a notification toggle reverting on mutation failure, the dark-mode toggle, the password-change form's disabled-until-filled state and successful submission (form clears), and logout navigating to `/login`.
  - **Verified running locally (2026-09-13)** — the full frontend suite was actually run via `npm test` from `frontend/` (not just reviewed by hand): 73/74 passed, with the one failure being `Events.test.tsx`'s own "Load more" test using a cache that didn't match production — described in §7 2026-09-13 (5) — now fixed. Same standing caveat as the backend note above: this environment still can't `npm install`, so anything dated after 2026-09-13 is reviewed by hand here until actually run.

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
| 2026-09-13 (6) | Sep 13 | `npm run build` failed after 2026-09-13 (5)'s `cacheTypePolicies` extraction: `tsc` flagged `feed`'s `keyArgs: false` as widened to plain `boolean`, incompatible with Apollo's `FieldPolicy['keyArgs']` type. Previously this object was inlined directly into `new InMemoryCache({ typePolicies: {...} })`, where contextual typing from that call site kept the literal narrow; pulling it out to a bare `const cacheTypePolicies = {...}` lost that context. Fixed by explicitly annotating `cacheTypePolicies: TypePolicies` (imported from `@apollo/client`), which restores the same contextual narrowing | ✅ Fixed |
| 2026-09-13 (5) | Sep 13 | Running the frontend suite for real caught a problem with `Events.test.tsx`'s own "Load more" test, not the app code: `MockedProvider` builds its own bare `InMemoryCache` with no field policies by default, so testing pagination without wiring in the app's real `upcomingEvents` merge policy meant the test was exercising a scenario that can't happen in production — worse, it initially proved the *opposite* of what 2026-09-13 (1) fixed, since without any merge policy `fetchMore`'s result lands under a completely different (un-watched) cache key and the UI doesn't update *at all*, not even by replacing the list. Fixed by extracting the cache config into an exported `cacheTypePolicies` object in `apollo.ts` and having the test build its own fresh `InMemoryCache` from it (passed via `MockedProvider`'s `cache` prop) — now an integration-level regression test for the real merge policy, not just `apollo.test.ts`'s existing unit-level `writeQuery`/`readQuery` coverage of the same function. Required a secondary fix: `apollo.ts` constructs a `GraphQLWsLink` at module load time, which throws if no global `WebSocket` exists (jsdom doesn't provide one) — a static import of `cacheTypePolicies` would have been hoisted ahead of any stub this file could add, so it's reached via a dynamic `import()` instead, same pattern `apollo.test.ts` already used for the same reason | ✅ Fixed |
| 2026-09-13 (4) | Sep 13 | Running the Events backend suite for real (locally, not just reviewed by hand) caught a second instance of the exact same populated-vs-raw-id pitfall as 2026-09-13 (2): `Event.myRsvp`'s attendee lookup did `a.user.toString()`, which works when `attendees.user` is a raw ObjectId (list queries) but silently fails to match once it's been populated into a full User object (createEvent/updateEvent/rsvpToEvent/cancelRsvp and the single `event(id)` query all populate it) — so `myRsvp` came back `null` right after RSVPing. Fixed by checking for a populated `_id` first, same pattern the `attendees` field resolver already used | ✅ Fixed |
| 2026-09-13 (3) | Sep 13 | Built Marketplace (`MarketplaceListing` model/resolvers, category-filtered browse grid, listing detail page, create-listing modal with multi-photo upload) — the last remaining "Coming Soon" placeholder. "Message Seller" deliberately reuses the existing `openChatWithUser` messaging flow instead of a parallel contact-seller feature. Deleted `ComingSoon.tsx` since Marketplace was its last remaining usage. No dedicated tests yet — see §3 | ✅ Added |
| 2026-09-13 (2) | Sep 13 | Built Events (`Event` model/resolvers, RSVP, upcoming-events grid, detail page) — during implementation, caught and fixed a self-notification bug before it ever shipped: `rsvpToEvent`'s host-RSVPing-to-their-own-event check compared `event.host.toString()` *after* `.populate('host', ...)`, which would have compared against a populated User object instead of the raw id, silently sending self-notifications. Fixed by capturing the id before populating. Full backend + frontend test coverage added same day (`event.test.ts`, `EventCard.test.tsx`, `Events.test.tsx`) | ✅ Added / Fixed |
| 2026-09-13 (1) | Sep 13 | Found and fixed the same pagination-cache bug as 2026-09-10 (5) in two more places before it could bite: neither `watchFeed` nor the new `upcomingEvents`/`marketplaceListings` fields had an Apollo cache `merge` policy, so `fetchMore()` silently *replaced* the list on "Load more" instead of appending to it (the `feed` field already had this fixed via its own `merge` function — these three didn't). Added a shared `paginatedConnectionMerge()` helper in `apollo.ts` (`keyArgs: false` for Watch/Events, `keyArgs: ['category']` for Marketplace since category legitimately scopes the list) with regression tests in `apollo.test.ts` | ✅ Fixed |
| 2026-09-11 (6) | Sep 11 | Three genuine bugs surfaced once the test suite could actually run: (1) `createComment`/`reactToPost` fired-and-forgot their `Notification.create(...)` calls, a real race where the notification isn't guaranteed to exist by the time the resolver returns — awaited both, matching the pattern `acceptFriendRequest`/`sendFriendRequest` already use; (2) `Story.media` spread a Mongoose subdocument (`{ ...parent.media, type: ... }`) to normalize the type casing — Mongoose exposes subdocument fields via prototype getters, not own enumerable properties, so the spread silently dropped every field including `url`, throwing `Cannot return null for non-nullable field StoryMedia.url`; fixed to build the return object from explicit field access, matching how `Comment.media`/`Message.media` already handle this same pitfall; (3) a video-visibility test only set friendship on one side (`author.friends = [friend]`) while the resolver correctly checks the *viewer's* own `friends` array — the real `acceptFriendRequest` flow always updates both users symmetrically, so this was an incomplete test fixture, not a resolver bug; fixed the fixture to set both sides | ✅ Fixed |
| 2026-09-11 (5) | Sep 11 | `test.server.deps.inline` fix (see (3) below) resurfaced as `Cannot use GraphQLObjectType "User" from another module or realm` at schema-build time — the explicit inline list named `graphql`/`@graphql-tools/schema`/`@graphql-tools/merge`/`graphql-tag` but missed `@graphql-tools/utils` (a transitive dep of `@graphql-tools/schema` that does the actual `mapSchema`/`isObjectType` work), which stayed externalized and pulled in yet another `graphql` build. Replaced the explicit list with `inline: [/graphql/]` so every graphql-related package, transitive or not, resolves through the same path | ✅ Fixed |
| 2026-09-11 (4) | Sep 11 | Removed the now-redundant `setup` script (was just `npm install`, so it added a name to remember without adding any behavior) — `npm install` from the root is the documented install step everywhere now, including the README | ✅ Cleaned up |
| 2026-09-11 (3) | Sep 11 | `Cannot use GraphQLSchema … from another module or realm` failing all 47 backend tests, even with a single deduped `graphql` package on disk — a dual CJS/ESM build hazard between the test files' `import { graphql } from 'graphql'` and `@graphql-tools/schema`'s internal resolution of the same package. A `resolve.alias` pinning `graphql` to one file didn't help, since Vitest externalizes `node_modules` packages by default (loaded via Node's own resolution, bypassing Vite's alias entirely) — fixed instead via `test.server.deps.inline` in `backend/vitest.config.ts`, forcing `graphql`/`@graphql-tools/*`/`graphql-tag` through Vite's unified module graph for every consumer. Also simplified the root `test`/install path (removed the redundant per-workspace installs the old `setup` script ran) and pinned `graphql` via root `overrides` as a belt-and-suspenders safeguard | ✅ Fixed |
| 2026-09-11 (2) | Sep 11 | Closed the remaining frontend test-coverage gap: Feed container, ProfilePage, WatchPage, SettingsPage | ✅ Added |
| 2026-09-11 (1) | Sep 11 | Root `package.json` (workspaces monorepo) had no `test` script — each workspace's own `npm test` worked, but `npm test` from the repo root did nothing | ✅ Fixed |
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
