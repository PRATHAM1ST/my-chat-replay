import { ArrowLeft, Moon, Search, Sun, X } from "lucide-react";

interface Props {
  chatName: string;
  senders: string[];
  meIndex: number;
  onMeChange: (i: number) => void;
  total: number;
  searchOpen: boolean;
  onToggleSearch: () => void;
  dark: boolean;
  onToggleDark: () => void;
  onClose: () => void;
}

export function ChatHeader({
  chatName,
  senders,
  meIndex,
  onMeChange,
  total,
  searchOpen,
  onToggleSearch,
  dark,
  onToggleDark,
  onClose,
}: Props) {
  const initials = chatName.slice(0, 2).toUpperCase();
  return (
    <header className="flex items-center gap-3 border-b border-wa-divider bg-wa-panel px-3 py-2 text-wa-panel-foreground">
      <button
        onClick={onClose}
        aria-label="Close chat"
        className="rounded-full p-1.5 hover:bg-wa-divider/60 md:hidden"
      >
        <ArrowLeft className="size-5" />
      </button>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-teal text-sm font-semibold text-wa-out-foreground">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">
          {chatName}
        </h1>
        <p className="truncate text-xs text-wa-meta">
          {senders.length > 2
            ? `${senders.length} participants · `
            : `${senders.join(", ")} · `}
          {total.toLocaleString()} messages
        </p>
      </div>

      <label className="hidden items-center gap-1.5 text-xs text-wa-meta sm:flex">
        You are
        <select
          value={meIndex}
          onChange={(e) => onMeChange(Number(e.target.value))}
          className="max-w-[9rem] rounded-md border border-wa-divider bg-wa-in px-2 py-1 text-xs text-wa-in-foreground"
        >
          {senders.map((s, i) => (
            <option key={s} value={i}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={onToggleSearch}
        aria-label="Search messages"
        className={`rounded-full p-2 hover:bg-wa-divider/60 ${searchOpen ? "bg-wa-divider/60" : ""}`}
      >
        {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
      </button>
      <button
        onClick={onToggleDark}
        aria-label="Toggle dark mode"
        className="rounded-full p-2 hover:bg-wa-divider/60"
      >
        {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>
      <button
        onClick={onClose}
        aria-label="Load another export"
        className="hidden rounded-full p-2 hover:bg-wa-divider/60 md:block"
      >
        <X className="size-5" />
      </button>
    </header>
  );
}
