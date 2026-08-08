import { useEffect, useState } from "react";
import { FileText, Download, Play, ImageOff } from "lucide-react";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg } from "@/lib/whatsapp/types";
import { Button } from "@/components/ui/button";

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

  const label = (file?.split("/").pop() ?? msg.label ?? msg.text) || "Attachment";

  if (!file || failed) {
    return (
      <div className="flex items-center gap-2 bg-wa-panel px-3 py-3 text-xs text-wa-meta">
        <ImageOff className="size-4 shrink-0" />
        <span className="max-w-52 truncate" title={label}>
          {label}
        </span>
        <span className="shrink-0 opacity-70">· not in export</span>
      </div>
    );
  }

  if (msg.kind === "image" || msg.kind === "sticker") {
    const sticker = msg.kind === "sticker";
    return (
      <Button variant="ghost" onClick={() => url && onOpen(msg, url)} className="block h-auto w-full overflow-hidden rounded-none p-0 hover:opacity-95">
        {url ? (
          <img
            src={url}
            alt={label}
            loading="lazy"
            decoding="async"
            className={
              sticker
                ? "h-32 w-32 object-contain"
                : "max-h-80 w-full object-cover sm:max-w-xs"
            }
          />
        ) : (
          <div className="h-40 w-56 animate-pulse bg-wa-divider" />
        )}
      </Button>
    );
  }

  if (msg.kind === "video") {
    return (
      <Button
        variant="ghost"
        onClick={() => url && onOpen(msg, url)}
        className="relative block h-auto w-full overflow-hidden rounded-none p-0 hover:opacity-95"
      >
        <video
          src={url ? `${url}#t=0.1` : undefined}
          preload="metadata"
          muted
          className="max-h-72 w-full max-w-xs bg-wa-panel-foreground object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-wa-panel-foreground/70">
            <Play className="size-5 fill-current text-wa-panel" />
          </span>
        </span>
      </Button>
    );
  }

  if (msg.kind === "audio") {
    return <audio controls preload="none" src={url ?? undefined} className="w-56 max-w-full" />;
  }

  return (
    <a
      href={url ?? undefined}
      download={label}
      className="flex items-center gap-2 bg-wa-panel px-3 py-3 text-xs hover:bg-wa-divider/60"
    >
      <FileText className="size-4 shrink-0" />
      <span className="max-w-40 truncate">{label}</span>
      <Download className="size-3.5 shrink-0 opacity-70" />
    </a>
  );
}
