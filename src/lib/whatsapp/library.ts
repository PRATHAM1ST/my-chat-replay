/**
 * Local chat library.
 *
 * Browsers never expose a file's real path, but the File System Access API
 * gives us a *handle* that can be stored in IndexedDB and re-opened later
 * (usually without re-picking the file). We keep one entry per archive so the
 * app behaves like a chat list: pick once, come back, tap to reopen.
 *
 * Nothing leaves the device — IndexedDB holds the handle + a little metadata,
 * never the archive contents.
 */

import { clearAllPrefs, clearPrefs } from "./prefs";

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
  // The archive on disk is never touched — we only forget our pointer to it
  // and everything we stored about the chat.
  clearPrefs(id);
  if (getLastId() === id) setLastId(null);
}

export async function clearChats() {
  try {
    await tx("readwrite", (s) => s.clear() as unknown as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
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

/** Re-open an archive from a stored handle. Prompts only when needed. */
export async function fileFromEntry(
  entry: LibraryEntry,
  { request = false } = {},
): Promise<File | null> {
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
