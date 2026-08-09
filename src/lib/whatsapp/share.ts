/**
 * PWA worker plumbing: registration, and the share-target hand-off.
 *
 * Android's share sheet delivers files with a POST, which only a service
 * worker can intercept, and the offline shell lives in the same worker
 * (`public/app-sw.js`). The worker must never run in dev or a Lovable preview
 * frame — there it would fight the dev server — so those environments get
 * scrubbed clean instead.
 */

const SW_URL = "/app-sw.js";
const SHARE_KEY = "/__shared-file";

function blocked(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  if (window.top !== window.self) return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  for (const base of ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"]) {
    if (h === base || h.endsWith(`.${base}`)) return true;
  }
  return new URLSearchParams(window.location.search).get("sw") === "off";
}

function scriptOf(reg: ServiceWorkerRegistration): string {
  return (reg.active ?? reg.waiting ?? reg.installing)?.scriptURL ?? "";
}

/** Blocked environments keep nothing: no workers of any kind, no caches. */
async function scrubEverything(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
  try {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  } catch {
    /* ignore */
  }
}

/**
 * Drop workers this app no longer ships (e.g. the old share-only worker).
 * Foreign caches are not touched here — the app worker's activate step deletes
 * every cache that is not its own, version included.
 */
async function evictStaleWorkers(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs.filter((r) => !scriptOf(r).endsWith(SW_URL)).map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

/**
 * The worker's activate step purges foreign caches, but only when a NEW worker
 * version activates — junk that appears while ours is already running would
 * sit forever. This sweeps on every start instead. The name scheme is the
 * contract with app-sw.js: everything ours is "shell-v*" or "assets-v*".
 */
async function purgeForeignCaches(): Promise<void> {
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => !/^(shell|assets)-v/.test(n)).map((n) => caches.delete(n)),
    );
  } catch {
    /* ignore */
  }
}

export function registerPwaWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (blocked()) {
    void scrubEverything();
    return;
  }
  void evictStaleWorkers();
  void purgeForeignCaches();
  void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
    /* share target and offline simply stay unavailable */
  });
}

/**
 * True when this page load is the tail end of a share. Worth knowing before
 * anything else starts opening chats: restoring the previous chat at the same
 * time would leave two archives loading over each other.
 */
export function hasPendingShare(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("shared");
}

/** Reads a file handed over by the share sheet, if this load came from one. */
export async function takeSharedFile(): Promise<File | null> {
  if (typeof window === "undefined") return null;
  if (!new URLSearchParams(window.location.search).has("shared")) return null;
  try {
    // The stash only exists inside the worker, so wait for it to be in charge
    // of this page — on a cold start the redirect can land first.
    if (!navigator.serviceWorker.controller) {
      await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 3000))]);
    }
    const res = await fetch(SHARE_KEY);
    if (!res.ok) return null;
    const name = decodeURIComponent(res.headers.get("x-filename") ?? "shared.zip");
    const blob = await res.blob();
    window.history.replaceState(null, "", window.location.pathname);
    return new File([blob], name, { type: blob.type });
  } catch {
    return null;
  }
}
