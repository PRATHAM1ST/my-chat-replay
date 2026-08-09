import { useCallback, useEffect, useRef } from "react";

const HOLD_MS = 450;
/** A finger that travels this far is scrolling, not holding. */
const SLOP = 12;

/**
 * WhatsApp's press-and-hold gesture.
 *
 * Deliberately built on pointer events rather than `touchstart`, so a mouse
 * right-click and a long press land in the same place, and so a press that
 * turns into a scroll is abandoned instead of firing. The click that follows a
 * completed hold is swallowed — otherwise letting go would also open the chat.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        cancel();
        // a real phone buzzes here; browsers that cannot just ignore it
        navigator.vibrate?.(12);
        onLongPress();
      }, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      if (Math.abs(e.clientX - start.x) > SLOP || Math.abs(e.clientY - start.y) > SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      cancel();
      fired.current = true;
      onLongPress();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
