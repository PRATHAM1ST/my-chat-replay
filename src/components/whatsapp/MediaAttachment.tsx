import { useEffect, useState } from "react";
import { FileText, Download, Play, ImageOff } from "lucide-react";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg } from "@/lib/whatsapp/types";

interface Props {
  msg: Msg;
  client: WaClient;
  onOpen: (msg: Msg, url: string) => void;
}

/**
 * Extracts one attachment from the archive lazily — only while its bubble is
 * mounted by the virtualizer. URLs come from the client's LRU cache.
 */
export function MediaAttachment({ msg, client, onOpen }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const file = msg.file;

  useEffect(() => {
    if (!file) return;
    let alive = true;
    client
      .media(file)
      .then((r) => alive && setUrl(r.url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [file, client]);

  const label = (file?.split("/").pop() ?? msg.text) || "Attachment";

  if (!file || failed) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs text-wa-meta dark:bg-white/10">
        <ImageOff className="size-4 shrink-0" />
        <span className="truncate">
          {msg.kind === "text" ? label : `${msg.kind} not included in export`}
        </span>
      </div>
    );
  }

  if (msg.kind === "image" || msg.kind === "sticker") {
    const sticker = msg.kind === "sticker";
    return (
      <button
        onClick={() => url && onOpen(msg, url)}
        className="block overflow-hidden rounded-lg"
      >
        {url ? (
          <img
            src={url}
            alt={label}
            loading="lazy"
            decoding="async"
            className={
              sticker
                ? "h-32 w-32 object-contain"
                : "max-h-80 max-w-full rounded-lg object-contain sm:max-w-xs"
            }
          />
        ) : (
          <div className="h-40 w-56 animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
        )}
      </button>
    );
  }

  if (msg.kind === "video") {
    return (
      <button
        onClick={() => url && onOpen(msg, url)}
        className="relative block overflow-hidden rounded-lg"
      >
        <video
          src={url ?? undefined}
          preload="metadata"
          muted
          className="max-h-72 w-full max-w-xs rounded-lg bg-black/70 object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/55">
            <Play className="size-5 fill-current text-white" />
          </span>
        </span>
      </button>
    );
  }

  if (msg.kind === "audio") {
    return (
      <audio
        controls
        preload="none"
        src={url ?? undefined}
        className="w-56 max-w-full"
      />
    );
  }

  return (
    <a
      href={url ?? undefined}
      download={label}
      className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
    >
      <FileText className="size-4 shrink-0" />
      <span className="max-w-40 truncate">{label}</span>
      <Download className="size-3.5 shrink-0 opacity-70" />
    </a>
  );
}
