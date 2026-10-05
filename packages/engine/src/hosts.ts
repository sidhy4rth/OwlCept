// Host extraction and reputation that works offline. Online lookups are
// optional and live outside the engine.

export interface HostInfo {
  host: string;
  /** Full URL when one was found; UNC/WebDAV paths keep the \\host\share form. */
  url: string;
  scheme: 'https' | 'http' | 'unc' | 'bare';
}

// Official one-line installer hosts. Download-and-run from these is how
// developers install tools every day, so it must pass silently.
const INSTALLER_HOSTS = [
  'get.scoop.sh',
  'community.chocolatey.org',
  'chocolatey.org',
  'brew.sh',
  'sh.rustup.rs',
  'win.rustup.rs',
  'static.rust-lang.org',
  'astral.sh',
  'bun.sh',
  'deno.land',
  'deno.com',
  'get.pnpm.io',
  'nodejs.org',
  'aka.ms',
  'dot.net',
  'get.docker.com',
  'install.python-poetry.org',
  'ohmyz.sh',
  'starship.rs',
  'tailscale.com',
  'sdk.cloud.google.com',
  'awscli.amazonaws.com',
  'cli.github.com',
  'ollama.com',
  'fnm.vercel.app',
  'get.volta.sh',
  'claude.ai',
  'opencode.ai',
  'pyenv.run',
  'get.rvm.io',
  'sh.vector.dev',
  'get.k3s.io',
  'install.determinate.systems',
  'nixos.org',
  'mise.run',
  'micro.mamba.pm',
  'get.sdkman.io',
  'raw.githubusercontent.com/homebrew/',
  'raw.githubusercontent.com/nvm-sh/',
  'raw.githubusercontent.com/ohmyzsh/',
  'raw.githubusercontent.com/coreybutler/',
  'raw.githubusercontent.com/pyenv/',
  'raw.githubusercontent.com/scoopinstaller/',
  'raw.githubusercontent.com/chocolatey/',
  'raw.githubusercontent.com/microsoft/',
  'raw.githubusercontent.com/docker/',
  'github.com/microsoft/',
  'github.com/powershell/',
  'github.com/cli/',
  'download.microsoft.com',
  'learn.microsoft.com',
  'dotnet.microsoft.com',
];

// Free hosting, tunnels and paste sites that lures use for staging.
const STAGING_HOSTS = [
  'pastebin.com',
  'paste.ee',
  'rentry.co',
  'hastebin.com',
  'trycloudflare.com',
  'ngrok.io',
  'ngrok-free.app',
  'ngrok.app',
  'serveo.net',
  'loca.lt',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'api.telegram.org',
  'transfer.sh',
  'temp.sh',
  'file.io',
  'gofile.io',
  'catbox.moe',
  'bitbucket.io',
];

const RISKY_TLDS = new Set([
  'top', 'xyz', 'shop', 'click', 'icu', 'cfd', 'sbs', 'live', 'online', 'site', 'buzz', 'rest', 'lat', 'monster',
  'cyou', 'bond', 'beauty', 'hair', 'quest', 'mom', 'boats', 'autos', 'motorcycles', 'zip', 'mov', 'run', 'su', 'cc', 'tk',
]);

const FILE_EXT = /\.(?:exe|zip|ps1|txt|msi|dll|bat|cmd|json|js|gz|tar|7z|rar|hta|vbs|log|csv|xml|ini|dat)$/i;

export function extractHosts(text: string): HostInfo[] {
  const out: HostInfo[] = [];
  const add = (h: HostInfo) => {
    if (!out.some((o) => o.url === h.url)) out.push(h);
  };
  for (const m of text.matchAll(/\b(https?):\/\/([^\s'"`<>)|;,]+)/gi)) {
    const host = m[2].split(/[\/?#:]/)[0].toLowerCase();
    if (host) add({ host, url: `${m[1].toLowerCase()}://${m[2]}`, scheme: m[1].toLowerCase() as 'http' | 'https' });
  }
  // \\host@SSL\DavWWWRoot\x.ps1 and \\1.2.3.4\share\x.exe (WebDAV / SMB fetches)
  for (const m of text.matchAll(/\\\\([a-z0-9.\-]+)(?:@ssl)?(?:@\d+)?\\[^\s'"]+/gi)) {
    add({ host: m[1].toLowerCase(), url: m[0], scheme: 'unc' });
  }
  // curl/iwr targets without a scheme: "iwr example.test/a.ps1", "irm get.scoop.sh"
  for (const m of text.matchAll(/\b(?:iwr|irm|curl(?:\.exe)?|wget|invoke-webrequest|invoke-restmethod)\s+(?:-\w+\s+)*["']?([a-z0-9\-]+(?:\.[a-z0-9\-]+)+(?:\/[^\s'"]*)?)/gi)) {
    const host = m[1].split('/')[0].toLowerCase();
    // Without a path, "out.zip" or "x.exe" is a filename, not a host.
    if (!m[1].includes('/') && (host.split('.').length < 3 || FILE_EXT.test(host))) continue;
    if (!out.some((o) => o.host === host)) add({ host, url: m[1], scheme: 'bare' });
  }
  return out;
}

export function isInstallerHost(h: HostInfo): boolean {
  // Bare hosts ("irm get.scoop.sh | iex") are how several official installers are documented.
  if (h.scheme !== 'https' && h.scheme !== 'bare') return false;
  const u = h.url.replace(/^https:\/\//i, '').toLowerCase();
  return INSTALLER_HOSTS.some((p) => (p.includes('/') ? u.startsWith(p) : h.host === p || h.host.endsWith(`.${p}`)));
}

export function isStagingHost(h: HostInfo): boolean {
  return STAGING_HOSTS.some((p) => h.host === p || h.host.endsWith(`.${p}`));
}

export function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
}

export function hasRiskyTld(host: string): boolean {
  const tld = host.split('.').pop() ?? '';
  return RISKY_TLDS.has(tld);
}

/** Registrable-ish domain: last two labels, or three for co.in / com.au style. */
export function siteOf(host: string): string {
  const parts = host.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const two = parts.slice(-2).join('.');
  if (/^(?:co|com|net|org|gov|ac|edu)\.[a-z]{2}$/.test(two)) return parts.slice(-3).join('.');
  return two;
}

export function hostOfUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
