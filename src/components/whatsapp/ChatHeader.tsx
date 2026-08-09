import { ArrowLeft, ArrowLeftRight, Check, Info, MoreVertical, Search, X } from "lucide-react";
import {
  Avatar,
  Emoji,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "./ui";

interface Props {
  chatName: string;
  senders: string[];
  meIndex: number;
  onMeChange: (i: number) => void;
  onSwap: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onBack: () => void;
  onOpenInfo: () => void;
  onCloseChat: () => void;
}

export function ChatHeader({
  chatName,
  senders,
  meIndex,
  onMeChange,
  onSwap,
  searchOpen,
  onToggleSearch,
  onBack,
  onOpenInfo,
  onCloseChat,
}: Props) {
  const subtitle =
    senders.length > 2 ? senders.join(", ") : senders.filter((_, i) => i !== meIndex).join(", ");

  return (
    <header className="z-20 flex h-[60px] shrink-0 items-center gap-1 border-b border-wa-divider bg-wa-panel pl-1 pr-2 text-wa-panel-foreground sm:pl-3">
      <IconButton onClick={onBack} aria-label="Back to chats" className="md:hidden">
        <ArrowLeft className="size-5" />
      </IconButton>

      <button
        type="button"
        onClick={onOpenInfo}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      >
        <Avatar name={chatName} seed={chatName.length} />
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-normal leading-[21px]">
            <Emoji text={chatName} />
          </span>
          <span className="block truncate text-[13px] leading-[17px] text-wa-meta">
            <Emoji
              text={senders.length > 2 ? `${senders.length} participants · ${subtitle}` : subtitle}
            />
          </span>
        </span>
      </button>

      <div className="flex shrink-0 items-center">
        {senders.length > 1 && (
          <IconButton
            onClick={onSwap}
            aria-label="Swap sides"
            title={`Swap sides — you are ${senders[meIndex] ?? ""}`}
            className="hidden sm:flex"
          >
            <ArrowLeftRight className="size-5" />
          </IconButton>
        )}
        <IconButton
          onClick={onToggleSearch}
          aria-label={searchOpen ? "Close search" : "Search messages"}
          active={searchOpen}
        >
          {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
        </IconButton>

        <Menu>
          <MenuTrigger asChild>
            <IconButton aria-label="Chat menu">
              <MoreVertical className="size-5" />
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={onOpenInfo}>
              <Info className="size-4 text-wa-meta" /> Contact info
            </MenuItem>
            <MenuItem onSelect={onToggleSearch}>
              <Search className="size-4 text-wa-meta" /> Search messages
            </MenuItem>
            {senders.length > 1 && (
              <>
                <MenuSeparator />
                <MenuLabel>Show as sent by</MenuLabel>
                {senders.map((name, i) => (
                  <MenuItem key={name} onSelect={() => onMeChange(i)}>
                    <span className="flex size-4 items-center justify-center">
                      {i === meIndex && <Check className="size-4 text-wa-green" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                  </MenuItem>
                ))}
              </>
            )}
            <MenuSeparator />
            <MenuItem onSelect={onCloseChat}>
              <X className="size-4 text-wa-meta" /> Close chat
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
