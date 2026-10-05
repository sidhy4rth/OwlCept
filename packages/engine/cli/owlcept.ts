#!/usr/bin/env node
// owlcept: the engine on the command line. For scripts, CI checks of documentation,
// and the Windows agent team (serve mode speaks JSON lines over stdio).
//
//   owlcept check "<command>" [--target run|terminal|explorer|web] [--lang en|hi|kn] [--json]
//                 [--origin URL] [--lure "Win+R"] [--hidden] [--scripted] [--app WhatsApp.exe]
//   echo "<command>" | owlcept check -
//   owlcept oauth "<pasted text>" --page URL
//   owlcept serve            one JSON request per stdin line, one JSON reply per stdout line
//
// Exit codes for check and oauth: 0 allow, 1 warn, 2 block, 64 usage error.

import { createInterface } from 'node:readline';
import { analyze, checkOAuthPaste, describeTrick, explain, explainConsentFix, normalizeForHash, sha256Hex } from '../src/index.ts';
import type { AnalyzeContext, CustodyRecord, Lang, PasteTarget, Verdict } from '../src/types.ts';

const VERSION = '0.2.0';
const TARGETS = new Set(['run', 'terminal', 'explorer', 'web', 'unknown']);
const LANGS = new Set(['en', 'hi', 'kn']);
const EXIT = { allow: 0, warn: 1, block: 2 } as const;

const USAGE = `owlcept ${VERSION}: explain what a pasted command would do

  owlcept check "<command>" [options]     check a command (use - to read it from stdin)
  owlcept oauth "<text>" --page <url>     ConsentFix check: is this a sign-in code pasted into the wrong site?
  owlcept hash "<command>"                fingerprint for the approvedCommands policy (- reads stdin)
  owlcept serve                           JSON lines over stdin/stdout, for the Windows agent
  owlcept --version

check options
  --target <run|terminal|explorer|web>    where it is being pasted (default: unknown)
  --lang <en|hi|kn>                       warning language (default: en)
  --origin <url>                          page it was copied from
  --app <process>                         desktop app it was copied from, e.g. WhatsApp.exe
  --lure <words>                          lure words seen near the copy (repeatable)
  --scripted                              a page script wrote the clipboard
  --hidden                                the copied text was not visible on the page
  --fake-captcha                          a CAPTCHA not served by a real provider was on the page
  --blocked-host <host>                   apply an organisation blocklist entry (repeatable)
  --approved <sha256>                     apply an approved-command fingerprint (repeatable)
  --trace                                 show how the command was decoded, step by step
  --json                                  print the verdict and explanation as JSON

exit status: 0 allow, 1 warn, 2 block, 64 usage error`;

type Flags = Record<string, string | string[] | boolean>;

function parse(argv: string[]): { cmd: string; args: string[]; flags: Flags } {
  const [cmd = '', ...rest] = argv;
  const args: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) {
      args.push(a);
      continue;
    }
    const key = a.slice(2);
    if (['json', 'scripted', 'hidden', 'fake-captcha', 'trace'].includes(key)) flags[key] = true;
    else {
      const v = rest[++i];
      if (v === undefined) usage(`--${key} needs a value`);
      flags[key] = ['lure', 'blocked-host', 'approved'].includes(key) ? [...((flags[key] as string[]) ?? []), v] : v;
    }
  }
  return { cmd, args, flags };
}

function usage(msg?: string): never {
  if (msg) process.stderr.write(`owlcept: ${msg}\n\n`);
  process.stderr.write(`${USAGE}\n`);
  process.exit(64);
}

async function readInput(arg: string | undefined): Promise<string> {
  if (arg !== undefined && arg !== '-') return arg;
  if (process.stdin.isTTY) usage('give a command, or - to read it from stdin');
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text.replace(/\r?\n$/, '');
}

function contextFrom(flags: Flags): { ctx: AnalyzeContext; lang: Lang } {
  const target = (flags.target as string) ?? 'unknown';
  const lang = (flags.lang as string) ?? 'en';
  if (!TARGETS.has(target)) usage(`unknown --target ${target}`);
  if (!LANGS.has(lang)) usage(`unknown --lang ${lang}`);
  let custody: CustodyRecord | null = null;
  if (flags.origin || flags.app || flags.lure || flags.scripted || flags.hidden || flags['fake-captcha']) {
    custody = {
      sourceKind: flags.app ? 'app' : 'browser',
      sourceApp: flags.app as string | undefined,
      originUrl: flags.origin as string | undefined,
      scriptWritten: !!flags.scripted || !!flags.hidden,
      visibleMatch: flags.hidden ? false : true,
      lureWords: (flags.lure as string[]) ?? [],
      fakeCaptcha: !!flags['fake-captcha'],
    };
  }
  const org = flags['blocked-host'] || flags.approved ? { blockedHosts: (flags['blocked-host'] as string[]) ?? [], approvedHashes: (flags.approved as string[]) ?? [] } : undefined;
  return { ctx: { target: target as PasteTarget, custody, org }, lang: lang as Lang };
}

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const tone = { allow: '32', warn: '33', block: '31' } as const;

function printHuman(v: Verdict, lang: Lang, custody: CustodyRecord | null | undefined, trace = false): void {
  const e = explain(v, custody, lang);
  const out = [paint(`1;${tone[v.action]}`, `${v.action.toUpperCase()} ${v.risk}/100  ${e.headline}`)];
  for (const d of e.details) out.push(`  • ${d}`);
  if (e.provenance) out.push(`  ${e.provenance}`);
  if (v.action !== 'allow') out.push(`  ${e.advice}`);
  if (v.hosts.length) out.push(paint('2', `  hosts: ${v.hosts.join(', ')}`));
  if (trace) {
    out.push(paint('1', '  how it was read:'));
    v.trace.forEach((step, i) => {
      const how = step.from === null ? 'what was pasted' : `${describeTrick(step.decodedBy!, lang)} (from step ${step.from + 1})`;
      out.push(`  ${i + 1}. ${how}${step.undid.length ? paint('2', ` · ${step.undid.map((t) => describeTrick(t, lang)).join(', ')}`) : ''}`);
      out.push(paint('2', `     ${step.text.slice(0, 300).replace(/\n/g, '\n     ')}`));
    });
  } else if (v.layers.length > 1) out.push(paint('2', `  decoded: ${v.layers.at(-1)!.slice(0, 200)}`));
  out.push(paint('2', `  findings: ${v.findings.map((f) => `${f.id}(${f.weight > 0 ? '+' : ''}${f.weight})`).join(' ') || 'none'} · ${v.ms} ms`));
  process.stdout.write(`${out.join('\n')}\n`);
}

/** serve: { id?, text, context?, lang?, kind?: "command" | "oauth", pageUrl? } per line. */
async function serve(): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let reply: unknown;
    try {
      const req = JSON.parse(line) as { id?: unknown; text: string; context?: AnalyzeContext; lang?: Lang; kind?: string; pageUrl?: string };
      if (typeof req.text !== 'string') throw new Error('"text" must be a string');
      const lang = req.lang && LANGS.has(req.lang) ? req.lang : 'en';
      if (req.kind === 'oauth') {
        const d = checkOAuthPaste(req.text, req.pageUrl ?? '');
        reply = { id: req.id, block: d.block, explanation: d.block && d.code ? explainConsentFix(d.code, lang) : null };
      } else {
        const verdict = analyze(req.text, req.context ?? {});
        reply = { id: req.id, verdict, explanation: explain(verdict, req.context?.custody ?? null, lang) };
      }
    } catch (e) {
      reply = { error: (e as Error).message };
    }
    process.stdout.write(`${JSON.stringify(reply)}\n`);
  }
}

async function main(): Promise<void> {
  const { cmd, args, flags } = parse(process.argv.slice(2));
  if (cmd === '--version' || cmd === '-v') return void process.stdout.write(`${VERSION}\n`);
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') return void process.stdout.write(`${USAGE}\n`);

  if (cmd === 'check') {
    const text = await readInput(args[0]);
    const { ctx, lang } = contextFrom(flags);
    const v = analyze(text, ctx);
    if (flags.json) process.stdout.write(`${JSON.stringify({ verdict: v, explanation: explain(v, ctx.custody, lang) }, null, 2)}\n`);
    else printHuman(v, lang, ctx.custody, !!flags.trace);
    process.exit(EXIT[v.action]);
  }
  if (cmd === 'oauth') {
    const text = await readInput(args[0]);
    if (typeof flags.page !== 'string') usage('oauth needs --page <url>, the site it is being pasted into');
    const lang = ((flags.lang as string) ?? 'en') as Lang;
    const d = checkOAuthPaste(text, flags.page);
    if (flags.json) process.stdout.write(`${JSON.stringify({ ...d, explanation: d.block && d.code ? explainConsentFix(d.code, lang) : null }, null, 2)}\n`);
    else if (d.block && d.code) {
      const e = explainConsentFix(d.code, lang);
      process.stdout.write(`${paint('1;31', `BLOCK  ${e.headline}`)}\n  • ${e.detail}\n  ${e.advice}\n`);
    } else process.stdout.write(`${paint('1;32', 'ALLOW')}  no sign-in code for another site\n`);
    process.exit(d.block ? EXIT.block : EXIT.allow);
  }
  if (cmd === 'hash') {
    const text = await readInput(args[0]);
    return void process.stdout.write(`${sha256Hex(normalizeForHash(text))}\n`);
  }
  if (cmd === 'serve') return serve();
  usage(`unknown command "${cmd}"`);
}

void main();
