// Printable incident report for one activity event, plus a signed evidence file
// (a one-event activity export, so the fleet view verifies it like any other).

import { buildReport, reasonLabel, signReport, type ActivityEvent } from '@owlcept/engine';
import { deviceKeyId, deviceKeys } from './keystore.ts';
import { eventKey, type PopupState } from './messages.ts';
import { defang } from './policy.ts';

const $ = (id: string) => document.getElementById(id)!;
const KIND: Record<ActivityEvent['kind'], [string, string]> = {
  'copy-block': ['Blocked a dangerous copy', 'OwlCept stopped a command at the moment it was copied and replaced the clipboard.'],
  'copy-warn': ['Warned about a copied command', 'OwlCept showed a warning when this command was copied.'],
  consentfix: ['Stopped a sign-in code paste', 'OwlCept stopped a sign-in link or code from being pasted into a site that did not start the sign-in (ConsentFix).'],
  override: ['Warning overridden ("Copy anyway")', 'The user typed COPY to restore a blocked command to the clipboard.'],
};

function rows(target: string, pairs: [string, string | Node][]): void {
  $(target).replaceChildren(
    ...pairs.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.append(v);
      return [dt, dd];
    }),
  );
}

const mono = (text: string) => Object.assign(document.createElement('span'), { className: 'mono', textContent: text });
const li = (text: string) => Object.assign(document.createElement('li'), { textContent: text });

async function main(): Promise<void> {
  const key = new URLSearchParams(location.search).get('e') ?? '';
  const state = (await chrome.runtime.sendMessage({ type: 'popup-state' })) as PopupState;
  const e = state.events.find((x) => eventKey(x) === key);
  if (!e) {
    $('missing').hidden = false;
    return;
  }
  $('report').hidden = false;
  const [title, summary] = KIND[e.kind];
  $('head').className = e.kind === 'copy-warn' ? 'warn' : e.kind;
  $('title').textContent = title;
  $('subtitle').textContent = `${new Date(e.time).toLocaleString()} · ${state.settings.deviceLabel || 'this device'}`;
  document.title = `OwlCept incident: ${title} (${new Date(e.time).toISOString().slice(0, 10)})`;

  rows('what', [
    ['Summary', summary],
    ['When (local)', new Date(e.time).toLocaleString()],
    ['When (UTC)', mono(new Date(e.time).toISOString())],
    ['Website', e.host || 'unknown'],
    ['Page address', e.url ? mono(defang(e.url)) : 'not kept (only kept for blocks and sign-in codes)'],
    ['Clipboard fingerprint', e.hash ? mono(e.hash) : 'none'],
    ['Shown to the user', e.note === 'audit' ? 'No: audit mode, logged only' : e.note === 'trusted-site' ? 'No: trusted site, warnings skipped' : 'Yes'],
  ]);

  const reasons = e.ids.filter((id) => !['Microsoft', 'Google'].includes(id));
  const provider = e.ids.find((id) => id === 'Microsoft' || id === 'Google');
  $('why').replaceChildren(...reasons.map((id) => li(reasonLabel(id))), ...(provider ? [li(`sign-in provider: ${provider}`)] : []));

  rows('device', [
    ['Device name', state.settings.deviceLabel || '(not set)'],
    ['Device id', mono(state.deviceId)],
    ['Signing key id', mono(await deviceKeyId())],
    ['OwlCept version', state.version],
    ['Protection mode', state.settings.mode],
    ['Windows agent', state.agentConnected ? 'connected' : 'not connected'],
  ]);

  const sameItem = e.hash ? state.events.filter((x) => x.hash === e.hash && x !== e) : [];
  const sameSite = state.events.filter((x) => x.host === e.host && x !== e);
  const overrides = state.events.filter((x) => x.kind === 'override' && x.host === e.host && x.time >= e.time);
  $('related').textContent = [
    sameItem.length ? `The same clipboard item was stopped ${sameItem.length} more time${sameItem.length === 1 ? '' : 's'} on this device.` : 'This clipboard item was not seen again on this device.',
    sameSite.length ? `${sameSite.length} other event${sameSite.length === 1 ? '' : 's'} from ${e.host}.` : '',
    overrides.length ? `After this, the user chose "Copy anyway" on ${e.host}.` : '',
  ].filter(Boolean).join(' ');

  const todo: string[] = [];
  if (e.kind === 'override' || overrides.length) todo.push('Talk to the user: they saw a warning and went ahead. If the command ran, treat the PC as possibly compromised and follow your incident process.');
  if (e.kind === 'consentfix') todo.push(`Ask the user to sign out of their ${provider ?? 'Microsoft or Google'} account on all devices and review recent sign-ins; revoke the session if anything looks unfamiliar.`);
  if (e.host && e.kind !== 'copy-warn') todo.push(`Add ${defang(e.host)} to the fleet view's blocklist (Block these sites on every PC) so every PC blocks commands that contact it.`);
  if (e.hash) todo.push('Drop exports from other PCs into the fleet view: a matching fingerprint under Campaigns means the same lure reached them.');
  if (e.url) todo.push('Report the page to Google Safe Browsing from the dashboard (Report) so other people are warned too.');
  todo.push('Keep the signed evidence file with the ticket; the fleet view can confirm it has not been edited.');
  $('todo').replaceChildren(...todo.map(li));
  $('generated').textContent = new Date().toLocaleString();

  $('print').addEventListener('click', () => print());
  $('evidence').addEventListener('click', async () => {
    const report = buildReport([e], { id: state.deviceId, label: state.settings.deviceLabel }, { name: 'OwlCept extension', version: state.version }, state.settings.mode);
    const signed = await signReport(report, await deviceKeys());
    const url = URL.createObjectURL(new Blob([JSON.stringify(signed, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `owlcept-incident-${new Date(e.time).toISOString().replace(/[:.]/g, '-')}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

void main();
