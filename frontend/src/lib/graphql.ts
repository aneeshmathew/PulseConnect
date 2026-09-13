import { gql } from '@apollo/client';

export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    username
    firstName
    lastName
    fullName
    avatar
    isOnline
    isVerified
    isFriend
    friendsCount
  }
`;

export const POST_FIELDS = gql`
  fragment PostFields on Post {
    id
    content
    media { url type thumbnail width height duration }
    reactionSummary { type count }
    myReaction
    isSaved
    commentsCount
    sharesCount
    visibility
    location
    feeling
    isPinned
    isEdited
    viewCount
    createdAt
    author { ...UserFields }
  }
  ${USER_FIELDS}
`;

export const COMMENT_FIELDS = gql`
  fragment CommentFields on Comment {
    id
    content
    isEdited
    createdAt
    repliesCount
    author { ...UserFields }
    reactions { user { id } type }
    media { url type }
  }
  ${USER_FIELDS}
`;

export const MESSAGE_FIELDS = gql`
  fragment MessageFields on Message {
    id
    content
    isEdited
    isDeleted
    createdAt
    sender { ...UserFields }
    media { url type name size }
    reactions { user { id } emoji }
    readBy { user { id } readAt }
    replyTo {
      id
      content
      sender { ...UserFields }
    }
  }
  ${USER_FIELDS}
`;

// ── Queries ──────────────────────────────────────────────────────────────────

export const GET_ME = gql`
  query GetMe {
    me { ...UserFields bio location website birthDate email friendsCount postsCount createdAt coverPhoto }
  }
  ${USER_FIELDS}
`;

export const GET_MY_SETTINGS = gql`
  query GetMySettings {
    me {
      id
      privacySettings { profileVisibility postsVisibility }
      notificationSettings { emailNotifications pushNotifications }
    }
  }
`;

export const UPDATE_PRIVACY_SETTINGS = gql`
  mutation UpdatePrivacySettings($input: UpdatePrivacySettingsInput!) {
    updatePrivacySettings(input: $input) {
      id
      privacySettings { profileVisibility postsVisibility }
    }
  }
`;

export const UPDATE_NOTIFICATION_SETTINGS = gql`
  mutation UpdateNotificationSettings($input: UpdateNotificationSettingsInput!) {
    updateNotificationSettings(input: $input) {
      id
      notificationSettings { emailNotifications pushNotifications }
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

export const GET_FEED = gql`
  query GetFeed($cursor: String, $limit: Int) {
    feed(cursor: $cursor, limit: $limit) {
      posts { ...PostFields }
      hasMore
      nextCursor
      total
    }
  }
  ${POST_FIELDS}
`;

export const GET_POST = gql`
  query GetPost($id: ID!) {
    post(id: $id) {
      ...PostFields
      sharedFrom { ...PostFields }
      tags { ...UserFields }
    }
  }
  ${POST_FIELDS}
`;

// PostFields (used by GetFeed/GetUserPosts/GetSavedPosts — everywhere a post
// is fetched except this specific page) only carries `commentsCount`, not
// the actual comment list — fetching full comment threads for every post in
// a paginated feed just to show a count would be wasteful. CommentSection
// fetches this itself, on demand, since it's only mounted in the first
// place once someone actually expands a given post's comments (see
// PostCard.tsx's `showComments` toggle) — this was previously missing
// entirely, which is why opening comments on any post reached from the main
// feed (as opposed to a standalone post-detail view) showed nothing, and a
// freshly-posted comment never appeared anywhere.
export const GET_POST_COMMENTS = gql`
  query GetPostComments($postId: ID!, $limit: Int) {
    comments(postId: $postId, limit: $limit) {
      ...CommentFields
      replies(limit: 5) { ...CommentFields }
    }
  }
  ${COMMENT_FIELDS}
`;

export const GET_USER = gql`
  query GetUser($id: ID, $username: String) {
    user(id: $id, username: $username) {
      ...UserFields
      bio location website birthDate email coverPhoto
      friends { ...UserFields }
      hasFriendRequest
    }
  }
  ${USER_FIELDS}
`;

export const GET_USER_POSTS = gql`
  query GetUserPosts($userId: ID!, $cursor: String, $limit: Int) {
    userPosts(userId: $userId, cursor: $cursor, limit: $limit) {
      posts { ...PostFields }
      hasMore
      nextCursor
    }
  }
  ${POST_FIELDS}
`;

// Backs the Profile page's Photos tab — only requests the fields the photo
// grid actually needs (not the full PostFields fragment) since we're
// flattening many posts' media into thumbnails, not rendering full post cards.
export const GET_USER_PHOTOS = gql`
  query GetUserPhotos($userId: ID!, $cursor: String, $limit: Int) {
    userPhotos(userId: $userId, cursor: $cursor, limit: $limit) {
      posts {
        id
        createdAt
        media { url type thumbnail }
      }
      hasMore
      nextCursor
    }
  }
`;

export const GET_SAVED_POSTS = gql`
  query GetSavedPosts($cursor: String, $limit: Int) {
    savedPosts(cursor: $cursor, limit: $limit) {
      posts { ...PostFields }
      hasMore
      nextCursor
    }
  }
  ${POST_FIELDS}
`;

export const SAVE_POST = gql`
  mutation SavePost($postId: ID!) {
    savePost(postId: $postId)
  }
`;

export const UNSAVE_POST = gql`
  mutation UnsavePost($postId: ID!) {
    unsavePost(postId: $postId)
  }
`;

export const SEARCH_USERS = gql`
  query SearchUsers($query: String!) {
    searchUsers(query: $query) { ...UserFields }
  }
  ${USER_FIELDS}
`;

export const GET_SUGGESTED_FRIENDS = gql`
  query GetSuggestedFriends {
    suggestedFriends(limit: 8) { ...UserFields bio location }
  }
  ${USER_FIELDS}
`;

export const GET_FRIEND_REQUESTS = gql`
  query GetFriendRequests {
    friendRequests {
      sentAt
      from { ...UserFields bio location }
    }
  }
  ${USER_FIELDS}
`;

export const GET_SENT_FRIEND_REQUESTS = gql`
  query GetSentFriendRequests {
    sentFriendRequests { ...UserFields }
  }
  ${USER_FIELDS}
`;

export const CANCEL_FRIEND_REQUEST = gql`
  mutation CancelFriendRequest($userId: ID!) {
    cancelFriendRequest(userId: $userId)
  }
`;

export const REMOVE_FRIEND = gql`
  mutation RemoveFriend($userId: ID!) {
    removeFriend(userId: $userId)
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($limit: Int, $offset: Int) {
    notifications(limit: $limit, offset: $offset) {
      id type message isRead entityId entityType createdAt
      sender { ...UserFields }
    }
    unreadNotificationsCount
  }
  ${USER_FIELDS}
`;

export const GET_CONVERSATIONS = gql`
  query GetConversations {
    conversations {
      id isGroup groupName groupAvatar lastMessageAt unreadCount isTyping
      participants { ...UserFields }
      lastMessage { id content createdAt isDeleted sender { id firstName } }
    }
  }
  ${USER_FIELDS}
`;

export const GET_MESSAGES = gql`
  query GetMessages($conversationId: ID!, $cursor: String, $limit: Int) {
    messages(conversationId: $conversationId, cursor: $cursor, limit: $limit) {
      ...MessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const GET_STORIES = gql`
  query GetStories {
    stories {
      user { ...UserFields }
      hasUnviewed
      stories {
        id text backgroundColor viewsCount hasViewed expiresAt createdAt
        media { url type duration thumbnail }
        reactions { user { id } emoji }
      }
    }
  }
  ${USER_FIELDS}
`;

export const CREATE_STORY = gql`
  mutation CreateStory($input: CreateStoryInput!) {
    createStory(input: $input) { id }
  }
`;

// ── Watch (video feed / reels) ──────────────────────────────────────────────

export const VIDEO_FIELDS = gql`
  fragment VideoFields on Video {
    id
    url
    thumbnail
    caption
    duration
    width
    height
    visibility
    reactionSummary { type count }
    myReaction
    reactionsCount
    commentsCount
    comments { id content createdAt author { ...UserFields } }
    sharesCount
    viewCount
    createdAt
    author { ...UserFields }
  }
  ${USER_FIELDS}
`;

export const GET_WATCH_FEED = gql`
  query GetWatchFeed($cursor: String, $limit: Int) {
    watchFeed(cursor: $cursor, limit: $limit) {
      videos { ...VideoFields }
      hasMore
      nextCursor
    }
  }
  ${VIDEO_FIELDS}
`;

export const GET_VIDEO = gql`
  query GetVideo($id: ID!) {
    video(id: $id) { ...VideoFields }
  }
  ${VIDEO_FIELDS}
`;

export const CREATE_VIDEO = gql`
  mutation CreateVideo($input: CreateVideoInput!) {
    createVideo(input: $input) { ...VideoFields }
  }
  ${VIDEO_FIELDS}
`;

export const DELETE_VIDEO = gql`
  mutation DeleteVideo($id: ID!) {
    deleteVideo(id: $id)
  }
`;

export const REACT_TO_VIDEO = gql`
  mutation ReactToVideo($videoId: ID!, $type: ReactionType!) {
    reactToVideo(videoId: $videoId, type: $type) { ...VideoFields }
  }
  ${VIDEO_FIELDS}
`;

export const REMOVE_VIDEO_REACTION = gql`
  mutation RemoveVideoReaction($videoId: ID!) {
    removeVideoReaction(videoId: $videoId) { ...VideoFields }
  }
  ${VIDEO_FIELDS}
`;

export const COMMENT_ON_VIDEO = gql`
  mutation CommentOnVideo($videoId: ID!, $content: String!) {
    commentOnVideo(videoId: $videoId, content: $content) { ...VideoFields }
  }
  ${VIDEO_FIELDS}
`;

export const INCREMENT_VIDEO_VIEW = gql`
  mutation IncrementVideoView($videoId: ID!) {
    incrementVideoView(videoId: $videoId)
  }
`;

// ── Events ───────────────────────────────────────────────────────────────────

export const EVENT_FIELDS = gql`
  fragment EventFields on Event {
    id
    title
    description
    coverImage
    location
    startAt
    endAt
    visibility
    attendeesCount
    goingCount
    interestedCount
    myRsvp
    createdAt
    host { ...UserFields }
    attendees { status respondedAt user { ...UserFields } }
  }
  ${USER_FIELDS}
`;

export const GET_UPCOMING_EVENTS = gql`
  query GetUpcomingEvents($cursor: String, $limit: Int) {
    upcomingEvents(cursor: $cursor, limit: $limit) {
      events { ...EventFields }
      hasMore
      nextCursor
    }
  }
  ${EVENT_FIELDS}
`;

export const GET_EVENT = gql`
  query GetEvent($id: ID!) {
    event(id: $id) { ...EventFields }
  }
  ${EVENT_FIELDS}
`;

export const GET_USER_EVENTS = gql`
  query GetUserEvents($userId: ID!, $cursor: String, $limit: Int) {
    userEvents(userId: $userId, cursor: $cursor, limit: $limit) {
      events { ...EventFields }
      hasMore
      nextCursor
    }
  }
  ${EVENT_FIELDS}
`;

export const CREATE_EVENT = gql`
  mutation CreateEvent($input: CreateEventInput!) {
    createEvent(input: $input) { ...EventFields }
  }
  ${EVENT_FIELDS}
`;

export const UPDATE_EVENT = gql`
  mutation UpdateEvent($id: ID!, $input: UpdateEventInput!) {
    updateEvent(id: $id, input: $input) { ...EventFields }
  }
  ${EVENT_FIELDS}
`;

export const DELETE_EVENT = gql`
  mutation DeleteEvent($id: ID!) {
    deleteEvent(id: $id)
  }
`;

export const RSVP_TO_EVENT = gql`
  mutation RsvpToEvent($eventId: ID!, $status: RsvpStatus!) {
    rsvpToEvent(eventId: $eventId, status: $status) { ...EventFields }
  }
  ${EVENT_FIELDS}
`;

export const CANCEL_RSVP = gql`
  mutation CancelRsvp($eventId: ID!) {
    cancelRsvp(eventId: $eventId) { ...EventFields }
  }
  ${EVENT_FIELDS}
`;

// ── Mutations ─────────────────────────────────────────────────────────────────

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user { ...UserFields email }
    }
  }
  ${USER_FIELDS}
`;

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user { ...UserFields email }
    }
  }
  ${USER_FIELDS}
`;

export const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) { ...PostFields }
  }
  ${POST_FIELDS}
`;

export const REACT_TO_POST = gql`
  mutation ReactToPost($postId: ID!, $type: ReactionType!) {
    reactToPost(postId: $postId, type: $type) {
      id reactionSummary { type count } myReaction
    }
  }
`;

export const REMOVE_REACTION = gql`
  mutation RemoveReaction($postId: ID!) {
    removeReaction(postId: $postId) {
      id reactionSummary { type count } myReaction
    }
  }
`;

export const CREATE_COMMENT = gql`
  mutation CreateComment($input: CreateCommentInput!) {
    createComment(input: $input) { ...CommentFields }
  }
  ${COMMENT_FIELDS}
`;

export const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;

export const UPDATE_POST = gql`
  mutation UpdatePost($id: ID!, $content: String!) {
    updatePost(id: $id, content: $content) { ...PostFields }
  }
  ${POST_FIELDS}
`;

export const SEND_FRIEND_REQUEST = gql`
  mutation SendFriendRequest($userId: ID!) {
    sendFriendRequest(userId: $userId) { id isFriend hasFriendRequest }
  }
`;

export const ACCEPT_FRIEND_REQUEST = gql`
  mutation AcceptFriendRequest($userId: ID!) {
    acceptFriendRequest(userId: $userId) { id isFriend }
  }
`;

export const DECLINE_FRIEND_REQUEST = gql`
  mutation DeclineFriendRequest($userId: ID!) {
    declineFriendRequest(userId: $userId)
  }
`;

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($id: ID!) {
    deleteNotification(id: $id)
  }
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      ...MessageFields
      conversation { id }
    }
  }
  ${MESSAGE_FIELDS}
`;

// Used when opening a chat from somewhere that only knows the *person*
// (e.g. a profile page), not an existing conversation — lets us check
// whether one already exists before falling back to "start a new one on
// first send" (see ChatWindow's pending-recipient mode).
export const CONVERSATION_WITH_USER = gql`
  query ConversationWithUser($userId: ID!) {
    conversationWithUser(userId: $userId) {
      id
    }
  }
`;

export const SET_TYPING = gql`
  mutation SetTyping($conversationId: ID!, $isTyping: Boolean!) {
    setTyping(conversationId: $conversationId, isTyping: $isTyping)
  }
`;

export const MARK_CONVERSATION_READ = gql`
  mutation MarkConversationRead($conversationId: ID!) {
    markConversationRead(conversationId: $conversationId)
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) { id isRead }
  }
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) { ...UserFields bio location website coverPhoto }
  }
  ${USER_FIELDS}
`;

// ── Subscriptions ────────────────────────────────────────────────────────────

export const NEW_POST_SUB = gql`
  subscription NewPost {
    newPost { ...PostFields }
  }
  ${POST_FIELDS}
`;

export const NEW_MESSAGE_SUB = gql`
  subscription NewMessage($conversationId: ID!) {
    newMessage(conversationId: $conversationId) { ...MessageFields }
  }
  ${MESSAGE_FIELDS}
`;

export const TYPING_STATUS_SUB = gql`
  subscription TypingStatus($conversationId: ID!) {
    typingStatus(conversationId: $conversationId) {
      conversationId userId isTyping
    }
  }
`;

export const NEW_NOTIFICATION_SUB = gql`
  subscription NewNotification {
    newNotification {
      id type message isRead entityId entityType createdAt
      sender { ...UserFields }
    }
  }
  ${USER_FIELDS}
`;

export const USER_ONLINE_STATUS_SUB = gql`
  subscription UserOnlineStatus($userId: ID!) {
    userOnlineStatus(userId: $userId) {
      userId isOnline lastSeen
    }
  }
`;
