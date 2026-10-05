// Activity dashboard: what OwlCept stopped on this device, the family summary,
// fleet export and every setting. Everything is rendered with textContent;
// hosts and URLs in the log came from web pages and are treated as untrusted.

import { buildReport, reasonLabel as label, summarize, type ActivityEvent } from '@owlcept/engine';
import type { PopupState, Settings } from './messages.ts';
import { defang, normalizeSite, reportUrl, type Mode } from './policy.ts';
import { saveSettings } from './settings-store.ts';
import type { LangSetting } from './strings.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

const KIND_LABEL: Record<ActivityEvent['kind'], string> = {
  'copy-block': 'Blocked',
  'copy-warn': 'Warned',
  consentfix: 'Sign-in code',
  override: 'Copied anyway',
};

let state: PopupState;
let days = 30;

async function load(): Promise<void> {
  state = (await chrome.runtime.sendMessage({ type: 'popup-state' })) as PopupState;
  render();
}

function render(): void {
  const s = state.settings;
  $('status').textContent = [
    s.mode === 'audit' ? 'Audit mode: logging only' : s.mode === 'strict' ? 'Strict protection' : 'Smart protection',
    state.agentConnected ? 'browser + Windows agent' : 'browser only',
    `v${state.version}`,
  ].join(' · ');
  renderSummary();
  renderHistory();
  renderFamily();
  renderSettings();
}

// ------------------------------------------------------------------ summary

function renderSummary(): void {
  const sum = summarize(state.events, { days });
  $('n-blocked').textContent = String(sum.blocked);
  $('n-warned').textContent = String(sum.warned);
  $('n-consentfix').textContent = String(sum.consentfix);
  $('n-overrides').textContent = String(sum.overrides);
  $('n-silent').textContent = String(sum.silent);

  // Stacked bars, one per day; plain SVG so the page needs no chart library.
  const W = 1000, H = 150, pad = 18;
  const max = Math.max(1, ...sum.byDay.map((d) => d.blocked + d.warned));
  const bw = W / sum.byDay.length;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const rect = (x: number, y: number, w: number, h: number, fill: string, title: string) => {
    const r = document.createElementNS(ns, 'rect');
    Object.entries({ x, y, width: w, height: h, rx: Math.min(3, w / 4), fill }).forEach(([k, v]) => r.setAttribute(k, String(v)));
    const t = document.createElementNS(ns, 'title');
    t.textContent = title;
    r.append(t);
    svg.append(r);
  };
  const css = getComputedStyle(document.documentElement);
  rect(0, H - pad, W, 1, css.getPropertyValue('--line'), '');
  sum.byDay.forEach((d, i) => {
    const scale = (H - pad - 4) / max;
    const x = i * bw + bw * 0.15, w = bw * 0.7;
    const hb = d.blocked * scale, hw = d.warned * scale;
    const title = `${d.day}: ${d.blocked} blocked, ${d.warned} warned`;
    if (hb) rect(x, H - pad - hb, w, hb, css.getPropertyValue('--red'), title);
    if (hw) rect(x, H - pad - hb - hw, w, hw, css.getPropertyValue('--amber'), title);
    if (!hb && !hw) rect(x, H - pad - 2, w, 2, css.getPropertyValue('--line'), title);
  });
  $('chart').replaceChildren(svg);

  const bars = (target: string, rows: [string, number][], fmt: (k: string) => string) => {
    const list = $(target);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    list.replaceChildren(
      ...(rows.length
        ? rows.map(([k, n]) => {
            const bar = el('i');
            bar.style.width = `${(n / max) * 100}%`;
            return el('li', {}, el('span', { textContent: fmt(k), title: fmt(k) }), el('em', { textContent: String(n) }), bar);
          })
        : [el('li', { className: 'none', textContent: 'Nothing in this period.' })]),
    );
  };
  bars('top-hosts', sum.topHosts, (h) => h);
  bars('top-reasons', sum.topReasons, label);
  $('campaign').hidden = sum.repeatedHashes.length === 0;
  bars('repeated', sum.repeatedHashes, (h) => {
    const hosts = [...new Set(state.events.filter((e) => e.hash === h).map((e) => e.host))];
    return `${h.slice(0, 12)}… on ${hosts.slice(0, 3).join(', ')}${hosts.length > 3 ? ` +${hosts.length - 3}` : ''}`;
  });
}

// ------------------------------------------------------------------ history

function renderHistory(): void {
  const q = $<HTMLInputElement>('search').value.trim().toLowerCase();
  const kind = $<HTMLSelectElement>('kind').value;
  const since = Date.now() - days * 86_400_000;
  const rows = state.events.filter((e) => e.time >= since && (!kind || e.kind === kind) && (!q || e.host.includes(q))).slice(0, 300);
  $('history').replaceChildren(
    ...rows.map((e) => {
      const what = el('td', {}, el('span', { className: `tag ${e.kind}`, textContent: KIND_LABEL[e.kind] }));
      if (e.note) what.append(el('span', { className: 'tag note', textContent: e.note === 'audit' ? 'audit' : 'trusted site' }));
      const site = el('td', { className: 'site', textContent: e.host || '—' });
      if (e.url) site.append(el('small', { textContent: defang(e.url) }));
      const why = el('td', { textContent: e.ids.filter((id) => !['script-copy', 'Microsoft', 'Google'].includes(id)).slice(0, 3).map(label).join(' · ') });
      const act = el('td');
      if (e.url) {
        const b = el('button', { className: 'small', textContent: 'Report', title: 'Opens Google Safe Browsing’s report form with this address filled in' });
        b.addEventListener('click', () => window.open(reportUrl(e.url!), '_blank', 'noopener'));
        act.append(b);
      }
      return el('tr', {}, el('td', { className: 'when', textContent: new Date(e.time).toLocaleString() }), what, site, why, act);
    }),
  );
  $('empty').hidden = rows.length > 0;
}

// ------------------------------------------------------------------ family view and export

function summaryText(): string {
  const sum = summarize(state.events, { days: 7 });
  const name = state.settings.deviceLabel || 'my computer';
  const lines = [`OwlCept weekly summary for ${name}:`, `• ${sum.blocked} dangerous command${sum.blocked === 1 ? '' : 's'} blocked`, `• ${sum.warned} warning${sum.warned === 1 ? '' : 's'}`];
  if (sum.consentfix) lines.push(`• ${sum.consentfix} sign-in code${sum.consentfix === 1 ? '' : 's'} stopped from going to the wrong site`);
  if (sum.overrides) lines.push(`• copied anyway ${sum.overrides} time${sum.overrides === 1 ? '' : 's'} after a warning`);
  if (sum.topHosts.length) lines.push(`Websites: ${sum.topHosts.slice(0, 3).map(([h]) => defang(h)).join(', ')}`);
  if (!sum.total) lines.push('Nothing suspicious this week.');
  return lines.join('\n');
}

function renderFamily(): void {
  $('summary').textContent = summaryText();
  const digits = state.settings.contact.replace(/\D/g, '');
  $<HTMLButtonElement>('send-summary').disabled = !digits;
  $('no-contact').hidden = !!digits;
}

function download(name: string, type: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type }));
  el('a', { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);
const fileLabel = () => (state.settings.deviceLabel || 'device').replace(/[^\w.-]+/g, '-').slice(0, 40);

function exportJson(): void {
  const report = buildReport(state.events, { id: state.deviceId, label: state.settings.deviceLabel }, { name: 'OwlCept extension', version: state.version }, state.settings.mode);
  download(`owlcept-${fileLabel()}-${stamp()}.json`, 'application/json', JSON.stringify(report, null, 2));
}

function exportCsv(): void {
  // Leading = + - @ would run as a formula in a spreadsheet; a quote in front keeps it text.
  const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const head = ['time', 'kind', 'host', 'reasons', 'note', 'url', 'hash'];
  const rows = state.events.map((e) => [new Date(e.time).toISOString(), e.kind, e.host, e.ids.join(' '), e.note ?? '', e.url ?? '', e.hash ?? ''].map(cell).join(','));
  download(`owlcept-${fileLabel()}-${stamp()}.csv`, 'text/csv', [head.join(','), ...rows].join('\r\n'));
}

// ------------------------------------------------------------------ settings

function renderSettings(): void {
  const s = state.settings;
  const locked = new Set(state.locked);
  $('locked').hidden = locked.size === 0;
  const bind = (id: string, key: keyof Settings, value: string | boolean) => {
    const input = $<HTMLInputElement | HTMLSelectElement>(id);
    if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = value as boolean;
    else input.value = value as string;
    input.disabled = locked.has(key);
    const lbl = input.closest('label');
    if (lbl && locked.has(key) && !lbl.dataset.locked) {
      lbl.dataset.locked = '1';
      lbl.prepend('🔒 ');
    }
  };
  bind('mode', 'mode', s.mode);
  bind('lang', 'lang', s.lang);
  bind('contact', 'contact', s.contact);
  bind('device-label', 'deviceLabel', s.deviceLabel);
  bind('report-lures', 'reportLures', s.reportLures);

  const trustLocked = locked.has('trustedSites');
  $<HTMLInputElement>('trust-input').disabled = trustLocked;
  $('trusted').replaceChildren(
    ...(s.trustedSites.length
      ? s.trustedSites.map((site) => {
          const li = el('li', {}, site);
          if (!trustLocked) {
            const x = el('button', { textContent: '×', title: `Stop trusting ${site}` });
            x.setAttribute('aria-label', `Remove ${site}`);
            x.addEventListener('click', () => void update({ trustedSites: s.trustedSites.filter((t) => t !== site) }));
            li.append(x);
          }
          return li;
        })
      : [el('li', { className: 'none', textContent: 'No trusted sites.' })]),
  );
}

async function update(patch: Partial<Settings>): Promise<void> {
  await saveSettings(patch);
  await load();
}

// ------------------------------------------------------------------ wiring

for (const b of document.querySelectorAll<HTMLButtonElement>('.range button')) {
  b.addEventListener('click', () => {
    days = Number(b.dataset.days);
    document.querySelectorAll('.range button').forEach((x) => x.classList.toggle('on', x === b));
    renderSummary();
    renderHistory();
  });
}
$('search').addEventListener('input', renderHistory);
$('kind').addEventListener('change', renderHistory);
$('send-summary').addEventListener('click', () => {
  const digits = state.settings.contact.replace(/\D/g, '');
  if (digits) window.open(`https://wa.me/${digits}?text=${encodeURIComponent(summaryText())}`, '_blank', 'noopener');
});
$('copy-summary').addEventListener('click', () => void navigator.clipboard.writeText(summaryText()));
$('export-json').addEventListener('click', exportJson);
$('export-csv').addEventListener('click', exportCsv);
$('clear').addEventListener('click', () => ($('clear-confirm').hidden = false));
$('clear-no').addEventListener('click', () => ($('clear-confirm').hidden = true));
$('clear-yes').addEventListener('click', async () => {
  await chrome.storage.local.set({ events: [] });
  $('clear-confirm').hidden = true;
  await load();
});
$('mode').addEventListener('change', (e) => void update({ mode: (e.target as HTMLSelectElement).value as Mode }));
$('lang').addEventListener('change', (e) => void update({ lang: (e.target as HTMLSelectElement).value as LangSetting }));
$('contact').addEventListener('change', (e) => void update({ contact: (e.target as HTMLInputElement).value }));
$('device-label').addEventListener('change', (e) => void update({ deviceLabel: (e.target as HTMLInputElement).value.trim() }));
$('report-lures').addEventListener('change', (e) => void update({ reportLures: (e.target as HTMLInputElement).checked }));
$('trust-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('trust-input');
  const site = normalizeSite(input.value);
  $('trust-error').hidden = !!site;
  if (!site) return;
  input.value = '';
  void update({ trustedSites: [...state.settings.trustedSites.filter((t) => t !== site), site] });
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.events || changes.settings) void load();
});

void load();
