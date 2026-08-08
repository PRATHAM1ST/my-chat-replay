export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dayKey(ts: number) {
  const d = new Date(ts);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function formatDay(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const k = dayKey(ts);
  if (k === dayKey(today.getTime())) return "Today";
  if (k === dayKey(today.getTime() - 86400000)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** index of the first element of `view` that is >= target (view is sorted) */
export function lowerBound(view: Int32Array, target: number) {
  let lo = 0;
  let hi = view.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((view[mid] ?? 0) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
