import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { client } from '@/lib/apollo';

// ─── Shared type ─────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatar?: string | null;
  coverPhoto?: string | null;
  bio?: string | null;
  isOnline: boolean;
  isVerified: boolean;
  friendsCount: number;
  postsCount: number;
}

// ─── Auth store ───────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        isAuthenticated: false,

        setAuth: (token, user) => {
          localStorage.setItem('token', token);
          set({ token, user, isAuthenticated: true }, false, 'auth/setAuth');
        },

        setUser: (partial) =>
          set(
            (s) => ({ user: s.user ? { ...s.user, ...partial } : s.user }),
            false,
            'auth/setUser'
          ),

        logout: () => {
          localStorage.removeItem('token');
          // Reset Apollo cache on logout so stale data doesn't leak between sessions
          client.clearStore().catch(() => {});
          set({ token: null, user: null, isAuthenticated: false }, false, 'auth/logout');
        },
      }),
      {
        name: 'auth-storage',
        partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }),
      }
    ),
    { name: 'AuthStore' }
  )
);

// ─── UI store ─────────────────────────────────────────────────────────────────

interface ChatRecipient {
  id: string;
  fullName: string;
  avatar?: string | null;
  username: string;
  isOnline: boolean;
}

interface UIState {
  darkMode: boolean;
  sidebarOpen: boolean;
  chatOpen: boolean;
  activeChatId: string | null;
  // Set when a chat is opened from somewhere that only knows the *person*
  // (e.g. Profile.tsx's "Message" button) rather than an existing
  // conversation id. ChatPanel checks for an existing conversation and, if
  // none exists, renders the chat window in "pending" mode — the first
  // message sent creates the conversation server-side.
  pendingRecipient: ChatRecipient | null;
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  openChat: (id: string) => void;
  openChatWithUser: (recipient: ChatRecipient) => void;
  closeChat: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        // Pulse Connect defaults to dark mode regardless of system preference.
        // Returning users still get whatever they last chose, via `persist` below.
        darkMode: true,
        sidebarOpen: true,
        chatOpen: false,
        activeChatId: null,
        pendingRecipient: null,

        toggleDarkMode: () =>
          set((s) => {
            const next = !s.darkMode;
            // Apply to document root so Tailwind dark: classes work
            document.documentElement.classList.toggle('dark', next);
            return { darkMode: next };
          }, false, 'ui/toggleDarkMode'),

        toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, 'ui/toggleSidebar'),

        openChat: (id) => set({ chatOpen: true, activeChatId: id, pendingRecipient: null }, false, 'ui/openChat'),
        openChatWithUser: (recipient) =>
          set({ chatOpen: true, activeChatId: null, pendingRecipient: recipient }, false, 'ui/openChatWithUser'),
        closeChat: () => set({ chatOpen: false, activeChatId: null, pendingRecipient: null }, false, 'ui/closeChat'),
      }),
      { name: 'ui-storage', partialize: (s) => ({ darkMode: s.darkMode }) }
    ),
    { name: 'UIStore' }
  )
);

// ─── Notification store ───────────────────────────────────────────────────────

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }, false, 'notif/set'),
      incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 }), false, 'notif/inc'),
      clearUnread: () => set({ unreadCount: 0 }, false, 'notif/clear'),
    }),
    { name: 'NotificationStore' }
  )
);
