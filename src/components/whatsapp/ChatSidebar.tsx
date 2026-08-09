import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  Images,
  KeyRound,
  MessageSquarePlus,
  Moon,
  MoreVertical,
  Search,
  Share2,
  Sun,
  Trash2,
  X,
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
import { useLongPress } from "./useLongPress";
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
  canShare: boolean;
  onAdd: () => void;
  onOpen: (entry: LibraryEntry) => void;
  onRemove: (entries: LibraryEntry[]) => void;
  onShare: (entries: LibraryEntry[]) => void;
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

/** One chat, in either normal or selection mode. */
function ChatRow({
  entry,
  active,
  locked,
  busy,
  selecting,
  selected,
  onOpen,
  onSelect,
  onRemove,
}: {
  entry: LibraryEntry;
  active: boolean;
  locked: boolean;
  busy: boolean;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const title = entry.chatName || entry.name;
  const hold = useLongPress(onSelect);

  return (
    <li className="group relative">
      <button
        type="button"
        {...hold}
        onClick={() => (selecting ? onSelect() : onOpen())}
        disabled={busy && !selecting}
        aria-pressed={selecting ? selected : undefined}
        style={{ WebkitTouchCallout: "none", touchAction: "pan-y" }}
        className={`flex w-full cursor-pointer select-none items-center gap-3 pl-3 pr-2 text-left transition-colors disabled:cursor-default ${
          /* the phone's list is flat — the open-chat tint is a wide-screen cue */
          selected
            ? "bg-wa-green/12"
            : active && !selecting
              ? "hover:bg-wa-hover md:bg-wa-active"
              : "hover:bg-wa-hover"
        }`}
      >
        <span className="relative shrink-0">
          <Avatar
            name={title}
            seed={title.length}
            size="md"
            icon={locked ? <KeyRound className="size-5" /> : undefined}
          />
          {selecting && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full ring-2 ring-wa-surface transition-colors ${
                selected ? "bg-wa-green text-white" : "bg-wa-input text-transparent"
              }`}
            >
              <Check className="size-3" strokeWidth={3.5} />
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col justify-center border-b border-wa-divider py-3.5 pr-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[16px] leading-[21px] text-wa-panel-foreground">
              <Emoji text={title} />
            </span>
            <span className="shrink-0 text-[12px] text-wa-meta">
              {formatListStamp(entry.lastOpened)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 truncate text-[13.5px] leading-[19px] text-wa-meta">
            {entry.stored && !locked && (
              <CheckCheck className="size-3.5 shrink-0 text-wa-tick" aria-hidden="true" />
            )}
            {busy ? "Opening…" : locked ? "Tap to allow file access" : describe(entry)}
          </span>
        </span>
      </button>

      {!selecting && (
        <IconButton
          onClick={onRemove}
          aria-label={`Remove ${title} from this app`}
          className="absolute right-2 top-1/2 size-8 -translate-y-1/2 bg-wa-surface/90 text-wa-meta opacity-0 backdrop-blur-sm hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </IconButton>
      )}
    </li>
  );
}

export function ChatSidebar({
  entries,
  activeId,
  needsPermission,
  busyId,
  canShare,
  onAdd,
  onOpen,
  onRemove,
  onShare,
  onClearAll,
  dark,
  onToggleDark,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<LibraryEntry[] | "all" | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const selecting = picked.size > 0;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (needle && !(entry.chatName || entry.name).toLowerCase().includes(needle)) return false;
      if (filter === "media") return (entry.mediaCount ?? 0) > 0;
      if (filter === "locked") return needsPermission.has(entry.id);
      return true;
    });
  }, [entries, query, filter, needsPermission]);

  // A chat removed elsewhere must not stay selected.
  useEffect(() => {
    setPicked((prev) => {
      if (!prev.size) return prev;
      const live = new Set(entries.map((e) => e.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [entries]);

  const toggle = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setPicked(new Set()), []);
  const selectedEntries = useMemo(() => entries.filter((e) => picked.has(e.id)), [entries, picked]);

  // Escape leaves selection mode, the way back does on a phone.
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && clearSelection();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, clearSelection]);

  const lockedCount = entries.filter((e) => needsPermission.has(e.id)).length;
  const clearingAll = confirm === "all";
  const doomed = Array.isArray(confirm) ? confirm : [];

  return (
    <aside className="relative flex h-full min-h-0 w-full flex-col border-r border-wa-divider bg-wa-surface md:w-[380px] lg:w-[420px]">
      {selecting ? (
        <header className="wa-fade-in flex h-[60px] shrink-0 items-center gap-1 border-b border-wa-divider bg-wa-panel pl-1 pr-2">
          <IconButton onClick={clearSelection} aria-label="Leave selection">
            <X className="size-5" />
          </IconButton>
          <p className="min-w-0 flex-1 truncate text-[17px] font-medium text-wa-panel-foreground">
            {picked.size} selected
          </p>
          {canShare && (
            <IconButton
              onClick={() => {
                onShare(selectedEntries);
                clearSelection();
              }}
              aria-label="Share selected chats"
            >
              <Share2 className="size-5" />
            </IconButton>
          )}
          <IconButton
            onClick={() => setConfirm(selectedEntries)}
            aria-label="Remove selected chats"
            className="hover:text-destructive"
          >
            <Trash2 className="size-5" />
          </IconButton>
          <Menu>
            <MenuTrigger asChild>
              <IconButton aria-label="Selection menu">
                <MoreVertical className="size-5" />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => setPicked(new Set(filtered.map((e) => e.id)))}>
                <Check className="size-4 text-wa-meta" /> Select all
              </MenuItem>
              <MenuItem onSelect={clearSelection}>
                <X className="size-4 text-wa-meta" /> Clear selection
              </MenuItem>
            </MenuContent>
          </Menu>
        </header>
      ) : (
        <header className="flex h-[64px] shrink-0 items-center justify-between gap-2 border-b border-wa-divider bg-wa-panel pl-4 pr-2 dark:border-transparent">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo size={26} />
            <h1 className="truncate text-[23px] font-bold tracking-tight text-wa-panel-foreground">
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
                {entries.length > 0 && (
                  <MenuItem onSelect={() => setPicked(new Set([entries[0]!.id]))}>
                    <Check className="size-4 text-wa-meta" /> Select chats
                  </MenuItem>
                )}
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
          </div>
        </header>
      )}

      <div className="shrink-0 space-y-2 px-3 py-2">
        <SearchField
          value={query}
          onValue={setQuery}
          placeholder="Search your chats"
          icon={<Search className="size-[17px]" />}
          className="h-[47px] rounded-full px-4"
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
            {filtered.map((entry) => (
              <ChatRow
                key={entry.id}
                entry={entry}
                active={activeId === entry.id}
                // the chat on screen is already open — never nag about permission
                locked={needsPermission.has(entry.id) && activeId !== entry.id}
                busy={busyId === entry.id || (busyId !== null && !selecting)}
                selecting={selecting}
                selected={picked.has(entry.id)}
                onOpen={() => onOpen(entry)}
                onSelect={() => toggle(entry.id)}
                onRemove={() => setConfirm([entry])}
              />
            ))}
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

      {!selecting && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Open a chat export"
          className="absolute bottom-5 right-4 z-10 flex size-[55px] cursor-pointer items-center justify-center rounded-[17px] bg-wa-green text-white shadow-[var(--wa-shadow-float)] transition-transform hover:scale-105 active:scale-95 dark:text-[#0a0f13]"
        >
          <MessageSquarePlus className="size-6" />
        </button>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clearingAll
                ? "Clear all chats?"
                : doomed.length === 1
                  ? `Remove "${doomed[0]?.chatName || doomed[0]?.name}"?`
                  : `Remove ${doomed.length} chats?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clearingAll
                ? "Every chat disappears from this list, along with the copy kept on this device and its saved names, perspective and reading position. Your own export files are not deleted — you can open them again any time."
                : "This disappears from the list, along with the copy kept on this device and the saved names, perspective and reading position. Your own export file is not deleted — you can open it again any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (clearingAll) onClearAll();
                else if (doomed.length) onRemove(doomed);
                setConfirm(null);
                clearSelection();
              }}
            >
              {clearingAll ? "Clear all" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
