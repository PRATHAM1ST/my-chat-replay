import { Trash2, MessageSquareText, KeyRound, FileArchive } from "lucide-react";
import { formatBytes } from "@/lib/whatsapp/format";
import type { LibraryEntry } from "@/lib/whatsapp/library";

interface Props {
  entries: LibraryEntry[];
  needsPermission: Set<string>;
  busyId: string | null;
  onOpen: (entry: LibraryEntry) => void;
  onRemove: (entry: LibraryEntry) => void;
  onClear: () => void;
}

export function ChatLibrary({
  entries,
  needsPermission,
  busyId,
  onOpen,
  onRemove,
  onClear,
}: Props) {
  if (!entries.length) return null;

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-wa-panel-foreground">Your chats</h2>
        <button
          onClick={onClear}
          className="text-xs text-wa-meta underline-offset-2 hover:underline"
        >
          Remove all
        </button>
      </div>

      <ul className="divide-y divide-wa-divider overflow-hidden rounded-xl border border-wa-divider bg-wa-panel">
        {entries.map((e) => {
          const locked = needsPermission.has(e.id);
          return (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                onClick={() => onOpen(e)}
                disabled={busyId !== null}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-teal text-wa-out-foreground">
                  {locked ? <KeyRound className="size-4" /> : <FileArchive className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-wa-panel-foreground">
                    {e.chatName || e.name}
                  </span>
                  <span className="block truncate text-xs text-wa-meta">
                    {busyId === e.id
                      ? "Opening…"
                      : locked
                        ? "Tap to allow access again"
                        : [
                            e.msgCount ? `${e.msgCount.toLocaleString()} messages` : null,
                            e.mediaCount ? `${e.mediaCount.toLocaleString()} media` : null,
                            formatBytes(e.size),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                  </span>
                </span>
              </button>

              <button
                onClick={() => onRemove(e)}
                aria-label={`Remove ${e.chatName || e.name}`}
                className="rounded-full p-2 text-wa-meta transition-colors hover:bg-black/5 hover:text-destructive dark:hover:bg-white/10"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 flex items-start gap-2 text-xs text-wa-meta">
        <MessageSquareText className="mt-0.5 size-3.5 shrink-0" />
        Only a pointer to each file is remembered on this device — the archives stay where they are
        and are never copied or uploaded.
      </p>
    </section>
  );
}
