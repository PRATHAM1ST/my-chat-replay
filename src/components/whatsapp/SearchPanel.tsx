import { useCallback, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Headphones,
  Image as ImageIcon,
  Link2,
  Search,
  Users,
  Video,
  X,
} from "lucide-react";
import { formatDay, formatTime, nameColor } from "@/lib/whatsapp/format";
import type { Msg, SearchScope } from "@/lib/whatsapp/types";
import {
  Chip,
  Emoji,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  SearchField,
} from "./ui";

interface Props {
  messages: Msg[];
  senders: string[];
  meIndex: number;
  query: string;
  onQuery: (v: string) => void;
  scope: SearchScope;
  onScope: (v: SearchScope) => void;
  sender: number | null;
  onSender: (v: number | null) => void;
  matches: Int32Array;
  matchPos: number;
  onPrev: () => void;
  onNext: () => void;
  onPick: (globalIndex: number, pos: number) => void;
  onJumpDate: (date: string) => void;
  onClose: () => void;
  busy: boolean;
}

const SCOPES: { id: SearchScope; label: string; icon?: React.ReactNode }[] = [
  { id: "all", label: "All" },
  { id: "photos", label: "Photos", icon: <ImageIcon className="size-3.5" /> },
  { id: "videos", label: "Videos", icon: <Video className="size-3.5" /> },
  { id: "links", label: "Links", icon: <Link2 className="size-3.5" /> },
  { id: "docs", label: "Docs", icon: <FileText className="size-3.5" /> },
  { id: "audio", label: "Audio", icon: <Headphones className="size-3.5" /> },
];

const KIND_LABEL: Record<string, string> = {
  image: "Photo",
  video: "Video",
  sticker: "Sticker",
  audio: "Audio",
  document: "Document",
  call: "Call",
};

/** One line of context around the hit, the way WhatsApp previews results. */
function snippet(text: string, needle: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!needle) return flat.slice(0, 140);
  const at = flat.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return flat.slice(0, 140);
  const from = Math.max(0, at - 32);
  return (from ? "…" : "") + flat.slice(from, from + 150);
}

function Snippet({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <Emoji text={text} />;
  const lower = text.toLowerCase();
  const q = needle.toLowerCase();
  const out: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(q);
  let k = 0;
  while (at !== -1) {
    if (at > from) out.push(<Emoji key={k++} text={text.slice(from, at)} />);
    out.push(
      <mark key={k++} className="bg-transparent font-semibold text-wa-teal dark:text-wa-green">
        <Emoji text={text.slice(at, at + q.length)} />
      </mark>,
    );
    from = at + q.length;
    at = lower.indexOf(q, from);
  }
  out.push(<Emoji key={k++} text={text.slice(from)} />);
  return <>{out}</>;
}

export function SearchPanel({
  messages,
  senders,
  meIndex,
  query,
  onQuery,
  scope,
  onScope,
  sender,
  onSender,
  matches,
  matchPos,
  onPrev,
  onNext,
  onPick,
  onJumpDate,
  onClose,
  busy,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const active = query.trim().length > 0 || sender !== null || scope !== "all";

  const virtualizer = useVirtualizer({
    count: matches.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 74,
    overscan: 8,
  });

  // keep the highlighted result in view as the user steps through hits
  useEffect(() => {
    if (matches.length) virtualizer.scrollToIndex(matchPos, { align: "auto" });
  }, [matchPos, matches.length, virtualizer]);

  const rows = virtualizer.getVirtualItems();
  const needle = query.trim();

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.shiftKey ? onPrev : onNext)();
      }
      if (e.key === "Escape") onClose();
    },
    [onNext, onPrev, onClose],
  );

  const senderLabel =
    sender === null ? "Everyone" : sender === meIndex ? "You" : (senders[sender] ?? "Everyone");
  const counter = useMemo(() => {
    if (!active) return "Search a word, or filter by type";
    if (busy) return "Searching…";
    if (!matches.length) return "No messages found";
    return `${matchPos + 1} of ${matches.length.toLocaleString()} ${
      matches.length === 1 ? "result" : "results"
    }`;
  }, [active, busy, matches.length, matchPos]);

  return (
    <aside className="wa-slide-in absolute inset-0 z-30 flex min-h-0 flex-col border-l border-wa-divider bg-wa-surface dark:border-transparent md:static md:w-[400px] md:shrink-0 lg:w-[430px]">
      {/* Phones get the app's own search bar: one stadium pill holding the
          back arrow, the field and the jump-to-date calendar. */}
      <header className="shrink-0 px-4 pb-2 pt-3 md:hidden">
        <div className="flex h-[47px] items-center gap-1 rounded-full bg-wa-system pl-1.5 pr-1.5">
          <IconButton
            onClick={onClose}
            aria-label="Close search"
            className="size-9 dark:text-white"
          >
            <ArrowLeft className="size-5" />
          </IconButton>
          <input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search..."
            className="min-w-0 flex-1 bg-transparent text-[15px] text-wa-panel-foreground caret-wa-green outline-none placeholder:text-wa-meta dark:placeholder:text-[#b8bec2]"
          />
          <label
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-wa-icon transition-colors hover:bg-white/5 dark:text-white"
            title="Jump to date"
          >
            <CalendarDays className="size-5" />
            <input
              type="date"
              onChange={(e) => onJumpDate(e.target.value)}
              className="absolute size-9 cursor-pointer opacity-0 [color-scheme:light] dark:[color-scheme:dark]"
              aria-label="Jump to date"
            />
          </label>
        </div>
      </header>

      <header className="hidden h-[60px] shrink-0 items-center gap-3 border-b border-wa-divider bg-wa-panel pl-2 pr-3 text-wa-panel-foreground md:flex">
        <IconButton onClick={onClose} aria-label="Close search">
          <X className="size-5" />
        </IconButton>
        <h2 className="flex-1 truncate text-[16px]">Search messages</h2>
        <div className="flex shrink-0 items-center">
          <IconButton onClick={onPrev} disabled={!matches.length} aria-label="Previous result">
            <ChevronUp className="size-5" />
          </IconButton>
          <IconButton onClick={onNext} disabled={!matches.length} aria-label="Next result">
            <ChevronDown className="size-5" />
          </IconButton>
        </div>
      </header>

      <div className="shrink-0 space-y-2.5 border-b border-wa-divider px-3 py-2 dark:border-transparent md:py-3">
        <SearchField
          autoFocus={false}
          value={query}
          onValue={onQuery}
          onKeyDown={onKeyDown}
          placeholder="Search…"
          icon={<Search className="size-[17px]" />}
          className="hidden md:flex"
        />

        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          {SCOPES.map((s) => (
            <Chip key={s.id} active={scope === s.id} onClick={() => onScope(s.id)}>
              {s.icon}
              {s.label}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {senders.length > 1 && (
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-black/[0.05] px-3 py-[5px] text-[13px] font-medium text-wa-meta transition-colors hover:bg-black/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
                >
                  <Users className="size-3.5 shrink-0" />
                  <span className="max-w-[140px] truncate">{senderLabel}</span>
                  <ChevronDown className="size-3.5 shrink-0" />
                </button>
              </MenuTrigger>
              <MenuContent align="start">
                <MenuItem onSelect={() => onSender(null)}>Everyone</MenuItem>
                {senders.map((name, i) => (
                  <MenuItem key={name} onSelect={() => onSender(i)}>
                    <span className="min-w-0 flex-1 truncate">{i === meIndex ? "You" : name}</span>
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}

          <label className="hidden cursor-pointer items-center gap-1.5 rounded-full bg-black/[0.05] px-3 py-[5px] text-[13px] font-medium text-wa-meta transition-colors hover:bg-black/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] md:flex">
            <CalendarDays className="size-3.5 shrink-0" />
            <input
              type="date"
              onChange={(e) => onJumpDate(e.target.value)}
              className="cursor-pointer bg-transparent text-[13px] font-medium text-wa-meta outline-none [color-scheme:light] dark:[color-scheme:dark]"
              aria-label="Jump to date"
              title="Jump to date"
            />
          </label>
        </div>

        <div className="flex items-center px-1">
          <p className="min-w-0 flex-1 text-[12.5px] text-wa-meta">{counter}</p>
          <div className="flex shrink-0 items-center md:hidden">
            <IconButton
              onClick={onPrev}
              disabled={!matches.length}
              aria-label="Previous result"
              className="size-8"
            >
              <ChevronUp className="size-[18px]" />
            </IconButton>
            <IconButton
              onClick={onNext}
              disabled={!matches.length}
              aria-label="Next result"
              className="size-8"
            >
              <ChevronDown className="size-[18px]" />
            </IconButton>
          </div>
        </div>
      </div>

      <div ref={listRef} className="wa-scroller min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {rows.map((vi) => {
            const gi = matches[vi.index] ?? 0;
            const msg = messages[gi];
            if (!msg) return null;
            const isCurrent = vi.index === matchPos;
            const name = msg.s === meIndex ? "You" : (senders[msg.s] ?? "Unknown");
            const preview = msg.text
              ? snippet(msg.text, needle)
              : (KIND_LABEL[msg.kind] ?? "Attachment");

            return (
              <button
                key={vi.key}
                type="button"
                data-index={vi.index}
                ref={virtualizer.measureElement}
                onClick={() => onPick(gi, vi.index)}
                style={{ transform: `translateY(${vi.start}px)` }}
                className={`absolute left-0 top-0 flex w-full cursor-pointer flex-col gap-1 px-4 py-2.5 text-left transition-colors ${
                  isCurrent ? "bg-wa-active" : "hover:bg-wa-hover"
                }`}
              >
                <span className="flex items-baseline gap-2 text-[12.5px]">
                  <span
                    className="min-w-0 flex-1 truncate font-medium"
                    style={{
                      color:
                        msg.s === meIndex
                          ? "var(--wa-green)"
                          : `var(--wa-name-${nameColor(msg.s)})`,
                    }}
                  >
                    <Emoji text={name} />
                  </span>
                  <span className="shrink-0 text-wa-meta">
                    {formatDay(msg.ts)}, {formatTime(msg.ts)}
                  </span>
                </span>
                <span className="line-clamp-2 text-[14px] leading-[19px] text-wa-panel-foreground">
                  {msg.text ? (
                    <Snippet text={preview} needle={needle} />
                  ) : (
                    <span className="italic text-wa-meta">{preview}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {active && !busy && !matches.length && (
          <div className="px-8 py-16 text-center">
            <p className="text-[15px] text-wa-panel-foreground">No results</p>
            <p className="mt-1 text-[13.5px] text-wa-meta">
              Try another word, or clear the filters above.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
