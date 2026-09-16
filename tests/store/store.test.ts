import { describe, it, expect, vi, beforeEach } from 'vitest';

// store/index.ts imports the real Apollo `client` singleton at module
// scope purely to call `client.clearStore()` on logout — mocking it here
// keeps these tests focused on store state transitions rather than
// dragging in the real ApolloClient/graphql-ws construction (see
// tests/lib/apollo.test.ts for that side of things).
//
// `vi.mock` factories are hoisted above every other top-level statement in
// this file, including `const` declarations — so a plain
// `const clearStore = vi.fn(); vi.mock(..., () => ({ clearStore }))` reads
// `clearStore` before it's ever assigned (a TDZ error). `vi.hoisted` is
// hoisted together with `vi.mock`, in the same order, specifically so
// values can be shared between them safely.
const { clearStore } = vi.hoisted(() => ({
  clearStore: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/apollo', () => ({
  client: { clearStore },
}));

import { useAuthStore, useUIStore, useNotificationStore } from '@/store';

const fakeUser = {
  id: 'u1',
  username: 'alice',
  firstName: 'Alice',
  lastName: 'A',
  fullName: 'Alice A',
  email: 'alice@example.com',
  avatar: null,
  coverPhoto: null,
  bio: null,
  isOnline: true,
  isVerified: false,
  friendsCount: 0,
  postsCount: 0,
};

beforeEach(() => {
  localStorage.clear();
  clearStore.mockClear();
  // Reset each store to its known initial shape — these are module-level
  // singletons, so state from one test would otherwise leak into the next.
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  useUIStore.setState({
    mobileMenuOpen: false,
    chatOpen: false,
    activeChatId: null,
    pendingRecipient: null,
  });
  useNotificationStore.setState({ unreadCount: 0 });
});

describe('useAuthStore', () => {
  it('setAuth stores the token in localStorage and marks the user authenticated', () => {
    useAuthStore.getState().setAuth('token-123', fakeUser);

    expect(localStorage.getItem('token')).toBe('token-123');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.username).toBe('alice');
    expect(state.token).toBe('token-123');
  });

  it('setUser merges a partial update without touching other fields', () => {
    useAuthStore.getState().setAuth('token-123', fakeUser);
    useAuthStore.getState().setUser({ bio: 'Hello world', friendsCount: 5 });

    const state = useAuthStore.getState();
    expect(state.user?.bio).toBe('Hello world');
    expect(state.user?.friendsCount).toBe(5);
    expect(state.user?.username).toBe('alice'); // untouched
  });

  it('setUser is a no-op when there is no current user', () => {
    useAuthStore.getState().setUser({ bio: 'orphan update' });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('logout clears localStorage, resets state, and clears the Apollo cache', async () => {
    useAuthStore.getState().setAuth('token-123', fakeUser);

    useAuthStore.getState().logout();

    expect(localStorage.getItem('token')).toBeNull();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(clearStore).toHaveBeenCalledTimes(1);
  });
});

describe('useUIStore', () => {
  it('toggleDarkMode flips state and toggles the document root class', () => {
    useUIStore.setState({ darkMode: false });
    useUIStore.getState().toggleDarkMode();

    expect(useUIStore.getState().darkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useUIStore.getState().toggleDarkMode();
    expect(useUIStore.getState().darkMode).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggleMobileMenu flips mobileMenuOpen', () => {
    useUIStore.setState({ mobileMenuOpen: false });
    useUIStore.getState().toggleMobileMenu();
    expect(useUIStore.getState().mobileMenuOpen).toBe(true);
  });

  it('closeMobileMenu sets mobileMenuOpen to false', () => {
    useUIStore.setState({ mobileMenuOpen: true });
    useUIStore.getState().closeMobileMenu();
    expect(useUIStore.getState().mobileMenuOpen).toBe(false);
  });

  it('openChat sets activeChatId and clears any pending recipient', () => {
    useUIStore.getState().openChatWithUser({
      id: 'them1', fullName: 'Them', username: 'them', isOnline: true,
    });
    expect(useUIStore.getState().pendingRecipient?.id).toBe('them1');

    useUIStore.getState().openChat('conv1');

    const state = useUIStore.getState();
    expect(state.chatOpen).toBe(true);
    expect(state.activeChatId).toBe('conv1');
    expect(state.pendingRecipient).toBeNull();
  });

  it('openChatWithUser sets a pending recipient and clears any active conversation id', () => {
    useUIStore.getState().openChat('conv1');
    useUIStore.getState().openChatWithUser({
      id: 'them2', fullName: 'Them Two', username: 'them2', isOnline: false,
    });

    const state = useUIStore.getState();
    expect(state.chatOpen).toBe(true);
    expect(state.activeChatId).toBeNull();
    expect(state.pendingRecipient?.username).toBe('them2');
  });

  it('closeChat resets all chat-related state', () => {
    useUIStore.getState().openChat('conv1');
    useUIStore.getState().closeChat();

    const state = useUIStore.getState();
    expect(state.chatOpen).toBe(false);
    expect(state.activeChatId).toBeNull();
    expect(state.pendingRecipient).toBeNull();
  });
});

describe('useNotificationStore', () => {
  it('setUnreadCount, incrementUnread, and clearUnread all behave as expected', () => {
    useNotificationStore.getState().setUnreadCount(5);
    expect(useNotificationStore.getState().unreadCount).toBe(5);

    useNotificationStore.getState().incrementUnread();
    expect(useNotificationStore.getState().unreadCount).toBe(6);

    useNotificationStore.getState().clearUnread();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});
