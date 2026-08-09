import { useCallback, useEffect, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const STORAGE_KEY = "wa-install-banner-dismissed";

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

/** Slim install banner shown in every browser until installed or dismissed. */
export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY) === "true") return;
    setIos(isIos());
    setVisible(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const install = useCallback(async () => {
    if (!deferred) {
      setHelp((v) => !v);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") setVisible(false);
  }, [deferred]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3">
      <div className="pointer-events-auto w-full max-w-[520px] rounded-2xl bg-wa-elevated px-3 py-2.5 text-wa-panel-foreground shadow-[var(--wa-shadow-float)] ring-1 ring-black/5 dark:ring-white/10">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-wa-green text-white">
            <Download className="size-[18px]" />
          </span>
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
            Install Chat Replay as an app
            <span className="hidden text-wa-meta sm:inline"> — opens exports faster, works offline</span>
          </p>
          <button
            type="button"
            onClick={() => void install()}
            className="h-9 shrink-0 rounded-full bg-wa-green px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-wa-teal"
          >
            {deferred ? "Install" : "How?"}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="grid size-9 shrink-0 place-items-center rounded-full text-wa-meta transition-colors hover:bg-wa-hover"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {help && !deferred && (
          <div className="mt-2 rounded-xl bg-wa-input p-2.5 text-[12.5px] leading-relaxed text-wa-meta">
            {ios ? (
              <span className="flex flex-wrap items-center gap-1">
                Tap <Share className="inline size-4" /> Share, then
                <Plus className="inline size-4" /> “Add to Home Screen”.
              </span>
            ) : (
              <span>Open the browser menu and choose “Install app” / “Add to Home screen”.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
