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
  const input = text.length > MAX_INPUT ? text.slice(0, MAX_INPUT) : text;
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

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
