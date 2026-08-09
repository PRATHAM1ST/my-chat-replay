export type MsgKind =
  "text" | "image" | "video" | "audio" | "sticker" | "document" | "call" | "system";

export interface Msg {
  /** index in the full message array */
  i: number;
  /** epoch ms */
  ts: number;
  /** index into `senders`, -1 for system messages */
  s: number;
  text: string;
  /** attachment file name inside the zip, when resolvable */
  file?: string;
  /** file name mentioned in the transcript but not present in the archive */
  label?: string;
  /** WhatsApp appended "<This message was edited>" */
  edited?: boolean;
  kind: MsgKind;
}

export interface ParsedChat {
  messages: Msg[];
  senders: string[];
  counts: number[];
  chatName: string;
  mediaCount: number;
  /** heuristic: index of the busiest sender */
  meIndex: number;
}

/** The chips in the search drawer, mirroring WhatsApp's own filter row. */
export type SearchScope = "all" | "photos" | "videos" | "links" | "docs" | "audio";

export interface QueryFilters {
  text: string;
  sender: number | null;
  scope: SearchScope;
}

export const MEDIA_KINDS: MsgKind[] = ["image", "video", "audio", "sticker", "document"];

export const SCOPE_KINDS: Record<Exclude<SearchScope, "all" | "links">, MsgKind[]> = {
  photos: ["image", "sticker"],
  videos: ["video"],
  docs: ["document"],
  audio: ["audio"],
};

export const LINK_RE = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/gi;

export function kindFromFileName(name: string): MsgKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "webp") return "sticker";
  if (["jpg", "jpeg", "png", "gif", "bmp", "heic", "avif"].includes(ext)) return "image";
  if (["mp4", "mov", "3gp", "mkv", "webm", "avi"].includes(ext)) return "video";
  if (["opus", "mp3", "m4a", "ogg", "wav", "aac", "amr"].includes(ext)) return "audio";
  return "document";
}

export function mimeFromFileName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    avif: "image/avif",
    bmp: "image/bmp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    "3gp": "video/3gpp",
    mkv: "video/x-matroska",
    webm: "video/webm",
    opus: "audio/ogg",
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    aac: "audio/aac",
    amr: "audio/amr",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
