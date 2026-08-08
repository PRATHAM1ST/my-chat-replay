/// <reference lib="webworker" />
import { unzipSync } from "fflate";
import { parseChat } from "./parse";
import { MEDIA_KINDS, mimeFromFileName, type Msg } from "./types";

let archive: Uint8Array | null = null;
let messages: Msg[] = [];
let haystack: string[] = [];

function post(msg: unknown, transfer?: Transferable[]) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? []);
}

function chatNameFromTxt(name: string) {
  const base = (name.split("/").pop() ?? name).replace(/\.txt$/i, "");
  const m = /WhatsApp Chat (?:with|-)\s*(.+)/i.exec(base);
  return m ? m[1].trim() : base === "_chat" ? "Chat" : base;
}

async function load(file: File) {
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

  post({ type: "progress", phase: "Indexing", pct: 0.9 });
  messages = parsed.messages;
  haystack = messages.map((m) => m.text.toLowerCase());

  post({ type: "loaded", chat: parsed });
}

function query(id: number, text: string, sender: number | null, mediaOnly: boolean) {
  const q = text.trim().toLowerCase();
  const view: number[] = [];
  const matches: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (sender !== null && m.s !== sender) continue;
    if (mediaOnly && !MEDIA_KINDS.includes(m.kind)) continue;
    view.push(i);
    if (q && haystack[i].includes(q)) matches.push(i);
  }
  const v = new Int32Array(view);
  const mt = new Int32Array(matches);
  post({ type: "query", id, view: v, matches: mt }, [v.buffer, mt.buffer]);
}

function media(id: number, name: string) {
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
    query(d.id, d.text, d.sender, d.mediaOnly);
  } else if (d.type === "media") {
    media(d.id, d.name);
  }
};
