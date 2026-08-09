import { kindFromFileName, type Msg, type MsgKind, type ParsedChat } from "./types";

// Matches both iOS "[12/03/2024, 14:22:01] Name: text" and
// Android "12/03/24, 2:22 pm - Name: text" line headers.
const HEAD =
  /^\[?(\d{1,4})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([APap])\.?[Mm]\.?)?\]?(?:\s*-)?\s*([\s\S]*)$/;

const ATTACHED_IOS = /<attached:\s*([^>]+)>/i;
const ATTACHED_ANDROID = /^(.+?)\s*\((?:file attached|attached)\)$/i;
const OMITTED =
  /\b(image|photo|video|audio|voice message|sticker|GIF|document|Contact card)\b\s+omitted/i;

/** strip zero-width / directional marks WhatsApp sprinkles into exports */
function clean(s: string) {
  return s.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, "");
}

function detectDayFirst(lines: string[]): boolean {
  for (let i = 0; i < lines.length; i++) {
    const m = HEAD.exec(clean(lines[i] ?? ""));
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) return true;
    if (b > 12) return false;
  }
  return true;
}

function omittedKind(text: string): MsgKind | null {
  const m = OMITTED.exec(text);
  if (!m) return null;
  const w = (m[1] ?? "").toLowerCase();
  if (w === "sticker") return "sticker";
  if (w === "video") return "video";
  if (w === "audio" || w === "voice message") return "audio";
  if (w === "image" || w === "photo" || w === "gif") return "image";
  return "document";
}

export interface ParseOptions {
  /** file names present in the archive, used to resolve attachments */
  fileNames?: string[];
  chatName?: string;
  onProgress?: (pct: number) => void;
}

export function parseChat(raw: string, opts: ParseOptions = {}): ParsedChat {
  const lines = raw.split(/\r?\n/);
  const dayFirst = detectDayFirst(lines);

  // lowercase base-name -> real archive path
  const lookup = new Map<string, string>();
  for (const n of opts.fileNames ?? []) {
    const base = n.split("/").pop() ?? n;
    lookup.set(base.toLowerCase(), n);
  }

  const messages: Msg[] = [];
  const senders: string[] = [];
  const counts: number[] = [];
  const senderIdx = new Map<string, number>();
  let mediaCount = 0;

  const pushLine = (text: string, ts: number, sender: number) => {
    let body = text;
    let file: string | undefined;
    let label: string | undefined;
    let edited = false;
    let kind: MsgKind = sender < 0 ? "system" : "text";

    const editedMark = /\s*<this message was edited>\s*$/i;
    if (editedMark.test(body)) {
      edited = true;
      body = body.replace(editedMark, "");
    }

    const ios = ATTACHED_IOS.exec(body);
    // Android writes the attachment on its own first line and puts the caption,
    // if there is one, on the lines beneath it.
    const firstBreak = body.indexOf("\n");
    const headLine = (firstBreak === -1 ? body : body.slice(0, firstBreak)).trim();
    const android = ios ? null : ATTACHED_ANDROID.exec(headLine);
    const rawName = ios?.[1] ?? android?.[1];

    if (rawName) {
      const name = rawName.trim();
      const resolved = lookup.get((name.split("/").pop() ?? name).toLowerCase());
      file = resolved;
      kind = kindFromFileName(name);
      body = ios
        ? body.replace(ATTACHED_IOS, "").trim()
        : firstBreak === -1
          ? ""
          : body.slice(firstBreak + 1).trim();
      if (!resolved) label = name;
      mediaCount++;
    } else if (sender >= 0) {
      // "<Media omitted>" / "video omitted", sometimes followed by a file name
      const nl = body.indexOf("\n");
      const first = (nl === -1 ? body : body.slice(0, nl)).trim();
      if (/omitted/i.test(first)) {
        const rest = nl === -1 ? "" : body.slice(nl + 1).trim();
        const named = rest && rest.length <= 120 && !rest.includes("\n") ? rest : undefined;
        const resolved = named
          ? lookup.get((named.split("/").pop() ?? named).toLowerCase())
          : undefined;
        kind = omittedKind(first) ?? (named ? kindFromFileName(named) : "document");
        if (resolved) file = resolved;
        else label = named ?? first.replace(/[<>]/g, "");
        body = named ? "" : rest;
        mediaCount++;
      }
    }

    messages.push({
      i: messages.length,
      ts,
      s: sender,
      text: body,
      kind,
      ...(file ? { file } : {}),
      ...(label ? { label } : {}),
      ...(edited ? { edited: true } : {}),
    });
  };

  let curTs = 0;
  let curSender = -1;
  let curText: string[] = [];
  let has = false;

  const flush = () => {
    if (!has) return;
    pushLine(curText.join("\n").trim(), curTs, curSender);
    has = false;
    curText = [];
  };

  const step = Math.max(1, Math.floor(lines.length / 50));

  for (let li = 0; li < lines.length; li++) {
    if (opts.onProgress && li % step === 0) opts.onProgress(li / Math.max(1, lines.length));

    const line = clean(lines[li] ?? "");
    const m = HEAD.exec(line);
    if (!m) {
      if (has) curText.push(line);
      continue;
    }

    flush();

    const n1 = Number(m[1]);
    const n2 = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const day = dayFirst ? n1 : n2;
    const month = dayFirst ? n2 : n1;
    let hour = Number(m[4]);
    const min = Number(m[5]);
    const sec = m[6] ? Number(m[6]) : 0;
    const ap = m[7]?.toLowerCase();
    if (ap === "p" && hour < 12) hour += 12;
    if (ap === "a" && hour === 12) hour = 0;
    curTs = new Date(year, month - 1, day, hour, min, sec).getTime();

    const rest = m[8] ?? "";
    const sm = /^([^:\n]{1,80}?):\s([\s\S]*)$/.exec(rest);
    if (sm) {
      const name = (sm[1] ?? "").trim();
      let idx = senderIdx.get(name);
      if (idx === undefined) {
        idx = senders.length;
        senderIdx.set(name, idx);
        senders.push(name);
        counts.push(0);
      }
      counts[idx] = (counts[idx] ?? 0) + 1;
      curSender = idx;
      curText = [sm[2] ?? ""];
    } else {
      curSender = -1;
      curText = [rest];
    }
    has = true;
  }
  flush();

  let meIndex = 0;
  for (let i = 1; i < counts.length; i++)
    if ((counts[i] ?? 0) > (counts[meIndex] ?? 0)) meIndex = i;

  const other = senders.find((_, i) => i !== meIndex);
  return {
    messages,
    senders,
    counts,
    chatName: opts.chatName ?? (senders.length === 2 && other ? other : "Chat"),
    mediaCount,
    meIndex,
  };
}
