// Settings resolution. The user's choices live in chrome.storage.local; an
// organisation can set any of them through browser policy (Group Policy,
// Intune, Jamf), which arrives in chrome.storage.managed. Managed values win
// and are shown locked.

import { DEFAULT_SETTINGS, type Settings } from './messages.ts';
import { normalizeSite } from './policy.ts';

const MODES = new Set(['audit', 'smart', 'strict']);
const LANGS = new Set(['auto', 'en', 'hi', 'kn']);

/** Keeps only well-formed values; policy and storage are both outside our control. */
export function clean(raw: Record<string, unknown> | undefined): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (!raw) return out;
  if (typeof raw.mode === 'string' && MODES.has(raw.mode)) out.mode = raw.mode as Settings['mode'];
  if (typeof raw.lang === 'string' && LANGS.has(raw.lang)) out.lang = raw.lang as Settings['lang'];
  if (typeof raw.contact === 'string') out.contact = raw.contact.replace(/[^\d+]/g, '').slice(0, 20);
  if (Array.isArray(raw.trustedSites)) out.trustedSites = [...new Set(raw.trustedSites.map((s) => (typeof s === 'string' ? normalizeSite(s) : '')).filter(Boolean))].slice(0, 500);
  if (typeof raw.reportLures === 'boolean') out.reportLures = raw.reportLures;
  if (typeof raw.allowCopyAnyway === 'boolean') out.allowCopyAnyway = raw.allowCopyAnyway;
  if (typeof raw.deviceLabel === 'string') out.deviceLabel = raw.deviceLabel.slice(0, 80);
  if (Array.isArray(raw.blockedHosts)) out.blockedHosts = [...new Set(raw.blockedHosts.map((s) => (typeof s === 'string' ? normalizeSite(s) : '')).filter(Boolean))].slice(0, 5000);
  if (Array.isArray(raw.approvedCommands)) out.approvedCommands = [...new Set(raw.approvedCommands.filter((h): h is string => typeof h === 'string' && /^[0-9a-f]{64}$/i.test(h.trim())).map((h) => h.trim().toLowerCase()))].slice(0, 5000);
  return out;
}

/** Settings only an organisation can set; values in local storage are ignored. */
const ORG_ONLY: (keyof Settings)[] = ['blockedHosts', 'approvedCommands'];

async function managed(): Promise<Partial<Settings>> {
  try {
    return clean((await chrome.storage.managed.get(null)) as Record<string, unknown>);
  } catch {
    return {}; // no policy set, or a browser without managed storage
  }
}

export async function loadSettings(): Promise<{ settings: Settings; locked: (keyof Settings)[] }> {
  const [{ settings: local }, policy] = await Promise.all([chrome.storage.local.get('settings'), managed()]);
  const mine = clean(local as Record<string, unknown>);
  for (const k of ORG_ONLY) delete mine[k];
  return {
    settings: { ...DEFAULT_SETTINGS, ...mine, ...policy },
    locked: Object.keys(policy) as (keyof Settings)[],
  };
}

/** Saves the user's choices; fields the organisation has locked are left alone. */
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const { locked } = await loadSettings();
  const { settings } = (await chrome.storage.local.get('settings')) as { settings?: Record<string, unknown> };
  const next = { ...clean(settings), ...clean(patch as Record<string, unknown>) };
  for (const k of [...locked, ...ORG_ONLY]) delete next[k];
  await chrome.storage.local.set({ settings: next });
}

/** A random id for this browser profile, used only to tell devices apart in fleet exports. */
export async function deviceId(): Promise<string> {
  const { deviceId: id } = (await chrome.storage.local.get('deviceId')) as { deviceId?: string };
  if (id) return id;
  const fresh = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId: fresh });
  return fresh;
}
