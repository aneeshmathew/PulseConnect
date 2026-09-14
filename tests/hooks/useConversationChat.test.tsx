import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { useConversationChat } from '@/hooks/useConversationChat';
import { GET_MESSAGES, SEND_MESSAGE, MARK_CONVERSATION_READ } from '@/lib/graphql';

// Coverage for the hook DEVELOPMENT.md's changelog (2026-08-23 (6)) calls
// out as having been extracted specifically to de-duplicate logic that used
// to live separately (and drift) in both the chat popup and the full
// Messages page. Testing the hook directly means either caller regressing
// independently would show up here, instead of only being caught by
// whichever one someone happened to manually click-test.

vi.mock('@/lib/apollo', () => ({
  // Forces the hook down the "no WebSocket backend" path — skips both
  // useSubscription calls entirely, so tests don't need to mock
  // subscriptions just to exercise send/receive-by-poll logic.
  subscriptionsEnabled: false,
  POLL_INTERVAL_MS: { chatMessages: 3000, conversationsList: 8000, feedNewPostsCheck: 12000 },
}));

vi.mock('@/store', () => ({
  useAuthStore: () => ({ user: { id: 'me1' } }),
}));

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: any[]) => toastError(...args), success: vi.fn() },
}));

function wrapper(mocks: any[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MockedProvider mocks={mocks} addTypename={false}>{children}</MockedProvider>;
  };
}

function messageFixture(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'm1',
    content: overrides.content ?? 'hello',
    isEdited: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    sender: {
      id: 'me1', username: 'me', firstName: 'Me', lastName: 'User', fullName: 'Me User',
      avatar: null, isOnline: true, isVerified: false, isFriend: false, friendsCount: 0,
    },
    media: null,
    reactions: [],
    readBy: [],
    replyTo: null,
    conversation: { id: overrides.conversationId ?? 'conv1' },
    ...overrides,
  };
}

describe('useConversationChat — existing conversation', () => {
  it('sends a message, clears the input, and does not require a new conversation', async () => {
    const mocks = [
      {
        request: { query: GET_MESSAGES, variables: { conversationId: 'conv1', limit: 40 } },
        result: { data: { messages: [] } },
      },
      {
        request: { query: MARK_CONVERSATION_READ, variables: { conversationId: 'conv1' } },
        result: { data: { markConversationRead: true } },
      },
      {
        request: {
          query: SEND_MESSAGE,
          variables: { input: { conversationId: 'conv1', content: 'hello there' } },
        },
        result: { data: { sendMessage: messageFixture({ content: 'hello there' }) } },
      },
    ];

    const onConversationCreated = vi.fn();
    const { result } = renderHook(
      () => useConversationChat({ conversationId: 'conv1', recipient: null, onConversationCreated }),
      { wrapper: wrapper(mocks) }
    );

    act(() => result.current.setText('hello there'));
    await act(async () => {
      await result.current.handleSend();
    });

    expect(result.current.text).toBe('');
    expect(onConversationCreated).not.toHaveBeenCalled();
  });

  it('does nothing on empty or whitespace-only input', async () => {
    const mocks = [
      {
        request: { query: GET_MESSAGES, variables: { conversationId: 'conv1', limit: 40 } },
        result: { data: { messages: [] } },
      },
      {
        request: { query: MARK_CONVERSATION_READ, variables: { conversationId: 'conv1' } },
        result: { data: { markConversationRead: true } },
      },
    ];

    const { result } = renderHook(
      () => useConversationChat({ conversationId: 'conv1', recipient: null }),
      { wrapper: wrapper(mocks) }
    );

    act(() => result.current.setText('   '));
    await act(async () => {
      await result.current.handleSend();
    });

    // No SEND_MESSAGE mock was provided — if the hook had tried to send,
    // MockedProvider would throw "no more mocked responses" and this
    // assertion would never be reached cleanly.
    expect(result.current.text).toBe('   ');
  });
});

describe('useConversationChat — brand-new conversation (pending recipient)', () => {
  const recipient = { id: 'them1', fullName: 'Them Person', username: 'them', isOnline: false, avatar: null };

  it('sends the first message with a recipientId and promotes to the new conversation id', async () => {
    const mocks = [
      // conversationId is null, so GET_MESSAGES is skipped and no mark-read
      // effect runs — no mocks needed for either.
      {
        request: {
          query: SEND_MESSAGE,
          variables: { input: { recipientId: 'them1', content: 'hi there' } },
        },
        result: {
          data: {
            sendMessage: messageFixture({ content: 'hi there', conversationId: 'brand-new-conv' }),
          },
        },
      },
    ];

    const onConversationCreated = vi.fn();
    const { result } = renderHook(
      () => useConversationChat({ conversationId: null, recipient, onConversationCreated }),
      { wrapper: wrapper(mocks) }
    );

    act(() => result.current.setText('hi there'));
    await act(async () => {
      await result.current.handleSend();
    });

    await waitFor(() => expect(onConversationCreated).toHaveBeenCalledWith('brand-new-conv'));
    expect(result.current.text).toBe('');
  });
});

describe('useConversationChat — send failure', () => {
  it('restores the typed text and surfaces a toast on a failed send, instead of just clearing silently', async () => {
    const mocks = [
      {
        request: { query: GET_MESSAGES, variables: { conversationId: 'conv1', limit: 40 } },
        result: { data: { messages: [] } },
      },
      {
        request: { query: MARK_CONVERSATION_READ, variables: { conversationId: 'conv1' } },
        result: { data: { markConversationRead: true } },
      },
      {
        request: {
          query: SEND_MESSAGE,
          variables: { input: { conversationId: 'conv1', content: 'will fail' } },
        },
        result: { errors: [new GraphQLError('Message cannot be empty')] },
      },
    ];

    const { result } = renderHook(
      () => useConversationChat({ conversationId: 'conv1', recipient: null }),
      { wrapper: wrapper(mocks) }
    );

    act(() => result.current.setText('will fail'));
    await act(async () => {
      await result.current.handleSend();
    });

    await waitFor(() => expect(result.current.text).toBe('will fail'));
    expect(toastError).toHaveBeenCalledWith('Message cannot be empty');
  });
});
