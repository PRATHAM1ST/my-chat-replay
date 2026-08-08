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
  /** first bubble of a sender group — gets the corner tail */
  tail: boolean;
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
  if (last < text.length) out.push(<Highlighted key={k++} text={text.slice(last)} query={query} />);
  return <>{out}</>;
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u;
const PICTO = /\p{Extended_Pictographic}/gu;

/** WhatsApp renders emoji-only messages large and without a bubble background. */
function emojiScale(text: string): "lg" | "md" | null {
  if (!text || !EMOJI_ONLY.test(text)) return null;
  const count = (text.match(PICTO) ?? []).length;
  if (count === 0 || count > 6) return null;
  return count <= 3 ? "lg" : "md";
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
  tail,
  client,
  onOpenMedia,
}: Props) {
  if (msg.kind === "system") {
    return (
      <div className="flex justify-center px-4 py-1.5">
        <p className="max-w-md rounded-lg bg-wa-panel/95 px-3 py-1.5 text-center text-[12.5px] text-wa-meta shadow-sm">
          <Highlighted text={msg.text} query={isMatch ? query : ""} />
        </p>
      </div>
    );
  }

  const hasMedia = msg.kind !== "text";
  const big = hasMedia ? null : emojiScale(msg.text);
  const mediaCard = hasMedia && ["image", "video", "sticker"].includes(msg.kind);

  return (
    <div className={`flex px-[5%] py-[1px] md:px-12 ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`wa-bubble max-w-[85%] overflow-hidden shadow-sm sm:max-w-[65%] ${
          isMe ? "bg-wa-out text-wa-out-foreground" : "bg-wa-in text-wa-in-foreground"
        } ${tail ? (isMe ? "wa-bubble-tail-out" : "wa-bubble-tail-in") : ""} ${
          isActive ? "ring-2 ring-wa-green" : ""
        } ${big ? "wa-emoji-transparent overflow-visible" : ""} ${mediaCard ? "p-[3px]" : "px-[9px] pb-[6px] pt-[6px]"}`}
      >
        {showName && !isMe && (
          <p
            className={`${mediaCard ? "px-1.5 pt-1" : ""} mb-0.5 text-[12.8px] font-medium leading-[17px]`}
            style={{ color: `var(--wa-name-${colorIdx})` }}
          >
            {senderName}
          </p>
        )}

        {hasMedia && (
          <div className={mediaCard ? "overflow-hidden rounded-[5px]" : "-mx-[9px] -mt-[6px] mb-1"}>
            <MediaAttachment msg={msg} client={client} onOpen={onOpenMedia} />
          </div>
        )}

        <div
          className={`flex flex-wrap items-end justify-end gap-x-2 ${mediaCard && msg.text ? "px-1.5 pb-1 pt-1.5" : ""} ${mediaCard && !msg.text ? "px-1.5 pb-1" : ""}`}
        >
          {msg.text ? (
            <p
              className={`wa-text whitespace-pre-wrap break-words text-[14.2px] leading-[19px] ${
                big === "lg" ? "wa-emoji-only" : big === "md" ? "wa-emoji-only-md" : ""
              }`}
            >
              <Body text={msg.text} query={isMatch ? query : ""} />
            </p>
          ) : hasMedia ? null : (
            <p className="text-[14.2px] italic leading-[19px] text-wa-meta">
              Message not included in export
            </p>
          )}
          <span
            className={`ml-auto flex shrink-0 items-center gap-[3px] self-end pl-1 text-[11px] leading-[15px] text-wa-meta ${big ? "rounded bg-wa-in/90 px-1 py-0.5 shadow-sm" : ""}`}
          >
            {msg.edited && <span className="italic">edited</span>}
            {formatTime(msg.ts)}
            {isMe ? (
              <CheckCheck className="size-[15px] text-wa-tick" strokeWidth={2.2} />
            ) : (
              <Check className="size-[15px] opacity-0" />
            )}
          </span>
        </div>
      </div>
    </div>
  );
});
