/**
 * Removes the hosting badge from the published app.
 *
 * The badge is not in this repository — the host injects it into the served
 * page — so it cannot simply be deleted from a component. This watches the
 * document and drops it whenever it appears, which also covers it being
 * re-inserted after hydration. `styles.css` hides the same things declaratively
 * so nothing flashes before this module runs.
 *
 * Matching is deliberately narrow: an element only counts when it names one of
 * the host's own domains or ships under one of its own tag / id / class names.
 * The app itself never links to them, so nothing of ours can match.
 */

const HOSTS = ["lovable.dev", "lovable.app", "lovableproject.com", "gpteng.co", "gptengineer.app"];

const NAME = /lovable|gpteng|gpt-engineer/i;

function attr(el: Element, name: string): string {
  return el.getAttribute?.(name) ?? "";
}

function pointsAtHost(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return HOSTS.some((h) => lower.includes(h));
}

function isBadge(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "html" || tag === "body" || tag === "head") return false;
  if (NAME.test(tag)) return true;

  if (NAME.test(el.id ?? "")) return true;
  const cls = typeof el.className === "string" ? el.className : "";
  if (NAME.test(cls)) return true;

  if (tag === "a" || tag === "iframe" || tag === "img" || tag === "script") {
    if (pointsAtHost(attr(el, "href")) || pointsAtHost(attr(el, "src"))) return true;
  }
  return false;
}

function sweep(root: ParentNode): void {
  // an anchor to the host may be wrapped in a positioning div — take the
  // outermost element that exists only to hold it
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (!isBadge(el)) continue;
    let target: Element = el;
    let parent = target.parentElement;
    while (
      parent &&
      parent !== document.body &&
      parent.childElementCount === 1 &&
      !parent.textContent?.trim().length
    ) {
      target = parent;
      parent = target.parentElement;
    }
    target.remove();
  }
}

let watching = false;

export function stripHostBadge(): void {
  if (typeof document === "undefined" || watching) return;
  watching = true;

  const run = () => sweep(document);
  run();

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (isBadge(node)) {
          node.remove();
          continue;
        }
        if (node.childElementCount) sweep(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}
