import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  Pencil,
  X,
} from "lucide-react";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg, ParsedChat } from "@/lib/whatsapp/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const URL_RE = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/g;
const PAGE = 18;

function MediaThumb({
  msg,
  client,
  onOpen,
}: {
  msg: Msg;
  client: WaClient;
  onOpen: (msg: Msg) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!msg.file) return;
    let alive = true;
    client
      .media(msg.file)
      .then((result) => alive && setUrl(result.url))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [client, msg.file]);

  if (!url) return <div className="aspect-square animate-pulse bg-wa-divider" />;
  return (
    <Button
      variant="ghost"
      onClick={() => onOpen(msg)}
      className="aspect-square h-auto overflow-hidden rounded-none p-0 hover:opacity-90"
    >
      {msg.kind === "video" ? (
        <video src={`${url}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
      ) : (
        <img
          src={url}
          alt={msg.label || msg.file || "Chat media"}
          loading="lazy"
          className="size-full object-cover"
        />
      )}
    </Button>
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
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`min-w-0 truncate ${className ?? ""}`}>{value}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${label}`}
          onClick={() => setEditing(true)}
          className="size-7 shrink-0 rounded-full text-wa-meta hover:bg-wa-divider/60"
        >
          <Pencil className="size-3.5" />
        </Button>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Input
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
        className="h-8 min-w-0 flex-1 border-wa-divider bg-wa-panel text-sm text-wa-in-foreground"
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Save name"
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        className="size-7 shrink-0 rounded-full text-wa-green hover:bg-wa-divider/60"
      >
        <Check className="size-4" />
      </Button>
    </span>
  );
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
}

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
}: Props) {
  const media = useMemo(
    () =>
      chat.messages.filter((msg) => msg.file && ["image", "video", "sticker"].includes(msg.kind)),
    [chat.messages],
  );
  const docs = useMemo(
    () => chat.messages.filter((msg) => msg.kind === "document"),
    [chat.messages],
  );
  const links = useMemo(
    () =>
      chat.messages.flatMap((msg) => Array.from(msg.text.matchAll(URL_RE), (match) => match[0])),
    [chat.messages],
  );
  const [shown, setShown] = useState(PAGE);
  const initials = chatName.slice(0, 2).toUpperCase();

  return (
    <aside className="absolute inset-0 z-40 flex min-h-0 flex-col border-l border-wa-divider bg-wa-chat md:static md:w-[400px] md:shrink-0">
      <header className="flex h-[59px] shrink-0 items-center gap-5 bg-wa-panel px-4 text-wa-panel-foreground">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close contact info"
          className="rounded-full hover:bg-wa-divider/60"
        >
          <X className="size-5" />
        </Button>
        <h2 className="text-[16px] font-normal">Contact info</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="flex flex-col items-center bg-wa-in px-6 py-7 text-center">
          <span className="flex size-28 items-center justify-center rounded-full bg-wa-teal text-3xl font-medium text-wa-out-foreground">
            {initials}
          </span>
          <div className="mt-4 flex w-full max-w-full justify-center">
            <EditableName
              value={chatName}
              label="chat name"
              onSave={onRenameChat}
              className="text-2xl font-normal text-wa-in-foreground"
            />
          </div>
          <p className="mt-1 text-sm text-wa-meta">
            {senders.length > 2 ? `${senders.length} participants` : senders.join(", ")}
          </p>
        </section>

        <section className="mt-2 bg-wa-in px-4 py-4">
          <div className="mb-2 flex items-center gap-2 px-2 text-sm text-wa-meta">
            Participants
            {senders.length === 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSwap}
                className="ml-auto h-7 gap-1.5 rounded-full px-2 text-xs text-wa-green hover:bg-wa-divider/60"
              >
                <ArrowLeftRight className="size-3.5" /> Swap sides
              </Button>
            )}
          </div>
          <ul>
            {senders.map((name, index) => (
              <li key={chat.senders[index] ?? name} className="flex items-center gap-3 px-2 py-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-teal text-xs font-semibold text-wa-out-foreground">
                  {name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <EditableName
                    value={name}
                    label={`name of ${name}`}
                    onSave={(next) => onRenameSender(index, next)}
                    className="text-[15px] text-wa-in-foreground"
                  />
                  <span className="block text-xs text-wa-meta">
                    {(chat.counts[index] ?? 0).toLocaleString()} messages
                  </span>
                </span>
                <Button
                  variant={index === meIndex ? "default" : "outline"}
                  size="sm"
                  onClick={() => onMeChange(index)}
                  className="h-7 shrink-0 rounded-full px-3 text-xs"
                >
                  {index === meIndex ? "You" : "Set as you"}
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-2 bg-wa-in px-6 py-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-wa-meta">Messages</span>
            <span className="text-wa-in-foreground">{chat.messages.length.toLocaleString()}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-wa-meta">Media, links and docs</span>
            <span className="text-wa-in-foreground">
              {(media.length + links.length + docs.length).toLocaleString()}
            </span>
          </div>
        </section>

        <section className="mt-2 bg-wa-in px-4 py-4">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm text-wa-meta">
            <ImageIcon className="size-4" /> Media <span className="ml-auto">{media.length}</span>
          </div>
          {media.length ? (
            <>
              <div className="grid grid-cols-3 gap-1">
                {media.slice(0, shown).map((msg) => (
                  <MediaThumb key={msg.i} msg={msg} client={client} onOpen={onOpenMedia} />
                ))}
              </div>
              {shown < media.length && (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShown((s) => s + PAGE * 2)}
                    className="flex-1 rounded-full text-xs"
                  >
                    Show more
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShown(media.length)}
                    className="rounded-full text-xs text-wa-green"
                  >
                    See all {media.length}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="px-2 py-3 text-sm text-wa-meta">No media in this export</p>
          )}
        </section>

        {!!links.length && (
          <section className="mt-2 bg-wa-in px-6 py-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-wa-meta">
              <Link2 className="size-4" /> Links
            </div>
            <ul className="space-y-1">
              {links.slice(0, 20).map((link, index) => (
                <li key={`${link}-${index}`}>
                  <a
                    href={link.startsWith("http") ? link : `https://${link}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex min-w-0 items-center gap-2 py-2 text-sm text-wa-link hover:underline"
                  >
                    <span className="min-w-0 flex-1 truncate">{link}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!!docs.length && (
          <section className="mt-2 bg-wa-in px-6 py-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-wa-meta">
              <FileText className="size-4" /> Docs
            </div>
            <ul className="space-y-2">
              {docs.slice(0, 20).map((msg) => (
                <li key={msg.i} className="truncate text-sm text-wa-in-foreground">
                  {msg.label || msg.file?.split("/").pop() || "Document"}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
