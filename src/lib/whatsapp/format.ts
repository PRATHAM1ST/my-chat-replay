export function formatTime(ts: number) {
  // WhatsApp writes its meridiem lowercase — "12:04 pm" — on every platform.
  return new Date(ts)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(/[AP]M\b/, (m) => m.toLowerCase());
}

export function dayKey(ts: number) {
  const d = new Date(ts);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const DAY = 86400000;

/** "Today" / "Yesterday" / weekday for the last week / full date. */
export function formatDay(ts: number) {
  const d = new Date(ts);
  const now = Date.now();
  const k = dayKey(ts);
  if (k === dayKey(now)) return "Today";
  if (k === dayKey(now - DAY)) return "Yesterday";
  if (ts > now - 6 * DAY) return d.toLocaleDateString(undefined, { weekday: "long" });
  // WhatsApp spells the month out on its date pills: "23 July 2026".
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Compact stamp for list rows — time today, weekday this week, else date. */
export function formatListStamp(ts: number) {
  const d = new Date(ts);
  const now = Date.now();
  const k = dayKey(ts);
  if (k === dayKey(now)) return formatTime(ts);
  if (k === dayKey(now - DAY)) return "Yesterday";
  if (ts > now - 6 * DAY) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Up to two letters for the avatar placeholder, emoji-safe. */
export function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\p{Extended_Pictographic}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "#";
  const first = [...(words[0] ?? "")][0] ?? "";
  const second = words.length > 1 ? ([...(words[words.length - 1] ?? "")][0] ?? "") : "";
  return (first + second).toUpperCase();
}

/** Stable 1..8 palette slot for a participant, so colours survive renames. */
export function nameColor(index: number) {
  return (index % 8) + 1;
}

/** index of the first element of `list` that is >= target (list is sorted) */
export function lowerBound(list: ArrayLike<number>, target: number) {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] ?? 0) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
