import { useCallback, useRef, useState } from "react";
import { FileArchive, LockKeyhole, MessageSquare, Search, Sparkles, Upload } from "lucide-react";
import { pickArchive, supportsHandles, type LibraryEntry } from "@/lib/whatsapp/library";
import { Logo } from "./Logo";


interface Props {
  onFile: (file: File, handle?: FileSystemFileHandle) => void;
  busy: boolean;
  phase: string;
  pct: number;
  error: string | null;
  entries?: LibraryEntry[];
}

const POINTS = [
  { icon: MessageSquare, text: "Reads like the real thing — bubbles, days, ticks and all" },
  { icon: Search, text: "Search every message, photo, link and document" },
  { icon: Sparkles, text: "Handles hundreds of megabytes without breaking a sweat" },
];

export function DropZone({ onFile, busy, phase, pct, error }: Props) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = useCallback(
    (files: FileList | null) => {
      const f = files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  // Prefer the native picker: it returns a handle we can remember for next time.
  const browse = useCallback(async () => {
    if (busy) return;
    if (supportsHandles) {
      const picked = await pickArchive();
      if (picked) onFile(picked.file, picked.handle);
      return;
    }
    input.current?.click();
  }, [busy, onFile]);

  return (
    <main className="wa-doodle flex min-h-[100dvh] flex-col items-center justify-center px-5 py-12">
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-wa-surface shadow-[var(--wa-shadow-float)]">
            <Logo size={44} />
          </span>

          <h1 className="mt-5 text-[28px] font-light leading-tight text-wa-panel-foreground">
            Chat Replay
          </h1>
          <p className="mt-2 text-[14.5px] text-wa-meta">
            Open a WhatsApp export and read it back as a real chat.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick(e.dataTransfer.files);
          }}
          onClick={browse}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") void browse();
          }}
          className={`mt-7 cursor-pointer rounded-2xl border-2 border-dashed bg-wa-surface p-8 text-center shadow-[var(--wa-shadow-panel)] transition-colors ${
            over ? "border-wa-green bg-wa-green/5" : "border-wa-divider hover:border-wa-green/60"
          }`}
        >
          <input
            ref={input}
            type="file"
            accept=".zip,.txt"
            className="hidden"
            onChange={(e) => pick(e.target.files)}
          />
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-wa-green/12 text-wa-teal dark:text-wa-green">
            {busy ? <FileArchive className="size-6" /> : <Upload className="size-6" />}
          </span>
          <p className="mt-3 text-[15px] font-medium text-wa-panel-foreground">
            {busy ? phase : "Drop your export .zip here"}
          </p>
          <p className="mt-1 text-[13.5px] text-wa-meta">
            {busy ? `${Math.round(pct * 100)}%` : "or click to browse — .zip or _chat.txt"}
          </p>

          {busy && (
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-wa-divider">
              <div
                className="h-full rounded-full bg-wa-green transition-[width] duration-200"
                style={{ width: `${Math.max(4, pct * 100)}%` }}
              />
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-[13.5px] text-destructive">
            {error}
          </p>
        )}

        <ul className="mt-7 space-y-2.5">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[13.5px] text-wa-meta">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-wa-surface text-wa-teal shadow-[var(--wa-shadow-bubble)] dark:text-wa-green">
                <Icon className="size-3.5" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <p className="mt-7 flex items-center justify-center gap-2 text-[12.5px] text-wa-meta">
          <LockKeyhole className="size-3.5" /> Nothing is uploaded — your files stay on this device
        </p>
      </div>
    </main>
  );
}
