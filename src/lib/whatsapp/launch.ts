/**
 * PWA launch handling.
 *
 * When the app is installed, the OS can hand us a file directly ("Open with…"
 * on a .zip). Chromium exposes those as FileSystemFileHandles on
 * window.launchQueue, which is exactly what our library already stores — so an
 * OS-opened archive behaves like one picked in-app, including re-opening later.
 */

interface LaunchParams {
  files?: FileSystemFileHandle[];
}

declare global {
  interface Window {
    launchQueue?: { setConsumer: (cb: (params: LaunchParams) => void) => void };
  }
}

export function onLaunchWithFile(
  handler: (file: File, handle?: FileSystemFileHandle) => void,
): void {
  if (typeof window === "undefined" || !window.launchQueue) return;
  window.launchQueue.setConsumer((params) => {
    const handle = params.files?.[0];
    if (!handle) return;
    void (async () => {
      try {
        const file = await handle.getFile();
        handler(file, handle);
      } catch {
        /* permission withdrawn — user can still open it from the library */
      }
    })();
  });
}
