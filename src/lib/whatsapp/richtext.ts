/**
 * WhatsApp's inline text styles, as they survive into exports.
 *
 * The app never exports its rendering — it exports the markers the user typed:
 * *bold*, _italic_, ~strikethrough~ and ```monospace``` arrive as literal
 * characters. Rendering them styled (and hiding the markers) is exactly what
 * the real client does, and the rules below mirror its behaviour:
 *
 *  - an opening marker must not sit mid-word ("5*3=15*2" stays maths) and the
 *    styled run must start and end on non-space ("* bold*" stays literal)
 *  - a pair must close on the same line — except ``` which may span lines
 *  - styles nest ("_*both*_"), resolved outermost-first by position
 *  - anything unmatched stays as typed
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  mono?: boolean;
}

type StyleKey = "bold" | "italic" | "strike";

const MARKERS: [string, StyleKey][] = [
  ["*", "bold"],
  ["_", "italic"],
  ["~", "strike"],
];

const MONO = /```([\s\S]+?)```/;
const WORD = /[\p{L}\p{N}]/u;

/** First valid marker pair for `ch`, or null. Indices of the two markers. */
function pair(text: string, ch: string): [number, number] | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ch) continue;
    const prev = i === 0 ? " " : text[i - 1]!;
    const next = text[i + 1];
    if (!next || next === ch) continue;
    if (WORD.test(prev)) continue; // opening marker glued to a word
    if (/\s/.test(next)) continue; // run must start on non-space
    for (let j = i + 2; j < text.length; j++) {
      const c = text[j];
      if (c === "\n") break; // same line only
      if (c !== ch) continue;
      if (/\s/.test(text[j - 1]!)) continue; // run must end on non-space
      const after = text[j + 1];
      if (after && WORD.test(after)) continue; // closing marker glued to a word
      return [i, j];
    }
  }
  return null;
}

function walk(text: string, style: Omit<Run, "text">): Run[] {
  if (!text) return [];

  // monospace wins outright and its contents render raw
  const mono = MONO.exec(text);
  if (mono && mono.index !== undefined && mono[1]) {
    return [
      ...walk(text.slice(0, mono.index), style),
      { text: mono[1], ...style, mono: true },
      ...walk(text.slice(mono.index + mono[0].length), style),
    ];
  }

  // earliest opening marker is the outermost style
  let best: { at: [number, number]; key: StyleKey } | null = null;
  for (const [ch, key] of MARKERS) {
    if (style[key]) continue;
    const p = pair(text, ch);
    if (p && (!best || p[0] < best.at[0])) best = { at: p, key };
  }
  if (!best) return [{ text, ...style }];

  const [i, j] = best.at;
  return [
    ...walk(text.slice(0, i), style),
    ...walk(text.slice(i + 1, j), { ...style, [best.key]: true }),
    ...walk(text.slice(j + 1), style),
  ];
}

export function splitFormatRuns(text: string): Run[] {
  // fast path: nothing that could be a marker
  if (!/[*_~`]/.test(text)) return [{ text }];
  return walk(text, {});
}

/* ------------------------------------------------------------- call lines */

export interface CallLine {
  video: boolean;
  missed: boolean;
  label: string;
  sub: string | null;
}

/**
 * Call events as exports write them: "Missed voice call", "Video call",
 * sometimes with a detail after a separator ("Video call, 12 secs"). A plain
 * sentence like "video call me later" has no separator and stays a message.
 */
const CALL = /^(missed |silenced |unanswered )?(voice|video) call(?:\s*[.,:·—-]\s*(.{1,60}))?$/i;

export function parseCallLine(text: string): CallLine | null {
  const m = CALL.exec(text.trim());
  if (!m) return null;
  const prefix = (m[1] ?? "").trim();
  const video = (m[2] ?? "").toLowerCase() === "video";
  const kind = video ? "video" : "voice";
  const label = prefix
    ? `${prefix[0]!.toUpperCase()}${prefix.slice(1)} ${kind} call`
    : `${kind[0]!.toUpperCase()}${kind.slice(1)} call`;
  return { video, missed: !!prefix, label, sub: m[3]?.trim() || null };
}

/** "This message was deleted" / "You deleted this message" */
const DELETED = /^(this message was deleted|you deleted this message)\.?$/i;

export function isDeletedMessage(text: string): boolean {
  return DELETED.test(text.trim());
}
