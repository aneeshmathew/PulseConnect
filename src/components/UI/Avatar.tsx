import { memo, useState } from 'react';
import { cn, getInitials, generateAvatarColor } from '@/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

const SIZES = {
  xs: { container: 'w-6 h-6 text-[10px]', dot: 'w-2 h-2 border' },
  sm: { container: 'w-8 h-8 text-xs',     dot: 'w-2.5 h-2.5 border' },
  md: { container: 'w-10 h-10 text-sm',   dot: 'w-3 h-3 border-2' },
  lg: { container: 'w-12 h-12 text-base', dot: 'w-3.5 h-3.5 border-2' },
  xl: { container: 'w-28 h-28 text-3xl',  dot: 'w-5 h-5 border-2' },
};

export const Avatar = memo(function Avatar({
  src, name, size = 'md', isOnline, className,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { container, dot } = SIZES[size];
  const bgColor = generateAvatarColor(name);
  const showFallback = !src || imgError;

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center font-semibold text-white select-none',
          container
        )}
        style={showFallback ? { backgroundColor: bgColor } : undefined}
        role="img"
        aria-label={name}
      >
        {showFallback ? (
          <span aria-hidden="true">{getInitials(name)}</span>
        ) : (
          <img
            src={src!}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Online indicator — only render when prop is explicitly passed */}
      {isOnline !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white dark:border-surface-dark-2',
            isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
            dot
          )}
        />
      )}
    </div>
  );
});
