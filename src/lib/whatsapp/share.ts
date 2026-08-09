/**
 * Share-target plumbing.
 *
 * Android's share sheet delivers files with a POST, which only a service worker
 * can intercept. Ours caches nothing and only handles that POST, so it can't
 * serve a stale app — but it still must never run in dev or Lovable preview.
 */

const SW_URL = "/share-sw.js";
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

async function unregisterShareWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs.filter((r) => scriptOf(r).endsWith(SW_URL)).map((r) => r.unregister()),
  );
}

/**
 * Nothing this app serves should ever come out of a cache: the transcript, the
 * media and the archive are all already on the device. A cache can only do
 * harm here — a shell held over from an earlier deploy asks for asset files
 * that no longer exist, and the app comes up blank. So on every start we empty
 * Cache Storage and drop any service worker that is not the share handler.
 */
async function evictStaleWorkers(): Promise<void> {
  try {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  } catch {
    /* no Cache Storage is exactly what we want */
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs.filter((r) => !scriptOf(r).endsWith(SW_URL)).map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

export function registerShareTarget(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void evictStaleWorkers();
  if (blocked()) {
    void unregisterShareWorker();
    return;
  }
  void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
    /* share target simply stays unavailable */
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
