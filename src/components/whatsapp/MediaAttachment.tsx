import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, ImageOff, Mic, Pause, Play, Video } from "lucide-react";
import type { WaClient } from "@/lib/whatsapp/client";
import { mediaBox } from "@/lib/whatsapp/layout";
import type { Msg } from "@/lib/whatsapp/types";

interface Props {
  msg: Msg;
  client: WaClient;
  isMe: boolean;
  onOpen: (msg: Msg, url: string) => void;
}

/**
 * Resolves one attachment out of the archive.
 *
 * Everything is local and nothing is ever evicted, so a url that has already
 * been extracted is handed over synchronously and the bubble paints with no
 * skeleton at all.
 */
function useMediaUrl(file: string | undefined, client: WaClient) {
  const [url, setUrl] = useState<string | null>(() => client.ready(file)?.url ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Hold the attachment for as long as this bubble is mounted. Nothing the
  // virtualizer is showing can be reclaimed, so a picture on screen never goes
  // blank; once the row scrolls away it becomes reclaimable again.
  useEffect(() => {
    if (!file) return;
    client.retain(file);
    return () => client.release(file);
  }, [file, client]);

  useEffect(() => {
    if (!file) return;
    setFailed(false);
    const cached = client.ready(file);
    if (cached) {
      setUrl(cached.url);
      return;
    }
    let alive = true;
    client
      .media(file)
      .then((r) => alive && setUrl(r.url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [file, client, attempt]);

  /** The url went stale (undecodable) — drop it and extract again. */
  const retry = useCallback(() => {
    if (!file) return;
    client.forget(file);
    setUrl(null);
    setAttempt((n) => (n > 2 ? n : n + 1));
    if (attempt > 2) setFailed(true);
  }, [client, file, attempt]);

  return { url, failed, retry };
}

function Missing({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[6px] bg-black/[0.04] px-3 py-3 text-[13px] text-wa-meta dark:bg-white/[0.06]">
      <ImageOff className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      <span className="shrink-0 text-[11px] opacity-70">not in export</span>
    </div>
  );
}

function secs(total: number) {
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** WhatsApp voice note: avatar, play control, seekable bar, running time. */
function VoiceNote({ url, isMe }: { url: string | null; isMe: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className="flex w-[248px] max-w-full items-center gap-2 py-1 pl-0.5 pr-1">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          isMe ? "bg-wa-teal/25" : "bg-wa-teal/15"
        } text-wa-teal dark:text-wa-green`}
      >
        <Mic className="size-5" />
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
      >
        {playing ? (
          <Pause className="size-5 fill-current" />
        ) : (
          <Play className="size-5 translate-x-[1px] fill-current" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="relative h-[3px] w-full rounded-full bg-wa-meta/40">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-wa-green transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
          <span
            className="absolute top-1/2 size-[11px] -translate-y-1/2 rounded-full bg-wa-green shadow-sm"
            style={{ left: `calc(${pct}% - 5px)` }}
          />
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.05}
            value={time}
            aria-label="Seek voice message"
            onChange={(e) => {
              const el = audio.current;
              if (!el) return;
              el.currentTime = Number(e.target.value);
              setTime(Number(e.target.value));
            }}
            className="absolute inset-x-0 -top-2 h-6 w-full cursor-pointer opacity-0"
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-none text-wa-meta">
          {secs(playing || time > 0 ? time : duration)}
        </p>
      </div>
      <audio
        ref={audio}
        src={url ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        className="hidden"
      />
    </div>
  );
}

/**
 * Extracts one attachment from the archive lazily — only while its bubble is
 * mounted by the virtualizer. URLs come from the client's LRU cache.
 */
export const MediaAttachment = memo(function MediaAttachment({ msg, client, isMe, onOpen }: Props) {
  const file = msg.file;
  const { url, failed, retry } = useMediaUrl(file, client);
  const [ratio, setRatio] = useState(() => client.ratio(file));
  const label = (file?.split("/").pop() ?? msg.label ?? msg.text) || "Attachment";

  const remember = useCallback(
    (w: number, h: number) => {
      if (!file || !w || !h) return;
      client.rememberRatio(file, w, h);
      setRatio((prev) => (prev?.w === w && prev?.h === h ? prev : { w, h }));
    },
    [client, file],
  );

  if (!file || failed) return <Missing label={label} />;

  if (msg.kind === "sticker") {
    return (
      <button
        type="button"
        onClick={() => url && onOpen(msg, url)}
        aria-label="Open sticker"
        className="block size-[130px] rounded-[6px] transition-opacity hover:opacity-90"
      >
        {url ? (
          <img
            src={url}
            alt={label}
            loading="lazy"
            decoding="async"
            onError={retry}
            className="size-full object-contain"
          />
        ) : (
          <span className="wa-media-skeleton block size-full rounded-[6px]" />
        )}
      </button>
    );
  }

  if (msg.kind === "image" || msg.kind === "video") {
    const { w, h } = mediaBox(ratio);
    const video = msg.kind === "video";
    return (
      <button
        type="button"
        onClick={() => url && onOpen(msg, url)}
        aria-label={video ? "Play video" : "Open photo"}
        style={{ width: w, aspectRatio: `${w} / ${h}` }}
        className="group relative block max-w-full overflow-hidden rounded-[6px] bg-black/5 dark:bg-white/5"
      >
        {url ? (
          video ? (
            <video
              src={`${url}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              onError={retry}
              onLoadedMetadata={(e) =>
                remember(e.currentTarget.videoWidth, e.currentTarget.videoHeight)
              }
              className="wa-fade-in size-full object-cover"
            />
          ) : (
            <img
              src={url}
              alt={label}
              loading="lazy"
              decoding="async"
              onError={retry}
              onLoad={(e) => remember(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
              className="wa-fade-in size-full object-cover"
            />
          )
        ) : (
          <span className="wa-media-skeleton absolute inset-0 block" />
        )}

        {video && (
          <>
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[11px] font-medium text-white backdrop-blur-sm">
              <Video className="size-3" /> Video
            </span>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-transform group-hover:scale-105">
                <Play className="size-6 translate-x-[2px] fill-white text-white" />
              </span>
            </span>
          </>
        )}
      </button>
    );
  }

  if (msg.kind === "audio") return <VoiceNote url={url} isMe={isMe} />;

  return (
    <a
      href={url ?? undefined}
      download={label}
      className="flex w-[280px] max-w-full items-center gap-3 rounded-[6px] bg-black/[0.045] px-3 py-2.5 transition-colors hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/70 text-wa-meta dark:bg-black/25">
        <FileText className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] leading-[18px]" title={label}>
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] uppercase text-wa-meta">
          {label.split(".").pop()?.slice(0, 5) ?? "file"} document
        </span>
      </span>
      <Download className="size-4 shrink-0 text-wa-meta" />
    </a>
  );
});
