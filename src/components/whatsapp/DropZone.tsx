import { useCallback, useRef, useState } from "react";
import { Upload, LockKeyhole } from "lucide-react";
import { pickArchive, supportsHandles, type LibraryEntry } from "@/lib/whatsapp/library";
import { Button } from "@/components/ui/button";

interface Props {
  onFile: (file: File, handle?: FileSystemFileHandle) => void;
  busy: boolean;
  phase: string;
  pct: number;
  error: string | null;
  entries?: LibraryEntry[];
}

export function DropZone({
  onFile,
  busy,
  phase,
  pct,
  error,
}: Props) {
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-wa-chat px-5 py-12">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-wa-teal text-wa-out-foreground"><Upload className="size-8" /></span>
        <h1 className="mt-6 text-2xl font-light text-wa-panel-foreground">Open a chat export</h1>
        <p className="mt-2 text-sm text-wa-meta">Choose a WhatsApp ZIP or text file</p>

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
          className={`mt-8 cursor-pointer rounded-lg border-2 border-dashed bg-wa-in p-8 text-center transition-colors ${
            over ? "border-wa-green bg-wa-out/40" : "border-wa-divider"
          }`}
        >
          <input
            ref={input}
            type="file"
            accept=".zip,.txt"
            className="hidden"
            onChange={(e) => pick(e.target.files)}
          />
          <p className="font-medium text-wa-in-foreground">
            {busy ? phase : "Drop your WhatsApp export .zip here"}
          </p>
          <p className="mt-1 text-sm text-wa-meta">
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
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-wa-meta"><LockKeyhole className="size-3.5" /> Your files stay on this device</p>
      </div>
    </main>
  );
}
