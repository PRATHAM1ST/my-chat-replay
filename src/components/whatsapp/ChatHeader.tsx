import { ArrowLeft, MoreVertical, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  chatName: string;
  senders: string[];
  meIndex: number;
  onMeChange: (i: number) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onBack: () => void;
  onOpenInfo: () => void;
}

export function ChatHeader({
  chatName,
  senders,
  meIndex,
  onMeChange,
  searchOpen,
  onToggleSearch,
  onBack,
  onOpenInfo,
}: Props) {
  const initials = chatName.slice(0, 2).toUpperCase();
  return (
    <header className="grid h-[59px] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-wa-panel px-3 text-wa-panel-foreground">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Close chat"
        className="-ml-1 rounded-full hover:bg-wa-divider/60 md:hidden"
      >
        <ArrowLeft className="size-5" />
      </Button>
      <Button variant="ghost" onClick={onOpenInfo} className="h-[59px] min-w-0 justify-start rounded-none px-0 hover:bg-transparent">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-teal text-sm font-semibold text-wa-out-foreground">{initials}</span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-[16px] font-normal leading-[21px]">{chatName}</span>
          <span className="block truncate text-[13px] font-normal leading-[17px] text-wa-meta">{senders.length > 2 ? `${senders.length} participants` : senders.join(", ")}</span>
        </span>
      </Button>

      <div className="flex shrink-0 items-center">
      <Button variant="ghost" size="icon"
        onClick={onToggleSearch}
        aria-label="Search messages"
        className={`rounded-full hover:bg-wa-divider/60 ${searchOpen ? "bg-wa-divider/60" : ""}`}
      >
        {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
      </Button>
      <label className="relative">
        <span className="sr-only">Choose which participant is you</span>
        <select value={meIndex} onChange={(e) => onMeChange(Number(e.target.value))} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Choose which participant is you">
          {senders.map((s, i) => <option key={s} value={i}>{s}</option>)}
        </select>
        <span className="flex size-9 items-center justify-center rounded-full hover:bg-wa-divider/60"><MoreVertical className="size-5" /></span>
      </label>
      </div>
    </header>
  );
}
