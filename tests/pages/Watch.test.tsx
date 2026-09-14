import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { WatchPage } from '@/pages/Watch';
import { GET_WATCH_FEED } from '@/lib/graphql';

// Watch renders through the shared AppLayout shell and delegates each video
// card's playback/reactions/comments to VideoCard, and uploading to
// CreateVideoModal — neither is relevant to WatchPage's own feed-loading,
// empty-state, and "open the uploader" logic, so they're stubbed here.
vi.mock('@/pages/Home', () => ({
  AppLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/Watch/VideoCard', () => ({
  VideoCard: ({ video, isActive }: any) => (
    <div data-testid={`video-${video.id}`} data-active={isActive}>{video.caption}</div>
  ),
}));
vi.mock('@/components/Watch/CreateVideoModal', () => ({
  CreateVideoModal: ({ onClose }: any) => (
    <div role="dialog" aria-label="Upload video modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// jsdom has no IntersectionObserver — WatchPage only uses it to track which
// card is scrolled into view, which none of these tests exercise directly.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  (global as any).IntersectionObserver = FakeIntersectionObserver;
});

function makeVideo(id: string, caption: string) {
  return {
    __typename: 'Video',
    id,
    url: `https://example.com/${id}.mp4`,
    thumbnail: null,
    caption,
    duration: 30,
    width: 1080,
    height: 1920,
    visibility: 'PUBLIC',
    reactionSummary: [],
    myReaction: null,
    reactionsCount: 0,
    commentsCount: 0,
    comments: [],
    sharesCount: 0,
    viewCount: 0,
    createdAt: new Date().toISOString(),
    author: {
      __typename: 'User', id: 'author1', username: 'author', firstName: 'Author', lastName: 'One',
      fullName: 'Author One', avatar: null, isOnline: false, isVerified: false, isFriend: false, friendsCount: 0,
    },
  };
}

function renderWatch(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <WatchPage />
    </MockedProvider>
  );
}

const FEED_LIMIT = 6;

describe('WatchPage', () => {
  it('shows a loading placeholder before the feed arrives', () => {
    const mocks = [{
      request: { query: GET_WATCH_FEED, variables: { limit: FEED_LIMIT } },
      result: { data: { watchFeed: { videos: [], hasMore: false, nextCursor: null } } },
      delay: 50,
    }];
    renderWatch(mocks);
    expect(screen.queryByText('No videos yet')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no videos', async () => {
    const mocks = [{
      request: { query: GET_WATCH_FEED, variables: { limit: FEED_LIMIT } },
      result: { data: { watchFeed: { videos: [], hasMore: false, nextCursor: null } } },
    }];
    renderWatch(mocks);
    expect(await screen.findByText('No videos yet')).toBeInTheDocument();
    expect(screen.getByText('Be the first to share a reel.')).toBeInTheDocument();
  });

  it('renders videos once loaded, marking the first one active', async () => {
    const videos = [makeVideo('v1', 'First reel'), makeVideo('v2', 'Second reel')];
    const mocks = [{
      request: { query: GET_WATCH_FEED, variables: { limit: FEED_LIMIT } },
      result: { data: { watchFeed: { videos, hasMore: false, nextCursor: null } } },
    }];
    renderWatch(mocks);

    expect(await screen.findByText('First reel')).toBeInTheDocument();
    expect(screen.getByText('Second reel')).toBeInTheDocument();
    expect(screen.getByTestId('video-v1')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('video-v2')).toHaveAttribute('data-active', 'false');
  });

  it('opens the uploader when "Upload" is clicked, and closes it again', async () => {
    const mocks = [{
      request: { query: GET_WATCH_FEED, variables: { limit: FEED_LIMIT } },
      result: { data: { watchFeed: { videos: [], hasMore: false, nextCursor: null } } },
    }];
    renderWatch(mocks);
    await screen.findByText('No videos yet');

    fireEvent.click(screen.getByRole('button', { name: /upload/i }));
    const modal = screen.getByRole('dialog', { name: /upload video modal/i });
    expect(modal).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog', { name: /upload video modal/i })).not.toBeInTheDocument();
  });
});
