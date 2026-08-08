import { useCallback, useRef, useState } from "react";
import { Upload, ShieldCheck, FileArchive } from "lucide-react";
import { formatBytes } from "@/lib/whatsapp/format";
import { pickArchive, supportsHandles, type LibraryEntry } from "@/lib/whatsapp/library";
import { ChatLibrary } from "./ChatLibrary";

interface Props {
  onFile: (file: File, handle?: FileSystemFileHandle) => void;
  busy: boolean;
  phase: string;
  pct: number;
  error: string | null;
  entries: LibraryEntry[];
  needsPermission: Set<string>;
  busyId: string | null;
  onOpenEntry: (entry: LibraryEntry) => void;
  onRemoveEntry: (entry: LibraryEntry) => void;
  onClearEntries: () => void;
}

export function DropZone({
  onFile,
  busy,
  phase,
  pct,
  error,
  entries,
  needsPermission,
  busyId,
  onOpenEntry,
  onRemoveEntry,
  onClearEntries,
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
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-wa-teal text-wa-out-foreground">
            <FileArchive className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-wa-panel-foreground">Chat Replay</h1>
            <p className="text-sm text-wa-meta">Read your WhatsApp export like the real thing</p>
          </div>
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
          className={`cursor-pointer rounded-2xl border-2 border-dashed bg-wa-in p-10 text-center transition-colors ${
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
          <Upload className="mx-auto size-8 text-wa-teal" />
          <p className="mt-4 font-medium text-wa-in-foreground">
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

        <ChatLibrary
          entries={entries}
          needsPermission={needsPermission}
          busyId={busyId}
          onOpen={onOpenEntry}
          onRemove={onRemoveEntry}
          onClear={onClearEntries}
        />

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 space-y-3 text-sm text-wa-meta">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-wa-green" />
            100% local. Your archive is parsed in your browser — nothing is uploaded, stored or sent
            anywhere.
          </p>
          <p>
            Handles iOS and Android exports, groups, media, and files of{" "}
            {formatBytes(500 * 1024 * 1024)}+ thanks to a background worker, lazy media extraction
            and a virtualized message list.
          </p>
          <p className="text-xs">
            Export a chat in WhatsApp: open the chat → menu → More → Export chat → Attach media.
          </p>
        </div>
      </div>
    </main>
  );
}
