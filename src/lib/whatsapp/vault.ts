/**
 * On-device archive vault.
 *
 * A FileSystemFileHandle is only a *pointer* to a file the user picked. The
 * browser re-checks that grant on every visit, which is why reopening a chat
 * used to mean answering a permission prompt again — and why a file arriving
 * from the Android share sheet, which comes with no handle at all, could never
 * be reopened.
 *
 * So we keep our own copy of the bytes. The Origin Private File System is the
 * right home for it: same-origin only, invisible to the rest of the device, no
 * permission prompt, and writable as a stream so a 500 MB export never has to
 * sit in memory. Browsers without OPFS fall back to a Blob in IndexedDB.
 *
 * The copy still never leaves the device, and "Clear all chats" deletes it.
 */

const DIR = "archives";
const DB = "wa-vault";
const STORE = "blobs";

type Root = FileSystemDirectoryHandle & {
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemDirectoryHandle>;
  removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>;
};

export const hasOpfs =
  typeof navigator !== "undefined" &&
  typeof navigator.storage?.getDirectory === "function" &&
  typeof FileSystemFileHandle !== "undefined" &&
  "createWritable" in FileSystemFileHandle.prototype;

export const hasIdb = typeof indexedDB !== "undefined";

export const vaultSupported = hasOpfs || hasIdb;

/** Storage the browser may evict is no better than no storage at all. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- OPFS ---- */

async function dir(create = false): Promise<FileSystemDirectoryHandle | null> {
  if (!hasOpfs) return null;
  try {
    const root = (await navigator.storage.getDirectory()) as Root;
    return await root.getDirectoryHandle(DIR, { create });
  } catch {
    return null;
  }
}

/** Ids come from a file name, so they have to be flattened into one segment. */
function safeName(id: string) {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0;
  return `${id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)}-${(hash >>> 0).toString(36)}`;
}

/* ----------------------------------------------------------- IndexedDB ---- */

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRun<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await idb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

/* -------------------------------------------------------------- public ---- */

export class QuotaError extends Error {
  constructor() {
    super("Not enough room on this device to keep a copy of this export.");
    this.name = "QuotaError";
  }
}

function isQuota(e: unknown) {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

/** Keeps a copy of `file` so this chat can be reopened without a prompt. */
export async function saveArchive(id: string, file: File): Promise<void> {
  const folder = await dir(true);
  if (folder) {
    const name = safeName(id);
    try {
      const handle = await folder.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      try {
        await file.stream().pipeTo(writable);
      } catch (e) {
        await writable.abort?.().catch(() => undefined);
        throw e;
      }
      return;
    } catch (e) {
      // a half-written archive is worse than none
      await (folder as Root).removeEntry?.(name).catch(() => undefined);
      if (isQuota(e)) throw new QuotaError();
      // fall through and try IndexedDB
    }
  }

  if (!hasIdb) throw new Error("This browser cannot keep a local copy.");
  try {
    await idbRun("readwrite", (s) => s.put(file, id) as IDBRequest<IDBValidKey>);
  } catch (e) {
    if (isQuota(e)) throw new QuotaError();
    throw e;
  }
}

/** The stored copy of an archive, or null when we never managed to keep one. */
export async function loadArchive(id: string, name: string): Promise<File | null> {
  const folder = await dir();
  if (folder) {
    try {
      const handle = await folder.getFileHandle(safeName(id));
      const file = await handle.getFile();
      if (file.size > 0) return new File([file], name, { type: file.type });
    } catch {
      /* not in OPFS — try IndexedDB */
    }
  }
  if (!hasIdb) return null;
  try {
    const blob = await idbRun<Blob | undefined>(
      "readonly",
      (s) => s.get(id) as IDBRequest<Blob | undefined>,
    );
    return blob ? new File([blob], name, { type: blob.type }) : null;
  } catch {
    return null;
  }
}

export async function hasArchive(id: string): Promise<boolean> {
  const folder = await dir();
  if (folder) {
    try {
      await folder.getFileHandle(safeName(id));
      return true;
    } catch {
      /* fall through */
    }
  }
  if (!hasIdb) return false;
  try {
    return (await idbRun("readonly", (s) => s.count(id) as IDBRequest<number>)) > 0;
  } catch {
    return false;
  }
}

export async function deleteArchive(id: string): Promise<void> {
  const folder = (await dir()) as Root | null;
  await folder?.removeEntry?.(safeName(id)).catch(() => undefined);
  if (!hasIdb) return;
  try {
    await idbRun("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}

export async function clearVault(): Promise<void> {
  if (hasOpfs) {
    try {
      const root = (await navigator.storage.getDirectory()) as Root;
      await root.removeEntry?.(DIR, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  if (!hasIdb) return;
  try {
    await idbRun("readwrite", (s) => s.clear() as unknown as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}
