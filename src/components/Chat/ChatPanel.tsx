import { useState, useRef, useEffect, memo } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Phone, Video, Info, Image, Smile } from 'lucide-react';
import {
  GET_CONVERSATIONS, CONVERSATION_WITH_USER,
} from '@/lib/graphql';
import { subscriptionsEnabled, POLL_INTERVAL_MS } from '@/lib/apollo';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore, useUIStore } from '@/store';
import { formatMessageTime, cn } from '@/utils';
import { useConversationChat } from '@/hooks/useConversationChat';

// ─── Typing dots ──────────────────────────────────────────────────────────────

const TypingIndicator = memo(function TypingIndicator({ avatar, name }: { avatar?: string | null; name: string }) {
  return (
    <div className="flex items-end gap-1.5 pb-1">
      <Avatar src={avatar} name={name} size="xs" />
      <div className="bg-gray-100 dark:bg-surface-dark-3 rounded-2xl rounded-bl-sm px-3 py-2.5 flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
});

// ─── Single bubble ────────────────────────────────────────────────────────────

interface BubbleProps {
  msg: any;
  isMine: boolean;
  otherAvatar?: string | null;
  otherName: string;
}

const Bubble = memo(function Bubble({ msg, isMine, otherAvatar, otherName }: BubbleProps) {
  return (
    <div className={cn('flex items-end gap-1.5 pb-1 group', isMine ? 'flex-row-reverse' : 'flex-row')}>
      {!isMine && <Avatar src={otherAvatar} name={otherName} size="xs" />}

      <div className={cn('max-w-[70%] flex flex-col', isMine ? 'items-end' : 'items-start')}>
        {msg.replyTo && (
          <div
            className={cn(
              'text-xs px-2.5 py-1.5 rounded-xl mb-0.5 opacity-75 max-w-full',
              isMine ? 'bg-blue-400 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
            )}
          >
            <p className="font-semibold truncate">{msg.replyTo.sender?.firstName}</p>
            <p className="truncate">{msg.replyTo.content}</p>
          </div>
        )}

        <div
          className={cn(
            'px-3 py-2 rounded-2xl text-sm break-words',
            isMine
              ? 'bg-brand-500 text-white rounded-br-sm'
              : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-900 dark:text-white rounded-bl-sm',
            msg.isDeleted && 'italic opacity-60'
          )}
        >
          {msg.isDeleted ? 'This message was deleted' : msg.content}
        </div>

        {msg.reactions?.length > 0 && (
          <div className={cn('flex gap-0.5 mt-0.5', isMine ? 'flex-row-reverse' : 'flex-row')}>
            {msg.reactions.map((r: any, i: number) => (
              <span key={i} className="text-sm">{r.emoji}</span>
            ))}
          </div>
        )}

        <span className="text-[10px] text-gray-400 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatMessageTime(msg.createdAt)}
        </span>
      </div>
    </div>
  );
});

// ─── Chat window ─────────────────────────────────────────────────────────────

interface ChatWindowProps {
  // null means: we're messaging this person for the first time — no
  // conversation exists yet. Message history/typing/read-receipts are all
  // skipped until the first message is sent and the server creates one
  // (see handleSend below).
  conversationId: string | null;
  participant: any; // the OTHER person in the DM
}

const ChatWindow = memo(function ChatWindow({ conversationId, participant }: ChatWindowProps) {
  const { user } = useAuthStore();
  const { closeChat, openChat } = useUIStore();
  const [minimized, setMinimized] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    text, setText, messages, otherTyping, sending, handleTyping, handleSend,
  } = useConversationChat({
    conversationId,
    recipient: participant,
    limit: 40,
    // Only mark as read while the popup is actually open and not
    // collapsed — matches the original behavior exactly.
    markReadEnabled: !minimized,
    onConversationCreated: (newId) => openChat(newId),
  });

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: messages.length + (otherTyping ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 52,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);


  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="w-[340px] bg-white dark:bg-surface-dark-2 rounded-t-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
      style={{ maxHeight: minimized ? 52 : 480 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-gray-700 cursor-pointer select-none flex-shrink-0"
        onClick={() => setMinimized((v) => !v)}
      >
        <Avatar src={participant.avatar} name={participant.fullName} size="sm" isOnline={participant.isOnline} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{participant.fullName}</p>
          <p className="text-xs text-gray-400">
            {otherTyping
              ? <span className="text-brand-500">typing…</span>
              : participant.isOnline ? 'Active now' : 'Offline'}
          </p>
        </div>
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <button aria-label="Voice call" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-brand-500">
            <Phone size={14} />
          </button>
          <button aria-label="Video call" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-brand-500">
            <Video size={14} />
          </button>
          <button
            aria-label="Close chat"
            onClick={() => closeChat()}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-gray-500"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div ref={parentRef} className="flex-1 overflow-y-auto px-3 py-2" style={{ height: 360 }}>
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vItem) => {
                const isTypingSlot = vItem.index === messages.length;

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
                    }}
                  >
                    {isTypingSlot && otherTyping ? (
                      <TypingIndicator avatar={participant.avatar} name={participant.fullName} />
                    ) : (
                      <Bubble
                        msg={messages[vItem.index]}
                        isMine={messages[vItem.index]?.sender?.id === user?.id}
                        otherAvatar={participant.avatar}
                        otherName={participant.fullName}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button aria-label="Emoji" className="text-brand-500 hover:text-brand-600 flex-shrink-0">
              <Smile size={20} />
            </button>
            <button aria-label="Attach image" className="text-brand-500 hover:text-brand-600 flex-shrink-0">
              <Image size={20} />
            </button>
            <div className="flex-1 bg-gray-100 dark:bg-surface-dark-3 rounded-full px-3 py-1.5">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => { setText(e.target.value); handleTyping(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Aa"
                maxLength={20000}
                className="w-full bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              aria-label="Send message"
              className="text-brand-500 disabled:text-gray-300 dark:disabled:text-gray-600 hover:text-brand-600 transition-colors flex-shrink-0 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
});

// ─── Panel container ──────────────────────────────────────────────────────────

export function ChatPanel() {
  const { chatOpen, activeChatId, pendingRecipient, openChat } = useUIStore();
  const { user } = useAuthStore();

  const { data } = useQuery(GET_CONVERSATIONS, {
    skip: !chatOpen || !user,
    pollInterval: subscriptionsEnabled ? 0 : POLL_INTERVAL_MS.conversationsList,
  });

  // When a chat is opened via openChatWithUser() (e.g. Profile.tsx's
  // "Message" button — we only know the *person*, not a conversation),
  // check whether a conversation with them already exists.
  const { data: existingConvData, loading: checkingExisting } = useQuery(CONVERSATION_WITH_USER, {
    variables: { userId: pendingRecipient?.id },
    skip: !pendingRecipient,
  });

  // If one does, normalize to the regular activeChatId flow (message
  // history, subscriptions, read receipts) instead of staying in
  // "pending" mode.
  useEffect(() => {
    if (pendingRecipient && existingConvData?.conversationWithUser?.id) {
      openChat(existingConvData.conversationWithUser.id);
    }
  }, [pendingRecipient, existingConvData, openChat]);

  if (!chatOpen || !user) return null;
  if (!activeChatId && !pendingRecipient) return null;

  if (activeChatId) {
    const conversation = (data?.conversations ?? []).find((c: any) => c.id === activeChatId);
    if (!conversation) return null;

    // ✅ Fix: find the OTHER participant, not by conversation ID (was always undefined)
    const participant =
      conversation.participants.find((p: any) => p.id !== user.id) ??
      conversation.participants[0];

    if (!participant) return null;

    return (
      <div className="fixed bottom-0 right-6 z-50 flex items-end gap-3">
        <AnimatePresence>
          <ChatWindow
            key={activeChatId}
            conversationId={activeChatId}
            participant={participant}
          />
        </AnimatePresence>
      </div>
    );
  }

  // pendingRecipient path: still checking, or confirmed no conversation
  // exists yet — render the window immediately (we already have the
  // person's info) so the UI responds right away instead of looking like
  // nothing happened. Message history stays empty until the first send.
  if (checkingExisting) return null;

  return (
    <div className="fixed bottom-0 right-6 z-50 flex items-end gap-3">
      <AnimatePresence>
        <ChatWindow
          key={`pending-${pendingRecipient!.id}`}
          conversationId={null}
          participant={pendingRecipient}
        />
      </AnimatePresence>
    </div>
  );
}
