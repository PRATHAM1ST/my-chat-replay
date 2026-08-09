/**
 * Reply links: which message quotes which, per chat, on the device.
 *
 * WhatsApp's exporter drops reply relationships entirely — a reply arrives as
 * plain text with no reference to what it quoted — so the only truthful source
 * for the quote block is the person who was in the conversation. Two taps
 * attach one; it is stored like stars and renames are, keyed by the library
 * entry id, and deleted with the chat.
 */

const PREFIX = "wa-replies:";
const key = (id: string) => `${PREFIX}${id}`;

/** Parse stored links, dropping anything malformed or self-referential. */
export function parseReplies(raw: string | null): Map<number, number> {
  const out = new Map<number, number>();
  if (!raw) return out;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return out;
    for (const [k, v] of Object.entries(data)) {
      const from = Number(k);
      if (!Number.isInteger(from) || from < 0) continue;
      if (!Number.isInteger(v) || (v as number) < 0 || v === from) continue;
      out.set(from, v as number);
    }
  } catch {
    /* malformed storage reads as no links */
  }
  return out;
}

export function serializeReplies(links: Map<number, number>): string {
  const obj: Record<string, number> = {};
  for (const [from, to] of [...links.entries()].sort((a, b) => a[0] - b[0])) obj[String(from)] = to;
  return JSON.stringify(obj);
}

/** A new map with `from` quoting `to`; linking a message to itself is a no-op. */
export function withLink(
  links: Map<number, number>,
  from: number,
  to: number,
): Map<number, number> {
  if (from === to || from < 0 || to < 0) return links;
  const next = new Map(links);
  next.set(from, to);
  return next;
}

export function withoutLink(links: Map<number, number>, from: number): Map<number, number> {
  if (!links.has(from)) return links;
  const next = new Map(links);
  next.delete(from);
  return next;
}

export function getReplies(id: string | null): Map<number, number> {
  if (!id || typeof localStorage === "undefined") return new Map();
  try {
    return parseReplies(localStorage.getItem(key(id)));
  } catch {
    return new Map();
  }
}

export function saveReplies(id: string | null, links: Map<number, number>): void {
  if (!id || typeof localStorage === "undefined") return;
  try {
    if (links.size) localStorage.setItem(key(id), serializeReplies(links));
    else localStorage.removeItem(key(id));
  } catch {
    /* links are a convenience */
  }
}

export function clearReplies(id: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}

export function clearAllReplies(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
