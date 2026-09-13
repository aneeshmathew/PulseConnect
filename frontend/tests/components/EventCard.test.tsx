import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import toast from 'react-hot-toast';
import { EventCard } from '@/components/Events/EventCard';
import { RSVP_TO_EVENT, CANCEL_RSVP, DELETE_EVENT } from '@/lib/graphql';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

let currentUser: any = { id: 'attendee1' };
vi.mock('@/store', () => ({
  useAuthStore: () => ({ user: currentUser }),
}));

const baseEvent = {
  id: 'event1',
  title: 'Weekend Hike',
  coverImage: null,
  location: 'Griffith Park',
  startAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
  goingCount: 2,
  interestedCount: 1,
  myRsvp: null,
  host: { id: 'host1', fullName: 'Event Host', avatar: null },
};

function renderCard(event: any, mocks: any[] = [], onDeleted = vi.fn()) {
  return render(
    <MemoryRouter>
      <MockedProvider mocks={mocks} addTypename={false}>
        <EventCard event={event} onDeleted={onDeleted} />
      </MockedProvider>
    </MemoryRouter>
  );
}

describe('EventCard', () => {
  it('renders title, location, and going/interested counts', () => {
    renderCard(baseEvent);
    expect(screen.getByText('Weekend Hike')).toBeInTheDocument();
    expect(screen.getByText('Griffith Park')).toBeInTheDocument();
    expect(screen.getByText('2 going · 1 interested')).toBeInTheDocument();
  });

  it('sends a GOING rsvp when the Going button is clicked', async () => {
    // EventCard's `event` is a plain prop here, not backed by a live query,
    // so a successful mutation won't reactively repaint local counts in
    // this isolated test the way it does inside the real app (where
    // EventsPage's useQuery result is what actually re-renders with the
    // cache-merged event). What IS this component's own responsibility —
    // and what's worth testing here — is that it fires the mutation with
    // the right variables and doesn't surface an error. Same convention as
    // PostCard.test.tsx's reaction-picker test, which checks the picker
    // closes rather than asserting a refreshed reaction count.
    const mocks = [
      {
        request: { query: RSVP_TO_EVENT, variables: { eventId: 'event1', status: 'GOING' } },
        result: {
          data: {
            rsvpToEvent: { ...baseEvent, myRsvp: 'GOING', goingCount: 3 },
          },
        },
      },
    ];
    renderCard(baseEvent, mocks);

    const goingBtn = screen.getByRole('button', { name: /going/i });
    fireEvent.click(goingBtn);
    // Disables synchronously while useMutation's loading flag is true —
    // confirms the click actually kicked off the mutation round trip.
    expect(goingBtn).toBeDisabled();

    await waitFor(() => expect(goingBtn).not.toBeDisabled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('cancels the RSVP instead of re-sending the same status when toggled off', async () => {
    const alreadyGoing = { ...baseEvent, myRsvp: 'GOING' };
    const mocks = [
      {
        request: { query: CANCEL_RSVP, variables: { eventId: 'event1' } },
        result: {
          data: { cancelRsvp: { ...alreadyGoing, myRsvp: null, goingCount: 1 } },
        },
      },
    ];
    renderCard(alreadyGoing, mocks);

    // Clicking "Going" again while already GOING must call cancelRsvp, not
    // rsvpToEvent with the same status — this is the toggle-off behavior
    // implemented in EventCard's handleRsvp. MockedProvider throws "No
    // more mocked responses" if the wrong mutation/variables are sent,
    // which handleRsvp's catch block turns into a toast.error call — so
    // this exercises that branch precisely.
    const goingBtn = screen.getByRole('button', { name: /going/i });
    fireEvent.click(goingBtn);
    expect(goingBtn).toBeDisabled();

    await waitFor(() => expect(goingBtn).not.toBeDisabled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does not show the host options menu to a non-host viewer', () => {
    currentUser = { id: 'attendee1' }; // not the host ('host1')
    renderCard(baseEvent);
    expect(screen.queryByLabelText(/event options/i)).not.toBeInTheDocument();
  });

  it('lets the host delete the event via the options menu, with a confirmation', async () => {
    currentUser = { id: 'host1' };
    const onDeleted = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mocks = [
      {
        request: { query: DELETE_EVENT, variables: { id: 'event1' } },
        result: { data: { deleteEvent: true } },
      },
    ];
    renderCard(baseEvent, mocks, onDeleted);

    fireEvent.click(screen.getByLabelText(/event options/i));
    fireEvent.click(screen.getByRole('button', { name: /delete event/i }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith('event1');
    });
    confirmSpy.mockRestore();
  });

  it('does not delete when the confirmation is declined', async () => {
    currentUser = { id: 'host1' };
    const onDeleted = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCard(baseEvent, [], onDeleted);

    fireEvent.click(screen.getByLabelText(/event options/i));
    fireEvent.click(screen.getByRole('button', { name: /delete event/i }));

    await new Promise((r) => setTimeout(r, 0));
    expect(onDeleted).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
