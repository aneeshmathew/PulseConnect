import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { InMemoryCache } from '@apollo/client';
import { EventsPage } from '@/pages/Events';
import { GET_UPCOMING_EVENTS } from '@/lib/graphql';

// apollo.ts constructs a GraphQLWsLink (via graphql-ws) at module load
// time, which throws synchronously if no global WebSocket exists — jsdom
// doesn't provide one. A static `import { cacheTypePolicies } from
// '@/lib/apollo'` at the top of this file would be hoisted and evaluated
// before this stub (or any of this file's own code) ever runs, crashing
// the whole suite at load time. Stubbing here, then reaching `apollo.ts`
// only via a dynamic import inside renderEvents() below, guarantees the
// stub is in place first — same fix, same reasoning as apollo.test.ts.
class FakeWebSocket {}
(globalThis as any).WebSocket = (globalThis as any).WebSocket ?? FakeWebSocket;

// EventsPage renders through the shared AppLayout shell and delegates each
// event's own display/RSVP/delete behavior to EventCard, and creation to
// CreateEventModal — neither is relevant to EventsPage's own list-loading,
// empty-state, and "open the composer" logic, so they're stubbed here,
// same convention as Watch.test.tsx.
vi.mock('@/pages/Home', () => ({
  AppLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/Events/EventCard', () => ({
  EventCard: ({ event }: any) => <div data-testid={`event-${event.id}`}>{event.title}</div>,
}));
vi.mock('@/components/Events/CreateEventModal', () => ({
  CreateEventModal: ({ onClose }: any) => (
    <div role="dialog" aria-label="Create event modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

function makeEvent(id: string, title: string) {
  return {
    __typename: 'Event',
    id,
    title,
    description: '',
    coverImage: null,
    location: 'Somewhere',
    startAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    endAt: null,
    visibility: 'PUBLIC',
    attendeesCount: 0,
    goingCount: 0,
    interestedCount: 0,
    myRsvp: null,
    attendees: [],
    createdAt: new Date().toISOString(),
    host: {
      __typename: 'User', id: 'host1', username: 'host', firstName: 'Host', lastName: 'One',
      fullName: 'Host One', avatar: null, isOnline: false, isVerified: false, isFriend: false, friendsCount: 0,
    },
  };
}

async function renderEvents(mocks: any[]) {
  // Uses a fresh cache built from the app's real typePolicies (not
  // MockedProvider's bare default InMemoryCache) — without the
  // upcomingEvents merge policy, fetchMore's result lands under a
  // different cache key than the one the original query is watching
  // (args differ once `cursor` is added), so "Load more" would appear to
  // do nothing at all — which is exactly the bug this test caught before
  // the merge policy existed. A fresh instance per render avoids leaking
  // normalized entities between tests the way reusing the app's
  // `apolloCache` singleton would.
  const { cacheTypePolicies } = await import('@/lib/apollo');
  return render(
    <MockedProvider mocks={mocks} cache={new InMemoryCache({ typePolicies: cacheTypePolicies })}>
      <EventsPage />
    </MockedProvider>
  );
}

const EVENTS_LIMIT = 9;

describe('EventsPage', () => {
  it('shows a loading state before the list arrives', async () => {
    const mocks = [{
      request: { query: GET_UPCOMING_EVENTS, variables: { limit: EVENTS_LIMIT } },
      result: { data: { upcomingEvents: { events: [], hasMore: false, nextCursor: null } } },
      delay: 50,
    }];
    await renderEvents(mocks);
    expect(screen.queryByText('No upcoming events')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no events', async () => {
    const mocks = [{
      request: { query: GET_UPCOMING_EVENTS, variables: { limit: EVENTS_LIMIT } },
      result: { data: { upcomingEvents: { events: [], hasMore: false, nextCursor: null } } },
    }];
    await renderEvents(mocks);
    expect(await screen.findByText('No upcoming events')).toBeInTheDocument();
    expect(screen.getByText('Be the first to create one for your friends.')).toBeInTheDocument();
  });

  it('renders events once loaded', async () => {
    const events = [makeEvent('e1', 'Weekend Hike'), makeEvent('e2', 'Coffee Meetup')];
    const mocks = [{
      request: { query: GET_UPCOMING_EVENTS, variables: { limit: EVENTS_LIMIT } },
      result: { data: { upcomingEvents: { events, hasMore: false, nextCursor: null } } },
    }];
    await renderEvents(mocks);

    expect(await screen.findByText('Weekend Hike')).toBeInTheDocument();
    expect(screen.getByText('Coffee Meetup')).toBeInTheDocument();
  });

  it('opens the create-event modal when "Create event" is clicked, and closes it again', async () => {
    const mocks = [{
      request: { query: GET_UPCOMING_EVENTS, variables: { limit: EVENTS_LIMIT } },
      result: { data: { upcomingEvents: { events: [], hasMore: false, nextCursor: null } } },
    }];
    await renderEvents(mocks);
    await screen.findByText('No upcoming events');

    fireEvent.click(screen.getByRole('button', { name: /create event/i }));
    const modal = screen.getByRole('dialog', { name: /create event modal/i });
    expect(modal).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog', { name: /create event modal/i })).not.toBeInTheDocument();
  });

  it('shows a "Load more" button when hasMore is true, and accumulates the next page on click', async () => {
    const page1 = [makeEvent('e1', 'Weekend Hike')];
    const page2 = [makeEvent('e2', 'Coffee Meetup')];
    const mocks = [
      {
        request: { query: GET_UPCOMING_EVENTS, variables: { limit: EVENTS_LIMIT } },
        result: { data: { upcomingEvents: { events: page1, hasMore: true, nextCursor: 'cursor1' } } },
      },
      {
        request: { query: GET_UPCOMING_EVENTS, variables: { cursor: 'cursor1', limit: EVENTS_LIMIT } },
        result: { data: { upcomingEvents: { events: page2, hasMore: false, nextCursor: null } } },
      },
    ];
    await renderEvents(mocks);

    await screen.findByText('Weekend Hike');
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    // With the real upcomingEvents merge policy in play (keyArgs: false,
    // append + de-dupe by ref), page 2 is appended to page 1 rather than
    // replacing it — both should be visible.
    expect(await screen.findByText('Coffee Meetup')).toBeInTheDocument();
    expect(screen.getByText('Weekend Hike')).toBeInTheDocument();
    // Second page reports hasMore: false, so the button should be gone.
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });
});
