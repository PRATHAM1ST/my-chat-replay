import { useCallback, useEffect, useState } from "react";
import type { WaClient } from "@/lib/whatsapp/client";

/**
 * Why a picture cannot be painted.
 *
 * "absent" is the worker refusing to hand the bytes over at all — the entry is
 * not in the archive, or the archive is no longer readable. "undecodable" is
 * the opposite: the bytes are right there and this browser has nothing that
 * will render them (a HEIC photo, a .mkv, an .amr voice note).
 */
export type MediaFailure = "absent" | "undecodable";

/** How many times a stale url is worth re-extracting before it is the codec. */
const TRIES = 2;

/**
 * Resolves one attachment out of the archive, for anything that shows one.
 *
 * Every surface that paints an attachment needs the same three behaviours, and
 * getting any of them wrong is invisible until an export shows up that trips
 * it: claim the file so the memory trim cannot revoke a url that is on screen,
 * release it when the view goes away, and — the one that bites — give up.
 *
 * An <img> whose bytes will never decode fires `error` every single time it is
 * handed a url. Retrying without a ceiling turns that into a loop that
 * re-extracts the file from the zip forever, at sixty rounds a second, which
 * pins the worker and starves every other picture waiting on it. So the retry
 * is capped: twice for a url that really has gone stale, then the verdict is
 * the codec and the caller is told to draw something honest instead.
 *
 * This lives on its own because it was written twice — once per surface — and
 * only one of the copies had the ceiling.
 */
export function useMediaUrl(file: string | undefined, client: WaClient, enabled = true) {
  const [url, setUrl] = useState<string | null>(() =>
    enabled ? (client.ready(file)?.url ?? null) : null,
  );
  const [failed, setFailed] = useState<MediaFailure | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Hold the attachment for as long as this view is showing it. Nothing on
  // screen can be reclaimed, so a picture never goes blank under the reader;
  // once the row or tile goes away it becomes reclaimable again.
  useEffect(() => {
    if (!file || !enabled) return;
    client.retain(file);
    return () => client.release(file);
  }, [file, client, enabled]);

  useEffect(() => {
    if (!file || !enabled) return;
    setFailed(null);
    const cached = client.ready(file);
    if (cached) {
      setUrl(cached.url);
      return;
    }
    let alive = true;
    client
      .media(file)
      .then((r) => alive && setUrl(r.url))
      .catch(() => alive && setFailed("absent"));
    return () => {
      alive = false;
    };
  }, [file, client, enabled, attempt]);

  /**
   * The element refused the url. Usually that is a blob that went stale, so the
   * file is extracted again; past the ceiling it is the codec, and no amount of
   * re-extracting will help. The last url is kept alive in that case — the
   * bytes are good, so handing them over to save is the useful thing left.
   */
  const retry = useCallback(() => {
    if (!file) return;
    if (attempt >= TRIES) {
      setFailed("undecodable");
      return;
    }
    client.forget(file);
    setUrl(null);
    setAttempt((n) => n + 1);
  }, [client, file, attempt]);

  return { url, failed, retry };
}
