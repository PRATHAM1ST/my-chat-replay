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
 * media width and a portrait picture is allowed to run tall. */
export const MEDIA_MAX_W = 262;
export const MEDIA_MAX_H = 480;
export const MEDIA_MIN_W = 140;
/** Slot reserved before the real aspect ratio is known. */
export const MEDIA_FALLBACK = { w: 260, h: 200 };

export interface Ratio {
  w: number;
  h: number;
}

/**
 * The box one picture gets inside its bubble.
 *
 * A phone screenshot is roughly 9:20, and filling the media width with it asks
 * for a bubble nearly 600px tall. Squeezing that into a short box means
 * centre-cropping away four fifths of the picture — the reader gets a band out
 * of the middle of a screenshot and cannot tell what was sent, which defeats
 * the point of reading the chat back at all. So a tall picture is *narrowed*
 * to meet the height cap rather than cropped: the whole frame survives, and
 * the bubble takes the tall, slim shape the app itself gives a screenshot.
 * Cropping is left for the one case it is still the lesser evil — artwork so
 * narrow that fitting it would leave nothing wide enough to tap.
 */
export function mediaBox(ratio: Ratio | undefined): Ratio {
  if (!ratio || !ratio.w || !ratio.h) return MEDIA_FALLBACK;
  let w = Math.min(MEDIA_MAX_W, Math.max(ratio.w, MEDIA_MIN_W));
  let h = Math.round((w * ratio.h) / ratio.w);
  if (h > MEDIA_MAX_H) {
    h = MEDIA_MAX_H;
    w = Math.max(MEDIA_MIN_W, Math.round((MEDIA_MAX_H * ratio.w) / ratio.h));
  }
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
const SYSTEM_TEXT = 12.5; // system pill font size
const SYSTEM_LINE = 17; // and its line-height
const SYSTEM_PAD = 24; // the pill's own padding plus the row's, top and bottom
/** Average advance width of the UI font at the 14.2px bubble size. */
const GLYPH = 7.05;
/** Caption padding inside a picture bubble: pt-1 + pb-[3px]. */
const CAPTION_PAD = 7;

export interface StampParts {
  /** already formatted, because its width depends on the clock style */
  time: string;
  /** outgoing messages carry the delivery ticks */
  ticks?: boolean | undefined;
  starred?: boolean | undefined;
  edited?: boolean | undefined;
}

/**
 * How much room the timestamp needs at the end of a bubble's last line.
 *
 * The bubble reserves exactly this much and the stamp is painted into it, so
 * this number is the contract between the estimator here and the spacer the
 * bubble renders. Widths are the 11px meta type and the icons beside it.
 */
export function stampWidth({ time, ticks, starred, edited }: StampParts): number {
  let w = time.length * 6.05;
  if (ticks) w += 19; // 15px double tick + its gap
  if (starred) w += 15; // 11px star + its gap
  if (edited) w += 41; // the word "Edited" + its gap
  return Math.round(w + 8); // the gap that holds it off the text
}

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

/** System pills are smaller type in a box of their own: 85% of the pane on a
 * phone, a fixed 28rem from `sm:` up, less 12px of padding a side. */
function systemCharsPerLine(paneWidth: number) {
  if (!paneWidth) return 52;
  const box = paneWidth < 640 ? (paneWidth - 32) * 0.85 : Math.min((paneWidth - 32) * 0.85, 448);
  return Math.max(16, Math.floor((box - 24) / (GLYPH * (SYSTEM_TEXT / 14.2))));
}

/** Wrapped line count, plus how far along the last of them the text ends. */
function wrappedLines(text: string, cpl: number): { lines: number; last: number } {
  let lines = 0;
  let start = 0;
  for (;;) {
    const nl = text.indexOf("\n", start);
    const end = nl === -1 ? text.length : nl;
    const len = end - start;
    const rows = Math.max(1, Math.ceil(len / cpl));
    lines += rows;
    if (nl === -1) return { lines, last: len - (rows - 1) * cpl };
    start = nl + 1;
  }
}

/**
 * Height of a run of text that has to find room for its timestamp.
 *
 * The bubble reserves the stamp's width at the end of the last line, so the
 * stamp only costs a line of its own when that last line is genuinely full —
 * which is the whole reason a short message never grows a blank strip beneath
 * it. The spacer wraps onto an ordinary text line, so what it costs when it
 * does wrap is a text line, not the stamp's own smaller one.
 */
function textBlock(text: string, cpl: number, stamp: number): number {
  const { lines, last } = wrappedLines(text, cpl);
  const inline = last + Math.ceil(stamp / GLYPH) <= cpl;
  return (lines + (inline ? 0 : 1)) * LINE;
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
  /** the message is one of ours, so its stamp carries the delivery ticks */
  outgoing?: boolean | undefined;
  /** the reader starred it, so a star sits beside the clock */
  starred?: boolean | undefined;
  /** the bubble's timestamp, already formatted at the chat's clock style */
  time?: string | undefined;
  /** transcript width, for the pills that size themselves off it, not the bubble */
  pane?: number | undefined;
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
  // The encryption notice every export opens with runs to three lines on a
  // phone, so a flat guess leaves the very top of the transcript shifting the
  // moment it is measured.
  if (msg.kind === "system")
    return (
      base +
      SYSTEM_PAD +
      wrappedLines(msg.text, systemCharsPerLine(shape.pane ?? 0)).lines * SYSTEM_LINE
    );

  const name = shape.showName ? NAME : 0;
  const stamp = stampWidth({
    time: shape.time ?? "00:00",
    ticks: shape.outgoing,
    starred: shape.starred,
    edited: msg.edited,
  });

  switch (msg.kind) {
    case "image":
    case "video": {
      if (!msg.file) return base + name + 58;
      const { w, h } = mediaBox(shape.ratio);
      // A caption wraps at the picture's width, not the bubble's — a tall
      // screenshot leaves it a narrow column, and guessing one line for it is
      // what makes the row jump the moment it is measured for real.
      const caption = msg.text
        ? textBlock(msg.text, Math.max(8, Math.floor((w - 12) / GLYPH)), stamp) + CAPTION_PAD
        : 0;
      // 3px bubble inset, top and bottom
      return base + name + h + 6 + caption;
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
      return base + name + PAD_Y + textBlock(msg.text, shape.cpl, stamp);
    }
  }
}
