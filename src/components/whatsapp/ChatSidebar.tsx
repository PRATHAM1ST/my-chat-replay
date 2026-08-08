import { useMemo, useState } from "react";
import { Archive, KeyRound, MessageCircle, MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import type { LibraryEntry } from "@/lib/whatsapp/library";
import { Button } from "@/components/ui/button";

interface Props {
  entries: LibraryEntry[];
  activeId: string | null;
  needsPermission: Set<string>;
  busyId: string | null;
  onAdd: () => void;
  onOpen: (entry: LibraryEntry) => void;
  onRemove: (entry: LibraryEntry) => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function ChatSidebar({
  entries,
  activeId,
  needsPermission,
  busyId,
  onAdd,
  onOpen,
  onRemove,
  dark,
  onToggleDark,
}: Props) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? entries.filter((entry) => (entry.chatName || entry.name).toLowerCase().includes(needle))
      : entries;
  }, [entries, query]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-wa-divider bg-wa-in md:w-[360px] lg:w-[400px]">
      <header className="grid h-[59px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center bg-wa-panel px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-teal text-wa-out-foreground">
            <MessageCircle className="size-5" />
          </span>
          <h1 className="truncate text-xl font-semibold text-wa-panel-foreground">Chats</h1>
        </div>
        <div className="relative flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onAdd} aria-label="Add chat export" className="rounded-full text-wa-panel-foreground hover:bg-wa-divider/60">
            <Plus className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen((value) => !value)} aria-label="Chat list menu" className="rounded-full text-wa-panel-foreground hover:bg-wa-divider/60">
            <MoreVertical className="size-5" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-30 w-44 rounded-md bg-wa-in py-1 text-sm text-wa-in-foreground shadow-lg ring-1 ring-wa-divider">
              <Button
                variant="ghost"
                className="h-auto w-full justify-start rounded-none px-4 py-2.5 font-normal hover:bg-wa-panel"
                onClick={() => {
                  onToggleDark();
                  setMenuOpen(false);
                }}
              >
                {dark ? "Use light theme" : "Use dark theme"}
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="border-b border-wa-divider px-3 py-2">
        <label className="flex h-9 items-center gap-3 rounded-lg bg-wa-panel px-3 text-wa-meta">
          <Search className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-sm text-wa-panel-foreground outline-none placeholder:text-wa-meta"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length ? (
          <ul>
            {filtered.map((entry) => {
              const locked = needsPermission.has(entry.id);
              const active = activeId === entry.id;
              return (
                <li key={entry.id} className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center ${active ? "bg-wa-panel" : "hover:bg-wa-panel/70"}`}>
                  <Button
                    variant="ghost"
                    onClick={() => onOpen(entry)}
                    disabled={busyId !== null}
                    className="h-auto min-w-0 justify-start rounded-none px-3 py-3 text-left hover:bg-transparent"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-wa-teal text-wa-out-foreground">
                      {locked ? <KeyRound className="size-5" /> : <Archive className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1 border-b border-wa-divider pb-3">
                      <span className="block truncate text-[16px] font-normal text-wa-in-foreground">{entry.chatName || entry.name}</span>
                      <span className="mt-0.5 block truncate text-[13px] font-normal text-wa-meta">
                        {busyId === entry.id
                          ? "Opening…"
                          : locked
                            ? "Tap to allow file access"
                            : `${(entry.msgCount ?? 0).toLocaleString()} messages${entry.mediaCount ? ` · ${entry.mediaCount.toLocaleString()} media` : ""}`}
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(entry)}
                    aria-label={`Remove ${entry.chatName || entry.name}`}
                    className="mr-2 rounded-full text-wa-meta opacity-0 hover:bg-wa-divider/60 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-wa-meta">No chats found</p>
        )}
      </div>
    </aside>
  );
}