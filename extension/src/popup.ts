import type { OwlEvent, PopupState, Settings } from './messages.ts';
import type { LangSetting } from './strings.ts';
import { isTrusted, normalizeSite, type Mode } from './policy.ts';

const REASON: Record<string, string> = {
  'hidden-copy': 'copied text was hidden',
  'lure-words': 'page said to press Win+R',
  'fake-captcha': 'fake CAPTCHA',
  'download-exec': 'download and run',
  'remote-script-host': 'runs code from the internet',
  'decoy-comment': 'fake "not a robot" note',
  'decoy-path': 'fake file path',
  obfuscated: 'disguised command',
  'hidden-window': 'runs invisibly',
  consentfix: 'sign-in code pasted into another site',
  'from-chat': 'came from a chat',
  'from-email': 'came from an email',
  'from-pdf': 'came from a PDF',
  'from-ai': 'came from a chatbot answer',
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function timeAgo(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

function renderEvents(events: OwlEvent[]): void {
  const list = $('events');
  list.textContent = '';
  if (!events.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nothing blocked yet.';
    list.append(li);
    return;
  }
  for (const e of events.slice(0, 8)) {
    const li = document.createElement('li');
    const what = e.kind === 'override' ? 'Copied anyway' : e.note ? 'Logged' : e.kind === 'copy-warn' ? 'Warned' : 'Blocked';
    const reasons = [
      e.note === 'audit' ? 'audit mode' : e.note === 'trusted-site' ? 'trusted site' : '',
      ...e.ids.map((id) => REASON[id]).filter(Boolean).slice(0, 2),
    ].filter(Boolean).join(' · ');
    li.innerHTML = `<b></b><span class="host"></span><span class="why"></span><time></time>`;
    li.querySelector('b')!.textContent = what;
    li.querySelector('.host')!.textContent = e.host || 'a page';
    li.querySelector('.why')!.textContent = reasons;
    li.querySelector('time')!.textContent = timeAgo(e.time);
    li.classList.toggle('warn', e.kind === 'copy-warn' || e.kind === 'override');
    li.classList.toggle('note', !!e.note);
    list.append(li);
  }
}

async function save(patch: Partial<Settings>): Promise<void> {
  const stored = await chrome.storage.local.get('settings');
  const settings = (stored.settings as Partial<Settings> | undefined) ?? {};
  await chrome.storage.local.set({ settings: { ...settings, ...patch } });
}

async function main(): Promise<void> {
  const state = (await chrome.runtime.sendMessage({ type: 'popup-state' })) as PopupState;
  const status = $('status');
  const s = state.settings;
  status.textContent =
    s.mode === 'audit' ? 'Audit mode: logging only' : state.agentConnected ? 'Protected: browser + Windows' : 'Protected: browser only';
  status.classList.toggle('partial', !state.agentConnected && s.mode !== 'audit');
  status.classList.toggle('audit', s.mode === 'audit');
  $('agent-hint').hidden = state.agentConnected;
  renderEvents(state.events);

  const locked = new Set(state.locked ?? []);
  $('locked').hidden = locked.size === 0;

  const mode = $<HTMLSelectElement>('mode');
  mode.value = s.mode;
  mode.disabled = locked.has('mode');
  mode.addEventListener('change', () => void save({ mode: mode.value as Mode }).then(() => location.reload()));

  // "Trust this site" for the page the popup was opened on.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = normalizeSite(tab?.url?.startsWith('http') ? tab.url : '');
  if (host) {
    const trust = $<HTMLInputElement>('trust');
    $('trust-host').textContent = host;
    $('trust-row').hidden = false;
    trust.checked = isTrusted(host, s.trustedSites);
    trust.disabled = locked.has('trustedSites');
    trust.addEventListener('change', () => {
      const others = s.trustedSites.filter((t) => normalizeSite(t) !== host);
      void save({ trustedSites: trust.checked ? [...others, host] : others });
    });
  }

  const lang = $<HTMLSelectElement>('lang');
  lang.value = s.lang;
  lang.disabled = locked.has('lang');
  lang.addEventListener('change', () => void save({ lang: lang.value as LangSetting }));

  const contact = $<HTMLInputElement>('contact');
  contact.value = s.contact;
  contact.disabled = locked.has('contact');
  contact.addEventListener('change', () => void save({ contact: contact.value.replace(/[^\d+]/g, '') }));
}

void main();
