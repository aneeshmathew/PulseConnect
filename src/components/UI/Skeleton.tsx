import { memo } from 'react';
import { cn } from '@/utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton = memo(function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded bg-gray-200 dark:bg-gray-700 overflow-hidden relative',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/10 before:to-transparent',
        'before:animate-[shimmer_1.5s_infinite]',
        className
      )}
    />
  );
});

export const PostSkeleton = memo(function PostSkeleton() {
  return (
    <div
      className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-4 space-y-4"
      aria-busy="true"
      aria-label="Loading post"
    >
      {/* Author row */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Content lines */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
      {/* Media */}
      <Skeleton className="h-52 w-full rounded-xl" />
      {/* Action bar */}
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
    </div>
  );
});

export const StorySkeleton = memo(function StorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0" aria-hidden="true">
      <Skeleton className="w-14 h-14 rounded-full" />
      <Skeleton className="h-2.5 w-12" />
    </div>
  );
});

export const MessageSkeleton = memo(function MessageSkeleton() {
  return (
    <div className="flex gap-3 p-3" aria-hidden="true">
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
});

export const ConversationSkeleton = memo(function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
      <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
});
