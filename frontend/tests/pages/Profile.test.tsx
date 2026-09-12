import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { ProfilePage } from '@/pages/Profile';
import { GET_USER, GET_USER_POSTS, SEND_FRIEND_REQUEST } from '@/lib/graphql';

// Profile pulls in the whole authenticated shell (Navbar/sidebars/ChatPanel)
// via AppLayout, plus PostCard and EditProfileModal, none of which are
// relevant to Profile's own tab-switching / data-loading / friend-action
// logic — stub them so this file tests exactly that.
vi.mock('@/pages/Home', () => ({
  AppLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/Post/PostCard', () => ({
  PostCard: ({ post }: any) => <div data-testid={`post-${post.id}`}>{post.content}</div>,
}));
vi.mock('@/components/Profile/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: any) => (
    <div role="dialog" aria-label="Edit profile modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>();
  return { ...actual, uploadMedia: vi.fn().mockResolvedValue({ url: 'https://example.com/photo.jpg' }) };
});

const openChatWithUser = vi.fn();
let currentUser: any = { id: 'me1' };
vi.mock('@/store', () => ({
  useAuthStore: () => ({ user: currentUser }),
  useUIStore: () => ({ openChatWithUser }),
}));

function baseUser(overrides: any = {}) {
  return {
    __typename: 'User',
    id: 'user1',
    username: 'janedoe',
    firstName: 'Jane',
    lastName: 'Doe',
    fullName: 'Jane Doe',
    avatar: null,
    isOnline: false,
    isVerified: false,
    isFriend: false,
    friendsCount: 3,
    bio: null,
    location: null,
    website: null,
    birthDate: null,
    email: 'jane@example.com',
    coverPhoto: null,
    friends: [],
    hasFriendRequest: false,
    ...overrides,
  };
}

function renderProfile(mocks: any[]) {
  return render(
    <MemoryRouter initialEntries={['/profile/janedoe']}>
      <MockedProvider mocks={mocks}>
        <Routes>
          <Route path="/profile/:username" element={<ProfilePage />} />
        </Routes>
      </MockedProvider>
    </MemoryRouter>
  );
}

function userPostsMock(userId: string, posts: any[] = [], overrides: any = {}) {
  return {
    request: { query: GET_USER_POSTS, variables: { userId, limit: 10 } },
    result: { data: { userPosts: { posts, hasMore: false, nextCursor: null, ...overrides } } },
  };
}

describe('ProfilePage', () => {
  it('shows a loading skeleton while the profile is being fetched', () => {
    const mocks = [{ request: { query: GET_USER, variables: { username: 'janedoe' } }, result: { data: { user: baseUser() } }, delay: 50 }];
    renderProfile(mocks);
    // The skeleton header renders animate-pulse blocks with no profile name yet.
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('shows a "user not found" message when the profile does not exist', async () => {
    const mocks = [{ request: { query: GET_USER, variables: { username: 'janedoe' } }, result: { data: { user: null } } }];
    renderProfile(mocks);
    expect(await screen.findByText('User not found')).toBeInTheDocument();
    expect(screen.getByText(/@janedoe doesn't exist/i)).toBeInTheDocument();
  });

  it('renders the Posts tab by default and shows "Edit profile" for the profile owner', async () => {
    currentUser = { id: 'user1' }; // owner === profile
    const user = baseUser();
    const posts = [{ id: 'post1', content: 'Hello from Jane' }];
    const mocks = [
      { request: { query: GET_USER, variables: { username: 'janedoe' } }, result: { data: { user } } },
      userPostsMock('user1', posts),
    ];
    renderProfile(mocks);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^edit profile$/i })).toBeInTheDocument();
    expect(await screen.findByText('Hello from Jane')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^edit profile$/i }));
    expect(screen.getByRole('dialog', { name: /edit profile modal/i })).toBeInTheDocument();
  });

  it('switches to the About tab and shows bio/location/website', async () => {
    currentUser = { id: 'user1' };
    const user = baseUser({ bio: 'Loves hiking', location: 'Dublin, CA', website: 'janedoe.dev' });
    const mocks = [
      { request: { query: GET_USER, variables: { username: 'janedoe' } }, result: { data: { user } } },
      userPostsMock('user1'),
    ];
    renderProfile(mocks);

    fireEvent.click(await screen.findByRole('button', { name: 'About' }));
    // Bio/location/website also show in the always-visible profile header,
    // so scope these queries to the About tab's own section (identified by
    // its "About" heading) rather than matching the header's copy too.
    const aboutHeading = await screen.findByRole('heading', { name: 'About' });
    const aboutSection = within(aboutHeading.closest('div') as HTMLElement);
    expect(aboutSection.getByText('Loves hiking')).toBeInTheDocument();
    expect(aboutSection.getByText('Dublin, CA')).toBeInTheDocument();
    expect(aboutSection.getByText('janedoe.dev')).toBeInTheDocument();
  });

  it('shows "No friends to show" on the Friends tab when the list is empty', async () => {
    currentUser = { id: 'user1' };
    const user = baseUser({ friends: [] });
    const mocks = [
      { request: { query: GET_USER, variables: { username: 'janedoe' } }, result: { data: { user } } },
      userPostsMock('user1'),
    ];
    renderProfile(mocks);

    fireEvent.click(await screen.findByRole('button', { name: 'Friends' }));
    expect(await screen.findByText('No friends to show.')).toBeInTheDocument();
  });

  it('lets a visitor send a friend request, disabling the button once sent', async () => {
    currentUser = { id: 'me1' }; // visitor, not the profile owner
    const user = baseUser({ isFriend: false, hasFriendRequest: false });
    const mocks = [
      { request: { query: GET_USER, variables: { username: 'janedoe' } }, result: { data: { user } } },
      userPostsMock('user1'),
      {
        request: { query: SEND_FRIEND_REQUEST, variables: { userId: 'user1' } },
        result: { data: { sendFriendRequest: { id: 'user1', isFriend: false, hasFriendRequest: true } } },
      },
      // refetchQueries: ['GetUser'] fires an extra GET_USER request after the mutation
      { request: { query: GET_USER, variables: { username: 'janedoe' } }, result: { data: { user } } },
    ];
    renderProfile(mocks);

    const addFriendBtn = await screen.findByRole('button', { name: /add friend/i });
    fireEvent.click(addFriendBtn);

    expect(await screen.findByRole('button', { name: /request sent/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /message/i })).toBeInTheDocument();
  });
});
