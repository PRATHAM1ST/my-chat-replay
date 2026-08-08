import { memo } from "react";
import { Check, CheckCheck } from "lucide-react";
import { formatTime } from "@/lib/whatsapp/format";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg } from "@/lib/whatsapp/types";
import { MediaAttachment } from "./MediaAttachment";

interface Props {
  msg: Msg;
  isMe: boolean;
  senderName: string;
  showName: boolean;
  colorIdx: number;
  query: string;
  isMatch: boolean;
  isActive: boolean;
  client: WaClient;
  onOpenMedia: (msg: Msg, url: string) => void;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(q);
  let k = 0;
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={k++} className="rounded bg-wa-highlight px-0.5 text-inherit">
        {text.slice(at, at + q.length)}
      </mark>,
    );
    from = at + q.length;
    at = lower.indexOf(q, from);
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}

const URL_RE = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/g;

/** Renders message text with clickable links, keeping search highlighting. */
function Body({ text, query }: { text: string; query: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<Highlighted key={k++} text={text.slice(last, at)} query={query} />);
    const raw = m[0];
    out.push(
      <a
        key={k++}
        href={raw.startsWith("http") ? raw : `https://${raw}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-wa-link underline decoration-wa-link/40 underline-offset-2"
      >
        <Highlighted text={raw} query={query} />
      </a>,
    );
    last = at + raw.length;
  }
  if (last < text.length)
    out.push(<Highlighted key={k++} text={text.slice(last)} query={query} />);
  return <>{out}</>;
}

export const MessageBubble = memo(function MessageBubble({
  msg,
  isMe,
  senderName,
  showName,
  colorIdx,
  query,
  isMatch,
  isActive,
  client,
  onOpenMedia,
}: Props) {
  if (msg.kind === "system") {
    return (
      <div className="flex justify-center px-4 py-1.5">
        <p className="max-w-md rounded-lg bg-wa-panel/90 px-3 py-1.5 text-center text-xs text-wa-meta">
          <Highlighted text={msg.text} query={isMatch ? query : ""} />
        </p>
      </div>
    );
  }

  const hasMedia = msg.kind !== "text";

  return (
    <div className={`flex px-3 py-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2 pb-1.5 pt-1.5 shadow-sm sm:max-w-[68%] ${
          isMe
            ? "rounded-tr-none bg-wa-out text-wa-out-foreground"
            : "rounded-tl-none bg-wa-in text-wa-in-foreground"
        } ${isActive ? "ring-2 ring-wa-green" : ""}`}
      >
        {showName && !isMe && (
          <p
            className="mb-0.5 px-1 text-[13px] font-semibold"
            style={{ color: `var(--wa-name-${colorIdx})` }}
          >
            {senderName}
          </p>
        )}

        {hasMedia && (
          <div className="mb-1">
            <MediaAttachment msg={msg} client={client} onOpen={onOpenMedia} />
          </div>
        )}

        <div className="flex flex-wrap items-end justify-end gap-x-2">
          {msg.text ? (
            <p className="whitespace-pre-wrap break-words px-1 text-[15px] leading-[1.35]">
              <Body text={msg.text} query={isMatch ? query : ""} />
            </p>
          ) : hasMedia ? null : (
            <p className="px-1 text-[15px] italic leading-[1.35] text-wa-meta">
              Message not included in export
            </p>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1 pr-0.5 text-[11px] text-wa-meta">
            {msg.edited && <span className="italic">edited</span>}
            {formatTime(msg.ts)}
            {isMe ? (
              <CheckCheck className="size-3.5 text-wa-tick" />
            ) : (
              <Check className="size-3.5 opacity-0" />
            )}
          </span>
        </div>
      </div>
    </div>
  );
});
