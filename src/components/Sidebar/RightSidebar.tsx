import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import { UserPlus, Loader2 } from 'lucide-react';
import { GET_SUGGESTED_FRIENDS, GET_CONVERSATIONS, SEND_FRIEND_REQUEST } from '@/lib/graphql';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore, useUIStore } from '@/store';
import { timeAgo, cn } from '@/utils';
import toast from 'react-hot-toast';

function OnlineContact({ conversation }: { conversation: any }) {
  const { user } = useAuthStore();
  const { openChat } = useUIStore();

  // ✅ Fix: find other participant using the current user's id, not index[0]
  const other =
    conversation.participants.find((p: any) => p.id !== user?.id) ??
    conversation.participants[0];

  if (!other) return null;

  const preview = conversation.isTyping
    ? 'typing…'
    : conversation.lastMessage?.isDeleted
    ? 'Message deleted'
    : conversation.lastMessage?.content ?? '';

  return (
    <button
      onClick={() => openChat(conversation.id)}
      className="flex items-center gap-3 px-2 py-2 w-full rounded-xl hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors text-left group"
    >
      <Avatar src={other.avatar} name={other.fullName} size="sm" isOnline={other.isOnline} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{other.fullName}</p>
        <p className={cn(
          'text-xs truncate',
          conversation.isTyping ? 'text-brand-500 font-medium' : 'text-gray-500 dark:text-gray-400'
        )}>
          {preview || '\u00a0'}
        </p>
      </div>
      {conversation.unreadCount > 0 && (
        <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
          {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
        </span>
      )}
    </button>
  );
}

function SuggestedPerson({ person }: { person: any }) {
  const [sent, setSent] = useState(false);
  const [sendRequest, { loading }] = useMutation(SEND_FRIEND_REQUEST);

  const handleAdd = useCallback(async () => {
    if (sent || loading) return;
    try {
      await sendRequest({ variables: { userId: person.id } });
      setSent(true);
      toast.success(`Request sent to ${person.firstName}!`);
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to send request');
    }
  }, [sent, loading, sendRequest, person]);

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors group">
      <Link to={`/profile/${person.username}`} tabIndex={-1}>
        <Avatar src={person.avatar} name={person.fullName} size="sm" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/profile/${person.username}`}
          className="text-sm font-medium text-gray-900 dark:text-white hover:underline truncate block"
        >
          {person.fullName}
        </Link>
        <p className="text-xs text-gray-500 truncate">
          {person.friendsCount > 0 ? `${person.friendsCount} mutual friend${person.friendsCount !== 1 ? 's' : ''}` : 'Suggested for you'}
        </p>
      </div>
      <button
        onClick={handleAdd}
        disabled={sent || loading}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex-shrink-0',
          sent
            ? 'bg-gray-100 dark:bg-surface-dark-3 text-gray-500 cursor-default'
            : 'bg-blue-50 dark:bg-blue-900/20 text-brand-500 hover:bg-blue-100 dark:hover:bg-blue-900/30'
        )}
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : sent ? '✓ Sent' : <><UserPlus size={11} /> Add</>}
      </button>
    </div>
  );
}

export function RightSidebar() {
  const { user } = useAuthStore();
  const { data: convData } = useQuery(GET_CONVERSATIONS, { skip: !user });
  const { data: sugData } = useQuery(GET_SUGGESTED_FRIENDS, { skip: !user });

  const conversations = convData?.conversations?.slice(0, 8) ?? [];
  const suggested = sugData?.suggestedFriends?.slice(0, 6) ?? [];

  return (
    <aside className="w-72 h-[calc(100vh-56px)] sticky top-14 overflow-y-auto scrollbar-hide py-4 px-2 space-y-6">
      {/* Sponsored */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-2 mb-2">Sponsored</h3>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-surface-dark-3 cursor-pointer transition-colors">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Build Something Great</p>
            <p className="text-xs text-gray-500 mt-0.5">example.com</p>
          </div>
        </div>
      </section>

      {/* People you may know */}
      {suggested.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">People You May Know</h3>
            <Link to="/friends" className="text-xs text-brand-500 font-medium hover:underline">See all</Link>
          </div>
          <div className="space-y-0.5">
            {suggested.map((u: any) => (
              <SuggestedPerson key={u.id} person={u} />
            ))}
          </div>
        </section>
      )}

      {/* Contacts */}
      {conversations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-2 mb-2">Contacts</h3>
          <div className="space-y-0.5">
            {conversations.map((c: any) => (
              <OnlineContact key={c.id} conversation={c} />
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
