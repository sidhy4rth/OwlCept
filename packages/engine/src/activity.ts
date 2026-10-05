// Activity log format shared by the extension's dashboard (which writes it) and
// the fleet view (which reads exports from many devices). Events carry hashes
// and metadata only, never clipboard text. Imported files are untrusted: the
// parser keeps only known fields of the right type and size.

export type ActivityKind = 'copy-block' | 'copy-warn' | 'consentfix' | 'override';

export interface ActivityEvent {
  time: number;
  kind: ActivityKind;
  host: string;
  /** Finding ids, e.g. ["download-exec", "hidden-copy"]. */
  ids: string[];
  /** SHA-256 of the normalised clipboard text. */
  hash?: string;
  /** Logged but not shown: audit mode or a trusted site. */
  note?: 'audit' | 'trusted-site';
  /** Lure page URL, kept for blocks and ConsentFix only. */
  url?: string;
}

export interface ActivityReport {
  format: 'owlcept-activity';
  version: 1;
  device: { id: string; label: string };
  /** ISO time of export. */
  exported: string;
  app: { name: string; version: string };
  mode: string;
  events: ActivityEvent[];
}

const KINDS = new Set<ActivityKind>(['copy-block', 'copy-warn', 'consentfix', 'override']);
const MAX_EVENTS = 10_000;
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

export function buildReport(events: ActivityEvent[], device: { id: string; label: string }, app: { name: string; version: string }, mode: string, now = new Date()): ActivityReport {
  return { format: 'owlcept-activity', version: 1, device, exported: now.toISOString(), app, mode, events };
}

/** Parses an exported report. Throws an Error with a readable message when the file is not one. */
export function parseReport(text: string): ActivityReport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not JSON.');
  }
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== 'object' || r.format !== 'owlcept-activity') throw new Error('This is not an OwlCept activity export.');
  if (r.version !== 1) throw new Error(`Unsupported export version ${String(r.version)}.`);
  if (!Array.isArray(r.events)) throw new Error('The export has no event list.');

  const device = (r.device ?? {}) as Record<string, unknown>;
  const app = (r.app ?? {}) as Record<string, unknown>;
  const events: ActivityEvent[] = [];
  for (const e of r.events.slice(0, MAX_EVENTS) as Record<string, unknown>[]) {
    if (!e || typeof e !== 'object' || !KINDS.has(e.kind as ActivityKind) || typeof e.time !== 'number' || !Number.isFinite(e.time)) continue;
    const ev: ActivityEvent = {
      time: e.time,
      kind: e.kind as ActivityKind,
      host: str(e.host, 253).toLowerCase(),
      ids: Array.isArray(e.ids) ? e.ids.filter((i): i is string => typeof i === 'string').slice(0, 20).map((i) => i.slice(0, 40)) : [],
    };
    if (typeof e.hash === 'string' && /^[0-9a-f]{64}$/i.test(e.hash)) ev.hash = e.hash.toLowerCase();
    if (e.note === 'audit' || e.note === 'trusted-site') ev.note = e.note;
    if (typeof e.url === 'string' && /^https?:\/\//i.test(e.url)) ev.url = e.url.slice(0, 2048);
    events.push(ev);
  }
  return {
    format: 'owlcept-activity',
    version: 1,
    device: { id: str(device.id, 64) || 'unknown', label: str(device.label, 80) },
    exported: str(r.exported, 40),
    app: { name: str(app.name, 60), version: str(app.version, 20) },
    mode: str(r.mode, 20),
    events,
  };
}

export interface Summary {
  total: number;
  blocked: number;
  warned: number;
  consentfix: number;
  overrides: number;
  /** Logged without interrupting (audit mode or trusted site). */
  silent: number;
  /** One entry per day, oldest first, local dates "YYYY-MM-DD". */
  byDay: { day: string; blocked: number; warned: number }[];
  topHosts: [string, number][];
  topReasons: [string, number][];
  /** Same clipboard item stopped on more than one device or page: a campaign. */
  repeatedHashes: [string, number][];
}

const dayKey = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const top = (m: Map<string, number>, n: number): [string, number][] => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);

/** Summarises the events of the last `days` days. */
export function summarize(events: ActivityEvent[], opts: { now?: number; days?: number } = {}): Summary {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? 30;
  const since = now - days * 86_400_000;
  const recent = events.filter((e) => e.time >= since && e.time <= now + 60_000);

  const byDay = new Map<string, { blocked: number; warned: number }>();
  for (let i = days - 1; i >= 0; i--) byDay.set(dayKey(now - i * 86_400_000), { blocked: 0, warned: 0 });
  const hosts = new Map<string, number>();
  const reasons = new Map<string, number>();
  const hashes = new Map<string, number>();
  const s = { total: recent.length, blocked: 0, warned: 0, consentfix: 0, overrides: 0, silent: 0 };

  for (const e of recent) {
    if (e.note) s.silent++;
    if (e.kind === 'override') s.overrides++;
    else if (e.kind === 'consentfix') s.consentfix++;
    else if (e.kind === 'copy-block') s.blocked++;
    else s.warned++;
    const cell = byDay.get(dayKey(e.time));
    if (cell && e.kind !== 'override') e.kind === 'copy-warn' ? cell.warned++ : cell.blocked++;
    if (e.kind !== 'override') {
      if (e.host) hosts.set(e.host, (hosts.get(e.host) ?? 0) + 1);
      for (const id of e.ids) if (!['script-copy', 'lure-words-nearby', 'target-run', 'target-explorer', 'Microsoft', 'Google'].includes(id)) reasons.set(id, (reasons.get(id) ?? 0) + 1);
      if (e.hash) hashes.set(e.hash, (hashes.get(e.hash) ?? 0) + 1);
    }
  }
  return {
    ...s,
    byDay: [...byDay].map(([day, c]) => ({ day, ...c })),
    topHosts: top(hosts, 8),
    topReasons: top(reasons, 8),
    repeatedHashes: top(hashes, 50).filter(([, n]) => n > 1).slice(0, 8),
  };
}

// ------------------------------------------------------------------ fleet

export interface DeviceRow {
  id: string;
  label: string;
  mode: string;
  version: string;
  exported: string;
  blocked: number;
  warned: number;
  consentfix: number;
  overrides: number;
  silent: number;
  lastEvent: number | null;
}

export interface FleetSummary extends Summary {
  devices: DeviceRow[];
  /** Clipboard items (by fingerprint) stopped on two or more devices. */
  campaigns: { hash: string; devices: number; events: number; hosts: string[] }[];
  /** Hosts of blocked pages, ranked by how many devices met them. */
  lureHosts: { host: string; devices: number; events: number }[];
  /** Blocks logged by devices in audit mode: what enforcement would have stopped. */
  auditWouldBlock: number;
}

/** One report per device (the latest export wins), with events from older exports of the same device folded in. */
export function mergeReports(reports: ActivityReport[]): ActivityReport[] {
  const byDevice = new Map<string, ActivityReport>();
  for (const r of [...reports].sort((a, b) => a.exported.localeCompare(b.exported))) {
    const prev = byDevice.get(r.device.id);
    const seen = new Set<string>();
    const events: ActivityEvent[] = [];
    for (const e of [...r.events, ...(prev?.events ?? [])]) {
      const key = `${e.time}|${e.kind}|${e.host}|${e.hash ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        events.push(e);
      }
    }
    byDevice.set(r.device.id, { ...r, device: { ...r.device, label: r.device.label || prev?.device.label || '' }, events: events.sort((a, b) => b.time - a.time) });
  }
  return [...byDevice.values()];
}

export function summarizeFleet(reports: ActivityReport[], opts: { now?: number; days?: number } = {}): FleetSummary {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? 30;
  const since = now - days * 86_400_000;
  const merged = mergeReports(reports);
  const all = merged.flatMap((r) => r.events);
  const base = summarize(all, { now, days });

  const campaign = new Map<string, { devices: Set<string>; events: number; hosts: Set<string> }>();
  const lure = new Map<string, { devices: Set<string>; events: number }>();
  let auditWouldBlock = 0;
  const devices: DeviceRow[] = merged.map((r) => {
    const recent = r.events.filter((e) => e.time >= since && e.time <= now + 60_000);
    const s = summarize(recent, { now, days });
    for (const e of recent) {
      if (e.kind === 'override') continue;
      if (e.hash) {
        const c = campaign.get(e.hash) ?? { devices: new Set(), events: 0, hosts: new Set() };
        c.devices.add(r.device.id);
        c.events++;
        if (e.host) c.hosts.add(e.host);
        campaign.set(e.hash, c);
      }
      if ((e.kind === 'copy-block' || e.kind === 'consentfix') && e.host) {
        const l = lure.get(e.host) ?? { devices: new Set(), events: 0 };
        l.devices.add(r.device.id);
        l.events++;
        lure.set(e.host, l);
      }
      if (e.note === 'audit' && (e.kind === 'copy-block' || e.kind === 'consentfix')) auditWouldBlock++;
    }
    return {
      id: r.device.id,
      label: r.device.label,
      mode: r.mode,
      version: r.app.version,
      exported: r.exported,
      blocked: s.blocked,
      warned: s.warned,
      consentfix: s.consentfix,
      overrides: s.overrides,
      silent: s.silent,
      lastEvent: recent.length ? Math.max(...recent.map((e) => e.time)) : null,
    };
  });

  return {
    ...base,
    devices: devices.sort((a, b) => b.blocked + b.consentfix - (a.blocked + a.consentfix) || a.label.localeCompare(b.label)),
    campaigns: [...campaign]
      .filter(([, c]) => c.devices.size > 1)
      .map(([hash, c]) => ({ hash, devices: c.devices.size, events: c.events, hosts: [...c.hosts].sort() }))
      .sort((a, b) => b.devices - a.devices || b.events - a.events)
      .slice(0, 20),
    lureHosts: [...lure]
      .map(([host, l]) => ({ host, devices: l.devices.size, events: l.events }))
      .sort((a, b) => b.devices - a.devices || b.events - a.events || a.host.localeCompare(b.host))
      .slice(0, 50),
    auditWouldBlock,
  };
}
