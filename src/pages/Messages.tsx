import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useLazyQuery } from '@apollo/client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Send, Phone, Video, Info, Edit, ArrowLeft, MessageCircle, X } from 'lucide-react';
import { GET_CONVERSATIONS, SEARCH_USERS } from '@/lib/graphql';
import { subscriptionsEnabled, POLL_INTERVAL_MS } from '@/lib/apollo';
import { Avatar } from '@/components/UI/Avatar';
import { AppLayout } from './Home';
import { useAuthStore } from '@/store';
import { formatMessageTime, timeAgo, cn } from '@/utils';
import { useConversationChat } from '@/hooks/useConversationChat';

export function MessagesPage() {
  const { user } = useAuthStore();
  const { conversationId: paramConvId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [activeConvId, setActiveConvId] = useState<string | null>(paramConvId ?? null);
  // Set when starting a message with someone you don't have a conversation
  // with yet — same "pending" concept as the floating chat popup
  // (components/Chat/ChatPanel.tsx). No conversationId exists until the
  // first message is actually sent.
  const [pendingRecipient, setPendingRecipient] = useState<any | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMsgSearch, setNewMsgSearch] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);
  const newMessagePopoverRef = useRef<HTMLDivElement>(null);

  const { data: convsData } = useQuery(GET_CONVERSATIONS, {
    skip: !user,
    pollInterval: subscriptionsEnabled ? 0 : POLL_INTERVAL_MS.conversationsList,
  });

  const conversations = convsData?.conversations ?? [];
  const activeConv = conversations.find((c: any) => c.id === activeConvId);
  const otherParticipant = activeConv?.participants?.find((p: any) => p.id !== user?.id)
    ?? activeConv?.participants?.[0]
    ?? pendingRecipient; // starting a new conversation — no activeConv exists yet

  const {
    text, setText, messages, otherTyping, sending, handleTyping, handleSend,
  } = useConversationChat({
    conversationId: activeConvId,
    recipient: pendingRecipient,
    limit: 50,
    // No "minimized" concept on the full page — always mark read while a
    // conversation is selected, matching the original behavior exactly.
    markReadEnabled: true,
    onConversationCreated: (newId) => {
      setActiveConvId(newId);
      setPendingRecipient(null);
    },
  });
  const [searchUsers, { data: userSearchData, loading: userSearchLoading }] = useLazyQuery(SEARCH_USERS);

  // Debounced user search for the "New message" popover
  useEffect(() => {
    const q = newMsgSearch.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => searchUsers({ variables: { query: q } }), 300);
    return () => clearTimeout(t);
  }, [newMsgSearch, searchUsers]);

  // Close the "New message" popover on outside click / Escape
  useEffect(() => {
    if (!showNewMessage) return;
    const handleClick = (e: MouseEvent) => {
      if (newMessagePopoverRef.current && !newMessagePopoverRef.current.contains(e.target as Node)) {
        setShowNewMessage(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNewMessage(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showNewMessage]);

  const rowVirtualizer = useVirtualizer({
    count: messages.length + (otherTyping ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 56,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, activeConvId]);

  const handleSelectConv = useCallback((id: string) => {
    setActiveConvId(id);
    setPendingRecipient(null);
  }, []);

  const handleStartNewMessage = useCallback((recipient: any) => {
    // If a conversation with this person already exists, just open it —
    // don't create a duplicate. `conversations` is already loaded via
    // GET_CONVERSATIONS, so this is a plain client-side lookup.
    const existing = conversations.find((c: any) =>
      c.participants?.some((p: any) => p.id === recipient.id)
    );
    if (existing) {
      handleSelectConv(existing.id);
    } else {
      setActiveConvId(null);
      setPendingRecipient(recipient);
    }
    setShowNewMessage(false);
    setNewMsgSearch('');
  }, [conversations, handleSelectConv]);

  const filteredConvs = conversations.filter((c: any) => {
    if (!searchText.trim()) return true;
    const other = c.participants?.find((p: any) => p.id !== user?.id) ?? c.participants?.[0];
    return other?.fullName?.toLowerCase().includes(searchText.toLowerCase());
  });

  return (
    <AppLayout>
      <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card overflow-hidden flex"
        style={{ height: 'calc(100vh - 88px)' }}>

        {/* ── Conversation list ───────────────────────────────────────── */}
        <div className={cn(
          'w-full md:w-80 flex-shrink-0 flex flex-col border-r border-gray-100 dark:border-gray-700',
          activeConvId ? 'hidden md:flex' : 'flex'
        )}>
          <div className="p-4 flex-shrink-0 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chats</h1>
              <div className="flex items-center gap-1.5">
                <div className="relative" ref={newMessagePopoverRef}>
                  <button
                    onClick={() => setShowNewMessage((v) => !v)}
                    aria-label="New message"
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                      showNewMessage
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    <Edit size={14} />
                  </button>

                  <AnimatePresence>
                    {showNewMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-surface-dark-2 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50"
                      >
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">New message</p>
                          <div className="flex items-center gap-2 bg-gray-100 dark:bg-surface-dark-3 rounded-full px-3 py-2">
                            <Search size={14} className="text-gray-400 flex-shrink-0" aria-hidden />
                            <input
                              autoFocus
                              value={newMsgSearch}
                              onChange={(e) => setNewMsgSearch(e.target.value)}
                              placeholder="Search people…"
                              className="bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400 w-full"
                            />
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {newMsgSearch.trim().length < 2 && (
                            <p className="px-4 py-4 text-sm text-gray-400 text-center">Type at least 2 characters</p>
                          )}
                          {newMsgSearch.trim().length >= 2 && userSearchLoading && (
                            <p className="px-4 py-4 text-sm text-gray-400 text-center">Searching…</p>
                          )}
                          {newMsgSearch.trim().length >= 2 && !userSearchLoading && (userSearchData?.searchUsers ?? []).length === 0 && (
                            <p className="px-4 py-4 text-sm text-gray-400 text-center">No results for "{newMsgSearch}"</p>
                          )}
                          {(userSearchData?.searchUsers ?? [])
                            .filter((u: any) => u.id !== user?.id)
                            .map((u: any) => (
                              <button
                                key={u.id}
                                onClick={() => handleStartNewMessage(u)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors text-left"
                              >
                                <Avatar src={u.avatar} name={u.fullName} size="sm" isOnline={u.isOnline} />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.fullName}</p>
                                  <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                                </div>
                              </button>
                            ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => navigate('/')}
                  aria-label="Close messages"
                  title="Back to Home"
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <X size={15} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-surface-dark-3 rounded-full px-3 py-2">
              <Search size={14} className="text-gray-400" aria-hidden />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search Messenger"
                className="bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400 flex-1"
              />
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 && (
              <li className="p-6 text-center text-sm text-gray-400">No conversations found</li>
            )}
            {filteredConvs.map((conv: any) => {
              const other = conv.participants?.find((p: any) => p.id !== user?.id) ?? conv.participants?.[0];
              const isActive = conv.id === activeConvId;
              const lastMsgText = conv.lastMessage?.isDeleted
                ? 'Message deleted'
                : conv.lastMessage?.content || 'No messages yet';

              return (
                <li key={conv.id}>
                  <button
                    onClick={() => handleSelectConv(conv.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors text-left',
                      isActive && 'bg-blue-50 dark:bg-blue-900/20'
                    )}
                  >
                    <Avatar src={other?.avatar} name={other?.fullName ?? '?'} size="md" isOnline={other?.isOnline} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {conv.isGroup ? conv.groupName : other?.fullName}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                          {timeAgo(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className={cn(
                        'text-xs truncate mt-0.5',
                        conv.unreadCount > 0
                          ? 'font-semibold text-gray-900 dark:text-white'
                          : 'text-gray-500'
                      )}>
                        {conv.isTyping ? <span className="text-brand-500">typing…</span> : lastMsgText}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Chat area ───────────────────────────────────────────────── */}
        {(activeConvId || pendingRecipient) && otherParticipant ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => { setActiveConvId(null); setPendingRecipient(null); }}
                className="md:hidden text-brand-500 mr-1"
                aria-label="Back to conversations"
              >
                <ArrowLeft size={20} />
              </button>
              <Avatar src={otherParticipant.avatar} name={otherParticipant.fullName} size="md" isOnline={otherParticipant.isOnline} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white truncate">{otherParticipant.fullName}</p>
                <p className="text-xs text-gray-500">
                  {otherTyping
                    ? <span className="text-brand-500 font-medium">typing…</span>
                    : otherParticipant.isOnline ? 'Active now' : 'Offline'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label="Voice call" className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 flex items-center justify-center text-brand-500">
                  <Phone size={18} />
                </button>
                <button aria-label="Video call" className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 flex items-center justify-center text-brand-500">
                  <Video size={18} />
                </button>
                <button aria-label="Conversation info" className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 flex items-center justify-center text-brand-500">
                  <Info size={18} />
                </button>
              </div>
            </div>

            {/* Virtualized messages */}
            <div ref={parentRef} className="flex-1 overflow-y-auto px-4 py-2">
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', minHeight: '100%' }}>
                {rowVirtualizer.getVirtualItems().map((vItem) => {
                  const isTypingSlot = vItem.index === messages.length && otherTyping;
                  const msg = messages[vItem.index];

                  return (
                    <div
                      key={vItem.key}
                      data-index={vItem.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        width: '100%',
                        transform: `translateY(${vItem.start}px)`,
                        paddingBottom: '4px',
                      }}
                    >
                      {isTypingSlot ? (
                        <div className="flex items-end gap-2 pb-1">
                          <Avatar src={otherParticipant.avatar} name={otherParticipant.fullName} size="xs" />
                          <div className="bg-gray-100 dark:bg-surface-dark-3 rounded-2xl rounded-bl-sm px-3 py-2.5 flex gap-1 items-center">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </div>
                        </div>
                      ) : msg ? (
                        <div
                          className={cn(
                            'flex items-end gap-2 group',
                            msg.sender?.id === user?.id ? 'flex-row-reverse' : 'flex-row'
                          )}
                        >
                          {msg.sender?.id !== user?.id && (
                            <Avatar src={otherParticipant.avatar} name={otherParticipant.fullName} size="xs" />
                          )}
                          <div className={cn(
                            'max-w-[65%] flex flex-col',
                            msg.sender?.id === user?.id ? 'items-end' : 'items-start'
                          )}>
                            <div className={cn(
                              'px-4 py-2.5 rounded-2xl text-sm break-words',
                              msg.sender?.id === user?.id
                                ? 'bg-brand-500 text-white rounded-br-sm'
                                : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-900 dark:text-white rounded-bl-sm',
                              msg.isDeleted && 'italic opacity-60'
                            )}>
                              {msg.isDeleted ? 'This message was deleted' : msg.content}
                            </div>
                            <span className="text-[10px] text-gray-400 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <div className="flex-1 flex items-center bg-gray-100 dark:bg-surface-dark-3 rounded-full px-4 py-2.5">
                <input
                  value={text}
                  onChange={(e) => { setText(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Aa"
                  maxLength={20000}
                  className="flex-1 bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                aria-label="Send"
                className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center">
              <MessageCircle size={32} className="opacity-50" />
            </div>
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">Your Messages</p>
            <p className="text-sm">Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
