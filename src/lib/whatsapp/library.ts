/**
 * Local chat library.
 *
 * One entry per archive, so the app behaves like a chat list: open once, come
 * back, tap to reopen.
 *
 * Two things can point at an archive. The vault holds our own copy of the
 * bytes and needs no permission, so it is always tried first — that is what
 * makes reopening silent and what lets a file handed over by the share sheet
 * (which carries no handle) be reopened at all. The FileSystemFileHandle is
 * the fallback for browsers with no vault, and it is the one that prompts.
 *
 * Nothing leaves the device.
 */

import { clearAllPrefs, clearPrefs } from "./prefs";
import { clearVault, deleteArchive, hasArchive, loadArchive } from "./vault";

declare global {
  interface FileSystemFileHandle {
    queryPermission?: (d: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (d: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  }
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle[]>;
  }
}

export interface LibraryEntry {
  id: string;
  name: string;
  size: number;
  addedAt: number;
  lastOpened: number;
  chatName?: string;
  msgCount?: number;
  mediaCount?: number;
  /** FileSystemFileHandle when the browser supports it */
  handle?: FileSystemFileHandle;
  /** a copy of the archive lives in the vault, so no permission is needed */
  stored?: boolean;
}

const DB = "wa-library";
const STORE = "chats";
const LAST_KEY = "wa-library-last";

export const supportsHandles = typeof window !== "undefined" && "showOpenFilePicker" in window;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function listChats(): Promise<LibraryEntry[]> {
  try {
    const all = await tx<LibraryEntry[]>(
      "readonly",
      (s) => s.getAll() as IDBRequest<LibraryEntry[]>,
    );
    return all.sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

export async function putChat(entry: LibraryEntry) {
  try {
    await tx("readwrite", (s) => s.put(entry) as IDBRequest<IDBValidKey>);
  } catch {
    /* ignore — library is a convenience, not a requirement */
  }
}

export async function removeChat(id: string) {
  try {
    await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
  // The user's own archive on disk is never touched — we drop our copy of it,
  // our pointer to it, and everything we stored about the chat.
  await deleteArchive(id);
  clearPrefs(id);
  if (getLastId() === id) setLastId(null);
}

export async function clearChats() {
  try {
    await tx("readwrite", (s) => s.clear() as unknown as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
  await clearVault();
  clearAllPrefs();
  setLastId(null);
}

export function getLastId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function setLastId(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_KEY, id);
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* ignore */
  }
}

export function entryId(name: string, size: number) {
  return `${name}::${size}`;
}

type Perm = "granted" | "prompt" | "denied";

export async function handlePermission(handle: FileSystemFileHandle): Promise<Perm> {
  try {
    return ((await handle.queryPermission?.({ mode: "read" })) ?? "prompt") as Perm;
  } catch {
    return "prompt";
  }
}

/**
 * Whether opening this entry will put a permission prompt in the user's way.
 * Our own copy never does; a bare handle does until the browser says granted.
 */
export async function entryNeedsPermission(entry: LibraryEntry): Promise<boolean> {
  if (entry.stored && (await hasArchive(entry.id))) return false;
  if (!entry.handle) return true;
  return (await handlePermission(entry.handle)) !== "granted";
}

/**
 * Re-open an archive. The vault copy is tried first and never prompts; the
 * handle is only touched when there is no copy to read.
 */
export async function fileFromEntry(
  entry: LibraryEntry,
  { request = false } = {},
): Promise<File | null> {
  if (entry.stored) {
    const copy = await loadArchive(entry.id, entry.name);
    if (copy) return copy;
  }

  const handle = entry.handle;
  if (!handle) return null;
  let perm = await handlePermission(handle);
  if (perm !== "granted" && request) {
    try {
      perm = ((await handle.requestPermission?.({ mode: "read" })) ?? "denied") as Perm;
    } catch {
      return null;
    }
  }
  if (perm !== "granted") return null;
  try {
    return await handle.getFile();
  } catch {
    return null;
  }
}

/** Open the native picker so we get a persistable handle. */
export async function pickArchive(): Promise<{ file: File; handle?: FileSystemFileHandle } | null> {
  if (!supportsHandles) return null;
  try {
    const [handle] =
      (await window.showOpenFilePicker?.({
        multiple: false,
        types: [
          {
            description: "WhatsApp export",
            accept: { "application/zip": [".zip"], "text/plain": [".txt"] },
          },
        ],
      })) ?? [];
    if (!handle) return null;
    return { file: await handle.getFile(), handle };
  } catch {
    return null; // user cancelled
  }
}
