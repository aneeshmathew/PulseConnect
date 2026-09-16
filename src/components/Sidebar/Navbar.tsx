import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useLazyQuery, useSubscription, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Home, Users, Store, PlaySquare,
  Bell, MessageCircle, ChevronDown, X, Check, UserX,
  Settings, Bookmark, Menu, LogOut,
} from 'lucide-react';
import {
  GET_NOTIFICATIONS, SEARCH_USERS,
  NEW_NOTIFICATION_SUB, MARK_ALL_NOTIFICATIONS_READ, MARK_NOTIFICATION_READ,
  ACCEPT_FRIEND_REQUEST, DECLINE_FRIEND_REQUEST, DELETE_NOTIFICATION,
} from '@/lib/graphql';
import { subscriptionsEnabled } from '@/lib/apollo';
import { Avatar } from '@/components/UI/Avatar';
import { Logo } from '@/components/UI/Logo';
import { MobileSidebarDrawer } from '@/components/Sidebar/MobileSidebarDrawer';
import { useAuthStore, useNotificationStore, useUIStore } from '@/store';
import { timeAgo, cn } from '@/utils';
import toast from 'react-hot-toast';

const NAV_TABS = [
  { to: '/',          icon: Home,       label: 'Home' },
  { to: '/friends',   icon: Users,      label: 'Friends' },
  { to: '/watch',     icon: PlaySquare, label: 'Watch' },
  { to: '/marketplace', icon: Store,    label: 'Marketplace' },
];

const NOTIF_ICONS: Record<string, string> = {
  POST_LIKE: '👍', POST_COMMENT: '💬', FRIEND_REQUEST: '👤',
  FRIEND_ACCEPT: '🤝', COMMENT_REPLY: '↩️', MENTION: '@',
  POST_SHARE: '🔁', MESSAGE: '✉️',
};

export function Navbar() {
  const { user, logout } = useAuthStore();
  const { toggleMobileMenu, closeMobileMenu } = useUIStore();
  const { unreadCount, incrementUnread, setUnreadCount } = useNotificationStore();
  const navigate = useNavigate();
  // ✅ Fix: use React Router's useLocation, NOT window.location
  const location = useLocation();

  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  // ✅ Fix (mobile layout): the inline search box is a fixed 208px
  // (w-52) and flex-shrink-0, so on phone-width viewports the navbar
  // (logo + search + message/notif/profile icons) needed ~430px+ to fit
  // without overlap — the profile button (and its Log Out menu) was the
  // rightmost item, so it got pushed off-screen. Below `sm` we now show a
  // small search icon instead that opens the same search UI as a
  // full-width overlay, freeing ~216px so the icon cluster always fits.
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [searchUsers, { data: searchData, loading: searchLoading }] = useLazyQuery(SEARCH_USERS);
  const { data: notifsData } = useQuery(GET_NOTIFICATIONS, {
    variables: { limit: 15 },
    skip: !user,
  });
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ, {
    refetchQueries: [GET_NOTIFICATIONS],
  });

  // Friend requests actioned from the notification dropdown. GET_NOTIFICATIONS
  // is refetched after each action so the badge/list stay in sync, but we also
  // track handled ids locally so the button swaps to a status instantly
  // instead of waiting on the refetch round-trip.
  const [handledRequests, setHandledRequests] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [acceptFriendRequest] = useMutation(ACCEPT_FRIEND_REQUEST);
  const [declineFriendRequest] = useMutation(DECLINE_FRIEND_REQUEST);
  // Actually removes the notification server-side once a friend request has
  // been resolved. Previously accept/decline only swapped the buttons for a
  // status label in local component state — the underlying notification was
  // never touched, so it silently reappeared (still unread, still showing
  // Confirm/Delete) the next time GET_NOTIFICATIONS refetched or the
  // dropdown was reopened. This is the actual fix for that; the local
  // `handledRequests` state below now only covers the brief moment between
  // clicking and the delete+refetch completing.
  const [deleteNotification] = useMutation(DELETE_NOTIFICATION, {
    refetchQueries: [GET_NOTIFICATIONS],
  });

  const [markNotificationRead] = useMutation(MARK_NOTIFICATION_READ);

  const handleNotificationClick = useCallback((n: any) => {
    if (!n.isRead) markNotificationRead({ variables: { id: n.id } });
    setShowNotifs(false);

    if (n.type === 'FRIEND_REQUEST' || n.type === 'FRIEND_ACCEPT') {
      navigate(`/profile/${n.sender.username}`);
    } else if (n.entityType === 'post' && n.entityId) {
      navigate(`/post/${n.entityId}`);
    } else {
      // No page exists yet for this notification type (e.g. STORY_VIEW,
      // MESSAGE) — falling back to the sender's profile beats doing
      // nothing at all.
      navigate(`/profile/${n.sender.username}`);
    }
  }, [markNotificationRead, navigate]);

  const handleAcceptRequest = useCallback(async (notifId: string, senderId: string) => {
    setActioningId(notifId);
    try {
      await acceptFriendRequest({ variables: { userId: senderId } });
      setHandledRequests((prev) => ({ ...prev, [notifId]: 'accepted' }));
      toast.success('Friend request accepted! 🎉');
      await deleteNotification({ variables: { id: notifId } });
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to accept request');
    } finally {
      setActioningId(null);
    }
  }, [acceptFriendRequest, deleteNotification]);

  const handleDeclineRequest = useCallback(async (notifId: string, senderId: string) => {
    setActioningId(notifId);
    try {
      await declineFriendRequest({ variables: { userId: senderId } });
      setHandledRequests((prev) => ({ ...prev, [notifId]: 'declined' }));
      await deleteNotification({ variables: { id: notifId } });
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to decline request');
    } finally {
      setActioningId(null);
    }
  }, [declineFriendRequest, deleteNotification]);

  // Not polling this for now (out of current scope — Feed + Chat only).
  // GET_NOTIFICATIONS above still refreshes on its own triggers (mount,
  // refetchQueries after markAllRead), so counts aren't permanently stale,
  // just not push-live.
  useSubscription(NEW_NOTIFICATION_SUB, {
    skip: !user || !subscriptionsEnabled,
    onData: ({ data }) => {
      if (data.data?.newNotification) incrementUnread();
    },
  });

  // Sync unread count from server
  useEffect(() => {
    if (notifsData?.unreadNotificationsCount !== undefined) {
      setUnreadCount(notifsData.unreadNotificationsCount);
    }
  }, [notifsData?.unreadNotificationsCount, setUnreadCount]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      const q = searchText.trim();
      if (q.length >= 2) searchUsers({ variables: { query: q } });
    }, 300);
    return () => clearTimeout(t);
  }, [searchText, searchUsers]);

  // Close all panels on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setShowNotifs(false);
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close panels on route change
  useEffect(() => {
    setShowSearch(false);
    setShowNotifs(false);
    setShowProfile(false);
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
    setUnreadCount(0);
  }, [markAllRead, setUnreadCount]);

  const handleLogout = useCallback(() => {
    setShowProfile(false);
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Shared between the desktop inline search box and the mobile search
  // overlay so both stay in sync instead of duplicating result-rendering.
  const renderSearchResults = (onSelect?: () => void) => (
    <>
      {searchLoading && (
        <div className="px-4 py-3 text-sm text-gray-400 text-center">Searching…</div>
      )}
      {!searchLoading && (searchData?.searchUsers ?? []).length === 0 && (
        <div className="px-4 py-4 text-sm text-gray-500 text-center">No results for "{searchText}"</div>
      )}
      {(searchData?.searchUsers ?? []).map((u: any) => (
        <Link
          key={u.id}
          to={`/profile/${u.username}`}
          onClick={() => { setShowSearch(false); setSearchText(''); onSelect?.(); }}
          role="option"
          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors"
        >
          <Avatar src={u.avatar} name={u.fullName} size="sm" isOnline={u.isOnline} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.fullName}</p>
            <p className="text-xs text-gray-500">@{u.username}</p>
          </div>
          {u.isFriend && (
            <span className="ml-auto text-xs text-brand-500 font-medium flex-shrink-0">Friend</span>
          )}
        </Link>
      ))}
    </>
  );

  return (
    <>
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-surface-dark-2 border-b border-gray-200 dark:border-gray-700 z-40 flex items-center px-2 sm:px-4 gap-1 sm:gap-2"
    >
      {/* ── Hamburger (mobile/tablet, <lg) ──────────
          The LeftSidebar (Friends/Watch/Marketplace/Saved/Events, dark
          mode, Settings, Log Out) is `hidden lg:block`, so below `lg`
          this is the only way to reach any of that — including logging
          out, which the profile dropdown deliberately doesn't repeat. */}
      <button
        onClick={toggleMobileMenu}
        aria-label="Open navigation menu"
        className="lg:hidden flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <Menu size={19} className="text-gray-700 dark:text-gray-200" />
      </button>

      {/* ── Logo ─────────────────────────────────── */}
      <Link to="/" aria-label="Home" className="flex-shrink-0">
        <Logo size={34} />
      </Link>

      {/* ── Search (tablet/desktop: inline box, ≥sm) ── */}
      <div ref={searchRef} className="relative flex-shrink-0 hidden sm:block">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-surface-dark-3 rounded-full px-3 py-2 w-52">
          <Search size={15} className="text-gray-400 flex-shrink-0" aria-hidden />
          <input
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search PluseConnect"
            aria-label="Search"
            className="bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400 w-full"
          />
          {searchText && (
            <button onClick={() => { setSearchText(''); setShowSearch(false); }} aria-label="Clear search">
              <X size={13} className="text-gray-400" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {showSearch && searchText.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              role="listbox"
              aria-label="Search results"
              className="absolute top-full mt-2 left-0 w-76 bg-white dark:bg-surface-dark-2 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50"
            >
              {renderSearchResults()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Search (mobile: icon toggles full-width overlay, <sm) ── */}
      <div className="relative flex-shrink-0 sm:hidden">
        <button
          onClick={() => setShowMobileSearch((v) => !v)}
          aria-label="Search"
          aria-expanded={showMobileSearch}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <Search size={17} className="text-gray-700 dark:text-gray-200" />
        </button>

        <AnimatePresence>
          {showMobileSearch && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="fixed top-14 left-0 right-0 z-50 bg-white dark:bg-surface-dark-2 border-b border-gray-200 dark:border-gray-700 shadow-lg"
            >
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-surface-dark-3 rounded-full px-3 py-2 m-3">
                <Search size={15} className="text-gray-400 flex-shrink-0" aria-hidden />
                <input
                  autoFocus
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setShowSearch(true); }}
                  placeholder="Search PluseConnect"
                  aria-label="Search"
                  className="bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400 w-full"
                />
                <button
                  onClick={() => { setShowMobileSearch(false); setSearchText(''); setShowSearch(false); }}
                  aria-label="Close search"
                >
                  <X size={15} className="text-gray-400" />
                </button>
              </div>
              {searchText.trim().length >= 2 && (
                <div role="listbox" aria-label="Search results" className="max-h-[70vh] overflow-y-auto border-t border-gray-100 dark:border-gray-700">
                  {renderSearchResults(() => setShowMobileSearch(false))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Center tabs ──────────────────────────── */}
      <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center" role="navigation" aria-label="Main navigation">
        {NAV_TABS.map(({ to, icon: Icon, label }) => {
          // ✅ Fix: use location.pathname from useLocation()
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative px-10 py-2.5 rounded-xl transition-colors',
                isActive
                  ? 'text-brand-500'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3'
              )}
            >
              <Icon size={22} />
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 left-4 right-4 h-[3px] bg-brand-500 rounded-t-full"
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Right actions ────────────────────────── */}
      <div className="flex items-center gap-1 sm:gap-2 ml-auto">
        {/* Messages */}
        <button
          onClick={() => navigate('/messages')}
          aria-label="Messages"
          className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <MessageCircle size={18} className="text-gray-700 dark:text-gray-200" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs((v) => !v); setShowProfile(false); }}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            aria-expanded={showNotifs}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Bell size={19} className="text-gray-700 dark:text-gray-200" />
            {unreadCount > 0 && (
              <motion.span
                key={unreadCount}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ duration: 0.13 }}
                role="dialog"
                aria-label="Notifications panel"
                className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-full mt-0 sm:mt-2 w-auto sm:w-96 bg-white dark:bg-surface-dark-2 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h2>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-brand-500 font-medium hover:text-brand-600 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <ul className="overflow-y-auto max-h-[480px] divide-y divide-gray-50 dark:divide-gray-700/50">
                  {(notifsData?.notifications ?? []).length === 0 ? (
                    <li className="p-8 text-center text-gray-400">No notifications yet</li>
                  ) : (
                    (notifsData?.notifications ?? []).map((n: any) => {
                      const isFriendReq = n.type === 'FRIEND_REQUEST';
                      const handled = handledRequests[n.id];
                      const isActioning = actioningId === n.id;
                      return (
                        <li
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors cursor-pointer',
                            !n.isRead && 'bg-blue-50/60 dark:bg-blue-900/10'
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <Avatar src={n.sender.avatar} name={n.sender.fullName} size="md" />
                            <span className="absolute -bottom-1 -right-1 text-xs">
                              {NOTIF_ICONS[n.type] ?? '🔔'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-gray-100 leading-snug">{n.message}</p>
                            <p className="text-xs text-brand-500 mt-0.5">{timeAgo(n.createdAt)}</p>

                            {isFriendReq && (
                              <div className="mt-2">
                                {handled === 'accepted' ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                                    <Check size={13} /> Friend request accepted
                                  </span>
                                ) : handled === 'declined' ? (
                                  <span className="text-xs font-medium text-gray-400">Request declined</span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleAcceptRequest(n.id, n.sender.id); }}
                                      disabled={isActioning}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                                    >
                                      <Check size={13} /> Confirm
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeclineRequest(n.id, n.sender.id); }}
                                      disabled={isActioning}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-surface-dark-3 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg transition-colors"
                                    >
                                      <UserX size={13} /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {!n.isRead && (
                            <div className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile menu */}
        <div className="relative">
          <button
            onClick={() => { setShowProfile((v) => !v); setShowNotifs(false); }}
            aria-label="Account menu"
            aria-expanded={showProfile}
            className="flex items-center gap-1 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
          >
            <Avatar src={user?.avatar} name={user?.fullName ?? 'User'} size="sm" />
            <ChevronDown size={13} className="text-gray-500" />
          </button>

          <AnimatePresence>
            {showProfile && user && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ duration: 0.13 }}
                role="menu"
                className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-full mt-0 sm:mt-2 w-auto sm:w-72 bg-white dark:bg-surface-dark-2 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50"
              >
                <Link
                  to={`/profile/${user.username}`}
                  role="menuitem"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors"
                >
                  <Avatar src={user.avatar} name={user.fullName} size="md" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{user.fullName}</p>
                    <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                  </div>
                </Link>
                <div className="border-t border-gray-100 dark:border-gray-700 p-2 space-y-0.5">
                  {/* ✅ Fix: Log Out is now here too, not just in the
                      LeftSidebar — that sidebar is `hidden lg:block`, so on
                      mobile this dropdown was the only account menu in
                      reach and it had no way to log out at all. */}
                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors flex items-center gap-2.5"
                  >
                    <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center flex-shrink-0">
                      <Settings size={15} />
                    </span>
                    <span>Settings &amp; Privacy</span>
                  </Link>
                  <Link
                    to="/saved"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors flex items-center gap-2.5"
                  >
                    <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center flex-shrink-0">
                      <Bookmark size={15} />
                    </span>
                    <span>Saved</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2.5"
                  >
                    <span className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                      <LogOut size={15} />
                    </span>
                    <span>Log Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
    <MobileSidebarDrawer />
    </>
  );
}
