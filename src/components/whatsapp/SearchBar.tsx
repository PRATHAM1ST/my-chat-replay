import { ChevronDown, ChevronUp, CalendarDays, ImageIcon } from "lucide-react";

interface Props {
  query: string;
  onQuery: (v: string) => void;
  matchCount: number;
  matchPos: number;
  onPrev: () => void;
  onNext: () => void;
  senders: string[];
  sender: number | null;
  onSender: (v: number | null) => void;
  mediaOnly: boolean;
  onMediaOnly: (v: boolean) => void;
  onJumpDate: (date: string) => void;
}

export function SearchBar({
  query,
  onQuery,
  matchCount,
  matchPos,
  onPrev,
  onNext,
  senders,
  sender,
  onSender,
  mediaOnly,
  onMediaOnly,
  onJumpDate,
}: Props) {
  return (
    <div className="space-y-2 border-b border-wa-divider bg-wa-panel px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.shiftKey ? onPrev : onNext)();
          }}
          placeholder="Search messages…"
          className="min-w-0 flex-1 rounded-full border border-wa-divider bg-wa-in px-4 py-2 text-sm text-wa-in-foreground outline-none placeholder:text-wa-meta focus:border-wa-teal"
        />
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-wa-meta">
          {query ? (matchCount ? `${matchPos + 1} / ${matchCount}` : "0 / 0") : ""}
        </span>
        <button
          onClick={onPrev}
          disabled={!matchCount}
          aria-label="Previous match"
          className="rounded-full p-1.5 text-wa-panel-foreground hover:bg-wa-divider/60 disabled:opacity-40"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          onClick={onNext}
          disabled={!matchCount}
          aria-label="Next match"
          className="rounded-full p-1.5 text-wa-panel-foreground hover:bg-wa-divider/60 disabled:opacity-40"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-wa-meta">
        <select
          value={sender ?? ""}
          onChange={(e) => onSender(e.target.value === "" ? null : Number(e.target.value))}
          className="rounded-full border border-wa-divider bg-wa-in px-3 py-1.5 text-xs text-wa-in-foreground"
        >
          <option value="">Everyone</option>
          {senders.map((s, i) => (
            <option key={s} value={i}>
              {s}
            </option>
          ))}
        </select>

        <button
          onClick={() => onMediaOnly(!mediaOnly)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
            mediaOnly
              ? "border-wa-green bg-wa-green/15 text-wa-panel-foreground"
              : "border-wa-divider bg-wa-in text-wa-in-foreground"
          }`}
        >
          <ImageIcon className="size-3.5" /> Media only
        </button>

        <label className="flex items-center gap-1.5 rounded-full border border-wa-divider bg-wa-in px-3 py-1.5 text-wa-in-foreground">
          <CalendarDays className="size-3.5" />
          <input
            type="date"
            onChange={(e) => onJumpDate(e.target.value)}
            className="bg-transparent text-xs outline-none"
            aria-label="Jump to date"
          />
        </label>
      </div>
    </div>
  );
}
