/**
 * Emoji reactions, one per message, per chat, on the device.
 *
 * Exports carry no reaction data at all — WhatsApp drops them the same way it
 * drops reply references — so, like reply links, reactions here are curated by
 * the person who lived the conversation. They are stored like stars are, keyed
 * by the library entry id, and deleted with the chat.
 */

const PREFIX = "wa-reactions:";
const key = (id: string) => `${PREFIX}${id}`;
/** Longest thing accepted as "one emoji" — covers ZWJ families and flags. */
const MAX_LEN = 28;

/** Parse stored reactions, discarding anything malformed. */
export function parseReactions(raw: string | null): Map<number, string> {
  const out = new Map<number, string>();
  if (!raw) return out;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return out;
    for (const [k, v] of Object.entries(data)) {
      const index = Number(k);
      if (!Number.isInteger(index) || index < 0) continue;
      if (typeof v !== "string" || !v.trim() || v.length > MAX_LEN) continue;
      out.set(index, v);
    }
  } catch {
    /* malformed storage reads as no reactions */
  }
  return out;
}

export function serializeReactions(reactions: Map<number, string>): string {
  const obj: Record<string, string> = {};
  for (const [index, emoji] of [...reactions.entries()].sort((a, b) => a[0] - b[0]))
    obj[String(index)] = emoji;
  return JSON.stringify(obj);
}

/**
 * A new map with the message's reaction set, replaced, or — when `emoji` is
 * null or what is already there — removed, exactly like tapping in the app.
 */
export function withReaction(
  reactions: Map<number, string>,
  index: number,
  emoji: string | null,
): Map<number, string> {
  if (index < 0) return reactions;
  const cleaned = emoji?.trim() ? emoji.trim().slice(0, MAX_LEN) : null;
  const next = new Map(reactions);
  if (cleaned === null || next.get(index) === cleaned) next.delete(index);
  else next.set(index, cleaned);
  return next;
}

export function getReactions(id: string | null): Map<number, string> {
  if (!id || typeof localStorage === "undefined") return new Map();
  try {
    return parseReactions(localStorage.getItem(key(id)));
  } catch {
    return new Map();
  }
}

export function saveReactions(id: string | null, reactions: Map<number, string>): void {
  if (!id || typeof localStorage === "undefined") return;
  try {
    if (reactions.size) localStorage.setItem(key(id), serializeReactions(reactions));
    else localStorage.removeItem(key(id));
  } catch {
    /* reactions are a convenience */
  }
}

export function clearReactions(id: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}

export function clearAllReactions(): void {
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
