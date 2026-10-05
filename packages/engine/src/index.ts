// OwlCept engine entry point. Pure functions, no I/O, no network: the same
// code runs in the browser extension, the Windows agent and the web checker.

import { deobfuscate } from './deobfuscate.ts';
import { runRules } from './rules.ts';
import { score } from './score.ts';
import type { AnalyzeContext, Verdict } from './types.ts';

export type * from './types.ts';
export { explain } from './explain.ts';
export { detectLureText, isRealCaptchaSource } from './lure.ts';
export { checkOAuthPaste, detectOAuthCode, explainConsentFix } from './oauth.ts';
export { BLOCK_AT, WARN_AT } from './score.ts';
export { buildReport, mergeReports, parseReport, summarize, summarizeFleet, type ActivityEvent, type ActivityKind, type ActivityReport, type DeviceRow, type FleetSummary, type Summary } from './activity.ts';
export { REASON_LABELS, reasonLabel } from './labels.ts';
export { classifySource, type SourceCategory, type SourceInfo } from './source.ts';

/**
 * Text normalisation used before hashing a clipboard item, so the extension
 * (which sees the copy) and the agent (which sees the paste) agree on the hash
 * even when line endings or runs of spaces differ. The agent ports this exactly.
 */
export function normalizeForHash(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t\u00A0]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

/** Longest input analysed in full; real lures are a few hundred characters. */
const MAX_INPUT = 64 * 1024;

export function analyze(text: string, ctx: AnalyzeContext = {}): Verdict {
  const started = now();
  const input = fitInput(text);
  const decoded = deobfuscate(input);
  const { findings, hosts } = runRules(decoded);
  const { action, risk, context } = score(findings, hosts, ctx);
  return {
    action,
    risk,
    findings: [...findings, ...context],
    layers: decoded.layers,
    hosts: [...new Set(hosts.map((h) => h.host))],
    target: ctx.target ?? 'unknown',
    ms: Math.round((now() - started) * 100) / 100,
  };
}

/**
 * Bounds the work on huge pastes without letting padding hide the command:
 * long whitespace runs shrink (still long enough to register as padding), and
 * if the text is still too long both ends are kept, since a payload pushed past
 * the limit sits at the end.
 */
function fitInput(text: string): string {
  if (text.length <= MAX_INPUT) return text;
  const squeezed = text.replace(/[ \t\u00A0\u2000-\u200B\u3000]{64,}/g, (m) => m.slice(0, 64)).replace(/\n{8,}/g, '\n'.repeat(8));
  if (squeezed.length <= MAX_INPUT) return squeezed;
  return `${squeezed.slice(0, (MAX_INPUT * 3) / 4)}\n${squeezed.slice(-MAX_INPUT / 4)}`;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
