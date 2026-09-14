import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { ArrowLeft, FileX } from 'lucide-react';
import { GET_POST } from '@/lib/graphql';
import { PostCard } from '@/components/Post/PostCard';
import { AppLayout } from './Home';

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_POST, {
    variables: { id },
    skip: !id,
  });

  const post = data?.post;

  return (
    <AppLayout>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {loading && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-surface-dark-3" />
            <div className="space-y-1.5">
              <div className="h-3 w-32 bg-gray-200 dark:bg-surface-dark-3 rounded" />
              <div className="h-2.5 w-20 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            </div>
          </div>
          <div className="h-3 w-full bg-gray-200 dark:bg-surface-dark-3 rounded" />
          <div className="h-3 w-3/4 bg-gray-200 dark:bg-surface-dark-3 rounded" />
          <div className="h-64 w-full bg-gray-200 dark:bg-surface-dark-3 rounded-lg" />
        </div>
      )}

      {!loading && (error || !post) && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center mb-4">
            <FileX size={24} className="text-gray-400" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Post not found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
            This post may have been deleted, or you may not have permission to view it.
          </p>
          <Link
            to="/"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      )}

      {!loading && post && <PostCard post={post} initiallyExpanded />}
    </AppLayout>
  );
}
