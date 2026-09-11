import { Message, Conversation } from '../../models/Message';
import { GraphQLContext, requireAuth, EVENTS } from '../context';
import { GraphQLError } from 'graphql';
import { validate, SendMessageSchema } from '../../lib/validation';

async function assertParticipant(conversationId: string, userId: string) {
  const conv = await Conversation.findById(conversationId).select('participants').lean();
  if (!conv) throw new GraphQLError('Conversation not found', { extensions: { code: 'NOT_FOUND' } });
  const isParticipant = (conv.participants as any[]).some((p: any) => p.toString() === userId);
  if (!isParticipant) throw new GraphQLError('Not a participant', { extensions: { code: 'FORBIDDEN' } });
  return conv;
}

function decodeCursor(cursor: string): Date {
  try {
    return new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new GraphQLError('Invalid cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

export const messageResolvers = {
  Query: {
    conversations: async (_: unknown, __: unknown, { user }: GraphQLContext) => {
      requireAuth(user);
      // Use lean() — Map fields handled in field resolvers below
      const convs = await Conversation.find({ participants: user._id })
        .sort({ lastMessageAt: -1 })
        .populate('participants', '-password')
        .populate({ path: 'lastMessage', populate: { path: 'sender', select: '-password' } })
        .lean();
      return convs;
    },

    messages: async (_: unknown, { conversationId, cursor, limit = 20 }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const safeLimit = Math.min(Math.max(1, limit), 100);

      // Verify participation before returning messages
      await assertParticipant(conversationId, user._id.toString());

      // Fetch both deleted and non-deleted — deleted ones show "This message was deleted"
      const query: any = { conversation: conversationId };
      if (cursor) query.createdAt = { $lt: decodeCursor(cursor) };

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .populate('sender', '-password')
        .populate({ path: 'replyTo', populate: { path: 'sender', select: '-password' } })
        .lean();

      return messages.reverse();
    },

    conversation: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const conv = await Conversation.findOne({ _id: id, participants: user._id })
        .populate('participants', '-password')
        .populate({ path: 'lastMessage', populate: { path: 'sender', select: '-password' } })
        .lean();
      return conv;
    },

    conversationWithUser: async (_: unknown, { userId }: { userId: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      return Conversation.findOne({
        participants: { $all: [user._id, userId], $size: 2 },
        isGroup: false,
      })
        .populate('participants', '-password')
        .populate({ path: 'lastMessage', populate: { path: 'sender', select: '-password' } })
        .lean();
    },
  },

  Mutation: {
    sendMessage: async (_: unknown, { input }: { input: unknown }, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      const data = validate(SendMessageSchema, input);
      const { conversationId, recipientId, content, replyToId } = data as any;

      if (!content?.trim() && !((data as any).media)) {
        throw new GraphQLError('Message cannot be empty', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      let conversation: any;

      if (conversationId) {
        await assertParticipant(conversationId, user._id.toString());
        conversation = await Conversation.findById(conversationId);
      } else {
        // Find or create DM conversation
        conversation = await Conversation.findOne({
          participants: { $all: [user._id, recipientId], $size: 2 },
          isGroup: false,
        });
        if (!conversation) {
          conversation = await Conversation.create({
            participants: [user._id, recipientId],
            isGroup: false,
            lastMessageAt: new Date(),
          });
        }
      }

      const message = await Message.create({
        conversation: conversation._id,
        sender: user._id,
        content: content?.trim() ?? '',
        media: (data as any).media,
        replyTo: replyToId,
      });

      await message.populate('sender', '-password');
      if (replyToId) {
        await message.populate({ path: 'replyTo', populate: { path: 'sender', select: '-password' } });
      }

      // Build per-participant unread increments
      const unreadIncrements: Record<string, number> = {};
      (conversation.participants as any[]).forEach((p: any) => {
        if (p.toString() !== user._id.toString()) {
          unreadIncrements[`unreadCount.${p.toString()}`] = 1;
        }
      });

      await Conversation.findByIdAndUpdate(conversation._id, {
        lastMessage: message._id,
        lastMessageAt: new Date(),
        $inc: unreadIncrements,
      });

      pubsub.publish(`${EVENTS.NEW_MESSAGE}.${conversation._id.toString()}`, {
        newMessage: message.toObject(),
      });

      return message;
    },

    editMessage: async (_: unknown, { id, content }: any, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      if (!content?.trim()) {
        throw new GraphQLError('Content cannot be empty', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const message = await Message.findById(id).populate('sender', '-password');
      if (!message) throw new GraphQLError('Message not found', { extensions: { code: 'NOT_FOUND' } });
      if ((message.sender as any)._id.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }

      message.content = content.trim();
      message.isEdited = true;
      await message.save();

      pubsub.publish(`${EVENTS.MESSAGE_UPDATED}.${message.conversation.toString()}`, {
        messageUpdated: message.toObject(),
      });

      return message;
    },

    deleteMessage: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const message = await Message.findById(id);
      if (!message) throw new GraphQLError('Message not found', { extensions: { code: 'NOT_FOUND' } });
      if (message.sender.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }

      // Soft delete — keep the record, blank the content
      message.isDeleted = true;
      message.content = '';
      await message.save();
      return true;
    },

    reactToMessage: async (_: unknown, { messageId, emoji }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      if (!emoji?.trim()) throw new GraphQLError('Emoji required');

      const message = await Message.findById(messageId);
      if (!message) throw new GraphQLError('Message not found', { extensions: { code: 'NOT_FOUND' } });

      const existingIdx = message.reactions.findIndex(
        (r: any) => r.user.toString() === user._id.toString()
      );
      if (existingIdx > -1) {
        message.reactions[existingIdx].emoji = emoji;
      } else {
        message.reactions.push({ user: user._id, emoji });
      }
      await message.save();
      await message.populate('sender', '-password');
      return message;
    },

    markConversationRead: async (_: unknown, { conversationId }: { conversationId: string }, { user }: GraphQLContext) => {
      requireAuth(user);

      // Verify participation before marking read
      await assertParticipant(conversationId, user._id.toString());

      await Promise.all([
        Conversation.findByIdAndUpdate(conversationId, {
          $set: { [`unreadCount.${user._id.toString()}`]: 0 },
        }),
        Message.updateMany(
          {
            conversation: conversationId,
            isDeleted: false,
            'readBy.user': { $ne: user._id },
          },
          { $push: { readBy: { user: user._id, readAt: new Date() } } }
        ),
      ]);
      return true;
    },

    setTyping: async (_: unknown, { conversationId, isTyping }: any, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      pubsub.publish(`${EVENTS.TYPING_STATUS}.${conversationId}`, {
        typingStatus: { conversationId, userId: user._id.toString(), isTyping },
      });
      return true;
    },

    createGroupConversation: async (_: unknown, { input }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const { participantIds, groupName, groupAvatar } = input;

      if (!groupName?.trim()) {
        throw new GraphQLError('Group name is required', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if (!participantIds?.length || participantIds.length < 2) {
        throw new GraphQLError('Group needs at least 2 other participants', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const uniqueIds = [...new Set([user._id.toString(), ...participantIds])];
      const conversation = await Conversation.create({
        participants: uniqueIds,
        isGroup: true,
        groupName: groupName.trim(),
        groupAvatar,
        groupAdmin: user._id,
        lastMessageAt: new Date(),
      });
      await conversation.populate('participants', '-password');
      return conversation;
    },
  },

  Conversation: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,

    // lean() turns Maps into plain objects; use bracket access, not .get()
    unreadCount: (parent: any, _: unknown, { user }: GraphQLContext) => {
      if (!user) return 0;
      const counts = parent.unreadCount;
      if (!counts) return 0;
      // Support both Map and plain object (lean vs non-lean)
      if (typeof counts.get === 'function') return counts.get(user._id.toString()) ?? 0;
      return counts[user._id.toString()] ?? 0;
    },

    isTyping: (parent: any, _: unknown, { user }: GraphQLContext) => {
      if (!user) return false;
      const typing = parent.isTyping;
      if (!typing) return false;
      if (typeof typing.get === 'function') return typing.get(user._id.toString()) ?? false;
      return typing[user._id.toString()] ?? false;
    },

    // Same bug class as User.friends / Post.tags / Message.conversation
    // (see the comment on that resolver below): every query resolver in
    // this file that returns a Conversation does `.populate('participants',
    // ...)` by hand, EXCEPT the one path that was already fixed to stop
    // relying on that discipline — Message.conversation's fallback fetch
    // (`Conversation.findById(parent.conversation).lean()`, no populate).
    // A client asking for `sendMessage { conversation { participants {
    // id } } }` hit exactly that gap: raw ObjectIds reaching the
    // non-nullable `[User!]!` field, which then fails resolving `User.id`
    // etc. on a bare ObjectId. Resolving it here, the same "lazy-load
    // whichever shape shows up" way as tags/friends, closes the gap
    // regardless of which resolver produced the parent Conversation.
    participants: async (parent: any, _: unknown, { loaders }: GraphQLContext) => {
      if (!parent.participants?.length) return [];
      if (typeof parent.participants[0] === 'object' && parent.participants[0]?.firstName) {
        return parent.participants; // already populated
      }
      const users = await loaders.userLoader.loadMany(
        parent.participants.map((id: any) => id.toString())
      );
      return users.filter((u: any) => u && !(u instanceof Error));
    },

    // Same gap, same fix, for the one nullable ref on this path.
    lastMessage: async (parent: any) => {
      if (!parent.lastMessage) return null;
      if (typeof parent.lastMessage === 'object' && 'content' in parent.lastMessage) {
        return parent.lastMessage; // already populated
      }
      return Message.findById(parent.lastMessage).populate('sender', '-password').lean();
    },
  },

  Message: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,
    // Redact content of deleted messages at resolver level
    content: (parent: any) => (parent.isDeleted ? '' : parent.content),

    // Defensive guard against exactly the bug fixed in models/Message.ts:
    // any message created before that fix has `media` stored in the
    // database as `{ url: undefined, type: undefined, ... }` instead of
    // truly absent, which throws "Cannot return null for non-nullable
    // field MessageMedia.url" the moment it's queried. Treat a media
    // object with no url as "no media" rather than letting it reach the
    // MessageMedia.url: String! field and blow up the whole response —
    // this is what's needed for pre-existing messages to stop erroring
    // without a database migration.
    media: (parent: any) => (parent.media?.url ? parent.media : null),

    // `Message.conversation` is populated by the query resolvers above
    // when they need it, but `sendMessage`'s return value never populated
    // it. The frontend needs it to learn the new conversation's id right
    // after starting a brand-new DM (see Profile.tsx's "Message" button /
    // ChatWindow's pending-recipient mode) — resolve it lazily here rather
    // than everywhere a Message might be returned, same "don't rely on
    // every query author remembering to .populate()" fix as User.friends
    // and Post.tags.
    conversation: async (parent: any) => {
      if (parent.conversation && typeof parent.conversation === 'object' && parent.conversation.participants) {
        return parent.conversation; // already populated
      }
      return Conversation.findById(parent.conversation).lean();
    },
  },
};
