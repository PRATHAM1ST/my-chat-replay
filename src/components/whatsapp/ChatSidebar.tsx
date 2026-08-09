import { useMemo, useState } from "react";
import {
  Images,
  KeyRound,
  MessageSquarePlus,
  Moon,
  MoreVertical,
  Search,
  Sun,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBytes, formatListStamp } from "@/lib/whatsapp/format";
import type { LibraryEntry } from "@/lib/whatsapp/library";
import { Logo } from "./Logo";
import {
  Avatar,
  Chip,
  Emoji,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  SearchField,
} from "./ui";

interface Props {
  entries: LibraryEntry[];
  activeId: string | null;
  needsPermission: Set<string>;
  busyId: string | null;
  onAdd: () => void;
  onOpen: (entry: LibraryEntry) => void;
  onRemove: (entry: LibraryEntry) => void;
  onClearAll: () => void;
  dark: boolean;
  onToggleDark: () => void;
}


type Filter = "all" | "media" | "locked";

function describe(entry: LibraryEntry) {
  return [
    entry.msgCount ? `${entry.msgCount.toLocaleString()} messages` : null,
    entry.mediaCount ? `${entry.mediaCount.toLocaleString()} media` : null,
    formatBytes(entry.size),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ChatSidebar({
  entries,
  activeId,
  needsPermission,
  busyId,
  onAdd,
  onOpen,
  onRemove,
  onClearAll,
  dark,
  onToggleDark,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<LibraryEntry | "all" | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (needle && !(entry.chatName || entry.name).toLowerCase().includes(needle)) return false;
      if (filter === "media") return (entry.mediaCount ?? 0) > 0;
      if (filter === "locked") return needsPermission.has(entry.id);
      return true;
    });
  }, [entries, query, filter, needsPermission]);

  const lockedCount = entries.filter((e) => needsPermission.has(e.id)).length;
  const all = confirm === "all";

  return (
    <aside className="relative flex h-full min-h-0 w-full flex-col border-r border-wa-divider bg-wa-surface md:w-[380px] lg:w-[420px]">
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-wa-divider bg-wa-panel pl-3 pr-2">
        <div className="flex min-w-0 items-center gap-2">
          <Logo size={26} />
          <h1 className="truncate text-[21px] font-bold tracking-tight text-wa-panel-foreground">
            Chats
          </h1>
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton onClick={onAdd} aria-label="Open a chat export">
            <MessageSquarePlus className="size-[21px]" />
          </IconButton>
          <Menu>
            <MenuTrigger asChild>
              <IconButton aria-label="Chat list menu">
                <MoreVertical className="size-5" />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={onAdd}>
                <MessageSquarePlus className="size-4 text-wa-meta" /> Open an export…
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={onToggleDark}>
                {dark ? (
                  <Sun className="size-4 text-wa-meta" />
                ) : (
                  <Moon className="size-4 text-wa-meta" />
                )}
                {dark ? "Light theme" : "Dark theme"}
              </MenuItem>
              {entries.length > 0 && (
                <>
                  <MenuSeparator />
                  <MenuItem onSelect={() => setConfirm("all")} className="text-destructive">
                    <Trash2 className="size-4" /> Clear all chats
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>

            </MenuContent>
          </Menu>
        </div>
      </header>

      <div className="shrink-0 space-y-2 px-3 py-2">
        <SearchField
          value={query}
          onValue={setQuery}
          placeholder="Search or start a new chat"
          icon={<Search className="size-[17px]" />}
        />
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          <Chip active={filter === "media"} onClick={() => setFilter("media")}>
            <Images className="size-3.5" /> With media
          </Chip>
          {lockedCount > 0 && (
            <Chip active={filter === "locked"} onClick={() => setFilter("locked")}>
              <KeyRound className="size-3.5" /> Needs access ({lockedCount})
            </Chip>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length ? (
          <ul className="pb-20">
            {filtered.map((entry) => {
              const active = activeId === entry.id;
              // the chat on screen is already open — never nag about permission
              const locked = needsPermission.has(entry.id) && !active;
              const title = entry.chatName || entry.name;
              return (
                <li key={entry.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    disabled={busyId !== null}
                    className={`flex w-full cursor-pointer items-center gap-3 pl-3 pr-2 text-left transition-colors disabled:cursor-default ${
                      active ? "bg-wa-active" : "hover:bg-wa-hover"
                    }`}
                  >
                    <Avatar
                      name={title}
                      seed={title.length}
                      size="md"
                      icon={locked ? <KeyRound className="size-5" /> : undefined}
                    />
                    <span className="flex min-w-0 flex-1 flex-col justify-center border-b border-wa-divider py-3.5 pr-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[16px] leading-[21px] text-wa-panel-foreground">
                          <Emoji text={title} />
                        </span>
                        <span className="shrink-0 text-[12px] text-wa-meta">
                          {formatListStamp(entry.lastOpened)}
                        </span>
                      </span>
                      <span className="mt-0.5 truncate text-[13.5px] leading-[19px] text-wa-meta">
                        {busyId === entry.id
                          ? "Opening…"
                          : locked
                            ? "Tap to allow file access"
                            : describe(entry)}
                      </span>
                    </span>
                  </button>
                  <IconButton
                    onClick={() => onRemove(entry)}
                    aria-label={`Remove ${title}`}
                    className="absolute right-2 top-1/2 size-8 -translate-y-1/2 bg-wa-surface/90 text-wa-meta opacity-0 backdrop-blur-sm hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-8 py-14 text-center">
            <p className="text-[15px] text-wa-panel-foreground">No chats found</p>
            <p className="mt-1 text-[13.5px] text-wa-meta">
              {entries.length ? "Try a different search or filter." : "Open an export to start."}
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        aria-label="Open a chat export"
        className="absolute bottom-6 right-6 z-10 flex size-14 cursor-pointer items-center justify-center rounded-2xl bg-wa-green text-white shadow-[var(--wa-shadow-float)] transition-transform hover:scale-105 active:scale-95"
      >
        <MessageSquarePlus className="size-6" />
      </button>
    </aside>
  );
}
