import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { CommentSection } from '@/components/Post/CommentSection';
import { GET_POST_COMMENTS, CREATE_COMMENT } from '@/lib/graphql';

// Regression coverage for the bug documented in CommentSection.tsx itself
// (and DEVELOPMENT.md's changelog, 2026-09-07 (11)): this component used to
// only render an `initialComments` prop that no caller could ever actually
// supply (PostCard only ever had `post.commentsCount`, never the comment
// list), so comments silently never appeared regardless of what was in the
// database. The fix was for CommentSection to fetch its own data via
// GET_POST_COMMENTS. These tests exercise that fetch directly, with a real
// MockedProvider — not a stub of the component's internals — so a
// regression back to a prop-only render would show up as an empty screen
// here, the same as it did for real users.

vi.mock('@/store', () => ({
  useAuthStore: () => ({
    user: { id: 'me1', fullName: 'Current User', avatar: null },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const POST_ID = 'post1';

function makeComment(overrides: Record<string, any> = {}) {
  return {
    __typename: 'Comment',
    id: overrides.id ?? 'c1',
    content: overrides.content ?? 'Great post!',
    isEdited: false,
    createdAt: new Date().toISOString(),
    repliesCount: overrides.repliesCount ?? 0,
    author: {
      __typename: 'User',
      id: 'author1',
      username: 'author_one',
      firstName: 'Ava',
      lastName: 'Thor',
      fullName: 'Ava Thor',
      avatar: null,
      isOnline: false,
      isVerified: false,
      isFriend: false,
      friendsCount: 0,
    },
    reactions: [],
    media: null,
    replies: overrides.replies ?? [],
    ...overrides,
  };
}

function renderWithMocks(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <CommentSection postId={POST_ID} />
    </MockedProvider>
  );
}

describe('CommentSection', () => {
  it('fetches and displays comments via GET_POST_COMMENTS (not a prop)', async () => {
    const mocks = [
      {
        request: { query: GET_POST_COMMENTS, variables: { postId: POST_ID, limit: 10 } },
        result: { data: { comments: [makeComment({ content: 'First comment!' })] } },
      },
    ];

    renderWithMocks(mocks);

    expect(screen.getByText(/loading comments/i)).toBeInTheDocument();
    expect(await screen.findByText('First comment!')).toBeInTheDocument();
  });

  it('shows the empty state when the post genuinely has no comments', async () => {
    const mocks = [
      {
        request: { query: GET_POST_COMMENTS, variables: { postId: POST_ID, limit: 10 } },
        result: { data: { comments: [] } },
      },
    ];

    renderWithMocks(mocks);

    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('posts a new comment and refetches the comment list to show it', async () => {
    const user = userEvent.setup();
    const newComment = makeComment({ id: 'c2', content: 'Just posted this' });

    const mocks = [
      {
        request: { query: GET_POST_COMMENTS, variables: { postId: POST_ID, limit: 10 } },
        result: { data: { comments: [] } },
      },
      {
        request: {
          query: CREATE_COMMENT,
          variables: { input: { postId: POST_ID, content: 'Just posted this' } },
        },
        result: { data: { createComment: newComment } },
      },
      // The component explicitly refetches GET_POST_COMMENTS after a
      // successful post (see the comment in CommentSection.tsx about why
      // `refetchQueries: ['GetPost']` didn't work) — this second mock is
      // what makes that refetch resolve to the new state.
      {
        request: { query: GET_POST_COMMENTS, variables: { postId: POST_ID, limit: 10 } },
        result: { data: { comments: [newComment] } },
      },
    ];

    renderWithMocks(mocks);
    await screen.findByText(/no comments yet/i);

    const input = screen.getByPlaceholderText(/write a comment/i);
    await user.type(input, 'Just posted this');
    await user.click(screen.getByLabelText(/post comment/i));

    expect(await screen.findByText('Just posted this')).toBeInTheDocument();
    // The input clears after a successful post.
    expect(input).toHaveValue('');
  });

  it('shows a reply once repliesCount and replies are both present', async () => {
    const parent = makeComment({
      id: 'p1',
      content: 'Parent comment',
      repliesCount: 1,
      replies: [makeComment({ id: 'r1', content: 'A reply', repliesCount: 0 })],
    });
    const mocks = [
      {
        request: { query: GET_POST_COMMENTS, variables: { postId: POST_ID, limit: 10 } },
        result: { data: { comments: [parent] } },
      },
    ];

    const user = userEvent.setup();
    renderWithMocks(mocks);

    await screen.findByText('Parent comment');
    expect(screen.queryByText('A reply')).not.toBeInTheDocument();

    await user.click(screen.getByText(/1 reply/i));
    expect(await screen.findByText('A reply')).toBeInTheDocument();
  });
});
