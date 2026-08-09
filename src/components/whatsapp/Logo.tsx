import { cn } from "@/lib/utils";

/**
 * The app's mark — a chat bubble with a replay arrow turning inside it.
 *
 * Same geometry as the launcher icon in `public/icons`, minus the tile: inside
 * the app the mark sits on the UI's own surface, so it carries the colour and
 * knocks the arrow out in white. Inline SVG rather than a bitmap, so it stays
 * crisp at 20px in the rail and costs no request.
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
        <linearGradient id="chat-replay-mark" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#2ee06a" />
          <stop offset="0.55" stopColor="#20c65c" />
          <stop offset="1" stopColor="#0b9d4e" />
        </linearGradient>
      </defs>

      <path
        fill="url(#chat-replay-mark)"
        d="M 256 79.4 C 376.3 79.4 439.3 153.6 439.3 242.7 C 439.3 331.8 376.3 406 256 406 C 223.7 406 194 400.9 168.4 391.7 L 98.3 439.3 C 85 442.4 66.6 428 72.2 410.6 L 100.4 338.9 C 79.4 313.3 72.7 279.6 72.7 242.7 C 72.7 153.6 135.7 79.4 256 79.4 Z"
      />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="39.9"
        strokeLinecap="round"
        d="M 165.8 257.4 A 91.1 91.1 0 1 0 218.9 161.5"
      />
      <path fill="#fff" d="M 170.4 213.6 L 151.3 147.8 L 227.3 175.4 Z" />
    </svg>
  );
}
