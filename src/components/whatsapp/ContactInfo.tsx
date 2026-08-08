import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, ImageIcon, Link2, X } from "lucide-react";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg, ParsedChat } from "@/lib/whatsapp/types";
import { Button } from "@/components/ui/button";

const URL_RE = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/g;

function MediaThumb({ msg, client, onOpen }: { msg: Msg; client: WaClient; onOpen: (msg: Msg, url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!msg.file) return;
    let alive = true;
    client.media(msg.file).then((result) => alive && setUrl(result.url)).catch(() => undefined);
    return () => { alive = false; };
  }, [client, msg.file]);

  if (!url) return <div className="aspect-square animate-pulse bg-wa-divider" />;
  return (
    <Button variant="ghost" onClick={() => onOpen(msg, url)} className="h-auto aspect-square overflow-hidden rounded-none p-0 hover:opacity-90">
      {msg.kind === "video" ? (
        <video src={`${url}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
      ) : (
        <img src={url} alt={msg.label || msg.file || "Chat media"} loading="lazy" className="size-full object-cover" />
      )}
    </Button>
  );
}

interface Props {
  chat: ParsedChat;
  client: WaClient;
  onClose: () => void;
  onOpenMedia: (msg: Msg, url: string) => void;
}

export function ContactInfo({ chat, client, onClose, onOpenMedia }: Props) {
  const media = useMemo(() => chat.messages.filter((msg) => msg.file && ["image", "video", "sticker"].includes(msg.kind)), [chat.messages]);
  const docs = useMemo(() => chat.messages.filter((msg) => msg.kind === "document"), [chat.messages]);
  const links = useMemo(() => chat.messages.flatMap((msg) => Array.from(msg.text.matchAll(URL_RE), (match) => match[0])), [chat.messages]);
  const initials = chat.chatName.slice(0, 2).toUpperCase();

  return (
    <aside className="absolute inset-0 z-40 flex min-h-0 flex-col border-l border-wa-divider bg-wa-chat md:static md:w-[400px] md:shrink-0">
      <header className="flex h-[59px] shrink-0 items-center gap-5 bg-wa-panel px-4 text-wa-panel-foreground">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close contact info" className="rounded-full hover:bg-wa-divider/60">
          <X className="size-5" />
        </Button>
        <h2 className="text-[16px] font-normal">Contact info</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="flex flex-col items-center bg-wa-in px-6 py-7 text-center">
          <span className="flex size-28 items-center justify-center rounded-full bg-wa-teal text-3xl font-medium text-wa-out-foreground">{initials}</span>
          <h3 className="mt-4 max-w-full truncate text-2xl font-normal text-wa-in-foreground">{chat.chatName}</h3>
          <p className="mt-1 text-sm text-wa-meta">{chat.senders.length > 2 ? `${chat.senders.length} participants` : chat.senders.join(", ")}</p>
        </section>

        <section className="mt-2 bg-wa-in px-6 py-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-wa-meta">Messages</span>
            <span className="text-wa-in-foreground">{chat.messages.length.toLocaleString()}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-wa-meta">Media, links and docs</span>
            <span className="text-wa-in-foreground">{(media.length + links.length + docs.length).toLocaleString()}</span>
          </div>
        </section>

        <section className="mt-2 bg-wa-in px-4 py-4">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm text-wa-meta"><ImageIcon className="size-4" /> Media <span className="ml-auto">{media.length}</span></div>
          {media.length ? (
            <div className="grid grid-cols-3 gap-1">{media.slice(0, 30).map((msg) => <MediaThumb key={msg.i} msg={msg} client={client} onOpen={onOpenMedia} />)}</div>
          ) : <p className="px-2 py-3 text-sm text-wa-meta">No media in this export</p>}
        </section>

        {!!links.length && (
          <section className="mt-2 bg-wa-in px-6 py-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-wa-meta"><Link2 className="size-4" /> Links</div>
            <ul className="space-y-1">
              {links.slice(0, 20).map((link, index) => (
                <li key={`${link}-${index}`}>
                  <a href={link.startsWith("http") ? link : `https://${link}`} target="_blank" rel="noopener noreferrer nofollow" className="flex min-w-0 items-center gap-2 py-2 text-sm text-wa-link hover:underline">
                    <span className="min-w-0 flex-1 truncate">{link}</span><ExternalLink className="size-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!!docs.length && (
          <section className="mt-2 bg-wa-in px-6 py-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-wa-meta"><FileText className="size-4" /> Docs</div>
            <ul className="space-y-2">{docs.slice(0, 20).map((msg) => <li key={msg.i} className="truncate text-sm text-wa-in-foreground">{msg.label || msg.file?.split("/").pop() || "Document"}</li>)}</ul>
          </section>
        )}
      </div>
    </aside>
  );
}