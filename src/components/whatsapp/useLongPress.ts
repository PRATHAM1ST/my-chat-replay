import { useCallback, useEffect, useRef } from "react";

const HOLD_MS = 400;
/** A finger that travels this far is scrolling, not holding. */
const SLOP = 12;

/**
 * WhatsApp's press-and-hold gesture.
 *
 * Built on pointer events so a mouse right-click and a long press land in the
 * same place, and so a press that turns into a scroll is abandoned instead of
 * firing.
 *
 * Two things kept biting us and are handled explicitly:
 *  - Mobile browsers fire `contextmenu` for the *same* long press that our
 *    timer already handled. Firing twice toggled selection on and straight back
 *    off, which looked like the gesture doing nothing at all — so a press that
 *    already fired swallows the contextmenu.
 *  - The click that follows a completed hold is swallowed, otherwise letting go
 *    would also open the chat.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  /** true from the moment a hold fires until the trailing click is eaten */
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const fire = useCallback(() => {
    cancel();
    fired.current = true;
    // a real phone buzzes here; browsers that cannot just ignore it
    navigator.vibrate?.(12);
    onLongPress();
  }, [cancel, onLongPress]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancel();
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(fire, HOLD_MS);
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
      // the hold timer already handled this press — don't undo it
      if (fired.current) return;
      fire();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
