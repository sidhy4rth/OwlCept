// OwlCept fleet view: merges activity exports from many devices, entirely in
// the browser. Imported files are untrusted (parseReport keeps only known
// fields), and everything is rendered with textContent.

import { buildPolicy, generateDeviceKey, parseReport, reasonLabel, signReport, summarizeFleet, verifyReport, type ActivityEvent, type ActivityReport, type PolicyFormat } from '@owlcept/engine';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};
const defang = (s: string) => s.replace(/\./g, '[.]');
const when = (t: number | null) => (t ? new Date(t).toLocaleString() : '—');

let reports: ActivityReport[] = [];
/** Per device: whether every file was signed, and the key ids seen (more than one means the key changed). */
const trust = new Map<string, { unsigned: boolean; keys: Set<string> }>();
let days = 30;
/** Lure sites ticked for the policy; survives re-renders. */
const selected = new Set<string>();

// ------------------------------------------------------------------ loading

async function addFiles(files: FileList | File[]): Promise<void> {
  for (const f of [...files]) {
    if (f.size > 20 * 1024 * 1024) {
      note(`${f.name}: larger than 20 MB, skipped`, true);
      continue;
    }
    await addText(f.name, await f.text());
  }
  render();
}

/** Verifies, then adds one export. Files edited after signing are left out of every number. */
async function addText(name: string, text: string): Promise<void> {
  let r: ActivityReport;
  try {
    r = parseReport(text);
  } catch (e) {
    note(`${name}: ${(e as Error).message}`, true);
    return;
  }
  const v = await verifyReport(text);
  const who = r.device.label || r.device.id.slice(0, 8);
  if (v.status === 'invalid') {
    note(`${name}: ${who}: signature check failed (${v.reason}). Left out.`, true);
    return;
  }
  const t = trust.get(r.device.id) ?? { unsigned: false, keys: new Set<string>() };
  if (v.status === 'unsigned') t.unsigned = true;
  else t.keys.add(v.keyId!);
  trust.set(r.device.id, t);
  reports.push(r);
  const sig = v.status === 'verified' ? `signed, key ${v.keyId!.slice(0, 8)}${t.keys.size > 1 ? ' (KEY CHANGED for this device)' : ''}` : 'not signed';
  note(`${name}: ${who}, ${r.events.length} events, ${sig}`, t.keys.size > 1);
}

function note(text: string, err: boolean): void {
  $('files').append(el('li', { textContent: text, className: err ? 'err' : '' }));
}

// Three fictional lab PCs, so the page can be tried without real exports.
function sampleReports(): ActivityReport[] {
  const day = 86_400_000;
  const now = Date.now();
  const campaign = 'd'.repeat(64);
  const mk = (id: string, label: string, mode: string, evs: Omit<ActivityEvent, 'ids'>[], ids: string[][]): ActivityReport => ({
    format: 'owlcept-activity', version: 1, device: { id, label }, exported: new Date(now).toISOString(), app: { name: 'OwlCept extension', version: '0.2.0' }, mode,
    events: evs.map((e, i) => ({ ...e, ids: ids[i % ids.length] })),
  });
  const lure = (host: string, t: number, extra: Partial<ActivityEvent> = {}): Omit<ActivityEvent, 'ids'> => ({ time: now - t, kind: 'copy-block', host, hash: campaign, url: `https://${host}/verify`, ...extra });
  return [
    mk('lab-1', 'Library PC 1', 'smart', [lure('verify-human.example-lure.test', 2 * day), lure('cdn-check.example-lure.test', 9 * day, { hash: 'e'.repeat(64) }), { time: now - 3 * day, kind: 'copy-warn', host: 'scripts.example.test' }],
      [['download-exec', 'hidden-copy', 'lure-words'], ['remote-script-host', 'fake-captcha'], ['persistence']]),
    mk('lab-2', 'Library PC 2', 'smart', [lure('verify-human.example-lure.test', 2 * day + 3600_000), { time: now - 2 * day, kind: 'override', host: 'scripts.example.test' }, { time: now - 5 * day, kind: 'consentfix', host: 'connect.example-lure.test', url: 'https://connect.example-lure.test/link' }],
      [['download-exec', 'hidden-copy'], ['persistence'], ['consentfix', 'Microsoft']]),
    mk('hostel-7', 'Hostel desk', 'audit', [lure('verify-human.example-lure.test', 1 * day, { note: 'audit' }), lure('update-now.example-lure.test', 12 * day, { hash: 'f'.repeat(64), note: 'audit' })],
      [['download-exec', 'lure-words'], ['decoy-comment', 'obfuscated']]),
  ];
}

// ------------------------------------------------------------------ rendering

function render(): void {
  $('report').hidden = reports.length === 0;
  $('reset').hidden = reports.length === 0;
  if (!reports.length) return;
  const f = summarizeFleet(reports, { days });

  $('n-devices').textContent = String(f.devices.length);
  $('n-blocked').textContent = String(f.blocked);
  $('n-warned').textContent = String(f.warned);
  $('n-consentfix').textContent = String(f.consentfix);
  $('n-overrides').textContent = String(f.overrides);

  const auditDevices = f.devices.filter((d) => d.mode === 'audit').length;
  $('audit-note').hidden = !auditDevices;
  $('audit-note').textContent = `${auditDevices} device${auditDevices === 1 ? ' is' : 's are'} in audit mode. Switched to smart, OwlCept would have stopped ${f.auditWouldBlock} more command${f.auditWouldBlock === 1 ? '' : 's'} there.`;

  chart(f.byDay);

  $('devices').replaceChildren(
    ...f.devices.map((d) =>
      el('tr', {},
        el('td', {}, el('b', { textContent: d.label || 'Unnamed device' }), el('div', { className: 'mono', textContent: d.id.slice(0, 13) })),
        el('td', {}, el('span', { className: `tag ${d.mode}`, textContent: d.mode || '?' })),
        el('td', { className: `num ${d.blocked ? 'hot' : ''}`, textContent: String(d.blocked) }),
        el('td', { className: 'num', textContent: String(d.warned) }),
        el('td', { className: 'num', textContent: String(d.consentfix) }),
        el('td', { className: `num ${d.overrides ? 'overr' : ''}`, textContent: String(d.overrides) }),
        el('td', { textContent: when(d.lastEvent) }),
        el('td', { textContent: d.exported ? new Date(d.exported).toLocaleDateString() : '—' }),
        signatureCell(d.id),
      ),
    ),
  );

  const empty = (cols: number, text: string) => el('tr', {}, el('td', { colSpan: cols, className: 'muted', textContent: text }));
  $('hosts').replaceChildren(
    ...(f.lureHosts.length
      ? f.lureHosts.slice(0, 50).map((h) => {
          const box = document.createElement('input');
          box.type = 'checkbox';
          box.checked = selected.has(h.host);
          box.setAttribute('aria-label', `Block ${h.host}`);
          box.addEventListener('change', () => {
            if (box.checked) selected.add(h.host);
            else selected.delete(h.host);
            renderPolicy();
          });
          return el('tr', {}, el('td', {}, box), el('td', { className: 'mono', textContent: defang(h.host) }), el('td', { className: 'num', textContent: String(h.devices) }), el('td', { className: 'num', textContent: String(h.events) }));
        })
      : [empty(4, 'No blocked pages in this period.')]),
  );
  $('campaigns').replaceChildren(
    ...(f.campaigns.length
      ? f.campaigns.map((c) => el('tr', {}, el('td', { className: 'mono', textContent: `${c.hash.slice(0, 16)}…` }), el('td', { className: 'num', textContent: String(c.devices) }), el('td', { className: 'mono', textContent: c.hosts.map(defang).join(', ') })))
      : [empty(3, 'No item was stopped on more than one device.')]),
  );
  renderPolicy();
  $('reasons').replaceChildren(
    ...(f.topReasons.length ? f.topReasons.map(([id, n]) => el('tr', {}, el('td', { textContent: reasonLabel(id) }), el('td', { className: 'num', textContent: String(n) }))) : [empty(2, 'Nothing in this period.')]),
  );
}

// ------------------------------------------------------------------ policy

function currentPolicy() {
  const approved = $<HTMLTextAreaElement>('approved').value.split(/\s+/).filter(Boolean);
  return buildPolicy({ blockedHosts: [...selected], approvedCommands: approved }, $<HTMLSelectElement>('format').value as PolicyFormat);
}

function renderPolicy(): void {
  const p = currentPolicy();
  const empty = !selected.size && !$<HTMLTextAreaElement>('approved').value.trim();
  $('policy-preview').textContent = empty ? 'Tick at least one lure site above.' : p.text;
  $<HTMLButtonElement>('policy-download').disabled = empty;
  $<HTMLButtonElement>('policy-copy').disabled = empty;
  $('policy-note').textContent = p.rejected.length ? `Left out ${p.rejected.length} value${p.rejected.length === 1 ? '' : 's'} that ${p.rejected.length === 1 ? 'is' : 'are'} not a valid host name or fingerprint.` : '';
}

function signatureCell(deviceId: string): HTMLTableCellElement {
  const t = trust.get(deviceId);
  const keys = [...(t?.keys ?? [])];
  if (keys.length > 1) return el('td', { className: 'sig bad', textContent: `key changed (${keys.map((k) => k.slice(0, 8)).join(' → ')})` });
  if (!t || t.unsigned || !keys.length) return el('td', { className: 'sig none', textContent: 'not signed' });
  return el('td', { className: 'sig ok', textContent: `✓ ${keys[0].slice(0, 4)} ${keys[0].slice(4, 8)}`, title: `Device key ${keys[0]}` });
}

function chart(byDay: { day: string; blocked: number; warned: number }[]): void {
  const ns = 'http://www.w3.org/2000/svg';
  const W = 1000, H = 140, pad = 16;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const css = getComputedStyle(document.documentElement);
  const max = Math.max(1, ...byDay.map((d) => d.blocked + d.warned));
  const bw = W / byDay.length;
  const bar = (x: number, y: number, w: number, h: number, color: string, title: string) => {
    const r = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: w, height: h, rx: Math.min(3, w / 4), fill: css.getPropertyValue(color) })) r.setAttribute(k, String(v));
    const t = document.createElementNS(ns, 'title');
    t.textContent = title;
    r.append(t);
    svg.append(r);
  };
  byDay.forEach((d, i) => {
    const s = (H - pad) / max;
    const x = i * bw + bw * 0.15, w = bw * 0.7, title = `${d.day}: ${d.blocked} blocked, ${d.warned} warned`;
    if (d.blocked) bar(x, H - pad - d.blocked * s, w, d.blocked * s, '--red', title);
    if (d.warned) bar(x, H - pad - (d.blocked + d.warned) * s, w, d.warned * s, '--amber', title);
    if (!d.blocked && !d.warned) bar(x, H - pad - 2, w, 2, '--line', title);
  });
  $('chart').replaceChildren(svg);
}

function exportCsv(): void {
  const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const rows = reports.flatMap((r) => r.events.map((e) => [r.device.label, r.device.id, new Date(e.time).toISOString(), e.kind, e.host, e.ids.join(' '), e.note ?? '', e.url ?? '', e.hash ?? ''].map(cell).join(',')));
  const body = ['device,device_id,time,kind,host,reasons,note,url,hash', ...rows].join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
  el('a', { href: url, download: `owlcept-fleet-${new Date().toISOString().slice(0, 10)}.csv` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------------ wiring

const drop = $('drop');
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  if (e.dataTransfer?.files.length) void addFiles(e.dataTransfer.files);
});
$('pick').addEventListener('click', () => $<HTMLInputElement>('file').click());
$<HTMLInputElement>('file').addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files) void addFiles(input.files).then(() => (input.value = ''));
});
$('sample').addEventListener('click', async () => {
  // Two of the three sample devices sign their exports, like the extension does.
  const [a, b, c] = sampleReports();
  for (const [i, r] of [a, b].entries()) await addText(`sample-${i + 1}.json`, JSON.stringify(await signReport(r, await generateDeviceKey())));
  await addText('sample-3.json', JSON.stringify(c));
  render();
});
$('reset').addEventListener('click', () => {
  reports = [];
  selected.clear();
  trust.clear();
  $('files').replaceChildren();
  render();
});
for (const b of document.querySelectorAll<HTMLButtonElement>('.range button')) {
  b.addEventListener('click', () => {
    days = Number(b.dataset.days);
    document.querySelectorAll('.range button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });
}
$('copy-hosts').addEventListener('click', () => {
  const f = summarizeFleet(reports, { days });
  void navigator.clipboard.writeText(f.lureHosts.map((h) => `0.0.0.0 ${h.host}`).join('\n')).then(() => {
    $('copied').hidden = false;
    setTimeout(() => ($('copied').hidden = true), 2000);
  });
});
$('export-csv').addEventListener('click', exportCsv);
$('all-hosts').addEventListener('change', (e) => {
  const on = (e.target as HTMLInputElement).checked;
  for (const h of summarizeFleet(reports, { days }).lureHosts) (on ? selected.add(h.host) : selected.delete(h.host));
  render();
});
$('format').addEventListener('change', renderPolicy);
$('approved').addEventListener('input', renderPolicy);
$('policy-copy').addEventListener('click', () => void navigator.clipboard.writeText(currentPolicy().text));
$('policy-download').addEventListener('click', () => {
  const p = currentPolicy();
  const url = URL.createObjectURL(new Blob([p.text], { type: 'text/plain' }));
  el('a', { href: url, download: p.filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
