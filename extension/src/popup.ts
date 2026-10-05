import type { OwlEvent, PopupState, Settings } from './messages.ts';
import type { LangSetting } from './strings.ts';

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
    const what = e.kind === 'copy-warn' ? 'Warned' : 'Blocked';
    const reasons = e.ids.map((id) => REASON[id]).filter(Boolean).slice(0, 2).join(' · ');
    li.innerHTML = `<b></b><span class="host"></span><span class="why"></span><time></time>`;
    li.querySelector('b')!.textContent = what;
    li.querySelector('.host')!.textContent = e.host || 'a page';
    li.querySelector('.why')!.textContent = reasons;
    li.querySelector('time')!.textContent = timeAgo(e.time);
    li.classList.toggle('warn', e.kind === 'copy-warn');
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
  status.textContent = state.agentConnected ? 'Protected: browser + Windows' : 'Protected: browser only';
  status.classList.toggle('partial', !state.agentConnected);
  $('agent-hint').hidden = state.agentConnected;
  renderEvents(state.events);

  const lang = $<HTMLSelectElement>('lang');
  lang.value = state.settings.lang;
  lang.addEventListener('change', () => void save({ lang: lang.value as LangSetting }));

  const contact = $<HTMLInputElement>('contact');
  contact.value = state.settings.contact;
  contact.addEventListener('change', () => void save({ contact: contact.value.replace(/[^\d+]/g, '') }));
}

void main();
