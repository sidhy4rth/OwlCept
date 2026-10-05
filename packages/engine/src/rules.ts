// Behaviour rules: read the decoded layers and say what the command would do.
// Each rule maps to one plain-language sentence in explain.ts.

import type { Decoded, Trick } from './deobfuscate.ts';
import type { Finding, Severity } from './types.ts';
import { extractHosts, hasRiskyTld, isInstallerHost, isIpLiteral, isStagingHost, type HostInfo } from './hosts.ts';

const DOWNLOAD =
  /\b(?:invoke-webrequest|iwr|invoke-restmethod|irm|wget|curl(?:\.exe)?|net\.webclient|downloadstring|downloadfile|downloaddata|openread|start-bitstransfer|bitsadmin|msxml2\.xmlhttp|winhttp\.winhttprequest|httpclient|getasync|getstringasync)\b|certutil[^\n]{0,60}urlcache/i;

const EXECUTE =
  /\b(?:iex|invoke-expression|start-process|saps|invoke-item|invoke-command|scriptblock\]::create|rundll32|regsvr32|msiexec|mshta|wscript|cscript|eval|osascript)\b|\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|ksh|python3?|perl|ruby|iex|powershell|pwsh|cmd)\b|\.invoke\(\s*\)|&\s*\(|&\s*['"$]|\b(?:ba)?sh\s+-c\b|\bcmd(?:\.exe)?\s+\/[ck]\b|\bstart\s+(?:\/\w+\s+)*["']?(?:[a-z]:|%|\$)|\bpython3?\s+-c\b|chmod\s+\+x/i;

const HIDDEN =
  /(?:^|\s)[-\/]w(?:i(?:n(?:d(?:o(?:w(?:s(?:t(?:y(?:l(?:e)?)?)?)?)?)?)?)?)?)?\s+['"]?(?:h(?:i(?:d(?:d(?:e(?:n)?)?)?)?)?|1)\b|createnowindow|conhost(?:\.exe)?\s+--headless|\bstart\s+\/min\b|windowstyle\s*=\s*['"]?hidden/i;

interface Rule {
  id: string;
  weight: number;
  severity: Severity;
  test: RegExp;
}

// Static content rules. Order does not matter; weights add up and are capped later.
const RULES: Rule[] = [
  {
    id: 'remote-script-host',
    weight: 60,
    severity: 'critical',
    test: /\bmshta(?:\.exe)?\s+["']?(?:https?:|\\\\|javascript:|vbscript:)|\bregsvr32\b[^\n]{0,1024}\/i:\s*["']?(?:https?:|\\\\)|\bregsvr32\b[^\n]{0,1024}scrobj|\brundll32\b[^\n]{0,1024}(?:javascript:|url\.dll|shell32\.dll\s*,\s*shellexec_rundll)|\bwmic\b[^\n]{0,1024}\/format:\s*["']?(?:https?:|\\\\)|\bcmstp\b[^\n]{0,1024}\/s/i,
  },
  { id: 'mshta-local', weight: 35, severity: 'high', test: /\bmshta(?:\.exe)?\s+["']?(?!https?:|\\\\)[^\s"']+\.hta\b/i },
  { id: 'certutil-decode', weight: 35, severity: 'high', test: /\bcertutil(?:\.exe)?\b[^\n]{0,1024}(?:-decode|-decodehex|-urlcache)/i },
  { id: 'finger-staging', weight: 50, severity: 'critical', test: /\bfinger(?:\.exe)?\s+\S+@\S+/i },
  {
    id: 'dns-staging',
    weight: 55,
    severity: 'critical',
    test: /\bnslookup\b[^\n]{0,1024}(?:-q(?:uery)?=txt|-type=txt|\|\s*(?:findstr|iex|cmd|powershell)|\bfor\s+\/f)|\bfor\s+\/f[^\n]{0,1024}nslookup|resolve-dnsname\b[^\n]{0,1024}-type\s+txt[^\n]{0,1024}(?:iex|invoke-expression|\.strings)/i,
  },
  {
    id: 'persistence',
    weight: 35,
    severity: 'high',
    test: /\bschtasks(?:\.exe)?\s+\/create\b|register-scheduledtask|new-scheduledtask|currentversion\\run(?:once)?\b|start menu\\programs\\startup\\\S|\bnew-service\b|\bsc(?:\.exe)?\s+create\b|__eventfilter|launchagents|launchdaemons|\|\s*crontab\b|crontab\s+-(?![a-z])|loginitems/i,
  },
  {
    id: 'defense-evasion',
    weight: 50,
    severity: 'critical',
    test: /set-mppreference[^\n]{0,1024}-disable|add-mppreference[^\n]{0,1024}-exclusion|amsiutils|amsiinitfailed|amsiscanbuffer|disablerealtimemonitoring|\bnetsh\s+advfirewall\s+set\b[^\n]{0,1024}off|spctl\s+--master-disable/i,
  },
  { id: 'clear-tracks', weight: 20, severity: 'medium', test: /\bclear-history\b|historysavepath|\bwevtutil(?:\.exe)?\s+cl\b|clear-eventlog|history\s+-c\b/i },
  {
    id: 'temp-exec',
    weight: 30,
    severity: 'high',
    test: /(?:%temp%|\$env:temp|%appdata%|\$env:appdata|%localappdata%|\$env:localappdata|%programdata%|\$env:programdata|%public%|\$env:public|\\appdata\\|\\temp\\|\/tmp\/|\/private\/tmp\/)[^\s'"]*\.(?:exe|scr|ps1|hta|vbs|vbe|js|jse|wsf|bat|cmd|msi|dll|lnk|app|command|pkg)\b/i,
  },
  { id: 'exec-policy-bypass', weight: 5, severity: 'low', test: /(?:^|\s)-(?:ep|exec|executionpolicy)\s+(?:bypass|unrestricted)\b|set-executionpolicy\s+(?:bypass|unrestricted)/i },
  { id: 'mac-quarantine-strip', weight: 30, severity: 'high', test: /\bxattr\s+(?:-[a-z]*[dc][a-z]*\s+)+(?:com\.apple\.quarantine)?/i },
  {
    id: 'password-prompt',
    weight: 45,
    severity: 'critical',
    test: /osascript[^\n]{0,1024}display dialog[^\n]{0,1024}(?:hidden answer|password)|dscl\s+\.\s+-authonly|\bsecurity\s+(?:find-generic-password|find-internet-password|dump-keychain)/i,
  },
  { id: 'decode-to-shell', weight: 40, severity: 'high', test: /base64\s+(?:-d|-D|--decode)[^\n]{0,1024}\|\s*(?:sudo\s+)?(?:sh|bash|zsh|python3?)\b|eval\s+["']?\$\(\s*echo[^\n]{0,1024}base64/i },
  { id: 'reverse-shell', weight: 50, severity: 'critical', test: /\/dev\/tcp\/|\bnc(?:at)?\b[^\n]{0,1024}\s-e\s|net\.sockets\.tcpclient/i },
  {
    id: 'browser-data',
    weight: 40,
    severity: 'critical',
    test: /(?:login data|local state|\\cookies\b|key4\.db|logins\.json|wallet\.dat|\\exodus\\|metamask|\\electrum\\)/i,
  },
];

// Remote MSI installs: dangerous from an unknown host, routine from an official installer host.
const REMOTE_MSI = /\bmsiexec(?:\.exe)?\b[^\n]{0,1024}\/(?:i|package)\s*["']?(?:https?:|\\\\)/i;

// Opening a network folder is not a download; fetching a program or a WebDAV path is.
const UNC_FETCH = /@ssl|davwwwroot|\.(?:exe|scr|ps1|hta|vbs|vbe|js|jse|wsf|sct|bat|cmd|msi|dll|lnk|cpl)\b/i;

const TRICK_WEIGHT: Record<Trick, number> = {
  'invisible-chars': 20,
  'caret-escapes': 15,
  'backtick-escapes': 15,
  'quote-splitting': 15,
  'string-splitting': 15,
  'format-reorder': 20,
  'string-replace': 15,
  'char-codes': 20,
  'env-slicing': 25,
  'variable-indirection': 15,
  base64: 30,
  hex: 20,
  'url-encoding': 15,
  padding: 20,
};
const OBFUSCATION_CAP = 45;

const DECOY_WORDS =
  /robot|captcha|human|verif|cloudflare|ray\s*id|security check|confirm|validation|authenticat|✅|✔|☑|मैं रोबोट|सत्यापन|ರೋಬೋಟ್|ಪರಿಶೀಲನೆ/i;
const DECOY_PATH = /^[\s"']*(?:[a-z]:\\|\\\\|%\w+%\\|~\/|\/users\/)[^\n]{0,1024}\.(?:docx?|xlsx?|pptx?|pdf|txt|csv|zip|png|jpe?g)\b/i;

export interface RuleResult {
  findings: Finding[];
  hosts: HostInfo[];
  /** True when the command fetches something and runs it. */
  downloadExec: boolean;
  /** True when the command downloads or executes anything, i.e. its hosts would really be contacted. */
  reachesOut: boolean;
}

export function runRules(decoded: Decoded): RuleResult {
  const all = decoded.layers.join('\n');
  const findings: Finding[] = [];
  const add = (id: string, kind: Finding['kind'], weight: number, severity: Severity, params?: Record<string, string>) => {
    if (!findings.some((f) => f.id === id)) findings.push({ id, kind, weight, severity, params });
  };

  const hosts = extractHosts(all);
  const downloads = DOWNLOAD.test(all) || hosts.some((h) => h.scheme === 'unc' && UNC_FETCH.test(h.url));
  const executes = EXECUTE.test(all);
  const downloadExec = downloads && executes;
  const nonInstaller = hosts.filter((h) => !isInstallerHost(h));
  const shownHost = nonInstaller[0]?.host ?? hosts[0]?.host ?? '';

  if (downloadExec) {
    if (hosts.length > 0 && nonInstaller.length === 0) {
      add('installer', 'behaviour', 5, 'info', { host: hosts[0].host });
    } else {
      add('download-exec', 'behaviour', 45, 'high', { host: shownHost });
    }
  } else if (downloads && nonInstaller.length > 0) {
    add('download-file', 'behaviour', 15, 'low', { host: shownHost });
  }

  if (HIDDEN.test(all)) add('hidden-window', 'behaviour', 25, 'high');
  for (const r of RULES) if (r.test.test(all)) add(r.id, 'behaviour', r.weight, r.severity, shownHost ? { host: shownHost } : undefined);
  if (REMOTE_MSI.test(all) && !(hosts.length > 0 && nonInstaller.length === 0)) {
    add('remote-script-host', 'behaviour', 60, 'critical', shownHost ? { host: shownHost } : undefined);
  }
  // Clearing the quarantine flag on an app you already have is common advice; with a download or run it is the attack.
  const quarantine = findings.find((f) => f.id === 'mac-quarantine-strip');
  if (quarantine && !downloads && !executes) Object.assign(quarantine, { weight: 10, severity: 'low' as Severity });

  // Host reputation only matters when the command reaches out.
  if (downloads || executes) {
    for (const h of nonInstaller) {
      if (isIpLiteral(h.host)) add('ip-address', 'behaviour', 20, 'medium', { host: h.host });
      if (hasRiskyTld(h.host)) add('risky-domain', 'behaviour', 15, 'medium', { host: h.host });
      if (isStagingHost(h)) add('staging-host', 'behaviour', 25, 'high', { host: h.host });
      if (h.scheme === 'unc') add('network-share', 'behaviour', 30, 'high', { host: h.host });
      if (h.scheme === 'http') add('plain-http', 'behaviour', 10, 'low', { host: h.host });
    }
  }

  for (const c of decoded.comments) {
    if (DECOY_PATH.test(c)) add('decoy-path', 'behaviour', 45, 'critical', { text: c.slice(0, 80) });
    else if (DECOY_WORDS.test(c)) add('decoy-comment', 'behaviour', 50, 'critical', { text: c.slice(0, 80) });
  }

  let obf = 0;
  for (const t of decoded.tricks) obf += TRICK_WEIGHT[t];
  if (obf > 0) {
    const tricks = [...decoded.tricks];
    add('obfuscated', 'obfuscation', Math.min(obf, OBFUSCATION_CAP), obf >= 30 ? 'high' : 'medium', { tricks: tricks.join(', ') });
  }

  return { findings, hosts, downloadExec, reachesOut: downloads || executes };
}
