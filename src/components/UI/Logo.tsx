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
 * Pulse Connect brand mark — a circular badge built around the brand's two
 * actual ideas rather than a literal chat-bubble callout: two nodes joined
 * by a signal-arc ("Connect"), with one node picked out in a live-green
 * accent and a faint ripple around it ("Pulse" — real-time/active, without
 * reaching for the chat-bubble or medical-heartbeat clichés). Pure inline
 * SVG so it stays crisp at favicon sizes and hero sizes alike.
 */
export function Logo({ size = 44, className, withWordmark = false, wordmarkClassName }: LogoProps) {
  const gradId = 'pc-logo-grad';
  const glowId = 'pc-logo-glow';
  const clipId = 'pc-logo-clip';

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
          <linearGradient id={gradId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5EA8FF" />
            <stop offset="52%" stopColor="#1877F2" />
            <stop offset="100%" stopColor="#0c3685" />
          </linearGradient>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={clipId}>
            <circle cx="32" cy="32" r="30.5" />
          </clipPath>
        </defs>

        {/* Badge — a full circle, not a rounded square */}
        <circle cx="32" cy="32" r="30.5" fill={`url(#${gradId})`} />

        <g clipPath={`url(#${clipId})`}>
          {/* Soft top-left specular highlight for depth */}
          <ellipse cx="20" cy="14" rx="22" ry="14" fill="white" fillOpacity="0.14" />

          {/* Signal arc joining the two nodes below — the "Connect" */}
          <path
            d="M20 42 Q30 20 45 23"
            stroke="white"
            strokeOpacity="0.9"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Ripple around the live node — the "Pulse" */}
          <circle cx="45" cy="23" r="12" stroke="#3DDC97" strokeOpacity="0.22" strokeWidth="1.6" fill="none" />
          <circle cx="45" cy="23" r="8.5" stroke="#3DDC97" strokeOpacity="0.38" strokeWidth="1.6" fill="none" />

          {/* Node A — a person / connection point */}
          <circle cx="20" cy="42" r="6.5" fill="white" />

          {/* Node B — the live, pulsing node */}
          <circle cx="45" cy="23" r="5.5" fill="#3DDC97" filter={`url(#${glowId})`} />
        </g>

        {/* Rim highlight */}
        <circle cx="32" cy="32" r="30" stroke="white" strokeOpacity="0.16" />
      </svg>

      {withWordmark && (
        <span className={cn('text-xl font-black tracking-tight text-gray-900 dark:text-white', wordmarkClassName)}>
          Pulse<span className="text-brand-500">Connect</span>
        </span>
      )}
    </div>
  );
}
