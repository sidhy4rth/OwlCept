// "What you see is what you paste." Checks whether text a page script put on
// the clipboard was actually visible to the user. A genuine copy button copies
// code shown on screen; a ClickFix page copies a command the user never saw.

const PROMPT = /^\s*(?:\$|%|>|PS [^>\n]*>|[A-Z]:\\[^>\n]*>)\s+/gm;
const TOKEN_OVERLAP_VISIBLE = 0.85;
const PROBE_CHARS = 400;

export const norm = (s: string): string => s.replace(PROMPT, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * true  = the text is shown on the page in a way a person could read,
 * false = it is hidden or was never on the page,
 * null  = nothing to compare (empty text).
 */
export function checkVisibility(text: string, doc: Document = document): boolean | null {
  const probe = norm(text).slice(0, PROBE_CHARS);
  if (!probe) return null;

  const sel = norm(doc.getSelection()?.toString() ?? '');
  if (sel && sel.includes(probe)) return true;

  let hiddenCopyFound = false;

  // Form fields hold text in .value, which textContent does not include.
  for (const field of doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('textarea, input')) {
    if (!norm(field.value).includes(probe)) continue;
    if (perceptible(field)) return true;
    hiddenCopyFound = true;
  }

  const holder = doc.body ? deepestContaining(doc.body, probe) : null;
  if (holder) {
    if (perceptible(holder) && mostlyPerceptibleText(holder)) return true;
    hiddenCopyFound = true;
  }
  if (hiddenCopyFound) return false;

  // Copy buttons sometimes reformat what they show (line numbers, prompts, wrapping).
  const visible = norm(doc.body?.innerText ?? '');
  return tokenOverlap(probe, visible) >= TOKEN_OVERLAP_VISIBLE;
}

function textOf(el: Element): string {
  return norm(el.textContent ?? '');
}

/** Deepest element whose text still contains the probe (syntax highlighting splits commands across spans). */
function deepestContaining(root: Element, probe: string): Element | null {
  if (!textOf(root).includes(probe)) return null;
  for (const child of root.children) {
    if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'TEMPLATE') continue;
    const d = deepestContaining(child, probe);
    if (d) return d;
  }
  return root;
}

/** Every text node under el, weighted by length, must be perceptible. */
function mostlyPerceptibleText(el: Element): boolean {
  let total = 0;
  let seen = 0;
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = (n.textContent ?? '').trim().length;
    if (!len || !n.parentElement) continue;
    total += len;
    if (perceptible(n.parentElement)) seen += len;
  }
  return total === 0 || seen / total >= 0.9;
}

export function perceptible(el: Element): boolean {
  const win = el.ownerDocument.defaultView;
  if (!win) return false;
  for (let e: Element | null = el; e; e = e.parentElement) {
    const cs = win.getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (Number(cs.opacity) < 0.1) return false;
    if ((cs as CSSStyleDeclaration & { contentVisibility?: string }).contentVisibility === 'hidden') return false;
    if (/rect\(\s*0(?:px)?[\s,]+0(?:px)?[\s,]+0(?:px)?[\s,]+0(?:px)?\s*\)/.test(cs.clip)) return false;
    if (/inset\(\s*50%|circle\(\s*0(?:px)?\s/.test(cs.clipPath)) return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  if (r.right < 0 || r.left > win.innerWidth + 100) return false;
  const cs = win.getComputedStyle(el);
  if (parseFloat(cs.fontSize) < 6) return false;
  const fg = parseColor(cs.color);
  if (fg && fg[3] < 0.15) return false;
  if (fg) {
    const bg = effectiveBackground(el);
    if (contrast(fg, bg) < 1.6) return false;
  }
  return true;
}

type RGBA = [number, number, number, number];

function parseColor(c: string): RGBA | null {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,\/]+([\d.]+%?))?\s*\)/.exec(c);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}

function effectiveBackground(el: Element): RGBA {
  const win = el.ownerDocument.defaultView!;
  for (let e: Element | null = el; e; e = e.parentElement) {
    const bg = parseColor(win.getComputedStyle(e).backgroundColor);
    if (bg && bg[3] >= 0.5) return bg;
  }
  return [255, 255, 255, 1];
}

function luminance([r, g, b]: RGBA): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function tokenOverlap(probe: string, haystack: string): number {
  const tokens = probe.split(' ').filter((t) => t.length > 1);
  if (!tokens.length) return 0;
  const hay = new Set(haystack.split(' '));
  return tokens.filter((t) => hay.has(t)).length / tokens.length;
}
