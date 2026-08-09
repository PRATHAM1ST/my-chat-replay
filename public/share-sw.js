/**
 * Share-target-only service worker.
 *
 * It stores no pages, no assets and no responses. Everything this app shows
 * comes off the device already, so an offline cache would buy nothing and cost
 * the classic failure: a stale cached shell asking for asset file names that no
 * longer exist after a deploy, and a screen with nothing on it.
 *
 * Its single job is to catch the POST the Android share sheet sends, hand the
 * file to the page, and get out of the way. On activate it also empties Cache
 * Storage, so any cache left behind by an earlier version of this app is gone
 * the first time the new worker runs.
 */

const DB = "wa-share";
const STORE = "stash";
const KEY = "file";
const SHARE_PATH = "/__shared-file";

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, work) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = work(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Nothing here is ever meant to be cached — drop whatever is lying around. */
async function purgeCaches() {
  try {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  } catch {
    /* Cache Storage may be unavailable; that is the desired state anyway */
  }
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(purgeCaches().then(() => self.clients.claim())),
);

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData();
          const file = form.get("file") || form.get("files");
          if (file && typeof file !== "string") {
            await run("readwrite", (s) =>
              s.put({ blob: file, name: file.name || "shared.zip" }, KEY),
            );
            return Response.redirect("/?shared=1", 303);
          }
        } catch {
          /* fall through to a plain open */
        }
        return Response.redirect("/", 303);
      })(),
    );
    return;
  }

  // The handover read. Deliberately one-shot: the page takes the file and the
  // worker keeps nothing.
  if (event.request.method === "GET" && url.pathname === SHARE_PATH) {
    event.respondWith(
      (async () => {
        try {
          const stashed = await run("readonly", (s) => s.get(KEY));
          if (!stashed?.blob) return new Response(null, { status: 404 });
          await run("readwrite", (s) => s.delete(KEY));
          return new Response(stashed.blob, {
            headers: {
              "content-type": stashed.blob.type || "application/octet-stream",
              "x-filename": encodeURIComponent(stashed.name),
              "cache-control": "no-store",
            },
          });
        } catch {
          return new Response(null, { status: 404 });
        }
      })(),
    );
  }
});
