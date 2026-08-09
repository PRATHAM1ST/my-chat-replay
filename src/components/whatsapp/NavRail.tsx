import { FolderPlus, Images, Moon, Search, Sun } from "lucide-react";
import { Logo } from "./Logo";
import { IconButton } from "./ui";

interface Props {
  hasChat: boolean;
  searchOpen: boolean;
  infoOpen: boolean;
  dark: boolean;
  onSearch: () => void;
  onInfo: () => void;
  onAdd: () => void;
  onToggleDark: () => void;
}

function RailButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className="group relative flex justify-center">
      <IconButton
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        active={active}
        className="size-11"
      >
        {children}
      </IconButton>
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-1 -translate-y-1/2 whitespace-nowrap rounded-md bg-wa-elevated px-2.5 py-1.5 text-[12.5px] text-wa-panel-foreground opacity-0 shadow-[var(--wa-shadow-panel)] transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}

/**
 * The narrow icon column WhatsApp added in its 2024 redesign. Every entry here
 * is wired to something real — nothing decorative.
 */
export function NavRail({
  hasChat,
  searchOpen,
  infoOpen,
  dark,
  onSearch,
  onInfo,
  onAdd,
  onToggleDark,
}: Props) {
  return (
    <nav className="hidden w-[68px] shrink-0 flex-col items-center gap-1 border-r border-wa-divider bg-wa-panel py-3 md:flex">
      <RailButton label="Chats" active onClick={() => undefined}>
        <Logo size={22} />
      </RailButton>
      <RailButton
        label="Search messages"
        active={searchOpen}
        disabled={!hasChat}
        onClick={onSearch}
      >
        <Search className="size-[22px]" />
      </RailButton>
      <RailButton label="Media & info" active={infoOpen} disabled={!hasChat} onClick={onInfo}>
        <Images className="size-[22px]" />
      </RailButton>

      <span className="flex-1" />

      <RailButton label={dark ? "Light theme" : "Dark theme"} onClick={onToggleDark}>
        {dark ? <Sun className="size-[22px]" /> : <Moon className="size-[22px]" />}
      </RailButton>
      <RailButton label="Open an export" onClick={onAdd}>
        <FolderPlus className="size-[22px]" />
      </RailButton>
    </nav>
  );
}
