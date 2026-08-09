import { memo, useCallback, useState } from "react";
import { CheckCheck, ChevronDown, Copy, Share2, Star, StarOff } from "lucide-react";
import { formatDay, formatTime } from "@/lib/whatsapp/format";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg } from "@/lib/whatsapp/types";
import { MediaAttachment } from "./MediaAttachment";
import { useLongPress } from "./useLongPress";
import { Emoji, Menu, MenuContent, MenuItem, MenuTrigger } from "./ui";

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
  isStarred: boolean;
  onToggleStar: (index: number) => void;
  client: WaClient;
  onOpenMedia: (msg: Msg, url: string) => void;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <Emoji text={text} />;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(q);
  let k = 0;
  while (at !== -1) {
    if (at > from) parts.push(<Emoji key={k++} text={text.slice(from, at)} />);
    parts.push(
      <mark key={k++} className="rounded-[3px] bg-wa-highlight px-0.5 text-wa-highlight-foreground">
        <Emoji text={text.slice(at, at + q.length)} />
      </mark>,
    );
    from = at + q.length;
    at = lower.indexOf(q, from);
  }
  parts.push(<Emoji key={k++} text={text.slice(from)} />);
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

const MEDIA_CARD = new Set(["image", "video", "sticker"]);

/** The tiny star WhatsApp shows beside the time of a starred message. */
function StarMark() {
  return <Star className="size-[11px] shrink-0 fill-current" aria-label="Starred" />;
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
  isStarred,
  onToggleStar,
  client,
  onOpenMedia,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const hold = useLongPress(openMenu);

  const copyText = useCallback(() => {
    const stamp = `[${formatDay(msg.ts)}, ${formatTime(msg.ts)}] ${senderName}`;
    void navigator.clipboard?.writeText(msg.text || stamp).catch(() => undefined);
  }, [msg.text, msg.ts, senderName]);

  const shareText = useCallback(() => {
    void navigator.share?.({ text: `${senderName}: ${msg.text}` }).catch(() => undefined);
  }, [msg.text, senderName]);

  if (msg.kind === "system") {
    return (
      <div className="flex justify-center px-4 py-1.5">
        <p className="max-w-[85%] rounded-[7.5px] bg-wa-system px-3 py-[6px] text-center text-[12.5px] leading-[17px] text-wa-system-foreground shadow-[var(--wa-shadow-bubble)] sm:max-w-md">
          <Highlighted text={msg.text} query={isMatch ? query : ""} />
        </p>
      </div>
    );
  }

  const hasMedia = msg.kind !== "text";
  const big = hasMedia ? null : emojiScale(msg.text);
  const sticker = msg.kind === "sticker";
  const mediaCard = MEDIA_CARD.has(msg.kind);
  /* Pictures and stickers put the stamp on top of the artwork when there is no
     caption, exactly like the app does. */
  const overlayStamp = mediaCard && !msg.text;
  const bare = !!big || sticker;

  return (
    <div className={`flex px-[6%] py-[1px] md:px-[7%] ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        {...hold}
        className={[
          "wa-bubble group/bubble relative max-w-[85%] sm:max-w-[65%]",
          bare
            ? "wa-emoji-transparent overflow-visible"
            : isMe
              ? "bg-wa-out text-wa-out-foreground"
              : "bg-wa-in text-wa-in-foreground",
          !bare && tail ? (isMe ? "wa-bubble-tail-out" : "wa-bubble-tail-in") : "",
          isActive ? "wa-bubble-active" : "",
          mediaCard ? "p-[3px]" : "px-[9px] py-[6px]",
          bare ? "shadow-none" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* WhatsApp's hover chevron; long-press or right-click on touch */}
        <Menu open={menuOpen} onOpenChange={setMenuOpen}>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Message actions"
              className={`pointer-events-none absolute right-1 top-1 z-10 grid size-7 cursor-pointer place-items-center rounded-full opacity-0 transition-opacity focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100 ${
                overlayStamp && !sticker
                  ? "bg-black/40 text-white backdrop-blur-[2px]"
                  : "bg-black/10 text-wa-icon backdrop-blur-[2px] dark:bg-white/15"
              }`}
            >
              <ChevronDown className="size-4" />
            </button>
          </MenuTrigger>
          <MenuContent align={isMe ? "end" : "start"}>
            <MenuItem onSelect={() => onToggleStar(msg.i)}>
              {isStarred ? (
                <>
                  <StarOff className="size-4 text-wa-meta" /> Unstar
                </>
              ) : (
                <>
                  <Star className="size-4 text-wa-meta" /> Star message
                </>
              )}
            </MenuItem>
            {!!msg.text && (
              <MenuItem onSelect={copyText}>
                <Copy className="size-4 text-wa-meta" /> Copy
              </MenuItem>
            )}
            {!!msg.text && typeof navigator !== "undefined" && !!navigator.share && (
              <MenuItem onSelect={shareText}>
                <Share2 className="size-4 text-wa-meta" /> Share
              </MenuItem>
            )}
          </MenuContent>
        </Menu>

        {showName && !isMe && !big && (
          <p
            className={`${mediaCard ? "px-1.5 pt-1" : ""} mb-[3px] truncate text-[12.8px] font-medium leading-[17px]`}
            style={{ color: `var(--wa-name-${colorIdx})` }}
          >
            {senderName}
          </p>
        )}

        {hasMedia && (
          <div className={mediaCard ? "relative overflow-hidden rounded-[6px]" : "mb-1"}>
            <MediaAttachment msg={msg} client={client} isMe={isMe} onOpen={onOpenMedia} />
            {overlayStamp && !sticker && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/45 to-transparent px-2 pb-1 pt-6 text-[11px] leading-[15px] text-white">
                <span className="flex items-center gap-[3px]">
                  {isStarred && <StarMark />}
                  {msg.edited && <span className="italic opacity-80">edited</span>}
                  {formatTime(msg.ts)}
                  {isMe && <CheckCheck className="size-[15px] text-wa-tick" strokeWidth={2.2} />}
                </span>
              </span>
            )}
          </div>
        )}

        {!overlayStamp && (
          <div
            className={`flex flex-wrap items-end justify-end gap-x-2 ${
              mediaCard && msg.text ? "px-1.5 pb-[3px] pt-1" : ""
            }`}
          >
            {msg.text ? (
              <p
                className={`wa-text min-w-0 whitespace-pre-wrap break-words text-[14.2px] leading-[19px] ${
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
              className={`ml-auto flex shrink-0 items-center gap-[3px] self-end pl-1 text-[11px] leading-[15px] text-wa-meta ${
                bare
                  ? "rounded-full bg-wa-in/85 px-1.5 py-0.5 shadow-[var(--wa-shadow-bubble)] backdrop-blur-sm"
                  : ""
              }`}
            >
              {isStarred && <StarMark />}
              {msg.edited && <span className="italic">edited</span>}
              {formatTime(msg.ts)}
              {isMe && <CheckCheck className="size-[15px] text-wa-tick" strokeWidth={2.2} />}
            </span>
          </div>
        )}

        {overlayStamp && sticker && (
          <span className="mt-0.5 flex items-center justify-end gap-[3px] text-[11px] leading-[15px] text-wa-meta">
            {isStarred && <StarMark />}
            {formatTime(msg.ts)}
            {isMe && <CheckCheck className="size-[15px] text-wa-tick" strokeWidth={2.2} />}
          </span>
        )}
      </div>
    </div>
  );
});
