import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg } from "@/lib/whatsapp/types";
import { formatDay, formatTime } from "@/lib/whatsapp/format";
import { Button } from "@/components/ui/button";

interface Props {
  items: Msg[];
  index: number | null;
  client: WaClient | null;
  senders: string[];
  onIndex: (i: number) => void;
  onClose: () => void;
}

/** Full-screen media carousel: arrows, keyboard and a filmstrip of neighbours. */
export function Lightbox({ items, index, client, senders, onIndex, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const msg = index === null ? undefined : items[index];

  const go = useCallback(
    (delta: number) => {
      if (index === null || !items.length) return;
      onIndex((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndex],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, onClose]);

  useEffect(() => {
    setUrl(null);
    const file = msg?.file;
    if (!file || !client) return;
    let alive = true;
    client
      .media(file)
      .then((r) => alive && setUrl(r.url))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [msg?.file, client]);

  if (index === null || !msg) return null;
  const name = msg.s >= 0 ? senders[msg.s] : "";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-wa-panel-foreground/95"
      role="dialog"
      aria-modal="true"
    >
      <header className="flex h-[59px] shrink-0 items-center gap-3 px-3 text-wa-panel">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close preview"
          className="rounded-full text-wa-panel hover:bg-wa-panel/15"
        >
          <X className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm">{name}</p>
          <p className="truncate text-xs opacity-70">
            {formatDay(msg.ts)} at {formatTime(msg.ts)}
          </p>
        </div>
        <span className="ml-auto text-xs opacity-70">
          {index + 1} / {items.length}
        </span>
        {url && (
          <a
            href={url}
            download={msg.file?.split("/").pop() ?? "attachment"}
            aria-label="Download"
            className="flex size-9 items-center justify-center rounded-full text-wa-panel hover:bg-wa-panel/15"
          >
            <Download className="size-5" />
          </a>
        )}
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-2"
        onClick={onClose}
      >
        {items.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous media"
            className="absolute left-2 z-10 rounded-full bg-wa-panel/10 text-wa-panel hover:bg-wa-panel/25"
          >
            <ChevronLeft className="size-6" />
          </Button>
        )}

        {!url ? (
          <div className="size-40 animate-pulse rounded bg-wa-panel/15" />
        ) : msg.kind === "video" ? (
          <video
            key={url}
            src={url}
            controls
            autoPlay
            className="max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            key={url}
            src={url}
            alt={msg.file ?? "attachment"}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {items.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next media"
            className="absolute right-2 z-10 rounded-full bg-wa-panel/10 text-wa-panel hover:bg-wa-panel/25"
          >
            <ChevronRight className="size-6" />
          </Button>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-1 overflow-x-auto px-3 py-3">
          {items.slice(Math.max(0, index - 12), index + 13).map((m, k) => {
            const at = Math.max(0, index - 12) + k;
            return (
              <Strip
                key={m.i}
                msg={m}
                client={client}
                active={at === index}
                onClick={() => onIndex(at)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Strip({
  msg,
  client,
  active,
  onClick,
}: {
  msg: Msg;
  client: WaClient | null;
  active: boolean;
  onClick: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!msg.file || !client) return;
    let alive = true;
    client
      .media(msg.file)
      .then((r) => alive && setUrl(r.url))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [msg.file, client]);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open media"
      className={`size-11 shrink-0 overflow-hidden rounded ${active ? "ring-2 ring-wa-green" : "opacity-60 hover:opacity-100"}`}
    >
      {url ? (
        msg.kind === "video" ? (
          <video src={`${url}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
        ) : (
          <img src={url} alt="" className="size-full object-cover" />
        )
      ) : (
        <span className="block size-full bg-wa-panel/20" />
      )}
    </button>
  );
}
