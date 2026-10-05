// Turns organisation rules (blocked hosts, approved fingerprints) into files IT
// can deploy: a PowerShell command, a .reg file or a browser policy JSON.
//
// The hosts usually come from activity exports, which are untrusted, and the
// output is run as administrator, so only strict host names and 64-hex
// fingerprints ever reach it. Anything else is dropped and reported.

export const EXTENSION_ID = 'jjkhmdbenclipofjaeeblabpmjdcibpi';

const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

export type PolicyFormat = 'powershell' | 'reg' | 'json';

export interface PolicyInput {
  blockedHosts?: string[];
  approvedCommands?: string[];
}

export interface PolicyOutput {
  format: PolicyFormat;
  filename: string;
  text: string;
  /** Values left out because they are not a valid host or fingerprint. */
  rejected: string[];
}

function sanitize(input: PolicyInput): { hosts: string[]; hashes: string[]; rejected: string[] } {
  const rejected: string[] = [];
  const keep = (list: string[] | undefined, re: RegExp) =>
    [...new Set((list ?? []).map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : '')))].filter((v) => {
      if (re.test(v)) return true;
      if (v) rejected.push(v);
      return false;
    });
  const hosts = keep(input.blockedHosts, HOST).sort();
  const hashes = keep(input.approvedCommands, FINGERPRINT).sort();
  return { hosts, hashes, rejected };
}

const REG_ROOTS = ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Edge'];

export function buildPolicy(input: PolicyInput, format: PolicyFormat, now = new Date()): PolicyOutput {
  const { hosts, hashes, rejected } = sanitize(input);
  const stamp = now.toISOString().slice(0, 10);

  if (format === 'powershell') {
    // Validated values contain only [a-z0-9.-] or hex, so single quotes are safe.
    const list = (xs: string[]) => xs.map((x) => `'${x}'`).join(',');
    const parts = ['.\\Set-OwlCeptPolicy.ps1'];
    if (hosts.length) parts.push(`-BlockedHosts ${list(hosts)}`);
    if (hashes.length) parts.push(`-ApprovedCommands ${list(hashes)}`);
    return { format, filename: `owlcept-policy-${stamp}.ps1.txt`, text: `${parts.join(' ')}\n`, rejected };
  }

  if (format === 'reg') {
    const lines = ['Windows Registry Editor Version 5.00', '', `; OwlCept organisation rules, generated ${stamp}. Import as administrator.`, ''];
    for (const root of REG_ROOTS) {
      const key = `${root}\\3rdparty\\extensions\\${EXTENSION_ID}\\policy`;
      for (const [name, items] of [['blockedHosts', hosts], ['approvedCommands', hashes]] as const) {
        if (!items.length) continue;
        lines.push(`[-${key}\\${name}]`, '', `[${key}\\${name}]`);
        items.forEach((v, i) => lines.push(`"${i + 1}"="${v}"`));
        lines.push('');
      }
    }
    // .reg files are UTF-16LE with CRLF on Windows; regedit also accepts this ASCII-only form.
    return { format, filename: `owlcept-policy-${stamp}.reg`, text: lines.join('\r\n'), rejected };
  }

  const ext: Record<string, string[]> = {};
  if (hosts.length) ext.blockedHosts = hosts;
  if (hashes.length) ext.approvedCommands = hashes;
  const json = { '3rdparty': { extensions: { [EXTENSION_ID]: ext } } };
  return { format, filename: 'owlcept.json', text: `${JSON.stringify(json, null, 2)}\n`, rejected };
}
