/**
 * Starred messages, exactly as WhatsApp keeps them: a per-chat set of message
 * indices, on the device, deleted with the chat.
 *
 * The (de)serialising helpers are pure so they can be unit-tested without a
 * browser; only the thin load/save layer touches localStorage.
 */

const PREFIX = "wa-stars:";
const key = (id: string) => `${PREFIX}${id}`;

/** Parse a stored value into a set, discarding anything malformed. */
export function parseStars(raw: string | null): Set<number> {
  if (!raw) return new Set();
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return new Set();
    return new Set(data.filter((n): n is number => Number.isInteger(n) && n >= 0));
  } catch {
    return new Set();
  }
}

export function serializeStars(stars: Set<number>): string {
  return JSON.stringify([...stars].sort((a, b) => a - b));
}

/** A new set with the message's star flipped — the stored one is untouched. */
export function withToggled(stars: Set<number>, index: number): Set<number> {
  const next = new Set(stars);
  if (!next.delete(index)) next.add(index);
  return next;
}

export function getStars(id: string | null): Set<number> {
  if (!id || typeof localStorage === "undefined") return new Set();
  try {
    return parseStars(localStorage.getItem(key(id)));
  } catch {
    return new Set();
  }
}

export function saveStars(id: string | null, stars: Set<number>): void {
  if (!id || typeof localStorage === "undefined") return;
  try {
    if (stars.size) localStorage.setItem(key(id), serializeStars(stars));
    else localStorage.removeItem(key(id));
  } catch {
    /* stars are a convenience */
  }
}

export function clearStars(id: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}

export function clearAllStars(): void {
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
