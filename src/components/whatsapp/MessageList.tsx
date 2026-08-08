import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { dayKey, formatDay } from "@/lib/whatsapp/format";
import type { WaClient } from "@/lib/whatsapp/client";
import type { Msg } from "@/lib/whatsapp/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Msg[];
  view: Int32Array;
  senders: string[];
  meIndex: number;
  client: WaClient;
  query: string;
  matchSet: Set<number>;
  activeIndex: number | null;
  /** {row, nonce} — row is a position inside `view` */
  scrollTarget: { row: number; nonce: number } | null;
  onOpenMedia: (msg: Msg, url: string) => void;
}

/** Cheap height guess so the scrollbar is stable before rows are measured. */
function estimate(msg: Msg | undefined, newDay: boolean): number {
  if (!msg) return 64;
  let h = 0;
  if (newDay) h += 44;
  switch (msg.kind) {
    case "system":
      return h + 36;
    case "image":
    case "video":
      return h + (msg.file ? (msg.text ? 304 : 276) : 58);
    case "sticker":
      return h + 150;
    case "audio":
      return h + 68;
    case "document":
      return h + 60;
    default: {
      if (/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u.test(msg.text))
        return h + 72;
      const lines = Math.max(1, Math.ceil(msg.text.length / 42));
      return h + 30 + lines * 19;
    }
  }
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
          <span className="rounded-lg bg-wa-in px-3 py-[5px] text-[12.5px] font-medium uppercase text-wa-meta shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
            {formatDay(msg.ts)}
          </span>
        </div>
      )}
      <MessageBubble
        msg={msg}
        isMe={msg.s === meIndex}
        senderName={senders[msg.s] ?? ""}
        showName={showName}
        colorIdx={(msg.s % 6) + 1}
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
  view,
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

  const estimateSize = useCallback(
    (index: number) => {
      const msg = messages[view[index] ?? 0];
      const prev = index > 0 ? messages[view[index - 1] ?? 0] : undefined;
      return estimate(msg, !prev || !msg || dayKey(prev.ts) !== dayKey(msg.ts));
    },
    [messages, view],
  );

  const virtualizer = useVirtualizer({
    count: view.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 8,
    useAnimationFrameWithResizeObserver: true,
    useFlushSync: false,
    getItemKey: useCallback((i: number) => view[i] ?? i, [view]),
  });

  // stick to the newest message when a new chat / filter view loads
  const lastLen = useRef(-1);
  useEffect(() => {
    if (view.length && lastLen.current !== view.length) {
      lastLen.current = view.length;
      requestAnimationFrame(() => virtualizer.scrollToIndex(view.length - 1, { align: "end" }));
    }
  }, [view.length, virtualizer]);

  useEffect(() => {
    if (!scrollTarget) return;
    const id = requestAnimationFrame(() =>
      virtualizer.scrollToIndex(scrollTarget.row, { align: "center" }),
    );
    return () => cancelAnimationFrame(id);
  }, [scrollTarget, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const measure = virtualizer.measureElement;
  const totalSize = virtualizer.getTotalSize();

  // sticky date chip for whatever is at the top of the viewport
  const topDay = useMemo(() => {
    const first = items[0];
    if (!first) return null;
    const msg = messages[view[first.index] ?? 0];
    return msg ? formatDay(msg.ts) : null;
  }, [items, messages, view]);

  return (
    <div className="wa-doodle relative flex min-h-0 flex-1">
      {topDay && (
        <div className="pointer-events-none absolute left-0 right-0 top-2 z-10 flex justify-center">
          <span className="rounded-lg bg-wa-in/95 px-3 py-[5px] text-[12.5px] font-medium uppercase text-wa-meta shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] backdrop-blur">
            {topDay}
          </span>
        </div>
      )}
      <div ref={parentRef} className="relative flex-1 overflow-y-auto overscroll-contain">
        <div className="relative w-full" style={{ height: `${totalSize}px` }}>
          {items.map((vi) => {
            const gi = view[vi.index] ?? 0;
            const msg = messages[gi];
            if (!msg) return null;
            const prev = vi.index > 0 ? messages[view[vi.index - 1] ?? 0] : undefined;

            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={measure}
                className="absolute left-0 top-0 w-full will-change-transform"
                style={{ transform: `translateY(${vi.start}px)`, contain: "layout style" }}
              >
                <Row
                  msg={msg}
                  prevTs={prev ? prev.ts : null}
                  prevSender={prev ? prev.s : null}
                  senders={senders}
                  meIndex={meIndex}
                  client={client}
                  query={query}
                  isMatch={matchSet.has(gi)}
                  isActive={activeIndex === gi}
                  onOpenMedia={onOpenMedia}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
