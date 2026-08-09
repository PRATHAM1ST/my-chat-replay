import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Info,
  MoreVertical,
  Phone,
  Search,
  Video,
  X,
} from "lucide-react";
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
  // 1:1 chats are named after the other party, so echoing their name below the
  // title says nothing — WhatsApp's own placeholder line goes there instead.
  const others = senders.filter((_, i) => i !== meIndex).join(", ");
  const subtitle =
    senders.length > 2
      ? senders.map((n, i) => (i === meIndex ? "You" : n)).join(", ")
      : others && others !== chatName
        ? others
        : "tap here for contact info";

  // Android's dark header is the app background itself, its icons pure white.
  const iconTint = "dark:text-white";
  const placeholder = senders.length <= 2 && subtitle === "tap here for contact info";

  return (
    <header className="z-20 flex h-[60px] shrink-0 items-center gap-1 border-b border-wa-divider bg-wa-panel pl-1 pr-0.5 text-wa-panel-foreground dark:border-transparent dark:bg-wa-app sm:pl-3 sm:pr-2">
      <IconButton onClick={onBack} aria-label="Back to chats" className={`md:hidden ${iconTint}`}>
        <ArrowLeft className="size-5" />
      </IconButton>

      <button
        type="button"
        onClick={onOpenInfo}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      >
        <Avatar name={chatName} seed={chatName.length} className="size-9" />
        <span className="min-w-0">
          <span className="block truncate text-[17px] font-medium leading-[22px]">
            <Emoji text={chatName} />
          </span>
          {/* the phone shows the bare name in a 1:1 chat; the hint line only
              exists on wide screens, the way WhatsApp Web shows one */}
          <span
            className={`truncate text-[13px] leading-[17px] text-wa-meta ${
              placeholder ? "hidden md:block" : "block"
            }`}
          >
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
            className={`hidden sm:flex ${iconTint}`}
          >
            <ArrowLeftRight className="size-5" />
          </IconButton>
        )}
        {/* the call buttons every real chat carries — an export has no calls
            to place, so they only explain themselves */}
        <IconButton
          aria-label="Video call — not part of an export"
          title="Calls aren't included in a chat export"
          className={`md:hidden ${iconTint}`}
        >
          <Video className="size-5" />
        </IconButton>
        <IconButton
          aria-label="Voice call — not part of an export"
          title="Calls aren't included in a chat export"
          className={`md:hidden ${iconTint}`}
        >
          <Phone className="size-[18px]" />
        </IconButton>
        <IconButton
          onClick={onToggleSearch}
          aria-label={searchOpen ? "Close search" : "Search messages"}
          active={searchOpen}
          className={`hidden md:flex ${iconTint}`}
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
