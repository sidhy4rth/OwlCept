// Turns behaviour findings plus the custody record into allow / warn / block.
//
// Two-signal rule: provenance alone never prompts (nothing dangerous to run),
// and a dangerous-looking command copied visibly from the site it installs
// from passes silently. Hidden copies with lure text are blocked whatever the
// payload looks like, because that mismatch is the attack itself.

import type { Action, AnalyzeContext, Finding, PasteTarget } from './types.ts';
import { hostOfUrl, siteOf, type HostInfo } from './hosts.ts';
import { classifySource } from './source.ts';

export const WARN_AT = 35;
export const BLOCK_AT = 70;
/** Below this the command has nothing worth warning about, whatever its origin. */
const BEHAVIOUR_FLOOR = 15;

const DOCS_SITES = [
  'learn.microsoft.com',
  'docs.microsoft.com',
  'stackoverflow.com',
  'superuser.com',
  'serverfault.com',
  'askubuntu.com',
  'github.com',
  'gitlab.com',
  'developer.apple.com',
  'docs.docker.com',
  'docs.python.org',
  'pypi.org',
  'npmjs.com',
  'developer.mozilla.org',
];

export interface ScoreResult {
  action: Action;
  risk: number;
  context: Finding[];
}

export function score(behaviour: Finding[], hosts: HostInfo[], ctx: AnalyzeContext): ScoreResult {
  const base = Math.min(100, behaviour.reduce((s, f) => s + f.weight, 0));
  const context: Finding[] = [];
  const c = ctx.custody ?? null;
  const target: PasteTarget = ctx.target ?? 'unknown';

  if (c?.visibleMatch === false) context.push({ id: 'hidden-copy', kind: 'context', weight: 40, severity: 'critical' });
  else if (c?.scriptWritten) context.push({ id: 'script-copy', kind: 'context', weight: 10, severity: 'low' });

  if (c?.lureWords?.length) {
    // Tutorials also say "press Win+R"; what makes it a lure is a page script
    // filling the clipboard next to those words.
    const scripted = c.scriptWritten === true || c.visibleMatch === false;
    const words = c.lureWords.slice(0, 3).join(', ');
    if (scripted) context.push({ id: 'lure-words', kind: 'context', weight: 30, severity: 'critical', params: { words } });
    else context.push({ id: 'lure-words-nearby', kind: 'context', weight: 10, severity: 'low', params: { words } });
  }
  if (c?.fakeCaptcha) context.push({ id: 'fake-captcha', kind: 'context', weight: 20, severity: 'high' });

  // Chats, email and documents are where "support staff" hand people commands; chatbots
  // can repeat instructions planted on websites. Each adds weight but never prompts alone.
  const source = classifySource(c);
  const SOURCE_FINDING = { chat: 'from-chat', email: 'from-email', pdf: 'from-pdf', 'ai-chat': 'from-ai' } as const;
  if (source.category in SOURCE_FINDING) {
    const id = SOURCE_FINDING[source.category as keyof typeof SOURCE_FINDING];
    context.push({ id, kind: 'context', weight: 10, severity: 'medium', params: { app: source.name } });
  }

  // Run box and Explorer bar are where lures send people; developers use terminals.
  if ((target === 'run' || target === 'explorer') && base >= 25) {
    context.push({ id: `target-${target}`, kind: 'context', weight: 15, severity: 'medium' });
  }

  const originHost = hostOfUrl(c?.originUrl);
  const copiedVisibly = c?.visibleMatch === true || (c?.scriptWritten !== true && c?.visibleMatch !== false);
  if (originHost && copiedVisibly && !context.some((f) => f.id === 'lure-words' || f.id === 'fake-captcha')) {
    if (hosts.length > 0 && hosts.every((h) => sameSource(originHost, c!.originUrl!, h))) {
      context.push({ id: 'same-site', kind: 'context', weight: -35, severity: 'info', params: { host: originHost } });
    } else if (DOCS_SITES.some((d) => originHost === d || originHost.endsWith(`.${d}`))) {
      context.push({ id: 'docs-site', kind: 'context', weight: -15, severity: 'info', params: { host: originHost } });
    }
  }

  if (base < BEHAVIOUR_FLOOR) return { action: 'allow', risk: base, context };

  let risk = base + context.reduce((s, f) => s + f.weight, 0);

  // A page that wrote text you never saw, or told you to press Win+R, is the attack.
  const deceived = context.some((f) => f.id === 'hidden-copy' || f.id === 'lure-words');
  if (deceived) risk = Math.max(risk, 75);

  // Trusted-origin discounts never silence a critical behaviour.
  if (behaviour.some((f) => f.severity === 'critical')) risk = Math.max(risk, WARN_AT);

  risk = Math.max(0, Math.min(100, Math.round(risk)));
  const action: Action = risk >= BLOCK_AT ? 'block' : risk >= WARN_AT ? 'warn' : 'allow';
  return { action, risk, context };
}

/** The command fetches from the same site the user copied it from (GitHub READMEs count as their raw host). */
function sameSource(originHost: string, originUrl: string, h: HostInfo): boolean {
  if (siteOf(h.host) === siteOf(originHost)) return true;
  if (siteOf(originHost) === 'github.com' && (h.host === 'raw.githubusercontent.com' || h.host === 'objects.githubusercontent.com')) {
    const org = /github\.com\/([^\/?#]+)/i.exec(originUrl)?.[1]?.toLowerCase();
    const rawOrg = /githubusercontent\.com\/([^\/?#]+)/i.exec(h.url)?.[1]?.toLowerCase();
    return !!org && org === rawOrg;
  }
  return false;
}
