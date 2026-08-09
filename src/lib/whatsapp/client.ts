import type { ParsedChat, SearchScope } from "./types";

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };

export interface LoadHandlers {
  onProgress: (phase: string, pct: number) => void;
}

export interface QueryResult {
  matches: Int32Array;
}

export interface MediaResult {
  url: string;
  mime: string;
}

interface Held extends MediaResult {
  size: number;
}

/** How much released media to keep around for a quick scroll back. */
const IDLE_BUDGET = 48 * 1024 * 1024;

/** Talks to the parsing worker. All heavy work happens off the main thread. */
export class WaClient {
  private worker: Worker;
  private id = 0;
  private pending = new Map<number, Pending>();
  private loadResolve: ((c: ParsedChat) => void) | null = null;
  private loadReject: ((e: unknown) => void) | null = null;
  private handlers: LoadHandlers | null = null;
  private dead = false;

  /**
   * Extracted attachments, held only for as long as something needs them.
   *
   * An object url pins the whole decoded file in memory, so "keep everything"
   * means a 500 MB export becomes 500 MB of live blobs a few seconds after it
   * opens — which is what stops pictures rendering at all. Instead, a bubble
   * retains its attachment while it is mounted and releases it when the
   * virtualizer unmounts the row. Retained entries are never revoked, so what
   * is on screen can never break; released ones stay in a byte-capped pool so
   * scrolling back a screen or two is still instant.
   */
  private held = new Map<string, Held>();
  private refs = new Map<string, number>();
  /** names with no holder left, oldest first */
  private idle: string[] = [];
  private idleBytes = 0;
  private inflight = new Map<string, Promise<MediaResult>>();
  /** Names queued for background prefetch, drained a few at a time. */
  private queue: string[] = [];
  private active = 0;

  /**
   * Natural pixel size of every attachment we have decoded, so a row that
   * scrolls back into view reserves the right height immediately instead of
   * resizing once the picture decodes — that resize is what makes a virtual
   * list jump.
   */
  private ratios = new Map<string, { w: number; h: number }>();

  /** False when the source was a bare .txt — attachments can never resolve. */
  archivePresent = true;

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (e: MessageEvent) => this.handle(e.data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handle(d: any) {
    switch (d?.type) {
      case "progress":
        this.handlers?.onProgress(d.phase, d.pct);
        break;
      case "loaded": {
        // dimensions the worker read straight out of the archive's image
        // headers — rows never resize when a picture decodes
        const known = d.ratios as Record<string, { w: number; h: number }> | undefined;
        if (known)
          for (const [name, r] of Object.entries(known)) this.rememberRatio(name, r.w, r.h);
        this.archivePresent = d.hasArchive !== false;
        this.loadResolve?.(d.chat as ParsedChat);
        this.loadResolve = null;
        this.loadReject = null;
        break;
      }
      case "error":
        this.loadReject?.(new Error(d.message));
        this.loadReject = null;
        this.loadResolve = null;
        break;
      case "query":
      case "media": {
        const p = this.pending.get(d.id);
        if (!p) return;
        this.pending.delete(d.id);
        if (d.error) p.reject(new Error(d.error));
        else p.resolve(d);
        break;
      }
    }
  }

  load(file: File, handlers: LoadHandlers): Promise<ParsedChat> {
    this.handlers = handlers;
    return new Promise<ParsedChat>((resolve, reject) => {
      this.loadResolve = resolve;
      this.loadReject = reject;
      this.worker.postMessage({ type: "load", file });
    });
  }

  query(text: string, sender: number | null, scope: SearchScope): Promise<QueryResult> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ type: "query", id, text, sender, scope });
    }) as Promise<QueryResult>;
  }

  /** Cached natural size of an attachment, once it has been decoded once. */
  ratio(name: string | undefined) {
    return name ? this.ratios.get(name) : undefined;
  }

  rememberRatio(name: string, w: number, h: number) {
    if (w > 0 && h > 0) this.ratios.set(name, { w, h });
  }

  media(name: string): Promise<MediaResult> {
    const hit = this.held.get(name);
    if (hit) return Promise.resolve(hit);
    const running = this.inflight.get(name);
    if (running) return running;

    const id = ++this.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: "media", id, name });
    })
      .then((d) => {
        const blob = new Blob([d.bytes], { type: d.mime });
        const res: Held = { url: URL.createObjectURL(blob), mime: d.mime, size: blob.size };
        this.inflight.delete(name);
        if (this.dead) {
          URL.revokeObjectURL(res.url);
          return res;
        }
        this.held.set(name, res);
        if (!this.refs.get(name)) this.park(name, res);
        return res;
      })
      .catch((e) => {
        this.inflight.delete(name);
        throw e;
      });
    this.inflight.set(name, p);
    return p;
  }

  /** The attachment's url when it is already extracted and ready to paint. */
  ready(name: string | undefined) {
    return name ? this.held.get(name) : undefined;
  }

  /**
   * Extract attachments ahead of time, nearest first, so scrolling lands on
   * pictures that are already decoded. Runs a few at a time to leave the worker
   * responsive for whatever is actually on screen.
   */
  prefetch(names: (string | undefined)[]) {
    for (const n of names) {
      if (!n || this.held.has(n) || this.inflight.has(n)) continue;
      if (!this.queue.includes(n)) this.queue.push(n);
    }
    this.drain();
  }

  private drain() {
    while (!this.dead && this.active < 3 && this.queue.length) {
      const name = this.queue.shift()!;
      if (this.held.has(name)) continue;
      this.active++;
      this.media(name)
        .catch(() => undefined)
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }

  /** Claim an attachment for as long as a bubble is showing it. */
  retain(name: string) {
    this.refs.set(name, (this.refs.get(name) ?? 0) + 1);
    const at = this.idle.indexOf(name);
    if (at !== -1) {
      this.idle.splice(at, 1);
      this.idleBytes -= this.held.get(name)?.size ?? 0;
    }
  }

  /** The bubble is gone; the attachment may now be reclaimed under pressure. */
  release(name: string) {
    const left = (this.refs.get(name) ?? 0) - 1;
    if (left > 0) {
      this.refs.set(name, left);
      return;
    }
    this.refs.delete(name);
    const entry = this.held.get(name);
    if (entry) this.park(name, entry);
  }

  /** Move an unclaimed attachment into the pool, trimming it back to budget. */
  private park(name: string, entry: Held) {
    if (this.idle.includes(name)) return;
    this.idle.push(name);
    this.idleBytes += entry.size;
    while (this.idleBytes > IDLE_BUDGET && this.idle.length > 1) {
      const oldest = this.idle.shift();
      if (oldest === undefined) break;
      const gone = this.held.get(oldest);
      if (!gone) continue;
      this.idleBytes -= gone.size;
      this.held.delete(oldest);
      URL.revokeObjectURL(gone.url);
    }
  }

  /** Drop a url that failed to decode so the next call extracts it again. */
  forget(name: string) {
    const v = this.held.get(name);
    this.held.delete(name);
    const at = this.idle.indexOf(name);
    if (at !== -1) {
      this.idle.splice(at, 1);
      this.idleBytes -= v?.size ?? 0;
    }
    if (v) URL.revokeObjectURL(v.url);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    // Terminating the worker silently strands anything still in flight, and a
    // load that never settles leaves the UI stuck on "Reading file" forever.
    const gone = new DOMException("The chat was closed before it finished loading.", "AbortError");
    this.loadReject?.(gone);
    this.loadResolve = null;
    this.loadReject = null;
    for (const p of this.pending.values()) p.reject(gone);
    this.pending.clear();
    this.inflight.clear();
    this.queue = [];

    for (const v of this.held.values()) URL.revokeObjectURL(v.url);
    this.held.clear();
    this.refs.clear();
    this.idle = [];
    this.idleBytes = 0;
    this.ratios.clear();
    this.worker.terminate();
  }
}
