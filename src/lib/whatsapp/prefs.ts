/**
 * Per-chat local preferences: which participant is "you", a custom chat title
 * and custom display names for participants. Stored in localStorage keyed by
 * the library entry id, so it survives reloads and stays on the device.
 */

export interface ChatPrefs {
  meIndex?: number;
  chatName?: string;
  /** original sender name -> display name */
  names?: Record<string, string>;
}

const key = (id: string) => `wa-prefs:${id}`;

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

export function displayNames(senders: string[], prefs: ChatPrefs): string[] {
  return senders.map((s) => prefs.names?.[s]?.trim() || s);
}
