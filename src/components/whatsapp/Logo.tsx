import { cn } from "@/lib/utils";

/**
 * The app's mark — a chat bubble wrapped around a replay arrow.
 *
 * Drawn as inline SVG rather than the 1024px PNG master: it stays crisp at
 * 20px in the sidebar header, needs no network round-trip, and the PNG is kept
 * only for favicons and PWA icons where a bitmap is required.
 */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label="Chat Replay"
      className={cn("shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id="chat-replay-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2ecc63" />
          <stop offset="1" stopColor="#0f9d58" />
        </linearGradient>
      </defs>
      <path
        fill="url(#chat-replay-mark)"
        d="M24 3.5c11.3 0 20.5 8.7 20.5 19.5S35.3 42.5 24 42.5c-2.6 0-5.1-.4-7.4-1.2l-8.2 3.3a1.6 1.6 0 0 1-2.2-1.9l1.9-7.2A18.9 18.9 0 0 1 3.5 23C3.5 12.2 12.7 3.5 24 3.5Z"
      />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="4.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15.6 23.2a8.9 8.9 0 1 0 3.2-6.9" />
        <path d="M18.8 10.9v5.6h5.6" />
      </g>
    </svg>
  );
}
