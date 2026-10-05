// What the extension does with a verdict, given the protection mode and the
// user's trusted sites. Pure, so it is unit-tested without a browser.

import type { Action } from '@owlcept/engine';

export type Mode = 'audit' | 'smart' | 'strict';

export interface PolicyInput {
  action: Action;
  mode: Mode;
  trustedSites: string[];
  /** Host of the page the copy (or paste) happened on. */
  host: string;
  /** The Windows agent will check the paste itself, so copy-time warnings can stay quiet. */
  agentConnected: boolean;
}

export interface Decision {
  /** What to show on the page. */
  show: 'none' | 'toast' | 'banner';
  /** Swap the clipboard for the harmless "blocked" line. */
  replaceClipboard: boolean;
  /** What goes in the activity log ('allow' logs nothing). */
  log: Action;
  /** Why a verdict was softened, for the log. */
  note?: 'audit' | 'trusted-site';
}

/** True when host is a trusted site or a subdomain of one ("github.com" trusts "docs.github.com"). */
export function isTrusted(host: string, trustedSites: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return trustedSites.some((raw) => {
    const t = normalizeSite(raw);
    return !!t && (h === t || h.endsWith(`.${t}`));
  });
}

/** "https://Docs.GitHub.com/en/" → "docs.github.com"; returns '' for anything that is not a host. */
export function normalizeSite(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) return '';
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = new URL(s).hostname;
  } catch {
    return '';
  }
  s = s.replace(/^\*\./, '').split(/[\/?#:]/)[0].replace(/\.$/, '');
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s) || s === 'localhost' ? s : '';
}

export function decide(p: PolicyInput): Decision {
  if (p.action === 'allow') return { show: 'none', replaceClipboard: false, log: 'allow' };
  if (p.mode === 'audit') return { show: 'none', replaceClipboard: false, log: p.action, note: 'audit' };

  // Trust skips warnings only. Legitimate sites get hacked to show lures (700+ in
  // the May 2026 Ghost CMS campaign), so a block on a trusted site still blocks.
  if (p.action === 'warn' && isTrusted(p.host, p.trustedSites)) return { show: 'none', replaceClipboard: false, log: 'warn', note: 'trusted-site' };

  if (p.action === 'block' || p.mode === 'strict') return { show: 'banner', replaceClipboard: true, log: p.mode === 'strict' ? 'block' : p.action };
  // Smart mode warning: a small toast, unless the agent will check the paste itself.
  return { show: p.agentConnected ? 'none' : 'toast', replaceClipboard: false, log: 'warn' };
}

/** Google Safe Browsing's public report form, pre-filled. Opened only when the user clicks. */
export function reportUrl(pageUrl: string): string {
  return `https://safebrowsing.google.com/safebrowsing/report_phish/?url=${encodeURIComponent(pageUrl)}`;
}

/** Display form that cannot be clicked by accident: hxxps://example[.]test/path */
export function defang(url: string): string {
  return url.replace(/^http/i, 'hxxp').replace(/\.(?=[^\/]*(?:\/|$))/g, '[.]');
}
