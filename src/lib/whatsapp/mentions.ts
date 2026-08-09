/**
 * @mention detection, the way WhatsApp writes them into exports.
 *
 * A mention arrives in the transcript as literal text — "@Aarav Shah are you
 * coming" — with no markup, so the only way to colour it like the app does is
 * to recognise it. Participant names are matched first (longest first, so
 * "@Ann Marie" beats "@Ann"), then a generic @handle fallback for people who
 * are not in the chat. A lookbehind keeps email addresses out of it.
 */

export interface MentionSegment {
  text: string;
  mention: boolean;
}

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

export function buildMentionRegex(names: string[]): RegExp | null {
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(ESCAPE, "\\$&"));
  const alts = [...cleaned, "[\\p{L}\\p{N}][\\p{L}\\p{N}._-]{0,24}"];
  try {
    // no letter/digit directly before the @ — that would be an email address
    return new RegExp(`(?<![\\p{L}\\p{N}])@(?:${alts.join("|")})`, "gu");
  } catch {
    return null;
  }
}

export function splitMentions(text: string, re: RegExp | null): MentionSegment[] {
  if (!re || !text.includes("@")) return [{ text, mention: false }];
  re.lastIndex = 0;
  const out: MentionSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), mention: false });
    out.push({ text: m[0], mention: true });
    last = at + m[0].length;
  }
  if (!out.length) return [{ text, mention: false }];
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}
