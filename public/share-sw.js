/**
 * Share-target-only service worker.
 *
 * It caches nothing and never touches navigations. Its single job is to catch
 * the POST the Android share sheet sends to /share-target, stash the shared
 * file so the page can pick it up, and redirect to the app.
 */

const SHARE_CACHE = "chat-replay-share-v1";
const SHARE_KEY = "/__shared-file";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
            const cache = await caches.open(SHARE_CACHE);
            await cache.put(
              SHARE_KEY,
              new Response(file, {
                headers: {
                  "content-type": file.type || "application/octet-stream",
                  "x-filename": encodeURIComponent(file.name || "shared.zip"),
                },
              }),
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

  if (event.request.method === "GET" && url.pathname === SHARE_KEY) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHARE_CACHE);
        const hit = await cache.match(SHARE_KEY);
        if (!hit) return new Response(null, { status: 404 });
        await cache.delete(SHARE_KEY);
        return hit;
      })(),
    );
  }
});
