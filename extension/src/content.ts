// Isolated-world content script: checkpoint 1 (copy) and 1b (ConsentFix paste).
// Builds the custody record for every copy, blocks the dangerous ones, and
// sends only a hash plus metadata to the background worker.

import { analyze, checkOAuthPaste, explain, explainConsentFix, normalizeForHash } from '@owlcept/engine';
import type { CustodyRecord, Lang } from '@owlcept/engine';
import { askMessage, hideBanner, showBanner, showToast, type BannerData } from './banner.ts';
import { DEFAULT_SETTINGS, type Settings, type StatusReply, type ToBackground, type ToContent } from './messages.ts';
import { readLureContext } from './page-context.ts';
import { UI, fill, resolveLang } from './strings.ts';
import { checkVisibility } from './visibility.ts';
import { decide } from './policy.ts';

const TAG = '__owlcept__';
const CLICK_RELEVANCE_MS = 5000;
const DUPLICATE_WINDOW_MS = 1500;

let settings: Settings = DEFAULT_SETTINGS;
let agentConnected = false;
let lastPointer: Element | null = null;
let lastPointerAt = 0;
let overwriting = false;
const recent = new Map<string, number>();

const send = <T = unknown>(msg: ToBackground): Promise<T | undefined> =>
  chrome.runtime.sendMessage(msg).catch(() => undefined) as Promise<T | undefined>;

void send<StatusReply>({ type: 'status' }).then((s) => {
  if (!s) return;
  settings = s.settings;
  agentConnected = s.agentConnected;
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
});

const lang = (): Lang => resolveLang(settings.lang, chrome.i18n?.getUILanguage?.() ?? navigator.language);
const pageHost = (): string => location.hostname || (document.referrer ? new URL(document.referrer).hostname : '');

addEventListener('pointerdown', (e) => {
  lastPointer = e.target instanceof Element ? e.target : null;
  lastPointerAt = Date.now();
}, true);

// ------------------------------------------------------------ checkpoint 1: copy

// Page scripts writing the clipboard, reported by hook.ts from the main world.
addEventListener('message', (e: MessageEvent) => {
  if (e.source !== window || !e.data || e.data[TAG] !== 'write' || typeof e.data.text !== 'string') return;
  const { id, text, via } = e.data as { id: number; text: string; via: string };
  void onCopy(text, true).then((replace) => {
    if (via === 'writeText' || via === 'write') {
      window.postMessage({ [TAG]: 'decision', id, replace }, '*');
    } else if (replace !== null) {
      // setData / execCommand already wrote; overwrite after the page's copy finishes.
      setTimeout(() => overwriteClipboard(replace), 0);
    }
  });
});

// Manual copies (Ctrl+C, right-click Copy). Script writes during the same event are reported separately.
document.addEventListener('copy', () => {
  if (overwriting) return;
  const text = document.getSelection()?.toString() ?? '';
  setTimeout(() => {
    if (text && !isDuplicate(text)) void onCopy(text, false);
  }, 0);
}, true);

function isDuplicate(text: string): boolean {
  const now = Date.now();
  for (const [t, at] of recent) if (now - at > DUPLICATE_WINDOW_MS) recent.delete(t);
  return recent.has(text);
}

/** Returns replacement clipboard text when the copy must be blocked, null otherwise. */
async function onCopy(text: string, scripted: boolean): Promise<string | null> {
  if (isDuplicate(text)) return null;
  recent.set(text, Date.now());

  const clicked = Date.now() - lastPointerAt < CLICK_RELEVANCE_MS ? lastPointer : null;
  const { lureWords, fakeCaptcha } = readLureContext(clicked);
  const custody: CustodyRecord = {
    hash: await sha256(normalizeForHash(text)),
    sourceKind: 'browser',
    originUrl: location.href.startsWith('http') ? location.href : document.referrer || location.href,
    scriptWritten: scripted,
    visibleMatch: scripted ? checkVisibility(text) : true,
    lureWords,
    fakeCaptcha,
    time: Date.now(),
  };
  const verdict = analyze(text, { target: 'unknown', custody });
  const ids = verdict.findings.map((f) => f.id);
  const d = decide({ action: verdict.action, mode: settings.mode, trustedSites: settings.trustedSites, host: pageHost(), agentConnected });
  void send({ type: 'custody', record: custody, action: d.log, risk: verdict.risk, ids, note: d.note, shown: d.show !== 'none' });
  if (d.show === 'none') return null;

  const l = lang();
  const e = explain(verdict, custody, l);
  const data: BannerData = {
    kind: verdict.action === 'block' ? 'block' : 'warn',
    lang: l,
    headline: e.headline,
    details: e.details,
    provenance: e.provenance,
    advice: e.advice,
    host: pageHost(),
    ids,
  };
  present(data, d.replaceClipboard ? text : null, d.show);
  return d.replaceClipboard ? fill(UI[l].blockedLine, { host: pageHost() || 'this page' }) : null;
}

// ------------------------------------------------------------ checkpoint 1b: ConsentFix

function guardOAuthPaste(e: ClipboardEvent | DragEvent | InputEvent, text: string | undefined): void {
  if (!text || text.length > 20_000) return;
  const d = checkOAuthPaste(text, location.href);
  if (!d.block || !d.code) return;
  // A sign-in code in the wrong site is always a block; only audit mode lets it through (and logs it).
  const audit = settings.mode === 'audit';
  void send({ type: 'consentfix', host: pageHost(), provider: d.code.provider, note: audit ? 'audit' : undefined });
  if (audit) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const l = lang();
  const c = explainConsentFix(d.code, l);
  present({ kind: 'consentfix', lang: l, headline: c.headline, details: [c.detail], advice: c.advice, host: pageHost(), ids: ['consentfix'] }, null, 'banner');
}

addEventListener('paste', (e) => guardOAuthPaste(e, e.clipboardData?.getData('text/plain')), true);
addEventListener('drop', (e) => guardOAuthPaste(e, e.dataTransfer?.getData('text/plain')), true);
addEventListener('beforeinput', (e) => {
  if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') guardOAuthPaste(e, e.dataTransfer?.getData('text/plain') ?? e.data ?? undefined);
}, true);

// ------------------------------------------------------------ warning UI

/** Shows the warning in the top frame; small iframes would hide it. */
function present(data: BannerData, original: string | null, show: 'toast' | 'banner'): void {
  if (window !== window.top) {
    void send({ type: 'show-banner', data, canCopyAnyway: false, show });
    return;
  }
  render(data, original, show);
}

function render(data: BannerData, original: string | null, show: 'toast' | 'banner'): void {
  const actions = {
    onClose: () => void send({ type: 'close-tab' }),
    onAsk: () => {
      const digits = settings.contact.replace(/\D/g, '');
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(askMessage(data))}`, '_blank', 'noopener');
    },
    onCopyAnyway:
      original === null
        ? undefined
        : async () => {
            void send({ type: 'override', host: data.host, ids: data.ids ?? [] });
            await navigator.clipboard.writeText(original).catch(() => overwriteClipboard(original));
          },
  };
  if (show === 'toast') showToast(data, () => showBanner(data, actions));
  else showBanner(data, actions);
}

chrome.runtime.onMessage.addListener((msg: ToContent) => {
  if (msg?.type === 'show-banner' && window === window.top) render(msg.data, null, msg.show);
});

addEventListener('pagehide', hideBanner);

// ------------------------------------------------------------ helpers

function overwriteClipboard(text: string): void {
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  overwriting = true;
  document.addEventListener('copy', onCopy, true);
  try {
    document.execCommand('copy');
  } finally {
    document.removeEventListener('copy', onCopy, true);
    overwriting = false;
  }
  // Belt and braces: if the page swallowed our copy event, the async API still lands.
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
