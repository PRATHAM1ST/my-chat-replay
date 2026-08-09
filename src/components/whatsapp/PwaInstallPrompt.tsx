import { useEffect, useState, useCallback } from "react";
import { Download, Share, X, Plus } from "lucide-react";
import { IconButton } from "./ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const STORAGE_KEY = "wa-install-prompt-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as typeof window.navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    setIos(isIos());

    if (localStorage.getItem(STORAGE_KEY) === "true") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Show the popup regardless of whether the browser offers a native prompt.
    const timer = setTimeout(() => setVisible(true), 1200);

    const onAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    } else {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setVisible(false);
    setDeferred(null);
  }, [deferred]);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  if (!visible || installed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center sm:justify-end sm:p-6">
      <div className="fixed inset-0 bg-black/25" onClick={dismiss} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install Chat Replay"
        className="relative w-full max-w-[320px] overflow-hidden rounded-2xl bg-wa-elevated p-5 text-wa-panel-foreground shadow-[var(--wa-shadow-float)] ring-1 ring-black/5 dark:ring-white/10"
      >
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-wa-green text-white shadow-[var(--wa-shadow-bubble)]">
            <Download className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-medium leading-tight">Add Chat Replay</h3>
            <p className="mt-1 text-[13.5px] leading-snug text-wa-meta">
              Install this app on your home screen for the fastest way to open WhatsApp exports.
            </p>
          </div>
          <IconButton
            aria-label="Dismiss"
            onClick={dismiss}
            className="-mr-2 -mt-2 size-9 text-wa-meta"
          >
            <X className="size-5" />
          </IconButton>
        </div>

        {!deferred && (
          <div className="mt-4 rounded-xl bg-wa-input p-3 text-[13px] leading-relaxed text-wa-meta">
            {ios ? (
              <span className="flex flex-wrap items-center gap-1">
                Tap <Share className="inline size-4" /> Share, then
                <Plus className="inline size-4" /> “Add to Home Screen”.
              </span>
            ) : (
              <span>
                Open your browser menu and choose “Install app” / “Add to Home screen” to install.
              </span>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="flex h-10 flex-1 items-center justify-center rounded-full bg-wa-input px-4 text-[14px] font-medium text-wa-meta transition-colors hover:bg-wa-hover"
          >
            {deferred ? "Not now" : "Got it"}
          </button>
          {deferred && (
            <button
              type="button"
              onClick={install}
              className="flex h-10 flex-1 items-center justify-center rounded-full bg-wa-green px-4 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-wa-teal"
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
