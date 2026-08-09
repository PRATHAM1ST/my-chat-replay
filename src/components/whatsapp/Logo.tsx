import { cn } from "@/lib/utils";

/**
 * The app's mark — a circular chat bubble with a replay arrow turning inside.
 *
 * The path data is emitted by the same generator that renders the launcher
 * icons (`scratchpad/icon2.mjs` geometry, 512 grid), so the in-app logo and
 * the home-screen icon can never drift apart. On UI surfaces the fill flips:
 * gradient bubble, white glyph.
 */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label="Chat Replay"
      className={cn("shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id="chat-replay-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5ee879" />
          <stop offset="0.52" stopColor="#2bd366" />
          <stop offset="1" stopColor="#0ba84e" />
        </linearGradient>
      </defs>

      <path
        fill="url(#chat-replay-mark)"
        d="M 220.3 382.7 A 147.5 147.5 0 1 0 125.8 308.8 Q 119.8 373.9 114.9 413.8 Q 162.4 402 220.3 382.7 Z"
      />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="42"
        strokeLinecap="round"
        d="M 215.2 173.2 A 75.8 75.8 0 1 0 302.1 174.7"
      />
      <path fill="#fff" d="M 239.9 129.6 L 330.1 136.2 L 274.1 213.3 Z" />
    </svg>
  );
}
