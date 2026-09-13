import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime

  # ─── Enums ────────────────────────────────────────────────────────────────
  enum Visibility { PUBLIC FRIENDS PRIVATE }
  enum ReactionType { LIKE LOVE HAHA WOW SAD ANGRY }
  enum NotificationType {
    FRIEND_REQUEST FRIEND_ACCEPT POST_LIKE POST_COMMENT
    COMMENT_REPLY POST_SHARE POST_TAG MENTION STORY_VIEW MESSAGE EVENT_RSVP
  }
  enum MediaType { IMAGE VIDEO GIF }
  enum RsvpStatus { GOING INTERESTED DECLINED }
  enum ListingCategory { ELECTRONICS VEHICLES HOME_GARDEN CLOTHING FURNITURE TOYS_GAMES OTHER }
  enum ListingCondition { NEW LIKE_NEW GOOD FAIR }
  enum ListingStatus { ACTIVE SOLD }

  # ─── Types ────────────────────────────────────────────────────────────────
  type User {
    id: ID!
    username: String!
    email: String!
    firstName: String!
    lastName: String!
    fullName: String!
    avatar: String
    coverPhoto: String
    bio: String
    location: String
    website: String
    birthDate: DateTime
    friends: [User!]
    friendsCount: Int!
    isOnline: Boolean!
    lastSeen: DateTime
    isVerified: Boolean!
    isFriend: Boolean
    hasFriendRequest: Boolean
    posts: [Post!]
    postsCount: Int!
    createdAt: DateTime!
    # Only populated when viewing your own account (id === the requesting
    # user) — settings are private, not part of a public profile view.
    privacySettings: PrivacySettings
    notificationSettings: NotificationSettings
  }

  type PrivacySettings {
    profileVisibility: String!
    postsVisibility: String!
  }

  type NotificationSettings {
    emailNotifications: Boolean!
    pushNotifications: Boolean!
  }

  type FriendRequest {
    from: User!
    sentAt: DateTime!
  }

  type Media {
    url: String!
    type: MediaType!
    thumbnail: String
    width: Int
    height: Int
    duration: Int
  }

  type Reaction {
    user: User!
    type: ReactionType!
    createdAt: DateTime!
  }

  type ReactionSummary {
    type: ReactionType!
    count: Int!
  }

  type Post {
    id: ID!
    author: User!
    content: String!
    media: [Media!]
    reactions: [Reaction!]
    reactionSummary: [ReactionSummary!]
    myReaction: ReactionType
    isSaved: Boolean!
    commentsCount: Int!
    sharesCount: Int!
    comments(limit: Int, offset: Int): [Comment!]
    sharedFrom: Post
    visibility: Visibility!
    tags: [User!]
    location: String
    feeling: String
    isPinned: Boolean!
    isEdited: Boolean!
    viewCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Comment {
    id: ID!
    post: Post!
    author: User!
    content: String!
    media: CommentMedia
    reactions: [Reaction!]
    replies(limit: Int, offset: Int): [Comment!]
    repliesCount: Int!
    parentComment: Comment
    isEdited: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CommentMedia {
    url: String!
    type: String!
  }

  type Notification {
    id: ID!
    recipient: User!
    sender: User!
    type: NotificationType!
    entityId: ID
    entityType: String
    message: String!
    isRead: Boolean!
    createdAt: DateTime!
  }

  type Story {
    id: ID!
    author: User!
    media: StoryMedia
    text: String
    backgroundColor: String
    views: [StoryView!]
    viewsCount: Int!
    reactions: [StoryReaction!]
    expiresAt: DateTime!
    hasViewed: Boolean!
    createdAt: DateTime!
  }

  type StoryMedia {
    url: String!
    type: String!
    duration: Int
    thumbnail: String
  }

  type StoryView {
    user: User!
    viewedAt: DateTime!
  }

  type StoryReaction {
    user: User!
    emoji: String!
    createdAt: DateTime!
  }

  type StoryGroup {
    user: User!
    stories: [Story!]!
    hasUnviewed: Boolean!
  }

  # ─── Watch (video feed / reels) ─────────────────────────────────────────
  type Video {
    id: ID!
    author: User!
    url: String!
    thumbnail: String
    caption: String!
    duration: Int
    width: Int
    height: Int
    visibility: Visibility!
    reactionSummary: [ReactionSummary!]
    myReaction: ReactionType
    reactionsCount: Int!
    comments: [VideoComment!]!
    commentsCount: Int!
    sharesCount: Int!
    viewCount: Int!
    createdAt: DateTime!
  }

  type VideoComment {
    id: ID!
    author: User!
    content: String!
    createdAt: DateTime!
  }

  type VideoConnection {
    videos: [Video!]!
    hasMore: Boolean!
    nextCursor: String
  }

  # ─── Events ──────────────────────────────────────────────────────────────
  type Event {
    id: ID!
    host: User!
    title: String!
    description: String!
    coverImage: String
    location: String!
    startAt: DateTime!
    endAt: DateTime
    visibility: Visibility!
    attendees: [EventAttendee!]!
    attendeesCount: Int!
    goingCount: Int!
    interestedCount: Int!
    myRsvp: RsvpStatus
    createdAt: DateTime!
  }

  type EventAttendee {
    user: User!
    status: RsvpStatus!
    respondedAt: DateTime!
  }

  type EventConnection {
    events: [Event!]!
    hasMore: Boolean!
    nextCursor: String
  }

  # ─── Marketplace ─────────────────────────────────────────────────────────
  type MarketplaceListing {
    id: ID!
    seller: User!
    title: String!
    description: String!
    price: Float!
    category: ListingCategory!
    condition: ListingCondition!
    images: [String!]!
    location: String
    status: ListingStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type MarketplaceConnection {
    listings: [MarketplaceListing!]!
    hasMore: Boolean!
    nextCursor: String
  }

  type Message {
    id: ID!
    conversation: Conversation!
    sender: User!
    content: String!
    media: MessageMedia
    reactions: [MessageReaction!]
    readBy: [MessageRead!]
    isEdited: Boolean!
    isDeleted: Boolean!
    replyTo: Message
    createdAt: DateTime!
  }

  type MessageMedia {
    url: String!
    type: String!
    name: String
    size: Int
  }

  type MessageReaction {
    user: User!
    emoji: String!
  }

  type MessageRead {
    user: User!
    readAt: DateTime!
  }

  type Conversation {
    id: ID!
    participants: [User!]!
    isGroup: Boolean!
    groupName: String
    groupAvatar: String
    lastMessage: Message
    lastMessageAt: DateTime!
    unreadCount: Int!
    isTyping: Boolean!
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type FeedConnection {
    posts: [Post!]!
    hasMore: Boolean!
    nextCursor: String
    total: Int!
  }

  type UserConnection {
    users: [User!]!
    hasMore: Boolean!
    total: Int!
  }

  type OnlineStatus {
    userId: ID!
    isOnline: Boolean!
    lastSeen: DateTime
  }

  type TypingStatus {
    conversationId: ID!
    userId: ID!
    isTyping: Boolean!
  }

  # ─── Queries ──────────────────────────────────────────────────────────────
  type Query {
    # Auth
    me: User

    # Users
    user(id: ID, username: String): User
    searchUsers(query: String!, limit: Int): [User!]!
    suggestedFriends(limit: Int): [User!]!
    # Incoming friend requests for the current user — backs the Friends
    # page's "Requests" tab. Previously the only way to see a friend
    # request at all was the notification dropdown; this exposes the
    # underlying data (already stored on User.friendRequests) directly.
    friendRequests: [FriendRequest!]!
    # Outgoing friend requests the current user has sent but not yet had
    # accepted/declined — backs the "Sent" sub-view, pairs with
    # cancelFriendRequest below.
    sentFriendRequests: [User!]!

    # Feed
    feed(cursor: String, limit: Int): FeedConnection!
    exploreFeed(cursor: String, limit: Int): FeedConnection!

    # Posts
    post(id: ID!): Post
    userPosts(userId: ID!, cursor: String, limit: Int): FeedConnection!
    # Same shape/pagination as userPosts, but only posts that actually have
    # media attached — backs the Profile page's Photos tab (see
    # userPhotos resolver in post.resolvers.ts for why this is a separate
    # query rather than filtering userPosts client-side).
    userPhotos(userId: ID!, cursor: String, limit: Int): FeedConnection!
    # Backs the Saved page — the current user's bookmarked posts, newest
    # bookmark first. Same connection shape as feed/userPosts/userPhotos
    # for a consistent pagination pattern across all post-list views.
    savedPosts(cursor: String, limit: Int): FeedConnection!

    # Comments
    comments(postId: ID!, cursor: String, limit: Int): [Comment!]!

    # Stories
    stories: [StoryGroup!]!
    userStories(userId: ID!): [Story!]!

    # Watch
    watchFeed(cursor: String, limit: Int): VideoConnection!
    video(id: ID!): Video
    userVideos(userId: ID!, cursor: String, limit: Int): VideoConnection!

    # Events
    upcomingEvents(cursor: String, limit: Int): EventConnection!
    event(id: ID!): Event
    userEvents(userId: ID!, cursor: String, limit: Int): EventConnection!

    # Marketplace
    marketplaceListings(category: ListingCategory, cursor: String, limit: Int): MarketplaceConnection!
    marketplaceListing(id: ID!): MarketplaceListing
    userListings(userId: ID!, cursor: String, limit: Int): MarketplaceConnection!

    # Notifications
    notifications(limit: Int, offset: Int): [Notification!]!
    unreadNotificationsCount: Int!

    # Messages
    conversations: [Conversation!]!
    messages(conversationId: ID!, cursor: String, limit: Int): [Message!]!
    conversation(id: ID!): Conversation
    conversationWithUser(userId: ID!): Conversation
  }

  # ─── Mutations ────────────────────────────────────────────────────────────
  type Mutation {
    # Auth
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!

    # Profile
    updateProfile(input: UpdateProfileInput!): User!
    updatePrivacySettings(input: UpdatePrivacySettingsInput!): User!
    updateNotificationSettings(input: UpdateNotificationSettingsInput!): User!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    updateAvatar(url: String!): User!
    updateCoverPhoto(url: String!): User!

    # Friends
    sendFriendRequest(userId: ID!): User!
    acceptFriendRequest(userId: ID!): User!
    declineFriendRequest(userId: ID!): Boolean!
    # Withdraws a request the CURRENT user sent — userId is the recipient.
    # Distinct from declineFriendRequest, which only removes a request from
    # the *caller's own* incoming list (i.e. only the recipient can call
    # that one); there was previously no way for the sender to cancel.
    cancelFriendRequest(userId: ID!): Boolean!
    removeFriend(userId: ID!): Boolean!
    followUser(userId: ID!): User!
    unfollowUser(userId: ID!): User!

    # Posts
    createPost(input: CreatePostInput!): Post!
    updatePost(id: ID!, content: String!): Post!
    deletePost(id: ID!): Boolean!
    reactToPost(postId: ID!, type: ReactionType!): Post!
    removeReaction(postId: ID!): Post!
    sharePost(postId: ID!, content: String): Post!
    pinPost(postId: ID!): Post!
    # Bookmarking — independent of ownership/friendship, backs the Saved
    # page. Idempotent either direction (saving an already-saved post, or
    # unsaving one that isn't saved, both just succeed as a no-op).
    savePost(postId: ID!): Boolean!
    unsavePost(postId: ID!): Boolean!

    # Comments
    createComment(input: CreateCommentInput!): Comment!
    updateComment(id: ID!, content: String!): Comment!
    deleteComment(id: ID!): Boolean!
    reactToComment(commentId: ID!, type: ReactionType!): Comment!

    # Stories
    createStory(input: CreateStoryInput!): Story!
    deleteStory(id: ID!): Boolean!
    viewStory(storyId: ID!): Story!
    reactToStory(storyId: ID!, emoji: String!): Story!

    # Watch
    createVideo(input: CreateVideoInput!): Video!
    deleteVideo(id: ID!): Boolean!
    reactToVideo(videoId: ID!, type: ReactionType!): Video!
    removeVideoReaction(videoId: ID!): Video!
    commentOnVideo(videoId: ID!, content: String!): Video!
    incrementVideoView(videoId: ID!): Boolean!

    # Events
    createEvent(input: CreateEventInput!): Event!
    updateEvent(id: ID!, input: UpdateEventInput!): Event!
    deleteEvent(id: ID!): Boolean!
    rsvpToEvent(eventId: ID!, status: RsvpStatus!): Event!
    cancelRsvp(eventId: ID!): Event!

    # Marketplace
    createListing(input: CreateListingInput!): MarketplaceListing!
    updateListing(id: ID!, input: UpdateListingInput!): MarketplaceListing!
    deleteListing(id: ID!): Boolean!
    markListingSold(id: ID!): MarketplaceListing!
    relistListing(id: ID!): MarketplaceListing!

    # Notifications
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
    deleteNotification(id: ID!): Boolean!

    # Messages
    sendMessage(input: SendMessageInput!): Message!
    editMessage(id: ID!, content: String!): Message!
    deleteMessage(id: ID!): Boolean!
    reactToMessage(messageId: ID!, emoji: String!): Message!
    markConversationRead(conversationId: ID!): Boolean!
    setTyping(conversationId: ID!, isTyping: Boolean!): Boolean!
    createGroupConversation(input: CreateGroupInput!): Conversation!
  }

  # ─── Subscriptions ────────────────────────────────────────────────────────
  type Subscription {
    # Feed
    newPost: Post!
    postUpdated(postId: ID!): Post!

    # Comments
    newComment(postId: ID!): Comment!

    # Messages
    newMessage(conversationId: ID!): Message!
    messageUpdated(conversationId: ID!): Message!
    typingStatus(conversationId: ID!): TypingStatus!

    # Notifications
    newNotification: Notification!

    # Presence
    userOnlineStatus(userId: ID!): OnlineStatus!
    friendsOnlineStatus: [OnlineStatus!]!

    # Stories
    newStory: Story!
  }

  # ─── Inputs ───────────────────────────────────────────────────────────────
  input RegisterInput {
    username: String!
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    birthDate: DateTime
  }

  input UpdateProfileInput {
    firstName: String
    lastName: String
    bio: String
    location: String
    website: String
    birthDate: DateTime
    avatar: String
    coverPhoto: String
  }

  input UpdatePrivacySettingsInput {
    profileVisibility: String
    postsVisibility: String
  }

  input UpdateNotificationSettingsInput {
    emailNotifications: Boolean
    pushNotifications: Boolean
  }

  input CreatePostInput {
    content: String
    media: [MediaInput!]
    visibility: Visibility
    tags: [ID!]
    location: String
    feeling: String
  }

  input MediaInput {
    url: String!
    type: MediaType!
    thumbnail: String
    width: Int
    height: Int
    duration: Int
  }

  input CreateCommentInput {
    postId: ID!
    content: String!
    parentCommentId: ID
    media: CommentMediaInput
  }

  input CommentMediaInput {
    url: String!
    type: String!
  }

  input CreateStoryInput {
    mediaUrl: String
    mediaType: String
    text: String
    backgroundColor: String
    expiresInHours: Int
  }

  input CreateVideoInput {
    url: String!
    thumbnail: String
    caption: String
    duration: Int
    width: Int
    height: Int
    visibility: Visibility
  }

  input CreateEventInput {
    title: String!
    description: String
    coverImage: String
    location: String
    startAt: DateTime!
    endAt: DateTime
    visibility: Visibility
  }

  input UpdateEventInput {
    title: String
    description: String
    coverImage: String
    location: String
    startAt: DateTime
    endAt: DateTime
    visibility: Visibility
  }

  input CreateListingInput {
    title: String!
    description: String!
    price: Float!
    category: ListingCategory!
    condition: ListingCondition!
    images: [String!]!
    location: String
  }

  input UpdateListingInput {
    title: String
    description: String
    price: Float
    category: ListingCategory
    condition: ListingCondition
    images: [String!]
    location: String
  }

  input SendMessageInput {
    conversationId: ID
    recipientId: ID
    content: String
    media: MessageMediaInput
    replyToId: ID
  }

  input MessageMediaInput {
    url: String!
    type: String!
    name: String
    size: Int
  }

  input CreateGroupInput {
    participantIds: [ID!]!
    groupName: String!
    groupAvatar: String
  }
`;
