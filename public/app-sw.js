/**
 * The app's one service worker: share target + an offline shell that cannot
 * go stale.
 *
 * The failure that made caching feel dangerous here was a cached HTML shell
 * surviving a deploy and asking for hashed asset files that no longer exist —
 * a blank app. This design makes that impossible:
 *
 *  - Navigations are NETWORK-FIRST. While online, the browser always gets the
 *    freshly served HTML, so it always references live asset names. The cached
 *    copy is only ever used when the network is gone.
 *  - Files under /assets/ have content-hashed names, so they are immutable by
 *    definition: cache-first is safe forever, and a new deploy simply uses new
 *    names.
 *  - Other statics (icons, fonts, wallpaper, manifest) are fresh-first with a
 *    cache fallback: never stale online, still present offline.
 *  - Everything lives in version-keyed caches; activating a new worker deletes
 *    every cache that is not ours, including anything an older app left.
 *
 * The share-target handler stashes the POSTed file in IndexedDB, not Cache
 * Storage, so the cache layer stays purely a copy of what the server said.
 */

const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const KEEP = new Set([SHELL, ASSETS]);

/* ------------------------------------------------------ share-target stash */

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

/* -------------------------------------------------------------- lifecycle */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KEEP.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  ),
);

/* -------------------------------------------------------------- fetch path */

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Navigations: the network is the truth; the cache is only for offline. */
async function navigation(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(SHELL);
      // one canonical shell — every route serves the same SPA document
      cache.put("/", fresh.clone());
    }
    return fresh;
  } catch {
    return (
      (await caches.match(request, { cacheName: SHELL })) ??
      (await caches.match("/", { cacheName: SHELL })) ??
      Response.error()
    );
  }
}

/** Content-hashed files never change under the same name. */
async function immutable(request) {
  const hit = await caches.match(request, { cacheName: ASSETS });
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) {
    const cache = await caches.open(ASSETS);
    cache.put(request, fresh.clone());
    trim(ASSETS, 120);
  }
  return fresh;
}

/** Unhashed statics: always prefer the network, fall back when offline. */
async function freshFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(ASSETS);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    return (await caches.match(request, { cacheName: ASSETS })) ?? Response.error();
  }
}

const STATIC_PATH = /^\/(fonts|icons|screenshots)\/|\.(png|svg|webmanifest|ico|txt)$/;

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

  if (event.request.method !== "GET") return;

  // The handover read. Deliberately one-shot: the page takes the file and the
  // worker keeps nothing.
  if (url.pathname === SHARE_PATH) {
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
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(navigation(event.request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(immutable(event.request));
    return;
  }
  if (STATIC_PATH.test(url.pathname)) {
    event.respondWith(freshFirst(event.request));
  }
  // anything else goes straight to the network, untouched
});
