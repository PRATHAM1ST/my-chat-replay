import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import { dayKey, formatDay, nameColor } from "@/lib/whatsapp/format";
import { charsPerLine, estimateRow } from "@/lib/whatsapp/layout";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg } from "@/lib/whatsapp/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Msg[];
  senders: string[];
  meIndex: number;
  client: WaClient;
  query: string;
  matchSet: Set<number>;
  activeIndex: number | null;
  /** {index, nonce} — index is a position inside `messages` */
  scrollTarget: { index: number; nonce: number } | null;
  onOpenMedia: (msg: Msg, url: string) => void;
}

interface RowProps {
  msg: Msg;
  prevTs: number | null;
  prevSender: number | null;
  senders: string[];
  meIndex: number;
  client: WaClient;
  query: string;
  isMatch: boolean;
  isActive: boolean;
  onOpenMedia: (msg: Msg, url: string) => void;
}

function DayChip({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`rounded-lg bg-wa-system px-3 py-[5px] text-[12.5px] font-medium uppercase tracking-[0.01em] text-wa-system-foreground shadow-[var(--wa-shadow-bubble)] ${className}`}
    >
      {label}
    </span>
  );
}

const Row = memo(function Row({
  msg,
  prevTs,
  prevSender,
  senders,
  meIndex,
  client,
  query,
  isMatch,
  isActive,
  onOpenMedia,
}: RowProps) {
  const newDay = prevTs === null || dayKey(prevTs) !== dayKey(msg.ts);
  const newGroup = newDay || prevSender === null || prevSender !== msg.s;
  const showName = senders.length > 2 && newGroup;

  return (
    <>
      {newDay && (
        <div className="flex justify-center py-3">
          <DayChip label={formatDay(msg.ts)} />
        </div>
      )}
      <MessageBubble
        msg={msg}
        isMe={msg.s === meIndex}
        senderName={senders[msg.s] ?? ""}
        showName={showName}
        colorIdx={nameColor(msg.s)}
        query={query}
        isMatch={isMatch}
        isActive={isActive}
        tail={newGroup}
        client={client}
        onOpenMedia={onOpenMedia}
      />
    </>
  );
});

export function MessageList({
  messages,
  senders,
  meIndex,
  client,
  query,
  matchSet,
  activeIndex,
  scrollTarget,
  onOpenMedia,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [topDay, setTopDay] = useState<string | null>(null);
  // Text wraps at a width the estimator can only know by measuring the pane.
  const [cpl, setCpl] = useState(() => charsPerLine(0));
  const group = senders.length > 2;

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const apply = () => setCpl(charsPerLine(el.clientWidth));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const estimateSize = useCallback(
    (index: number) => {
      const msg = messages[index];
      const prev = index > 0 ? messages[index - 1] : undefined;
      const newDay = !prev || !msg || dayKey(prev.ts) !== dayKey(msg.ts);
      return estimateRow(msg, {
        newDay,
        showName: group && !!msg && msg.s >= 0 && (newDay || prev?.s !== msg.s),
        cpl,
        ratio: client.ratio(msg?.file),
      });
    },
    [messages, client, cpl, group],
  );

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 6,
    paddingStart: 8,
    paddingEnd: 12,
    // Chat semantics: when rows above resize or the transcript changes, keep
    // the reader pinned where they were instead of drifting.
    anchorTo: "end",
    scrollEndThreshold: 24,
    // Row offsets are written straight to the DOM, so scrolling costs no React
    // render at all. `position` mode keeps rows off the compositor — their
    // offsets only change when something above them is re-measured, which is
    // rare, and 20+ promoted layers of full-width media cost real GPU memory.
    directDomUpdates: true,
    directDomUpdatesMode: "position",
    useAnimationFrameWithResizeObserver: true,
    // Rows are already positioned outside React, so there is nothing to gain
    // from forcing a synchronous render mid-scroll — and React refuses to flush
    // from inside a lifecycle anyway, which is where the scroll handler runs.
    useFlushSync: false,
  });

  /**
   * A picture that finishes decoding changes its row's height. When that row
   * sits entirely above the fold the transcript below it must not move, so the
   * scroll offset has to absorb the delta — including while the reader is
   * scrolling *up*, which is precisely when new media resolves and precisely
   * the case the library's default rule skips. Rows straddling the fold are
   * still left alone: compensating those drags the viewport on every growth.
   */
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, _delta, instance) =>
    item.start + item.size <= (instance.scrollOffset ?? 0) + instance.scrollAdjustments;

  const items = virtualizer.getVirtualItems();
  const measure = virtualizer.measureElement;

  /** Jump to the newest message, retrying until measurements settle. */
  const toBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const count = messages.length;
      if (!count) return;
      virtualizer.scrollToIndex(count - 1, { align: "end", behavior });
      if (behavior === "auto") {
        let tries = 0;
        const settle = () => {
          if (tries++ > 4) return;
          virtualizer.scrollToIndex(count - 1, { align: "end" });
          requestAnimationFrame(settle);
        };
        requestAnimationFrame(settle);
      }
    },
    [messages.length, virtualizer],
  );

  // Land on the newest message whenever a different chat is opened.
  const lastKey = useRef<string>("");
  useLayoutEffect(() => {
    const key = `${messages.length}:${messages[0]?.ts ?? 0}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    setAtBottom(true);
    toBottom();
  }, [messages, toBottom]);

  useEffect(() => {
    if (!scrollTarget) return;
    const id = requestAnimationFrame(() =>
      virtualizer.scrollToIndex(scrollTarget.index, { align: "center" }),
    );
    return () => cancelAnimationFrame(id);
  }, [scrollTarget, virtualizer]);

  // Sticky day chip + "jump to latest" state, sampled from the scroll element
  // rather than from React state so scrolling stays render-free.
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    let frame = 0;
    const sample = () => {
      frame = 0;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distance < 120);
      const first = virtualizer.getVirtualItemForOffset(el.scrollTop + 12);
      const msg = first ? messages[first.index] : undefined;
      if (!first || !msg) {
        setTopDay(null);
        return;
      }
      // The row at the fold may carry its own day divider. When that divider
      // has not been scrolled past yet it is the one the reader sees, so the
      // floating copy would just print the date twice.
      const prev = first.index > 0 ? messages[first.index - 1] : undefined;
      const ownsDivider = !prev || dayKey(prev.ts) !== dayKey(msg.ts);
      setTopDay(ownsDivider && first.start >= el.scrollTop - 2 ? null : formatDay(msg.ts));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sample);
    };
    sample();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [messages, virtualizer]);

  return (
    <div className="wa-doodle relative flex min-h-0 flex-1">
      {topDay && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
          <DayChip label={topDay} className="bg-wa-system/95 backdrop-blur-sm" />
        </div>
      )}

      <div ref={parentRef} className="wa-scroller relative flex-1 overflow-y-auto">
        <div ref={virtualizer.containerRef} className="relative w-full">
          {items.map((vi) => {
            const msg = messages[vi.index];
            if (!msg) return null;
            const prev = vi.index > 0 ? messages[vi.index - 1] : undefined;

            return (
              <div key={vi.key} data-index={vi.index} ref={measure} className="wa-row">
                <Row
                  msg={msg}
                  prevTs={prev ? prev.ts : null}
                  prevSender={prev ? prev.s : null}
                  senders={senders}
                  meIndex={meIndex}
                  client={client}
                  query={query}
                  isMatch={matchSet.has(msg.i)}
                  isActive={activeIndex === msg.i}
                  onOpenMedia={onOpenMedia}
                />
              </div>
            );
          })}
        </div>
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => toBottom("smooth")}
          aria-label="Jump to latest message"
          className="wa-fade-in absolute bottom-5 right-5 z-20 flex size-10 items-center justify-center rounded-full bg-wa-elevated text-wa-icon shadow-[var(--wa-shadow-float)] transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronDown className="size-5" />
        </button>
      )}
    </div>
  );
}
