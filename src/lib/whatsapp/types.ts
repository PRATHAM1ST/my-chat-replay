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
  /**
   * Attachments the transcript names by file but the archive does not carry.
   *
   * WhatsApp's "include media" export stops adding files once it hits its size
   * ceiling and writes the transcript anyway, so a perfectly valid .zip can
   * reference hundreds of photos it does not contain. Counting them is what
   * lets the app say so instead of leaving a wall of grey chips.
   */
  missingCount: number;
  /**
   * Which sender is "me": never the one the archive is named after
   * ("WhatsApp Chat with Ann"), else the busiest sender as a fallback guess.
   */
  meIndex: number;
  /** the clock style the exporting phone used — timestamps render to match */
  hour12: boolean;
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
