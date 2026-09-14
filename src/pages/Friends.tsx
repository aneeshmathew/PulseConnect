import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Check, X, UserPlus, UserMinus, Users } from 'lucide-react';
import {
  GET_USER, GET_FRIEND_REQUESTS, GET_SENT_FRIEND_REQUESTS, GET_SUGGESTED_FRIENDS,
  SEND_FRIEND_REQUEST, ACCEPT_FRIEND_REQUEST, DECLINE_FRIEND_REQUEST,
  CANCEL_FRIEND_REQUEST, REMOVE_FRIEND,
} from '@/lib/graphql';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore, useUIStore } from '@/store';
import { timeAgo, cn } from '@/utils';
import { AppLayout } from './Home';
import toast from 'react-hot-toast';

const TABS = ['All Friends', 'Requests', 'Suggestions'] as const;
type Tab = typeof TABS[number];

export function FriendsPage() {
  const { user } = useAuthStore();
  const { openChatWithUser } = useUIStore();
  const [activeTab, setActiveTab] = useState<Tab>('All Friends');
  const [search, setSearch] = useState('');
  // Tracks which specific card has a mutation in flight, so only that
  // card's buttons disable/spin rather than the whole tab.
  const [actioningId, setActioningId] = useState<string | null>(null);

  const { data: userData, loading: friendsLoading } = useQuery(GET_USER, {
    variables: { id: user?.id },
    skip: !user?.id || activeTab !== 'All Friends',
  });

  const { data: reqData, loading: reqLoading, refetch: refetchRequests } = useQuery(GET_FRIEND_REQUESTS, {
    skip: activeTab !== 'Requests',
  });
  const { data: sentData, loading: sentLoading, refetch: refetchSent } = useQuery(GET_SENT_FRIEND_REQUESTS, {
    skip: activeTab !== 'Requests',
  });

  const { data: suggData, loading: suggLoading, refetch: refetchSuggestions } = useQuery(GET_SUGGESTED_FRIENDS, {
    skip: activeTab !== 'Suggestions',
  });

  const [sendFriendRequest] = useMutation(SEND_FRIEND_REQUEST);
  const [acceptFriendRequest] = useMutation(ACCEPT_FRIEND_REQUEST);
  const [declineFriendRequest] = useMutation(DECLINE_FRIEND_REQUEST);
  const [cancelFriendRequest] = useMutation(CANCEL_FRIEND_REQUEST);
  const [removeFriend] = useMutation(REMOVE_FRIEND);

  const friends = useMemo(() => {
    const list = userData?.user?.friends ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((f: any) =>
      f.fullName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  }, [userData, search]);

  const incomingRequests = reqData?.friendRequests ?? [];
  const sentRequests = sentData?.sentFriendRequests ?? [];
  const suggestions = suggData?.suggestedFriends ?? [];

  const handleAccept = useCallback(async (fromId: string, name: string) => {
    setActioningId(fromId);
    try {
      await acceptFriendRequest({ variables: { userId: fromId } });
      toast.success(`You and ${name} are now friends! 🎉`);
      refetchRequests();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to accept request');
    } finally {
      setActioningId(null);
    }
  }, [acceptFriendRequest, refetchRequests]);

  const handleDecline = useCallback(async (fromId: string) => {
    setActioningId(fromId);
    try {
      await declineFriendRequest({ variables: { userId: fromId } });
      refetchRequests();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to decline request');
    } finally {
      setActioningId(null);
    }
  }, [declineFriendRequest, refetchRequests]);

  const handleCancel = useCallback(async (recipientId: string) => {
    setActioningId(recipientId);
    try {
      await cancelFriendRequest({ variables: { userId: recipientId } });
      refetchSent();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to cancel request');
    } finally {
      setActioningId(null);
    }
  }, [cancelFriendRequest, refetchSent]);

  const handleAdd = useCallback(async (userId: string, name: string) => {
    setActioningId(userId);
    try {
      await sendFriendRequest({ variables: { userId } });
      toast.success(`Friend request sent to ${name}`);
      refetchSuggestions();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to send request');
    } finally {
      setActioningId(null);
    }
  }, [sendFriendRequest, refetchSuggestions]);

  const handleRemove = useCallback(async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from your friends?`)) return;
    setActioningId(userId);
    try {
      await removeFriend({ variables: { userId } });
      toast.success(`Removed ${name} from friends`);
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to remove friend');
    } finally {
      setActioningId(null);
    }
  }, [removeFriend]);

  return (
    <AppLayout>
      <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users size={22} className="text-brand-500" />
              Friends
            </h1>
            {incomingRequests.length > 0 && activeTab !== 'Requests' && (
              <button
                onClick={() => setActiveTab('Requests')}
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              >
                {incomingRequests.length} pending
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'relative px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors',
                  activeTab === tab
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-dark-3'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {/* ── All Friends ──────────────────────────────────────────── */}
          {activeTab === 'All Friends' && (
            <>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-surface-dark-3 rounded-full px-3.5 py-2 mb-4 max-w-sm">
                <Search size={15} className="text-gray-400 flex-shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your friends"
                  className="bg-transparent text-sm outline-none w-full text-gray-900 dark:text-white placeholder:text-gray-400"
                />
              </div>

              {friendsLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />
                  ))}
                </div>
              )}

              {!friendsLoading && friends.length === 0 && (
                <EmptyState
                  icon={Users}
                  title={search ? 'No matches' : 'No friends yet'}
                  description={search ? `Nobody matches "${search}"` : 'People you become friends with will show up here.'}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {friends.map((f: any) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                    <Avatar src={f.avatar} name={f.fullName} size="md" isOnline={f.isOnline} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{f.fullName}</p>
                      <p className="text-xs text-gray-400 truncate">@{f.username}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => openChatWithUser({ id: f.id, fullName: f.fullName, avatar: f.avatar, isOnline: f.isOnline, username: f.username })}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors"
                      >
                        Message
                      </button>
                      <button
                        onClick={() => handleRemove(f.id, f.fullName)}
                        disabled={actioningId === f.id}
                        aria-label={`Remove ${f.fullName}`}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-surface-dark-3 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-500 transition-colors"
                      >
                        <UserMinus size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Requests ─────────────────────────────────────────────── */}
          {activeTab === 'Requests' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                  Friend Requests {incomingRequests.length > 0 && `(${incomingRequests.length})`}
                </h2>
                {reqLoading && <CardSkeleton />}
                {!reqLoading && incomingRequests.length === 0 && (
                  <EmptyState icon={UserPlus} title="No pending requests" description="Friend requests you receive will show up here." />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AnimatePresence>
                    {incomingRequests.map((r: any) => (
                      <motion.div
                        key={r.from.id}
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                      >
                        <Avatar src={r.from.avatar} name={r.from.fullName} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.from.fullName}</p>
                          <p className="text-xs text-gray-400">{timeAgo(r.sentAt)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleAccept(r.from.id, r.from.fullName)}
                            disabled={actioningId === r.from.id}
                            aria-label="Confirm"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white transition-colors"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => handleDecline(r.from.id)}
                            disabled={actioningId === r.from.id}
                            aria-label="Delete"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-surface-dark-3 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-500 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {(sentLoading || sentRequests.length > 0) && (
                <div>
                  <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Sent Requests</h2>
                  {sentLoading && <CardSkeleton />}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AnimatePresence>
                      {sentRequests.map((u: any) => (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                        >
                          <Avatar src={u.avatar} name={u.fullName} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.fullName}</p>
                            <p className="text-xs text-gray-400 truncate">Request pending</p>
                          </div>
                          <button
                            onClick={() => handleCancel(u.id)}
                            disabled={actioningId === u.id}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-surface-dark-3 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0"
                          >
                            Cancel
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Suggestions ──────────────────────────────────────────── */}
          {activeTab === 'Suggestions' && (
            <>
              {suggLoading && <CardSkeleton />}
              {!suggLoading && suggestions.length === 0 && (
                <EmptyState icon={UserPlus} title="No suggestions right now" description="Check back later for people you may know." />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence>
                  {suggestions.map((u: any) => (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                    >
                      <Avatar src={u.avatar} name={u.fullName} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.fullName}</p>
                        <p className="text-xs text-gray-400 truncate">{u.location || `@${u.username}`}</p>
                      </div>
                      <button
                        onClick={() => handleAdd(u.id, u.fullName)}
                        disabled={actioningId === u.id}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white transition-colors flex-shrink-0"
                      >
                        <UserPlus size={13} /> Add
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center mb-3">
        <Icon size={20} className="text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
    </div>
  );
}
