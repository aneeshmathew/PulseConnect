import { cn } from '@/utils';

interface LogoProps {
  /** Pixel size of the badge (square). Default 44. */
  size?: number;
  className?: string;
  /** Show the wordmark next to the badge. */
  withWordmark?: boolean;
  wordmarkClassName?: string;
}

/**
 * Pulse Connect brand mark — a rounded gradient badge with a chat-bubble
 * glyph (messaging/social) carrying a typing-dots detail, plus a small
 * glowing "online" ping badge for the real-time ("pulse") angle. Reads
 * as a social/chat app at a glance — deliberately not a heartbeat/EKG mark.
 * Pure inline SVG so it stays crisp at favicon sizes and hero sizes alike.
 */
export function Logo({ size = 44, className, withWordmark = false, wordmarkClassName }: LogoProps) {
  const gradId = 'pc-logo-grad';
  const glowId = 'pc-logo-glow';

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Pulse Connect logo"
      >
        <defs>
          <linearGradient id={gradId} x1="4" y1="2" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5EA8FF" />
            <stop offset="52%" stopColor="#1877F2" />
            <stop offset="100%" stopColor="#0c3685" />
          </linearGradient>
          <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="1.5" y="1.5" width="61" height="61" rx="17" fill={`url(#${gradId})`} />
        <rect x="1.5" y="1.5" width="61" height="61" rx="17" fill="white" fillOpacity="0.04" />
        <rect x="2" y="2" width="60" height="60" rx="16.5" stroke="white" strokeOpacity="0.16" />

        {/* Chat bubble tail */}
        <path d="M21 39 L14.5 48 L27 39 Z" fill="white" />
        {/* Chat bubble */}
        <rect x="15" y="16" width="34" height="23" rx="10.5" fill="white" />
        {/* Typing-dots detail inside the bubble */}
        <circle cx="24" cy="27.5" r="2.3" fill="#1565d8" />
        <circle cx="32" cy="27.5" r="2.3" fill="#1565d8" />
        <circle cx="40" cy="27.5" r="2.3" fill="#1565d8" />

        {/* "Live" ping badge — the real-time / pulse cue, styled like an
            online-presence indicator rather than a medical heartbeat. */}
        <circle cx="47.5" cy="16.5" r="6.5" fill={`url(#${gradId})`} />
        <circle cx="47.5" cy="16.5" r="5.5" fill="#3DDC97" filter={`url(#${glowId})`} />
      </svg>

      {withWordmark && (
        <span className={cn('text-xl font-black tracking-tight text-gray-900 dark:text-white', wordmarkClassName)}>
          Pulse<span className="text-brand-500">Connect</span>
        </span>
      )}
    </div>
  );
}
