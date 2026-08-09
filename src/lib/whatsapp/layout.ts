/**
 * Geometry shared by the virtualizer's height estimator and the components it
 * measures.
 *
 * These two have to agree. Every pixel of disagreement becomes a resize the
 * moment a row is measured, and every resize makes the virtualizer nudge the
 * scroll position — which is exactly what a jumpy transcript feels like. Both
 * sides import from here so they cannot drift apart.
 */
import type { Msg } from "./types";

/** WhatsApp's picture box, measured on Android: artwork fills the ~262px
 * media width, and anything taller than ~350px is centre-cropped (the app
 * never letterboxes a tall screenshot down to a sliver). */
export const MEDIA_MAX_W = 262;
export const MEDIA_MAX_H = 350;
export const MEDIA_MIN_W = 140;
/** Slot reserved before the real aspect ratio is known. */
export const MEDIA_FALLBACK = { w: 260, h: 200 };

export interface Ratio {
  w: number;
  h: number;
}

export function mediaBox(ratio: Ratio | undefined): Ratio {
  if (!ratio || !ratio.w || !ratio.h) return MEDIA_FALLBACK;
  const w = Math.min(MEDIA_MAX_W, Math.max(ratio.w, MEDIA_MIN_W));
  // keep the width and crop the overflow — object-fit: cover does the rest
  const h = Math.min(MEDIA_MAX_H, Math.round((w * ratio.h) / ratio.w));
  return { w, h };
}

const LINE = 19; // text line-height
const STAMP = 15; // timestamp line-height
const NAME = 20; // group participant name line + its margin
const PAD_Y = 10; // bubble padding, top + bottom
const GAP = 2; // py-[1px] between bubbles
const GROUP_GAP = 8; // extra room WhatsApp leaves when the sender changes
const DAY_CHIP = 42;
const STICKER = 130;
/** Average advance width of the UI font at the 14.2px bubble size. */
const GLYPH = 7.05;
/** Room the inline timestamp takes on the final line. */
const STAMP_W = 56;

/**
 * How many characters fit on one line of the widest bubble at this pane width.
 * Derived from the same Tailwind classes MessageBubble uses: phones get the
 * app's fixed 17px gutters, wide panes reserve 7% a side like WhatsApp Web,
 * and the bubble caps at 85% (narrow) / 65% (wide) of what is left.
 */
export function charsPerLine(paneWidth: number) {
  if (!paneWidth) return 46;
  const inner = paneWidth < 768 ? paneWidth - 34 : paneWidth * 0.86;
  const bubble = inner * (paneWidth < 640 ? 0.85 : 0.65) - 18;
  return Math.max(14, Math.floor(bubble / GLYPH));
}

function wrappedLines(text: string, cpl: number) {
  let lines = 0;
  let start = 0;
  for (;;) {
    const nl = text.indexOf("\n", start);
    const end = nl === -1 ? text.length : nl;
    lines += Math.max(1, Math.ceil((end - start) / cpl));
    if (nl === -1) return lines;
    start = nl + 1;
  }
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u;

export interface RowShape {
  newDay: boolean;
  showName: boolean;
  cpl: number;
  ratio?: Ratio | undefined;
  /** the bubble carries a quoted-reply block above its content */
  quoted?: boolean;
  /** a reaction pill hangs off the bubble's bottom edge */
  reacted?: boolean;
  /** first bubble of a new sender group on the same day — gets breathing room */
  grouped?: boolean;
}

/** Height guess for one transcript row, day divider included. */
export function estimateRow(msg: Msg | undefined, shape: RowShape): number {
  if (!msg) return 64;
  const base =
    (shape.newDay ? DAY_CHIP : 0) +
    GAP +
    (shape.quoted ? 50 : 0) +
    (shape.reacted ? 24 : 0) +
    (shape.grouped && !shape.newDay ? GROUP_GAP : 0);
  if (msg.kind === "system") return base + 36;

  const name = shape.showName ? NAME : 0;

  switch (msg.kind) {
    case "image":
    case "video": {
      if (!msg.file) return base + name + 58;
      const { h } = mediaBox(shape.ratio);
      // 3px bubble inset top and bottom, plus a caption line when there is one
      return base + name + h + 6 + (msg.text ? LINE + STAMP - 4 : 0);
    }
    case "sticker":
      return base + name + STICKER + STAMP + 6;
    case "audio":
      return base + name + 48 + PAD_Y + STAMP;
    case "call":
      return base + name + 48 + PAD_Y + STAMP;
    case "document":
      return base + name + 52 + PAD_Y + STAMP;
    default: {
      // emoji-only messages sit in a normal bubble with larger glyphs
      if (EMOJI_ONLY.test(msg.text)) return base + name + PAD_Y + 36;
      const lines = wrappedLines(msg.text, shape.cpl);
      // the stamp shares the last line only when there is room left for it
      const tail = msg.text.length - (lines - 1) * shape.cpl;
      const stampInline = lines === 1 && tail * GLYPH + STAMP_W < shape.cpl * GLYPH;
      return base + name + PAD_Y + lines * LINE + (stampInline ? 0 : STAMP);
    }
  }
}
