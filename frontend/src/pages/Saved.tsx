import { useQuery } from '@apollo/client';
import { Bookmark } from 'lucide-react';
import { GET_SAVED_POSTS } from '@/lib/graphql';
import { PostCard } from '@/components/Post/PostCard';
import { AppLayout } from './Home';

export function SavedPage() {
  const { data, loading, fetchMore } = useQuery(GET_SAVED_POSTS, {
    variables: { limit: 15 },
  });

  const posts: any[] = (data?.savedPosts?.posts ?? []).filter(Boolean);
  const hasMore = data?.savedPosts?.hasMore;
  const nextCursor = data?.savedPosts?.nextCursor;

  return (
    <AppLayout>
      <div className="flex items-center gap-2 mb-4">
        <Bookmark size={22} className="text-brand-500" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Saved</h1>
      </div>

      {loading && posts.length === 0 && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-surface-dark-3" />
                <div className="space-y-1.5">
                  <div className="h-3 w-32 bg-gray-200 dark:bg-surface-dark-3 rounded" />
                  <div className="h-2.5 w-20 bg-gray-200 dark:bg-surface-dark-3 rounded" />
                </div>
              </div>
              <div className="h-3 w-full bg-gray-200 dark:bg-surface-dark-3 rounded" />
              <div className="h-3 w-3/4 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center mb-4">
            <Bookmark size={24} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">No saved posts yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Tap the ⋯ menu on any post and choose "Save post" to keep it here for later.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => fetchMore({
            variables: { cursor: nextCursor },
            updateQuery: (prev, { fetchMoreResult }) => {
              if (!fetchMoreResult) return prev;
              return {
                savedPosts: {
                  ...fetchMoreResult.savedPosts,
                  posts: [...prev.savedPosts.posts, ...fetchMoreResult.savedPosts.posts],
                },
              };
            },
          })}
          className="w-full mt-4 py-2.5 text-sm font-semibold text-brand-500 bg-white dark:bg-surface-dark-2 hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded-xl shadow-card dark:shadow-card-dark transition-colors"
        >
          Load more
        </button>
      )}
    </AppLayout>
  );
}
