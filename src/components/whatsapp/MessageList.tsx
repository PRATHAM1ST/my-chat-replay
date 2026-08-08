import { useEffect, useMemo, useRef } from "react";
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

  const virtualizer = useVirtualizer({
    count: view.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 14,
    useAnimationFrameWithResizeObserver: true,
    getItemKey: (i) => view[i] ?? i,
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
  const colorFor = useMemo(() => {
    const map = new Map<number, number>();
    senders.forEach((_, i) => map.set(i, (i % 6) + 1));
    return map;
  }, [senders]);

  return (
    <div ref={parentRef} className="wa-doodle flex-1 overflow-y-auto overscroll-contain">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {items.map((vi) => {
          const gi = view[vi.index] ?? 0;
          const msg = messages[gi];
          if (!msg) return null;
          const prev = vi.index > 0 ? messages[view[vi.index - 1] ?? 0] : undefined;
          const newDay = !prev || dayKey(prev.ts) !== dayKey(msg.ts);
          const showName = senders.length > 2 && (newDay || !prev || prev.s !== msg.s);

          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              {newDay && (
                <div className="flex justify-center py-3">
                  <span className="rounded-lg bg-wa-panel px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-wa-meta shadow-sm">
                    {formatDay(msg.ts)}
                  </span>
                </div>
              )}
              <MessageBubble
                msg={msg}
                isMe={msg.s === meIndex}
                senderName={senders[msg.s] ?? ""}
                showName={showName}
                colorIdx={colorFor.get(msg.s) ?? 1}
                query={query}
                isMatch={matchSet.has(gi)}
                isActive={activeIndex === gi}
                client={client}
                onOpenMedia={onOpenMedia}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
