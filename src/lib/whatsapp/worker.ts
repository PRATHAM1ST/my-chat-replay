/// <reference lib="webworker" />
import { unzipSync } from "fflate";
import { parseChat } from "./parse";
import {
  LINK_RE,
  SCOPE_KINDS,
  mimeFromFileName,
  type Msg,
  type MsgKind,
  type SearchScope,
} from "./types";

let archive: Uint8Array | null = null;
let messages: Msg[] = [];
let haystack: string[] = [];
/** message indices that contain at least one URL — precomputed once */
let linkFlags: Uint8Array = new Uint8Array(0);

/**
 * Extracted attachments are cached in the worker so scrolling back over media
 * never re-inflates it. Bytes are transferred to the main thread, so the cache
 * keeps its own copy and stays bounded by total size, not entry count.
 */
const MEDIA_CACHE_BYTES = 48 * 1024 * 1024;
const mediaCache = new Map<string, Uint8Array>();
let mediaCacheBytes = 0;

function post(msg: unknown, transfer?: Transferable[]) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? []);
}

function chatNameFromTxt(name: string) {
  const base = (name.split("/").pop() ?? name).replace(/\.txt$/i, "");
  const m = /WhatsApp Chat (?:with|-)\s*(.+)/i.exec(base);
  return m?.[1] ? m[1].trim() : base === "_chat" ? "Chat" : base;
}

function reset() {
  mediaCache.clear();
  mediaCacheBytes = 0;
  // The previous chat's archive has to go with it. Leaving it behind lets a
  // bare .txt opened afterwards resolve attachments out of the chat before it
  // — the same file names recur across exports, so it would even find some.
  archive = null;
}

async function load(file: File) {
  reset();
  post({ type: "progress", phase: "Reading file", pct: 0.05 });
  const buf = new Uint8Array(await file.arrayBuffer());

  let text = "";
  let names: string[] = [];
  let chatName = file.name.replace(/\.(zip|txt)$/i, "");

  if (/\.txt$/i.test(file.name)) {
    text = new TextDecoder("utf-8").decode(buf);
    chatName = chatNameFromTxt(file.name);
  } else {
    post({ type: "progress", phase: "Reading archive", pct: 0.2 });
    archive = buf;
    const all: string[] = [];
    const out = unzipSync(buf, {
      filter: (f) => {
        if (f.name.startsWith("__MACOSX") || f.name.endsWith("/")) return false;
        all.push(f.name);
        return /\.txt$/i.test(f.name);
      },
    });
    names = all;
    // pick the biggest .txt (the transcript)
    let best = "";
    let bestLen = -1;
    for (const [n, bytes] of Object.entries(out)) {
      if (bytes.length > bestLen) {
        bestLen = bytes.length;
        best = n;
      }
    }
    if (!best) throw new Error("No chat .txt file found inside the zip.");
    text = new TextDecoder("utf-8").decode(out[best]);
    chatName = chatNameFromTxt(best);
  }

  post({ type: "progress", phase: "Parsing messages", pct: 0.4 });
  const parsed = parseChat(text, {
    fileNames: names,
    chatName,
    onProgress: (p) => post({ type: "progress", phase: "Parsing messages", pct: 0.4 + p * 0.45 }),
  });

  // Read every referenced picture's dimensions from its file header now, so
  // the transcript is laid out right the first time — no bubble ever resizes
  // when an image finishes decoding. One file is inflated at a time (WhatsApp
  // stores JPEGs uncompressed, so this is close to a memcpy) and the bytes are
  // dropped immediately; a huge archive caps the pass rather than stalling.
  post({ type: "progress", phase: "Measuring pictures", pct: 0.88 });
  const ratios: Record<string, { w: number; h: number }> = {};
  if (archive) {
    const wanted: string[] = [];
    for (const m of parsed.messages) {
      if (m.file && m.kind === "image" && /\.(jpe?g|png|gif)$/i.test(m.file)) wanted.push(m.file);
      if (wanted.length >= 500) break;
    }
    for (const name of wanted) {
      try {
        const one = unzipSync(archive, { filter: (f) => f.name === name })[name];
        const dim = one && imageSize(one);
        if (dim) ratios[name] = dim;
      } catch {
        /* an unreadable picture just measures on decode, as before */
      }
    }
  }

  post({ type: "progress", phase: "Indexing", pct: 0.9 });
  messages = parsed.messages;
  haystack = new Array(messages.length);
  linkFlags = new Uint8Array(messages.length);
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m) continue;
    haystack[i] = m.text.toLowerCase();
    LINK_RE.lastIndex = 0;
    if (m.text.length > 3 && LINK_RE.test(m.text)) linkFlags[i] = 1;
  }

  post({ type: "loaded", chat: parsed, ratios, hasArchive: !!archive });
}

/** Width and height straight from a JPEG/PNG/GIF header, no decode. */
function imageSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    // PNG: IHDR is always the first chunk
    const dv = new DataView(b.buffer, b.byteOffset);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    // GIF: logical screen descriptor
    return { w: b[6]! | (b[7]! << 8), h: b[8]! | (b[9]! << 8) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    // JPEG: walk the markers to the first start-of-frame
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1]!;
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd9) || m === 0x01) {
        i += 2;
        continue;
      }
      const isSOF = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
      if (isSOF) return { w: (b[i + 7]! << 8) | b[i + 8]!, h: (b[i + 5]! << 8) | b[i + 6]! };
      i += 2 + ((b[i + 2]! << 8) | b[i + 3]!);
    }
  }
  return null;
}

function scopeMatches(kind: MsgKind, index: number, scope: SearchScope) {
  if (scope === "all") return true;
  if (scope === "links") return linkFlags[index] === 1;
  return (SCOPE_KINDS[scope] ?? []).includes(kind);
}

/**
 * Search never filters the transcript — WhatsApp keeps the conversation intact
 * and lists hits in a side panel — so this only returns the matching indices.
 */
function query(id: number, text: string, sender: number | null, scope: SearchScope) {
  const q = text.trim().toLowerCase();
  const active = q.length > 0 || sender !== null || scope !== "all";
  if (!active) {
    const empty = new Int32Array(0);
    post({ type: "query", id, matches: empty }, [empty.buffer]);
    return;
  }

  const matches: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || m.kind === "system") continue;
    if (sender !== null && m.s !== sender) continue;
    if (!scopeMatches(m.kind, i, scope)) continue;
    if (q && !(haystack[i] ?? "").includes(q)) continue;
    matches.push(i);
  }
  const mt = new Int32Array(matches);
  post({ type: "query", id, matches: mt }, [mt.buffer]);
}

function remember(name: string, bytes: Uint8Array) {
  if (bytes.byteLength > MEDIA_CACHE_BYTES / 3) return;
  mediaCache.set(name, bytes);
  mediaCacheBytes += bytes.byteLength;
  while (mediaCacheBytes > MEDIA_CACHE_BYTES) {
    const oldest = mediaCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    mediaCacheBytes -= mediaCache.get(oldest)?.byteLength ?? 0;
    mediaCache.delete(oldest);
  }
}

function media(id: number, name: string) {
  const cached = mediaCache.get(name);
  if (cached) {
    // refresh recency, then hand out a copy so the cache keeps its buffer
    mediaCache.delete(name);
    mediaCache.set(name, cached);
    const copy = cached.slice();
    post({ type: "media", id, bytes: copy, mime: mimeFromFileName(name) }, [copy.buffer]);
    return;
  }
  if (!archive) {
    post({ type: "media", id, error: "no archive" });
    return;
  }
  try {
    const out = unzipSync(archive, { filter: (f) => f.name === name });
    const bytes = out[name];
    if (!bytes) {
      post({ type: "media", id, error: "not found" });
      return;
    }
    remember(name, bytes);
    const copy = bytes.slice();
    post({ type: "media", id, bytes: copy, mime: mimeFromFileName(name) }, [copy.buffer]);
  } catch (e) {
    post({ type: "media", id, error: String(e) });
  }
}

self.onmessage = (e: MessageEvent) => {
  const d = e.data;
  if (d.type === "load") {
    load(d.file).catch((err) => post({ type: "error", message: String(err?.message ?? err) }));
  } else if (d.type === "query") {
    query(d.id, d.text, d.sender, d.scope);
  } else if (d.type === "media") {
    media(d.id, d.name);
  }
};
