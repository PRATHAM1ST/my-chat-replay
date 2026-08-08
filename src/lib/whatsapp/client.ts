import type { ParsedChat } from "./types";

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };

export interface LoadHandlers {
  onProgress: (phase: string, pct: number) => void;
}

export interface QueryResult {
  view: Int32Array;
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

  // LRU of object URLs so media memory stays bounded
  private mediaCache = new Map<string, MediaResult>();
  private mediaLimit = 60;
  private inflight = new Map<string, Promise<MediaResult>>();

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (e: MessageEvent) => this.handle(e.data);
  }

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

  query(text: string, sender: number | null, mediaOnly: boolean): Promise<QueryResult> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ type: "query", id, text, sender, mediaOnly });
    }) as Promise<QueryResult>;
  }

  media(name: string): Promise<MediaResult> {
    const hit = this.mediaCache.get(name);
    if (hit) {
      // refresh recency
      this.mediaCache.delete(name);
      this.mediaCache.set(name, hit);
      return Promise.resolve(hit);
    }
    const running = this.inflight.get(name);
    if (running) return running;

    const id = ++this.id;
    const p = new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: "media", id, name });
    }).then((d) => {
      const blob = new Blob([d.bytes], { type: d.mime });
      const res: MediaResult = { url: URL.createObjectURL(blob), mime: d.mime };
      this.mediaCache.set(name, res);
      while (this.mediaCache.size > this.mediaLimit) {
        const oldest = this.mediaCache.keys().next().value as string | undefined;
        if (!oldest) break;
        const v = this.mediaCache.get(oldest);
        this.mediaCache.delete(oldest);
        if (v) URL.revokeObjectURL(v.url);
      }
      this.inflight.delete(name);
      return res;
    });
    this.inflight.set(name, p);
    return p;
  }

  destroy() {
    for (const v of this.mediaCache.values()) URL.revokeObjectURL(v.url);
    this.mediaCache.clear();
    this.worker.terminate();
  }
}
