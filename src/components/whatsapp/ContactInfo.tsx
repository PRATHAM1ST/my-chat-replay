import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ExternalLink,
  FileText,
  Headphones,
  Image as ImageIcon,
  ImageOff,
  Link2,
  Lock,
  MessagesSquare,
  Pencil,
  Play,
  Star,
  X,
} from "lucide-react";
import type { WaClient } from "@/lib/whatsapp/client";
import { formatDay } from "@/lib/whatsapp/format";
import { LINK_RE, type Msg, type ParsedChat } from "@/lib/whatsapp/types";
import { Avatar, Chip, Emoji, IconButton } from "./ui";
import { useMediaUrl } from "./useMediaUrl";

const PAGE = 36;

/** Only fetch a thumbnail once its tile is actually on screen. */
function useInView<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

function MediaThumb({
  msg,
  client,
  onOpen,
}: {
  msg: Msg;
  client: WaClient;
  onOpen: (msg: Msg) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref);
  // The same claim-and-give-up rule the bubbles follow: a tile whose bytes will
  // never decode has to stop asking, or it re-extracts the file forever and
  // takes the worker — and every other picture waiting on it — down with it.
  const { url, failed, retry } = useMediaUrl(msg.file, client, inView);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(msg)}
      aria-label="Open media"
      className="relative aspect-square cursor-pointer overflow-hidden rounded-[3px] bg-black/5 transition-opacity hover:opacity-90 dark:bg-white/5"
    >
      {failed ? (
        <span
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-center text-wa-meta"
          title={msg.label || msg.file || "Attachment"}
        >
          <ImageOff className="size-5" />
          <span className="text-[10px] leading-tight">
            {failed === "absent" ? "not in export" : "can't preview"}
          </span>
        </span>
      ) : url ? (
        msg.kind === "video" ? (
          <>
            <video
              src={`${url}#t=0.1`}
              muted
              preload="metadata"
              onError={retry}
              className="size-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <Play className="size-6 fill-white/90 text-white/90 drop-shadow" />
            </span>
          </>
        ) : (
          <img
            src={url}
            alt={msg.label || msg.file || "Chat media"}
            loading="lazy"
            decoding="async"
            // the LRU may have revoked this url while the tile was parked
            onError={retry}
            className="wa-fade-in size-full object-cover"
          />
        )
      ) : (
        <span className="wa-media-skeleton absolute inset-0 block" />
      )}
    </button>
  );
}

/** Inline editable single-line field, WhatsApp "edit name" style. */
function EditableName({
  value,
  onSave,
  className,
  label,
}: {
  value: string;
  onSave: (next: string) => void;
  className?: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  };

  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <span className={`min-w-0 truncate ${className ?? ""}`}>
          <Emoji text={value} />
        </span>
        <IconButton
          aria-label={`Edit ${label}`}
          onClick={() => setEditing(true)}
          className="size-8"
        >
          <Pencil className="size-3.5" />
        </IconButton>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1">
      <input
        autoFocus
        value={draft}
        aria-label={`Edit ${label}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="h-9 min-w-0 flex-1 rounded-lg border-b-2 border-wa-green bg-transparent px-2 text-[15px] text-wa-panel-foreground outline-none"
      />
      <IconButton
        aria-label="Save name"
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        className="size-8 text-wa-green"
      >
        <Check className="size-4" />
      </IconButton>
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mt-2 bg-wa-surface ${className}`}>{children}</section>;
}

interface Props {
  chat: ParsedChat;
  client: WaClient;
  chatName: string;
  senders: string[];
  meIndex: number;
  onMeChange: (i: number) => void;
  onSwap: () => void;
  onRenameChat: (name: string) => void;
  onRenameSender: (index: number, name: string) => void;
  onClose: () => void;
  onOpenMedia: (msg: Msg) => void;
  /** message indices the user starred in this chat */
  starred: Set<number>;
  /** scroll the transcript to a message (used by the Starred tab) */
  onJumpTo: (index: number) => void;
}

const KIND_LABEL: Record<string, string> = {
  image: "Photo",
  video: "Video",
  sticker: "Sticker",
  audio: "Voice message",
  document: "Document",
  call: "Call",
};

type Tab = "media" | "links" | "docs" | "starred";

export function ContactInfo({
  chat,
  client,
  chatName,
  senders,
  meIndex,
  onMeChange,
  onSwap,
  onRenameChat,
  onRenameSender,
  onClose,
  onOpenMedia,
  starred,
  onJumpTo,
}: Props) {
  const [tab, setTab] = useState<Tab>("media");
  const [shown, setShown] = useState(PAGE);

  const { media, docs, audio, links } = useMemo(() => {
    const media: Msg[] = [];
    const docs: Msg[] = [];
    const audio: Msg[] = [];
    const links: { url: string; msg: Msg }[] = [];
    for (const msg of chat.messages) {
      if (msg.file && (msg.kind === "image" || msg.kind === "video" || msg.kind === "sticker"))
        media.push(msg);
      else if (msg.kind === "document") docs.push(msg);
      else if (msg.kind === "audio") audio.push(msg);
      if (msg.text.length > 3) {
        LINK_RE.lastIndex = 0;
        for (const m of msg.text.matchAll(LINK_RE)) links.push({ url: m[0], msg });
      }
    }
    return { media, docs, audio, links };
  }, [chat.messages]);

  const starredMsgs = useMemo(
    () => chat.messages.filter((msg) => starred.has(msg.i)),
    [chat.messages, starred],
  );

  useEffect(() => setShown(PAGE), [tab]);

  const counts = { media: media.length, links: links.length, docs: docs.length + audio.length };
  const fileDocs = useMemo(() => [...docs, ...audio], [docs, audio]);

  return (
    <aside className="wa-slide-in absolute inset-0 z-30 flex min-h-0 flex-col border-l border-wa-divider bg-wa-app md:static md:w-[400px] md:shrink-0 lg:w-[430px]">
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-wa-divider bg-wa-panel pl-2 pr-3 text-wa-panel-foreground">
        <IconButton onClick={onClose} aria-label="Close contact info">
          <X className="size-5" />
        </IconButton>
        <h2 className="text-[16px]">Contact info</h2>
      </header>

      <div className="wa-scroller min-h-0 flex-1 overflow-y-auto pb-6">
        <section className="flex flex-col items-center bg-wa-surface px-6 py-7 text-center">
          <Avatar name={chatName} seed={chatName.length} size="lg" />
          <div className="mt-4 flex w-full max-w-full justify-center">
            <EditableName
              value={chatName}
              label="chat name"
              onSave={onRenameChat}
              className="text-[22px] font-normal text-wa-panel-foreground"
            />
          </div>
          <p className="mt-1 text-[14px] text-wa-meta">
            {senders.length > 2 ? `Group · ${senders.length} participants` : senders.join(" · ")}
          </p>
          <p className="mt-4 flex items-center gap-1.5 rounded-full bg-wa-green/15 px-3 py-1 text-[12.5px] text-wa-teal dark:text-wa-green">
            <Lock className="size-3.5" /> Read from your device only
          </p>
        </section>

        <Card className="px-5 py-4">
          <div className="flex items-center justify-between text-[14px]">
            <span className="flex items-center gap-2 text-wa-meta">
              <MessagesSquare className="size-4" /> Messages
            </span>
            <span className="text-wa-panel-foreground">
              {chat.messages.length.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[14px]">
            <span className="flex items-center gap-2 text-wa-meta">
              <ImageIcon className="size-4" /> Media, links & docs
            </span>
            <span className="text-wa-panel-foreground">
              {(counts.media + counts.links + counts.docs).toLocaleString()}
            </span>
          </div>
          {chat.messages.length > 0 && (
            <p className="mt-3 border-t border-wa-divider pt-3 text-[12.5px] text-wa-meta">
              {formatDay(chat.messages[0]?.ts ?? 0)} —{" "}
              {formatDay(chat.messages[chat.messages.length - 1]?.ts ?? 0)}
            </p>
          )}
        </Card>

        <Card className="px-4 py-4">
          <div className="mb-3 flex items-center gap-2 px-1 text-[14px] text-wa-meta">
            Participants
            {senders.length === 2 && (
              <button
                type="button"
                onClick={onSwap}
                className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] text-wa-green transition-colors hover:bg-wa-hover"
              >
                <ArrowLeftRight className="size-3.5" /> Swap sides
              </button>
            )}
          </div>
          <ul>
            {senders.map((name, index) => (
              <li key={chat.senders[index] ?? name} className="flex items-center gap-3 px-1 py-2">
                <Avatar name={name} seed={index} />
                <span className="min-w-0 flex-1">
                  <EditableName
                    value={name}
                    label={`name of ${name}`}
                    onSave={(next) => onRenameSender(index, next)}
                    className="text-[15px] text-wa-panel-foreground"
                  />
                  <span className="block px-1 text-[12.5px] text-wa-meta">
                    {(chat.counts[index] ?? 0).toLocaleString()} messages
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onMeChange(index)}
                  className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
                    index === meIndex
                      ? "bg-wa-green text-white"
                      : "bg-black/[0.05] text-wa-meta hover:bg-black/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
                  }`}
                >
                  {index === meIndex ? "You" : "Set as you"}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="px-4 py-4">
          <div className="mb-3 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
            <Chip active={tab === "media"} onClick={() => setTab("media")}>
              <ImageIcon className="size-3.5" /> Media {counts.media}
            </Chip>
            <Chip active={tab === "links"} onClick={() => setTab("links")}>
              <Link2 className="size-3.5" /> Links {counts.links}
            </Chip>
            <Chip active={tab === "docs"} onClick={() => setTab("docs")}>
              <FileText className="size-3.5" /> Docs {counts.docs}
            </Chip>
            <Chip active={tab === "starred"} onClick={() => setTab("starred")}>
              <Star className="size-3.5" /> Starred {starredMsgs.length}
            </Chip>
          </div>

          {tab === "media" &&
            (media.length ? (
              <>
                <div className="grid grid-cols-3 gap-1">
                  {media.slice(0, shown).map((msg) => (
                    <MediaThumb key={msg.i} msg={msg} client={client} onOpen={onOpenMedia} />
                  ))}
                </div>
                {shown < media.length && (
                  <button
                    type="button"
                    onClick={() => setShown((s) => s + PAGE * 2)}
                    className="mt-3 w-full cursor-pointer rounded-lg bg-wa-hover py-2 text-[13.5px] font-medium text-wa-teal transition-colors hover:bg-wa-active dark:text-wa-green"
                  >
                    Show more ({(media.length - shown).toLocaleString()} left)
                  </button>
                )}
              </>
            ) : (
              <p className="px-1 py-4 text-[13.5px] text-wa-meta">No media in this export</p>
            ))}

          {tab === "links" &&
            (links.length ? (
              <ul className="divide-y divide-wa-divider">
                {links.slice(0, shown).map(({ url, msg }, index) => (
                  <li key={`${url}-${index}`}>
                    <a
                      href={url.startsWith("http") ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="flex min-w-0 items-center gap-3 px-1 py-2.5 transition-colors hover:bg-wa-hover"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-wa-hover text-wa-meta">
                        <Link2 className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-wa-link">{url}</span>
                        <span className="block truncate text-[12px] text-wa-meta">
                          {msg.s === meIndex ? "You" : (senders[msg.s] ?? "Unknown")} ·{" "}
                          {formatDay(msg.ts)}
                        </span>
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-wa-meta" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-4 text-[13.5px] text-wa-meta">No links in this chat</p>
            ))}

          {tab === "docs" &&
            (fileDocs.length ? (
              <ul className="divide-y divide-wa-divider">
                {fileDocs.slice(0, shown).map((msg) => (
                  <li
                    key={msg.i}
                    className="flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-wa-hover"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-wa-hover text-wa-meta">
                      {msg.kind === "audio" ? (
                        <Headphones className="size-4" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-wa-panel-foreground">
                        {msg.label || msg.file?.split("/").pop() || "Document"}
                      </span>
                      <span className="block truncate text-[12px] text-wa-meta">
                        {msg.s === meIndex ? "You" : (senders[msg.s] ?? "Unknown")} ·{" "}
                        {formatDay(msg.ts)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-4 text-[13.5px] text-wa-meta">No documents in this chat</p>
            ))}

          {tab === "starred" &&
            (starredMsgs.length ? (
              <ul className="divide-y divide-wa-divider">
                {starredMsgs.slice(0, shown).map((msg) => (
                  <li key={msg.i}>
                    <button
                      type="button"
                      onClick={() => onJumpTo(msg.i)}
                      className="flex w-full min-w-0 cursor-pointer items-start gap-3 px-1 py-2.5 text-left transition-colors hover:bg-wa-hover"
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-wa-hover text-wa-meta">
                        <Star className="size-4 fill-current" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2 text-[12px]">
                          <span className="min-w-0 flex-1 truncate font-medium text-wa-panel-foreground">
                            {msg.s < 0
                              ? "System"
                              : msg.s === meIndex
                                ? "You"
                                : (senders[msg.s] ?? "Unknown")}
                          </span>
                          <span className="shrink-0 text-wa-meta">{formatDay(msg.ts)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-[13.5px] leading-[18px] text-wa-meta">
                          {msg.text ? (
                            <Emoji text={msg.text.replace(/\s+/g, " ").slice(0, 160)} />
                          ) : (
                            <span className="italic">{KIND_LABEL[msg.kind] ?? "Attachment"}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-4 text-[13.5px] text-wa-meta">
                Star messages from the menu on any bubble and they collect here.
              </p>
            ))}

          {tab !== "media" &&
            ((tab === "links"
              ? links.length
              : tab === "starred"
                ? starredMsgs.length
                : fileDocs.length) > shown ? (
              <button
                type="button"
                onClick={() => setShown((s) => s + PAGE * 2)}
                className="mt-3 w-full cursor-pointer rounded-lg bg-wa-hover py-2 text-[13.5px] font-medium text-wa-teal transition-colors hover:bg-wa-active dark:text-wa-green"
              >
                Show more
              </button>
            ) : null)}
        </Card>
      </div>
    </aside>
  );
}
