import { memo, useCallback, useState } from "react";
import {
  Ban,
  CheckCheck,
  ChevronDown,
  Copy,
  Phone,
  Reply,
  Share2,
  Star,
  StarOff,
  Video,
  X,
} from "lucide-react";
import { formatDay, formatTime } from "@/lib/whatsapp/format";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg, MsgKind } from "@/lib/whatsapp/types";
import { splitMentions } from "@/lib/whatsapp/mentions";
import { isDeletedMessage, parseCallLine, splitFormatRuns } from "@/lib/whatsapp/richtext";
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
  /** compiled from the participant list; null when the chat has no names */
  mentionRe: RegExp | null;
  /** the message this one quotes, when the user linked one */
  quoted: { name: string; colorIdx: number; text: string; kind: MsgKind; index: number } | null;
  onQuoteJump: (index: number) => void;
  onStartReplyLink: (index: number) => void;
  onRemoveReplyLink: (index: number) => void;
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

/** Plain text with @mentions coloured the way WhatsApp colours them. */
function WithMentions({
  text,
  query,
  mentionRe,
}: {
  text: string;
  query: string;
  mentionRe: RegExp | null;
}) {
  const segs = splitMentions(text, mentionRe);
  if (segs.length === 1 && !segs[0]?.mention) return <Highlighted text={text} query={query} />;
  return (
    <>
      {segs.map((seg, i) =>
        seg.mention ? (
          <span key={i} className="wa-mention font-medium text-wa-teal dark:text-wa-green">
            <Highlighted text={seg.text} query={query} />
          </span>
        ) : (
          <Highlighted key={i} text={seg.text} query={query} />
        ),
      )}
    </>
  );
}

/** One styled run of text; mono runs render raw, others get mentions too. */
function Formatted({
  text,
  query,
  mentionRe,
}: {
  text: string;
  query: string;
  mentionRe: RegExp | null;
}) {
  const runs = splitFormatRuns(text);
  if (runs.length === 1 && !runs[0]?.bold && !runs[0]?.italic && !runs[0]?.strike && !runs[0]?.mono)
    return <WithMentions text={text} query={query} mentionRe={mentionRe} />;
  return (
    <>
      {runs.map((run, i) => {
        const cls =
          [
            run.bold ? "font-semibold" : "",
            run.italic ? "italic" : "",
            run.strike ? "line-through" : "",
            run.mono
              ? "rounded bg-black/[0.06] px-1 font-mono text-[13px] dark:bg-white/[0.08]"
              : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined;
        const inner = run.mono ? (
          <Highlighted text={run.text} query={query} />
        ) : (
          <WithMentions text={run.text} query={query} mentionRe={mentionRe} />
        );
        return cls ? (
          <span key={i} className={cls}>
            {inner}
          </span>
        ) : (
          <span key={i}>{inner}</span>
        );
      })}
    </>
  );
}

/** Message text with clickable links, coloured mentions and search marks. */
function Body({
  text,
  query,
  mentionRe,
}: {
  text: string;
  query: string;
  mentionRe: RegExp | null;
}) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    if (at > last)
      out.push(
        <Formatted key={k++} text={text.slice(last, at)} query={query} mentionRe={mentionRe} />,
      );
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
    out.push(<Formatted key={k++} text={text.slice(last)} query={query} mentionRe={mentionRe} />);
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

const QUOTE_KIND_LABEL: Record<string, string> = {
  image: "📷 Photo",
  video: "🎥 Video",
  sticker: "💟 Sticker",
  audio: "🎤 Voice message",
  document: "📄 Document",
  call: "📞 Call",
};

/**
 * The quoted-message block WhatsApp draws inside a reply bubble: colour bar,
 * sender name in their palette colour, one-line snippet. Tapping it scrolls to
 * the original, exactly like the app.
 */
function QuoteBlock({
  quoted,
  mediaCard,
  onJump,
}: {
  quoted: NonNullable<Props["quoted"]>;
  mediaCard: boolean;
  onJump: (index: number) => void;
}) {
  const snippet = quoted.text
    ? quoted.text.replace(/\s+/g, " ").slice(0, 120)
    : (QUOTE_KIND_LABEL[quoted.kind] ?? "Message");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump(quoted.index);
      }}
      className={`relative block w-full min-w-40 cursor-pointer overflow-hidden rounded-[6px] bg-black/[0.05] text-left transition-colors hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.09] ${
        mediaCard ? "mb-[3px]" : "mb-1"
      }`}
    >
      <span
        className="absolute inset-y-0 left-0 w-[4px]"
        style={{ background: `var(--wa-name-${quoted.colorIdx})` }}
      />
      <span className="block py-[5px] pl-2.5 pr-2">
        <span
          className="block truncate text-[12.8px] font-medium leading-[17px]"
          style={{ color: `var(--wa-name-${quoted.colorIdx})` }}
        >
          <Emoji text={quoted.name} />
        </span>
        <span className="block truncate text-[13px] leading-[18px] text-wa-meta">
          <Emoji text={snippet} />
        </span>
      </span>
    </button>
  );
}

/** Call events, drawn as the app draws them: icon disc, label, detail. */
function CallCard({ text }: { text: string }) {
  const call = parseCallLine(text) ?? { video: false, missed: false, label: text, sub: null };
  const Icon = call.video ? Video : Phone;
  return (
    <span className="flex min-w-0 items-center gap-3 py-1 pr-1">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full ${
          call.missed
            ? "bg-destructive/12 text-destructive"
            : "bg-black/[0.07] text-wa-icon dark:bg-white/[0.1]"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-medium leading-[19px]">
          {call.label}
        </span>
        <span className="block text-[12px] leading-[16px] text-wa-meta">
          {call.sub ?? (call.missed ? "No answer" : "Call ended")}
        </span>
      </span>
    </span>
  );
}

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
  mentionRe,
  quoted,
  onQuoteJump,
  onStartReplyLink,
  onRemoveReplyLink,
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

  const hasMedia = msg.kind !== "text" && msg.kind !== "call";
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
            {quoted ? (
              <MenuItem onSelect={() => onRemoveReplyLink(msg.i)}>
                <X className="size-4 text-wa-meta" /> Remove reply link
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => onStartReplyLink(msg.i)}>
                <Reply className="size-4 text-wa-meta" /> Link as reply…
              </MenuItem>
            )}
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

        {quoted && <QuoteBlock quoted={quoted} mediaCard={mediaCard} onJump={onQuoteJump} />}

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
            {msg.kind === "call" ? (
              <CallCard text={msg.text} />
            ) : msg.text && isDeletedMessage(msg.text) ? (
              <p className="flex min-w-0 items-center gap-1.5 text-[14.2px] italic leading-[19px] text-wa-meta">
                <Ban className="size-[15px] shrink-0" /> {msg.text}
              </p>
            ) : msg.text ? (
              <p
                className={`wa-text min-w-0 whitespace-pre-wrap break-words text-[14.2px] leading-[19px] ${
                  big === "lg" ? "wa-emoji-only" : big === "md" ? "wa-emoji-only-md" : ""
                }`}
              >
                <Body text={msg.text} query={isMatch ? query : ""} mentionRe={mentionRe} />
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
