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
   * Every attachment we have extracted, kept for the whole session. The archive
   * is already on disk, so evicting buys nothing — and a revoked url is exactly
   * what leaves a bubble showing an empty box.
   */
  private mediaCache = new Map<string, MediaResult>();
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
      case "loaded":
        this.loadResolve?.(d.chat as ParsedChat);
        this.loadResolve = null;
        this.loadReject = null;
        break;
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
    const hit = this.mediaCache.get(name);
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
        const res: MediaResult = { url: URL.createObjectURL(blob), mime: d.mime };
        this.inflight.delete(name);
        if (this.dead) {
          URL.revokeObjectURL(res.url);
          return res;
        }
        this.mediaCache.set(name, res);
        return res;
      })
      .catch((e) => {
        this.inflight.delete(name);
        throw e;
      });
    this.inflight.set(name, p);
    return p;
  }

  /** True once the attachment's url is resolved and ready to render. */
  ready(name: string | undefined) {
    return name ? this.mediaCache.get(name) : undefined;
  }

  /**
   * Extract attachments ahead of time, nearest first, so scrolling lands on
   * pictures that are already decoded. Runs a few at a time to leave the worker
   * responsive for whatever is actually on screen.
   */
  prefetch(names: (string | undefined)[]) {
    for (const n of names) {
      if (!n || this.mediaCache.has(n) || this.inflight.has(n)) continue;
      if (!this.queue.includes(n)) this.queue.push(n);
    }
    this.drain();
  }

  private drain() {
    while (!this.dead && this.active < 3 && this.queue.length) {
      const name = this.queue.shift()!;
      if (this.mediaCache.has(name)) continue;
      this.active++;
      this.media(name)
        .catch(() => undefined)
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }

  /** No-ops kept for callers: nothing is evicted while the chat is open. */
  retain(_name: string) {}
  release(_name: string) {}

  /** Forget a cached url (e.g. it failed to decode) so the next call re-extracts. */
  forget(name: string) {
    const v = this.mediaCache.get(name);
    this.mediaCache.delete(name);
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
    for (const v of this.mediaCache.values()) URL.revokeObjectURL(v.url);
    this.mediaCache.clear();
    this.ratios.clear();
    this.worker.terminate();
  }
}
