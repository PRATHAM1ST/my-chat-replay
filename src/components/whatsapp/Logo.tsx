import logo from "@/assets/chat-replay-logo.png";
import { cn } from "@/lib/utils";

/** The app's mark — a chat bubble wrapped around a replay arrow. */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <img
      src={logo}
      alt="Chat Replay"
      width={size}
      height={size}
      className={cn("select-none object-contain", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
