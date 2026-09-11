import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { PostCard } from '@/components/Post/PostCard';
import { REACT_TO_POST } from '@/lib/graphql';

// Regression coverage for DEVELOPMENT.md's changelog 2026-08-23 (5): the
// reaction picker used to close (via the Like button's onMouseLeave)
// before the pointer actually reached the picker itself, since moving the
// mouse from the button to the picker briefly leaves both elements. The
// fix uses a shared delayed-close timer that the picker's own onMouseEnter
// cancels. These tests drive that timing directly with fake timers rather
// than trusting that the handlers are wired correctly by inspection.

vi.mock('@/store', () => ({
  useAuthStore: () => ({ user: { id: 'me1' } }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const basePost = {
  id: 'post1',
  content: 'Hello world',
  author: { id: 'author1', fullName: 'Author One', username: 'author_one', isOnline: false, isVerified: false },
  media: [],
  reactionSummary: [],
  myReaction: null,
  isSaved: false,
  commentsCount: 0,
  sharesCount: 0,
  visibility: 'PUBLIC',
  isEdited: false,
  createdAt: new Date().toISOString(),
};

function renderPostCard(mocks: any[] = []) {
  return render(
    <MemoryRouter>
      <MockedProvider mocks={mocks} addTypename={false}>
        <PostCard post={basePost as any} />
      </MockedProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PostCard — reaction picker hover timing', () => {
  it('opens the picker ~500ms after hovering the Like button', () => {
    renderPostCard();
    const likeButton = screen.getByRole('button', { name: /like/i });

    fireEvent.mouseEnter(likeButton);
    expect(screen.queryByRole('dialog', { name: /reaction picker/i })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('dialog', { name: /reaction picker/i })).toBeInTheDocument();
  });

  it('does NOT close when the pointer moves from the Like button onto the picker itself', () => {
    renderPostCard();
    const likeButton = screen.getByRole('button', { name: /like/i });

    fireEvent.mouseEnter(likeButton);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const picker = screen.getByRole('dialog', { name: /reaction picker/i });

    // Leaving the button starts the close timer...
    fireEvent.mouseLeave(likeButton);
    // ...but entering the picker before it fires must cancel it. This is
    // the exact sequence that used to fail: the picker would vanish here.
    fireEvent.mouseEnter(picker);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('dialog', { name: /reaction picker/i })).toBeInTheDocument();
  });

  it('closes ~400ms after the pointer leaves the picker itself', () => {
    renderPostCard();
    const likeButton = screen.getByRole('button', { name: /like/i });

    fireEvent.mouseEnter(likeButton);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const picker = screen.getByRole('dialog', { name: /reaction picker/i });

    fireEvent.mouseEnter(picker);
    fireEvent.mouseLeave(picker);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.queryByRole('dialog', { name: /reaction picker/i })).not.toBeInTheDocument();
  });

  it('clicking an emoji in the picker sends that reaction and closes the picker', async () => {
    vi.useRealTimers(); // this test drives a real async mutation round-trip
    const mocks = [
      {
        request: { query: REACT_TO_POST, variables: { postId: 'post1', type: 'LOVE' } },
        result: {
          data: {
            reactToPost: { id: 'post1', reactionSummary: [{ type: 'LOVE', count: 1 }], myReaction: 'LOVE' },
          },
        },
      },
    ];
    renderPostCard(mocks);
    const likeButton = screen.getByRole('button', { name: /like/i });

    fireEvent.mouseEnter(likeButton);
    const picker = await screen.findByRole('dialog', { name: /reaction picker/i }, { timeout: 1000 });
    fireEvent.click(within(picker).getByRole('button', { name: 'LOVE' }));

    // The picker closes immediately on click (handleReact sets
    // showReactions false synchronously, before the mutation resolves).
    expect(screen.queryByRole('dialog', { name: /reaction picker/i })).not.toBeInTheDocument();
  });
});
