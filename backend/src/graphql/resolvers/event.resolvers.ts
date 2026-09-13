import { GraphQLError } from 'graphql';
import { Event } from '../../models/Event';
import { Notification } from '../../models/Notification';
import { GraphQLContext, requireAuth, EVENTS } from '../context';
import { validate, CreateEventSchema, UpdateEventSchema } from '../../lib/validation';

// Same base64(ISO date) cursor pattern as post.resolvers.ts / video.resolvers.ts
// — kept identical for a consistent pagination convention across every
// connection type in the app. Events paginate by `startAt` ascending
// (soonest first) rather than `createdAt` descending, since "upcoming
// events" is the natural default view — not "recently created".
function decodeCursor(cursor: string): Date {
  try {
    return new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new GraphQLError('Invalid pagination cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString(), 'utf8').toString('base64url');
}

// Same deleted-author-safe widening-fetch loop as paginateVideos in
// video.resolvers.ts — an event whose host has since been deleted is
// filtered out via populate's `match` + a null-check, and simply fetching
// `safeLimit + 1` and filtering afterward would let a deleted-host event
// silently shrink the valid count below what's actually available further
// out, making `hasMore` report `false` too early. Capped at 5 attempts.
async function paginateEvents(query: any, cursor: string | undefined, safeLimit: number) {
  if (cursor) query.startAt = { ...(query.startAt ?? {}), $gt: decodeCursor(cursor) };

  const needed = safeLimit + 1;
  let fetchSize = needed;
  let valid: any[] = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const events = await Event.find(query)
      .sort({ startAt: 1 })
      .limit(fetchSize)
      .populate({ path: 'host', select: '-password', match: { _id: { $exists: true } } })
      .lean();

    valid = (events as any[]).filter((e: any) => e.host != null);
    const exhausted = events.length < fetchSize;
    if (valid.length >= needed || exhausted) break;
    fetchSize *= 2;
  }

  const hasMore = valid.length > safeLimit;
  const items = hasMore ? valid.slice(0, safeLimit) : valid;
  return {
    events: items,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1].startAt) : null,
  };
}

export const eventResolvers = {
  Query: {
    // Public upcoming events only, same visibility model as watchFeed —
    // this is a broad discovery surface, not a friend-graph blend.
    upcomingEvents: async (_: unknown, { cursor, limit = 10 }: any) => {
      const safeLimit = Math.min(Math.max(1, limit), 30);
      return paginateEvents({ visibility: 'PUBLIC', startAt: { $gte: new Date() } }, cursor, safeLimit);
    },

    event: async (_: unknown, { id }: { id: string }) => {
      const event = await Event.findById(id)
        .populate({ path: 'host', select: '-password', match: { _id: { $exists: true } } })
        .populate({ path: 'attendees.user', select: '-password' })
        .lean();
      if (!event || !(event as any).host) return null;
      return event;
    },

    userEvents: async (_: unknown, { userId, cursor, limit = 12 }: any, { user }: GraphQLContext) => {
      const safeLimit = Math.min(Math.max(1, limit), 30);
      const isOwner = user?._id.toString() === userId;
      const isFriend = user?.friends.some((id: any) => id.toString() === userId);
      const query: any = { host: userId };
      if (!isOwner) query.visibility = isFriend ? { $in: ['PUBLIC', 'FRIENDS'] } : 'PUBLIC';
      return paginateEvents(query, cursor, safeLimit);
    },
  },

  Mutation: {
    createEvent: async (_: unknown, { input }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const data = validate(CreateEventSchema, input);
      const event = new Event({ ...data, host: user._id });
      await event.save();
      await event.populate('host', '-password');
      return event;
    },

    updateEvent: async (_: unknown, { id, input }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const event = await Event.findById(id);
      if (!event) throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
      if (event.host.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      const data = validate(UpdateEventSchema, input);
      Object.assign(event, data);
      await event.save();
      await event.populate('host', '-password');
      await event.populate('attendees.user', '-password');
      return event;
    },

    deleteEvent: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const event = await Event.findById(id);
      if (!event) throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
      if (event.host.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      await event.deleteOne();
      return true;
    },

    rsvpToEvent: async (_: unknown, { eventId, status }: any, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      const rsvpStatus = status.toUpperCase();
      const event = await Event.findById(eventId);
      if (!event) throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });

      // Captured before `.populate('host', ...)` below — once populated,
      // event.host becomes a full User document/object, and calling
      // .toString() on that no longer yields the raw id (same pitfall
      // Video.ts's comments field-resolver comment warns about with
      // Mongoose subdocuments/spreads). Comparing against a populated
      // object here would silently break the self-notification check.
      const hostId = event.host.toString();

      const existingIdx = event.attendees.findIndex((a) => a.user.toString() === user._id.toString());
      if (existingIdx === -1) {
        event.attendees.push({ user: user._id, status: rsvpStatus, respondedAt: new Date() } as any);
      } else {
        event.attendees[existingIdx].status = rsvpStatus;
        event.attendees[existingIdx].respondedAt = new Date();
      }
      await event.save();
      await event.populate('host', '-password');
      await event.populate('attendees.user', '-password');

      // Notify the host on a new/changed RSVP, same as reactToPost notifies
      // the post author — skip self-notification (host RSVPing to their
      // own event). Awaited directly rather than fire-and-forget: see
      // changelog 2026-09-11 (6), where fire-and-forget notification
      // calls on createComment/reactToPost were a real race that got
      // fixed by awaiting instead, matching the pattern
      // acceptFriendRequest/sendFriendRequest already used.
      if (hostId !== user._id.toString()) {
        try {
          const notif = await Notification.create({
            recipient: hostId,
            sender: user._id,
            type: 'EVENT_RSVP',
            entityId: event._id,
            entityType: 'event',
            message: `${user.firstName} ${user.lastName} responded ${rsvpStatus.toLowerCase()} to your event "${event.title}"`,
          });
          pubsub.publish(EVENTS.NEW_NOTIFICATION, { newNotification: notif });
        } catch (err) {
          console.error(err);
        }
      }

      return event;
    },

    cancelRsvp: async (_: unknown, { eventId }: { eventId: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const event = await Event.findByIdAndUpdate(
        eventId,
        { $pull: { attendees: { user: user._id } } },
        { new: true }
      )
        .populate('host', '-password')
        .populate('attendees.user', '-password');
      if (!event) throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
      return event;
    },
  },

  Event: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,
    visibility: (parent: any) => (parent.visibility ?? 'PUBLIC').toUpperCase(),

    attendeesCount: (parent: any) => parent.attendees?.length ?? 0,
    goingCount: (parent: any) => (parent.attendees ?? []).filter((a: any) => a.status === 'GOING').length,
    interestedCount: (parent: any) =>
      (parent.attendees ?? []).filter((a: any) => a.status === 'INTERESTED').length,

    myRsvp: (parent: any, _: unknown, { user }: GraphQLContext) => {
      if (!user) return null;
      // `attendees.user` is a raw ObjectId on upcomingEvents/userEvents
      // list results, but createEvent/updateEvent/rsvpToEvent/cancelRsvp
      // and the single event(id) query all populate it into a full User
      // object — same populated-vs-raw pitfall as the hostId capture in
      // rsvpToEvent above. `.toString()` on a populated object doesn't
      // yield the id, so this must check for an `_id` first.
      const a = parent.attendees?.find((att: any) => {
        const attendeeUserId = att.user?._id ? att.user._id.toString() : att.user.toString();
        return attendeeUserId === user._id.toString();
      });
      return a ? a.status.toUpperCase() : null;
    },

    // `attendees.user` is only populated by the single `event(id)` query
    // and by createEvent/updateEvent/rsvpToEvent/cancelRsvp's own
    // `.populate()` calls above — upcomingEvents/userEvents leave each
    // attendee's user as a raw ObjectId (populating a nested array on
    // every list page would be wasteful when the list view's primary
    // content is title/date/location/counts). Resolve here via the
    // shared userLoader so it's correct regardless of which query
    // returned the event — same pattern as Video.comments/Post.tags.
    attendees: async (parent: any, _: unknown, { loaders }: GraphQLContext) => {
      const list = parent.attendees ?? [];
      if (!list.length) return [];

      const alreadyPopulated = list[0]?.user && typeof list[0].user === 'object' && 'firstName' in list[0].user;
      const users = alreadyPopulated
        ? list.map((a: any) => a.user)
        : await loaders.userLoader.loadMany(list.map((a: any) => a.user.toString()));

      return list.map((a: any, i: number) => ({
        status: a.status,
        respondedAt: a.respondedAt,
        user: users[i],
      }));
    },
  },
};
