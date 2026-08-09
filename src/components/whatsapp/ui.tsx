import * as React from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { initials, nameColor } from "@/lib/whatsapp/format";
import { cn } from "@/lib/utils";

/** Round, quiet header/toolbar button — WhatsApp's only icon affordance. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(function IconButton({ className, active, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-wa-icon",
        "transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-wa-green/60 disabled:cursor-default disabled:opacity-40",
        "disabled:hover:bg-transparent dark:hover:bg-white/[0.08]",
        active && "bg-black/[0.06] dark:bg-white/[0.08]",
        className,
      )}
      {...props}
    />
  );
});

const SIZES = {
  sm: "size-10 text-[13px]",
  md: "size-12 text-[15px]",
  lg: "size-[104px] text-[34px]",
} as const;

/**
 * Initials avatar on a deterministic colour drawn from the participant palette,
 * so the same person keeps the same tint across the whole app.
 */
export function Avatar({
  name,
  seed = 0,
  size = "sm",
  className,
  icon,
}: {
  name: string;
  seed?: number;
  size?: keyof typeof SIZES;
  className?: string;
  icon?: React.ReactNode;
}) {
  const slot = nameColor(seed);
  return (
    <span
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white",
        SIZES[size],
        className,
      )}
      style={{
        backgroundColor: `var(--wa-name-${slot})`,
        backgroundImage: `linear-gradient(145deg, color-mix(in oklab, var(--wa-name-${slot}) 88%, white), color-mix(in oklab, var(--wa-name-${slot}) 80%, black))`,
      }}
      aria-hidden="true"
    >
      {icon ?? initials(name)}
    </span>
  );
}

/**
 * One emoji cluster: a pictograph with its optional variation selector, skin
 * tone and ZWJ continuations, plus keycaps and regional-indicator flags.
 */
const EMOJI_RUN =
  /(?:(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?\p{Emoji_Modifier}?)*)|(?:[#*0-9]\uFE0F?\u20E3)|(?:\p{Regional_Indicator}\p{Regional_Indicator}))+/gu;

/**
 * Renders text with every emoji run wrapped in the emoji font.
 *
 * Scoping it this way is the whole point: setting `font-variant-emoji: emoji`
 * on the paragraph drags digits, `#` and `*` into the emoji font (they are
 * keycap bases), while leaving it off lets a monochrome system symbol font win
 * the fallback race before the colour font is ever reached. Marking the runs
 * explicitly gets colour emoji and correct digits at the same time.
 */
export function Emoji({ text }: { text: string }) {
  EMOJI_RUN.lastIndex = 0;
  if (!EMOJI_RUN.test(text)) return <>{text}</>;

  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  EMOJI_RUN.lastIndex = 0;
  for (const m of text.matchAll(EMOJI_RUN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <span key={k++} className="wa-emoji">
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/**
 * Floating status strip. Failures used to be written into the drop zone, which
 * is only on screen before the first chat exists — so anything that went wrong
 * later (a withdrawn permission, a missing copy) failed silently. This says
 * what happened and offers the one action that fixes it.
 */
export function Toast({
  message,
  tone = "error",
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  tone?: "error" | "info";
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="wa-fade-in pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-[520px] items-center gap-3 rounded-xl px-3.5 py-2.5",
          "text-[13.5px] shadow-[var(--wa-shadow-float)] ring-1",
          tone === "error"
            ? "bg-destructive text-destructive-foreground ring-black/10"
            : "bg-wa-elevated text-wa-panel-foreground ring-black/5 dark:ring-white/10",
        )}
      >
        <span className="min-w-0 flex-1">{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              "shrink-0 cursor-pointer rounded-full px-3 py-1 text-[13px] font-semibold",
              tone === "error" ? "bg-white/20 hover:bg-white/30" : "bg-wa-green text-white",
            )}
          >
            {actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 cursor-pointer text-[18px] leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export const Menu = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;

export function MenuContent({
  className,
  align = "end",
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-[220px] overflow-hidden rounded-lg bg-wa-elevated py-1.5 text-[14.5px]",
          "text-wa-panel-foreground shadow-[var(--wa-shadow-panel)] ring-1 ring-black/5",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:ring-white/10",
          className,
        )}
        {...props}
      >
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  );
}

export function MenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dropdown.Item>) {
  return (
    <Dropdown.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-3 px-5 py-2.5 outline-none",
        "data-[highlighted]:bg-wa-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <Dropdown.Label className="px-5 pb-1 pt-2 text-[12px] font-medium uppercase tracking-wide text-wa-meta">
      {children}
    </Dropdown.Label>
  );
}

export function MenuSeparator() {
  return <Dropdown.Separator className="my-1.5 h-px bg-wa-divider" />;
}

/** Pill filter chip — the row under WhatsApp's search field. */
export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-[5px] text-[13px]",
        "font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-wa-green/60",
        active
          ? "bg-wa-green/20 text-wa-teal dark:text-wa-green"
          : "bg-black/[0.05] text-wa-meta hover:bg-black/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]",
        className,
      )}
      {...props}
    />
  );
}

/** Rounded search field used by both the chat list and the search drawer. */
export function SearchField({
  value,
  onValue,
  placeholder,
  icon,
  onClear,
  autoFocus,
  onKeyDown,
  className,
}: {
  value: string;
  onValue: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  onClear?: () => void;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-9 w-full items-center gap-4 rounded-lg bg-wa-input px-3.5 text-wa-meta",
        "transition-shadow focus-within:ring-1 focus-within:ring-wa-green/70",
        className,
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[14.5px] text-wa-panel-foreground outline-none placeholder:text-wa-meta"
      />
      {!!value && (
        <button
          type="button"
          onClick={() => {
            onValue("");
            onClear?.();
          }}
          aria-label="Clear"
          className="shrink-0 cursor-pointer text-[18px] leading-none text-wa-meta hover:text-wa-panel-foreground"
        >
          ×
        </button>
      )}
    </label>
  );
}
