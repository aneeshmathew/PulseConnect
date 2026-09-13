import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, asContextUser } from '../helpers/factories';
import { Event } from '../../src/models/Event';
import { Notification } from '../../src/models/Notification';
import { User } from '../../src/models/User';

function futureDate(daysFromNow = 5): Date {
  return new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
}

function createEventDoc(host: any, overrides: Record<string, any> = {}) {
  return Event.create({
    host: host._id,
    title: overrides.title ?? 'A test event',
    location: overrides.location ?? 'Somewhere',
    startAt: overrides.startAt ?? futureDate(),
    ...overrides,
  });
}

const CREATE_EVENT = /* GraphQL */ `
  mutation CreateEvent($input: CreateEventInput!) {
    createEvent(input: $input) {
      id
      title
      visibility
      startAt
      host {
        username
      }
    }
  }
`;

describe('createEvent', () => {
  it('creates an event defaulting to PUBLIC visibility', async () => {
    const host = await createUser({ username: 'event_host' });
    const viewer = await asContextUser(host);

    const result = await graphql({
      schema,
      source: CREATE_EVENT,
      contextValue: contextFor(viewer as any),
      variableValues: {
        input: { title: 'Weekend Hike', startAt: futureDate(3).toISOString() },
      },
    });

    expect(result.errors).toBeUndefined();
    const event = result.data?.createEvent as any;
    expect(event.visibility).toBe('PUBLIC');
    expect(event.title).toBe('Weekend Hike');
    expect(event.host.username).toBe('event_host');
  });

  it('rejects a missing title', async () => {
    const host = await createUser({ username: 'event_host2' });
    const viewer = await asContextUser(host);

    const result = await graphql({
      schema,
      source: CREATE_EVENT,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { title: '', startAt: futureDate().toISOString() } },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('rejects an endAt earlier than startAt', async () => {
    const host = await createUser({ username: 'event_host3' });
    const viewer = await asContextUser(host);
    const start = futureDate(5);
    const end = futureDate(2); // before start

    const result = await graphql({
      schema,
      source: CREATE_EVENT,
      contextValue: contextFor(viewer as any),
      variableValues: {
        input: { title: 'Bad range', startAt: start.toISOString(), endAt: end.toISOString() },
      },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('requires authentication', async () => {
    const result = await graphql({
      schema,
      source: CREATE_EVENT,
      contextValue: contextFor(null),
      variableValues: { input: { title: 'Anon event', startAt: futureDate().toISOString() } },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});

const UPCOMING_EVENTS = /* GraphQL */ `
  query UpcomingEvents($cursor: String, $limit: Int) {
    upcomingEvents(cursor: $cursor, limit: $limit) {
      events {
        id
        title
      }
      hasMore
      nextCursor
    }
  }
`;

describe('upcomingEvents', () => {
  it('only returns PUBLIC events that start in the future, never FRIENDS/PRIVATE or past ones', async () => {
    const host = await createUser({ username: 'upcoming_host' });
    await createEventDoc(host, { title: 'public future', visibility: 'PUBLIC', startAt: futureDate(2) });
    await createEventDoc(host, { title: 'friends future', visibility: 'FRIENDS', startAt: futureDate(2) });
    await createEventDoc(host, { title: 'private future', visibility: 'PRIVATE', startAt: futureDate(2) });
    // A past PUBLIC event must not show up in "upcoming" either.
    await createEventDoc(host, {
      title: 'public past',
      visibility: 'PUBLIC',
      startAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    });

    const result = await graphql({ schema, source: UPCOMING_EVENTS, contextValue: contextFor(null) });

    expect(result.errors).toBeUndefined();
    const events = (result.data?.upcomingEvents as any).events;
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('public future');
  });

  it('paginates soonest-first with hasMore/nextCursor and excludes an event whose host was deleted', async () => {
    // Same widening-fetch safety net as Watch's watchFeed (see
    // video.resolvers.ts / video.test.ts) — a deleted-host event landing
    // in the raw fetch window must not cause a valid event further out to
    // be silently dropped.
    const host = await createUser({ username: 'page_host' });
    const ghost = await createUser({ username: 'page_ghost' });
    for (let i = 0; i < 3; i++) {
      await createEventDoc(host, { title: `event ${i}`, startAt: futureDate(1 + i) });
    }
    await createEventDoc(ghost, { title: 'orphaned event', startAt: futureDate(0.5) });
    await User.findByIdAndDelete(ghost._id);

    const result = await graphql({
      schema,
      source: UPCOMING_EVENTS,
      contextValue: contextFor(null),
      variableValues: { limit: 2 },
    });

    expect(result.errors).toBeUndefined();
    const page = result.data?.upcomingEvents as any;
    expect(page.events).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTruthy();
    // Soonest-first ordering: event 0 (1 day out) then event 1 (2 days out).
    expect(page.events.map((e: any) => e.title)).toEqual(['event 0', 'event 1']);

    const nextPage = await graphql({
      schema,
      source: UPCOMING_EVENTS,
      contextValue: contextFor(null),
      variableValues: { limit: 2, cursor: page.nextCursor },
    });
    expect(nextPage.errors).toBeUndefined();
    const secondPageEvents = (nextPage.data?.upcomingEvents as any).events;
    expect(secondPageEvents.map((e: any) => e.title)).toEqual(['event 2']);
    expect((nextPage.data?.upcomingEvents as any).hasMore).toBe(false);
  });
});

const RSVP_TO_EVENT = /* GraphQL */ `
  mutation Rsvp($eventId: ID!, $status: RsvpStatus!) {
    rsvpToEvent(eventId: $eventId, status: $status) {
      myRsvp
      goingCount
      interestedCount
      attendeesCount
    }
  }
`;

const CANCEL_RSVP = /* GraphQL */ `
  mutation Cancel($eventId: ID!) {
    cancelRsvp(eventId: $eventId) {
      myRsvp
      attendeesCount
    }
  }
`;

describe('event RSVPs', () => {
  it('adds then changes an RSVP in place, then cancels it', async () => {
    const host = await createUser({ username: 'rsvp_host' });
    const attendee = await createUser({ username: 'rsvp_attendee' });
    const event = await createEventDoc(host);
    const viewer = await asContextUser(attendee);

    const first = await graphql({
      schema,
      source: RSVP_TO_EVENT,
      contextValue: contextFor(viewer as any),
      variableValues: { eventId: event._id.toString(), status: 'INTERESTED' },
    });
    expect(first.errors).toBeUndefined();
    expect((first.data?.rsvpToEvent as any).myRsvp).toBe('INTERESTED');
    expect((first.data?.rsvpToEvent as any).interestedCount).toBe(1);
    expect((first.data?.rsvpToEvent as any).goingCount).toBe(0);

    const changed = await graphql({
      schema,
      source: RSVP_TO_EVENT,
      contextValue: contextFor(viewer as any),
      variableValues: { eventId: event._id.toString(), status: 'GOING' },
    });
    expect(changed.errors).toBeUndefined();
    expect((changed.data?.rsvpToEvent as any).myRsvp).toBe('GOING');
    expect((changed.data?.rsvpToEvent as any).goingCount).toBe(1);
    expect((changed.data?.rsvpToEvent as any).interestedCount).toBe(0);
    expect((changed.data?.rsvpToEvent as any).attendeesCount).toBe(1); // still one attendee, not two

    const cancelled = await graphql({
      schema,
      source: CANCEL_RSVP,
      contextValue: contextFor(viewer as any),
      variableValues: { eventId: event._id.toString() },
    });
    expect(cancelled.errors).toBeUndefined();
    expect((cancelled.data?.cancelRsvp as any).myRsvp).toBeNull();
    expect((cancelled.data?.cancelRsvp as any).attendeesCount).toBe(0);
  });

  it('notifies the host on a new RSVP, but never self-notifies when the host RSVPs to their own event', async () => {
    const host = await createUser({ username: 'notif_host' });
    const attendee = await createUser({ username: 'notif_attendee' });
    const event = await createEventDoc(host, { title: 'Notify Me' });

    await graphql({
      schema,
      source: RSVP_TO_EVENT,
      contextValue: contextFor((await asContextUser(attendee)) as any),
      variableValues: { eventId: event._id.toString(), status: 'GOING' },
    });

    const hostNotifs = await Notification.find({ recipient: host._id });
    expect(hostNotifs).toHaveLength(1);
    expect(hostNotifs[0].type).toBe('EVENT_RSVP');
    expect(hostNotifs[0].sender.toString()).toBe(attendee._id.toString());
    expect(hostNotifs[0].entityType).toBe('event');

    // The host RSVPing to their own event must not notify themselves —
    // this is the exact check that would silently break if `hostId` were
    // read from a populated `event.host` object instead of the raw id
    // captured before populate() (see event.resolvers.ts rsvpToEvent).
    await graphql({
      schema,
      source: RSVP_TO_EVENT,
      contextValue: contextFor((await asContextUser(host)) as any),
      variableValues: { eventId: event._id.toString(), status: 'GOING' },
    });
    const stillOneNotif = await Notification.find({ recipient: host._id });
    expect(stillOneNotif).toHaveLength(1);
  });
});

const UPDATE_EVENT = /* GraphQL */ `
  mutation UpdateEvent($id: ID!, $input: UpdateEventInput!) {
    updateEvent(id: $id, input: $input) {
      title
      location
    }
  }
`;

const DELETE_EVENT = /* GraphQL */ `
  mutation DeleteEvent($id: ID!) {
    deleteEvent(id: $id)
  }
`;

describe('updateEvent / deleteEvent — ownership', () => {
  it('rejects updating an event that belongs to a different user', async () => {
    const owner = await createUser({ username: 'upd_owner' });
    const attacker = await createUser({ username: 'upd_attacker' });
    const event = await createEventDoc(owner, { title: 'Original' });

    const result = await graphql({
      schema,
      source: UPDATE_EVENT,
      contextValue: contextFor((await asContextUser(attacker)) as any),
      variableValues: { id: event._id.toString(), input: { title: 'Hijacked' } },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    expect((await Event.findById(event._id))?.title).toBe('Original');
  });

  it('allows the owner to update their own event', async () => {
    const owner = await createUser({ username: 'upd_owner2' });
    const event = await createEventDoc(owner, { title: 'Original', location: 'Old place' });

    const result = await graphql({
      schema,
      source: UPDATE_EVENT,
      contextValue: contextFor((await asContextUser(owner)) as any),
      variableValues: { id: event._id.toString(), input: { title: 'Updated', location: 'New place' } },
    });

    expect(result.errors).toBeUndefined();
    expect((result.data?.updateEvent as any).title).toBe('Updated');
    expect((result.data?.updateEvent as any).location).toBe('New place');
  });

  it('rejects deleting an event that belongs to a different user', async () => {
    const owner = await createUser({ username: 'del_owner' });
    const attacker = await createUser({ username: 'del_attacker' });
    const event = await createEventDoc(owner);

    const result = await graphql({
      schema,
      source: DELETE_EVENT,
      contextValue: contextFor((await asContextUser(attacker)) as any),
      variableValues: { id: event._id.toString() },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    expect(await Event.findById(event._id)).not.toBeNull();
  });

  it('allows the owner to delete their own event', async () => {
    const owner = await createUser({ username: 'del_owner2' });
    const event = await createEventDoc(owner);

    const result = await graphql({
      schema,
      source: DELETE_EVENT,
      contextValue: contextFor((await asContextUser(owner)) as any),
      variableValues: { id: event._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.deleteEvent).toBe(true);
    expect(await Event.findById(event._id)).toBeNull();
  });
});

describe('userEvents — visibility scoping', () => {
  const USER_EVENTS = /* GraphQL */ `
    query UserEvents($userId: ID!) {
      userEvents(userId: $userId) {
        events {
          title
        }
      }
    }
  `;

  it('shows a friend PUBLIC + FRIENDS events but not PRIVATE ones', async () => {
    const host = await createUser({ username: 'vis_host' });
    const friend = await createUser({ username: 'vis_friend' });
    const stranger = await createUser({ username: 'vis_stranger' });
    // Friendship is symmetric — resolver checks the viewer's own friends
    // list, so both sides need the link, same as userVideos's test.
    await User.findByIdAndUpdate(host._id, { $addToSet: { friends: friend._id } });
    await User.findByIdAndUpdate(friend._id, { $addToSet: { friends: host._id } });

    await createEventDoc(host, { title: 'public', visibility: 'PUBLIC' });
    await createEventDoc(host, { title: 'friends', visibility: 'FRIENDS' });
    await createEventDoc(host, { title: 'private', visibility: 'PRIVATE' });

    const asFriend = await graphql({
      schema,
      source: USER_EVENTS,
      contextValue: contextFor((await asContextUser(friend)) as any),
      variableValues: { userId: host._id.toString() },
    });
    expect(asFriend.errors).toBeUndefined();
    const friendTitles = (asFriend.data?.userEvents as any).events.map((e: any) => e.title).sort();
    expect(friendTitles).toEqual(['friends', 'public']);

    const asStranger = await graphql({
      schema,
      source: USER_EVENTS,
      contextValue: contextFor((await asContextUser(stranger)) as any),
      variableValues: { userId: host._id.toString() },
    });
    expect(asStranger.errors).toBeUndefined();
    const strangerTitles = (asStranger.data?.userEvents as any).events.map((e: any) => e.title);
    expect(strangerTitles).toEqual(['public']);

    const asOwner = await graphql({
      schema,
      source: USER_EVENTS,
      contextValue: contextFor((await asContextUser(host)) as any),
      variableValues: { userId: host._id.toString() },
    });
    expect(asOwner.errors).toBeUndefined();
    expect((asOwner.data?.userEvents as any).events).toHaveLength(3);
  });
});
