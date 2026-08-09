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
  if (new URLSearchParams(window.location.search).has("sw=off")) return true;
  return new URL(window.location.href).searchParams.get("sw") === "off";
}

async function unregisterShareWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active ?? r.waiting ?? r.installing)?.scriptURL.endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export function registerShareTarget(): void {
  if (blocked()) {
    void unregisterShareWorker();
    return;
  }
  void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
    /* share target simply stays unavailable */
  });
}

/** Reads a file handed over by the share sheet, if this load came from one. */
export async function takeSharedFile(): Promise<File | null> {
  if (typeof window === "undefined") return null;
  if (!new URLSearchParams(window.location.search).has("shared")) return null;
  try {
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
