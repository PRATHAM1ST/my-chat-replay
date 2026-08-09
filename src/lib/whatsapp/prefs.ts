/**
 * Per-chat local preferences: which participant is "you", a custom chat title,
 * custom display names for participants and the last reading position. Stored
 * in localStorage keyed by the library entry id, so it survives reloads and
 * stays on the device.
 */

export interface ChatPrefs {
  meIndex?: number;
  chatName?: string;
  /** original sender name -> display name */
  names?: Record<string, string>;
  /** last read message index inside `messages` */
  scrollIndex?: number;
  /** pixels scrolled past the top of that message */
  scrollOffset?: number;
  /** the reader was parked at the newest message */
  atBottom?: boolean;
}

const PREFIX = "wa-prefs:";
const key = (id: string) => `${PREFIX}${id}`;

export function getPrefs(id: string | null): ChatPrefs {
  if (!id) return {};
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as ChatPrefs) : {};
  } catch {
    return {};
  }
}

export function savePrefs(id: string | null, prefs: ChatPrefs): ChatPrefs {
  if (!id) return prefs;
  try {
    localStorage.setItem(key(id), JSON.stringify(prefs));
  } catch {
    /* ignore — preferences are a convenience */
  }
  return prefs;
}

/** Forget everything stored for one chat (names, perspective, scroll position). */
export function clearPrefs(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}

/** Forget the stored settings of every chat. */
export function clearAllPrefs() {
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

export function displayNames(senders: string[], prefs: ChatPrefs): string[] {
  return senders.map((s) => prefs.names?.[s]?.trim() || s);
}
