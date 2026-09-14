import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import {
  GET_MESSAGES, SEND_MESSAGE, SET_TYPING,
  NEW_MESSAGE_SUB, TYPING_STATUS_SUB,
  MARK_CONVERSATION_READ, GET_CONVERSATIONS,
} from '@/lib/graphql';
import { subscriptionsEnabled, POLL_INTERVAL_MS } from '@/lib/apollo';
import { useAuthStore } from '@/store';
import toast from 'react-hot-toast';

export interface ChatRecipient {
  id: string;
  fullName: string;
  avatar?: string | null;
  isOnline: boolean;
  username: string;
}

interface UseConversationChatOptions {
  // null means: messaging this person for the first time — no conversation
  // exists yet. Message history/typing/read-receipts are all skipped until
  // the first message is sent and the server creates one (see handleSend).
  conversationId: string | null;
  // Required when conversationId is null — who the first message goes to.
  recipient: ChatRecipient | null;
  // GET_MESSAGES page size. The popup and full page have historically used
  // different values (40 vs 50) — kept configurable rather than picking one
  // arbitrarily and silently changing the other's behavior.
  limit?: number;
  // Whether to mark the conversation read right now — re-evaluated by the
  // caller on every render (e.g. the popup passes `!minimized`, the full
  // page always passes `true`), same as both call sites already did before
  // this was extracted.
  markReadEnabled?: boolean;
  // Called once the first message of a brand-new conversation succeeds,
  // with the conversation id the server just created. The popup and full
  // page promote to a real conversation differently (global store vs local
  // state), so that stays the caller's responsibility.
  onConversationCreated?: (newConversationId: string) => void;
}

export function useConversationChat({
  conversationId,
  recipient,
  limit = 40,
  markReadEnabled = true,
  onConversationCreated,
}: UseConversationChatOptions) {
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const { data } = useQuery(GET_MESSAGES, {
    variables: { conversationId, limit },
    skip: !conversationId,
    // Fallback for deployments without a WebSocket-capable backend (e.g.
    // Vercel): re-poll for new messages every few seconds. Safe to merge —
    // `messages` is cached per-conversationId and dedupes by ref.
    pollInterval: subscriptionsEnabled ? 0 : POLL_INTERVAL_MS.chatMessages,
  });

  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE, {
    update(cache, { data }) {
      const newMsg = data?.sendMessage;
      // Nothing to merge into GET_MESSAGES yet if this was the very first
      // message of a brand-new conversation — there's no cached query for
      // a conversationId that didn't exist when this hook was called.
      // handleSend() below promotes to the real conversationId afterward,
      // which (via the caller's onConversationCreated) re-invokes this
      // hook with a real id and fetches fresh from the server.
      if (!newMsg || !conversationId) return;
      cache.updateQuery(
        { query: GET_MESSAGES, variables: { conversationId, limit } },
        (existing) => {
          if (!existing) return { messages: [newMsg] };
          const exists = existing.messages.some((m: any) => m.id === newMsg.id);
          return exists ? existing : { messages: [...existing.messages, newMsg] };
        }
      );
    },
    refetchQueries: [GET_CONVERSATIONS],
  });

  const [setTypingMutation] = useMutation(SET_TYPING);
  const [markRead] = useMutation(MARK_CONVERSATION_READ);

  useSubscription(NEW_MESSAGE_SUB, {
    variables: { conversationId },
    skip: !subscriptionsEnabled || !conversationId,
    onData: ({ client, data }) => {
      const newMsg = data.data?.newMessage;
      if (!newMsg) return;
      client.cache.updateQuery(
        { query: GET_MESSAGES, variables: { conversationId, limit } },
        (existing) => {
          if (!existing) return { messages: [newMsg] };
          const exists = existing.messages.some((m: any) => m.id === newMsg.id);
          return exists ? existing : { messages: [...existing.messages, newMsg] };
        }
      );
      if (markReadEnabled) markRead({ variables: { conversationId } });
    },
  });

  // Typing indicator has no polling equivalent (polling for it would mean
  // a request every second or two just to catch a ~1s-long event) — it's
  // simply unavailable without a WebSocket-capable backend.
  useSubscription(TYPING_STATUS_SUB, {
    variables: { conversationId },
    skip: !subscriptionsEnabled || !conversationId,
    onData: ({ data }) => {
      const s = data.data?.typingStatus;
      if (s && s.userId !== user?.id) {
        setOtherTyping(s.isTyping);
        if (s.isTyping) {
          // Auto-clear after 3s in case the stop event is lost
          setTimeout(() => setOtherTyping(false), 3000);
        }
      }
    },
  });

  const messages: any[] = data?.messages ?? [];

  // Reset per-conversation UI state when switching conversations. The
  // popup (ChatPanel.tsx) remounts this hook entirely via a `key` change
  // when the conversation changes, so this is a no-op there — but the full
  // Messages page keeps the same component instance across conversation
  // switches, so without this a stale typing indicator or draft could
  // leak from one conversation into the next. Keyed on recipient id too,
  // not just conversationId: switching from one "pending" (no
  // conversation yet) recipient straight to another pending recipient
  // never changes conversationId (both are null), so that alone wouldn't
  // catch it.
  useEffect(() => {
    setText('');
    setOtherTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, recipient?.id]);

  // Mark as read whenever the conversation is actually visible (caller
  // decides what "visible" means — open + not minimized for the popup,
  // just "a conversation is selected" for the full page).
  useEffect(() => {
    if (markReadEnabled && conversationId) {
      markRead({ variables: { conversationId } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markReadEnabled, conversationId]);

  const stopTyping = useCallback(() => {
    if (!conversationId) return; // no conversation yet — nothing to signal
    if (isTypingRef.current) {
      isTypingRef.current = false;
      setTypingMutation({ variables: { conversationId, isTyping: false } });
    }
  }, [conversationId, setTypingMutation]);

  const handleTyping = useCallback(() => {
    if (!conversationId) return; // no conversation yet — nothing to signal
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setTypingMutation({ variables: { conversationId, isTyping: true } });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2000);
  }, [conversationId, setTypingMutation, stopTyping]);

  // Stop typing on unmount (e.g. closing the chat window, or navigating
  // away from the Messages page mid-keystroke)
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      stopTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTyping]);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || (!conversationId && !recipient) || sending) return;
    setText('');
    stopTyping();
    try {
      const { data } = await sendMessage({
        variables: {
          input: conversationId
            ? { conversationId, content }
            : { recipientId: recipient!.id, content }, // first message — server creates the conversation
        },
      });
      if (!conversationId) {
        const newConversationId = data?.sendMessage?.conversation?.id;
        if (newConversationId) onConversationCreated?.(newConversationId);
      }
    } catch (err: any) {
      // Restoring the typed text on failure is correct, but doing it
      // silently looks exactly like "the input didn't clear" — the text
      // reappears with no explanation. Surface the real error so a failed
      // send is obviously a failed send, not a mystery UI glitch.
      setText(content);
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Message failed to send — check your connection');
    }
  }, [text, sending, conversationId, recipient, sendMessage, stopTyping, onConversationCreated]);

  return { text, setText, messages, otherTyping, sending, handleTyping, handleSend };
}
