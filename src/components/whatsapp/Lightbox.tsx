import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg } from "@/lib/whatsapp/types";
import { formatDay, formatTime } from "@/lib/whatsapp/format";
import { Avatar } from "./ui";

interface Props {
  items: Msg[];
  index: number | null;
  client: WaClient | null;
  senders: string[];
  onIndex: (i: number) => void;
  onClose: () => void;
}

function GlassButton({
  label,
  onClick,
  className = "",
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${className}`}
    >
      {children}
    </button>
  );
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
  const name = msg.s >= 0 ? (senders[msg.s] ?? "") : "";

  return (
    <div
      className="wa-fade-in fixed inset-0 z-50 flex flex-col bg-[oklch(0.16_0.015_240_/_0.97)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <header className="flex h-[64px] shrink-0 items-center gap-3 px-3 text-white">
        <GlassButton label="Close preview" onClick={onClose}>
          <X className="size-5" />
        </GlassButton>
        <Avatar name={name || "?"} seed={msg.s < 0 ? 0 : msg.s} />
        <div className="min-w-0">
          <p className="truncate text-[14.5px]">{name || "Media"}</p>
          <p className="truncate text-[12.5px] text-white/60">
            {formatDay(msg.ts)} at {formatTime(msg.ts)}
          </p>
        </div>
        <span className="ml-auto shrink-0 text-[12.5px] tabular-nums text-white/60">
          {index + 1} / {items.length}
        </span>
        {url && (
          <a
            href={url}
            download={msg.file?.split("/").pop() ?? "attachment"}
            aria-label="Download"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15"
          >
            <Download className="size-5" />
          </a>
        )}
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-3"
        onClick={onClose}
      >
        {items.length > 1 && (
          <GlassButton
            label="Previous media"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-3 z-10 size-11 bg-white/10 backdrop-blur-sm"
          >
            <ChevronLeft className="size-6" />
          </GlassButton>
        )}

        {!url ? (
          <div className="wa-media-skeleton size-48 rounded-xl" />
        ) : msg.kind === "video" ? (
          <video
            key={url}
            src={url}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            key={url}
            src={url}
            alt={msg.file ?? "attachment"}
            className="wa-fade-in max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {items.length > 1 && (
          <GlassButton
            label="Next media"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-3 z-10 size-11 bg-white/10 backdrop-blur-sm"
          >
            <ChevronRight className="size-6" />
          </GlassButton>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-1.5 overflow-x-auto px-3 py-3">
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
      className={`size-12 shrink-0 cursor-pointer overflow-hidden rounded-md transition-all ${
        active
          ? "ring-2 ring-wa-green ring-offset-2 ring-offset-transparent"
          : "opacity-50 hover:opacity-100"
      }`}
    >
      {url ? (
        msg.kind === "video" ? (
          <video src={`${url}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
        ) : (
          <img src={url} alt="" className="size-full object-cover" />
        )
      ) : (
        <span className="block size-full bg-white/10" />
      )}
    </button>
  );
}
