// OwlCept benchmark: runs every corpus sample through the checkpoints the
// extension and agent would run, and scores the result against the brief's
// targets. Writes bench/results/latest.json and docs/BENCHMARK.md.
//
//   node bench/run.ts            exits 1 when a target is missed
//   node bench/run.ts --no-fail  report only

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { analyze, checkOAuthPaste, explain } from '../packages/engine/src/index.ts';
import type { CustodyRecord, Lang, Verdict } from '../packages/engine/src/types.ts';
import { BENIGN } from './corpus/benign.ts';
import type { Sample } from './types.ts';

const root = new URL('../', import.meta.url).pathname;
const TARGETS = { detection: 0.95, perSuite: 0.9, falsePrompt: 0.01, pasteP95: 50, commitP95: 100, explained: 1 };
const LANGS: Lang[] = ['en', 'hi', 'kn'];
const REPEATS = 5;

// ------------------------------------------------------------------ load

const samples: Sample[] = [...BENIGN];
const corpusDir = `${root}bench/corpus/`;
const extraFiles = readdirSync(corpusDir).filter((f) => f.endsWith('.jsonl')).sort();
for (const f of extraFiles) {
  readFileSync(corpusDir + f, 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try {
      samples.push(JSON.parse(line) as Sample);
    } catch {
      throw new Error(`${f}:${i + 1} is not valid JSON`);
    }
  });
}

// ------------------------------------------------------------------ evaluate

function custodyOf(s: Sample): CustodyRecord | null {
  if (s.custody !== undefined) return s.custody;
  if (s.copy === 'typed') return null;
  if (s.app) return { sourceKind: 'app', sourceApp: s.app, lureWords: s.lure ?? [], time: Date.now() };
  return {
    sourceKind: 'browser',
    originUrl: s.origin,
    scriptWritten: s.copy === 'button' || s.copy === 'script-hidden',
    visibleMatch: s.copy !== 'script-hidden',
    lureWords: s.lure ?? [],
    fakeCaptcha: s.fakeCaptcha ?? false,
    time: Date.now(),
  };
}

interface Outcome {
  sample: Sample;
  /** Verdict per checkpoint that would run for this sample. */
  checkpoints: { name: 'copy' | 'paste' | 'commit' | 'oauth'; action: string; risk: number; ms: number; verdict?: Verdict }[];
  prompted: boolean;
  blocked: boolean;
}

const timings = { paste: [] as number[], commit: [] as number[] };

function timed<T>(fn: () => T, sink?: number[]): { value: T; ms: number } {
  let value!: T;
  let best = Infinity;
  for (let i = 0; i < (sink ? REPEATS : 1); i++) {
    const t = performance.now();
    value = fn();
    const ms = performance.now() - t;
    sink?.push(ms);
    best = Math.min(best, ms);
  }
  return { value, ms: best };
}

function evaluate(s: Sample): Outcome {
  const cps: Outcome['checkpoints'] = [];
  if (s.kind === 'oauth') {
    const { value, ms } = timed(() => checkOAuthPaste(s.text, s.pageUrl ?? 'https://unknown.test/'), timings.paste);
    cps.push({ name: 'oauth', action: value.block ? 'block' : 'allow', risk: value.block ? 100 : 0, ms });
  } else {
    const custody = custodyOf(s);
    // Checkpoint 1: the extension sees browser copies.
    if (custody?.sourceKind === 'browser') {
      const { value, ms } = timed(() => analyze(s.text, { target: 'unknown', custody }));
      cps.push({ name: 'copy', action: value.action, risk: value.risk, ms, verdict: value });
    }
    // Checkpoint 2: the agent sees the paste with the custody record looked up by hash.
    if (custody) {
      const { value, ms } = timed(() => analyze(s.text, { target: s.target, custody }), timings.paste);
      cps.push({ name: 'paste', action: value.action, risk: value.risk, ms, verdict: value });
    }
    // Checkpoint 3: Enter. Typed text has no custody; the commit check still reads the line.
    const { value, ms } = timed(() => analyze(s.text, { target: s.target, custody }), timings.commit);
    cps.push({ name: 'commit', action: value.action, risk: value.risk, ms, verdict: value });
  }
  return {
    sample: s,
    checkpoints: cps,
    prompted: cps.some((c) => c.action !== 'allow'),
    blocked: cps.some((c) => c.action === 'block'),
  };
}

// Warm the JIT so the timings reflect steady state, not the first call.
for (let i = 0; i < 3; i++) for (const s of samples.slice(0, 50)) if (s.kind !== 'oauth') analyze(s.text, { target: s.target });
timings.paste.length = 0;
timings.commit.length = 0;

const outcomes = samples.map(evaluate);

// ------------------------------------------------------------------ explanations

// Every finding the engine can raise must explain itself in every language, with no
// empty sentence or leftover {placeholder}. Checked per finding id, so the check means
// something even when the corpus raises none of them.
const src = ['rules.ts', 'score.ts', 'index.ts'].map((f) => readFileSync(`${root}packages/engine/src/${f}`, 'utf8')).join('\n');
const findingIds = [...new Set([...src.matchAll(/(?:\bid: |\badd\()'([a-z][a-z-]+)'/g)].map((m) => m[1]).concat([...src.matchAll(/'(from-[a-z]+)'/g)].map((m) => m[1]), 'obfuscated', 'target-run', 'target-explorer'))].sort();
const REASSURING = new Set(['installer', 'same-site', 'docs-site']);
const PARAMS = { host: 'example.test', words: 'Win+R', app: 'WhatsApp', text: 'I am not a robot', tricks: 'base64' };
const explainFailures: string[] = [];
let explained = 0;
for (const id of findingIds) {
  const verdict: Verdict = {
    action: 'block', risk: 90, target: 'run', layers: [], hosts: [], ms: 0,
    findings: [{ id, kind: 'behaviour', weight: 50, severity: 'high', params: PARAMS }],
  };
  for (const lang of LANGS) {
    explained++;
    const e = explain(verdict, null, lang);
    const parts = [e.headline, ...e.details, e.advice];
    const bad = parts.find((p) => /\{[a-z]+\}/i.test(p)) ?? (!e.headline ? '(no headline)' : null) ?? (!REASSURING.has(id) && e.details.length === 0 ? '(no sentence for this finding)' : null);
    if (bad) explainFailures.push(`${id} ${lang}: ${bad}`);
  }
}
// And every warning the corpora actually produced, with its real custody record.
for (const o of outcomes) {
  for (const c of o.checkpoints) {
    if (!c.verdict || c.verdict.action === 'allow') continue;
    for (const lang of LANGS) {
      explained++;
      const e = explain(c.verdict, custodyOf(o.sample), lang);
      const bad = [e.headline, ...e.details, e.advice, e.provenance ?? ''].find((p) => /\{[a-z]+\}/i.test(p));
      if (bad) explainFailures.push(`${o.sample.id} ${lang}: ${bad}`);
    }
  }
}

// ------------------------------------------------------------------ score

const pct = (a: number, b: number) => (b ? a / b : 0);
const fmt = (x: number) => `${(x * 100).toFixed(1)}%`;
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

const benign = outcomes.filter((o) => o.sample.label === 'benign');
const malicious = outcomes.filter((o) => o.sample.label === 'malicious');
const falsePrompts = benign.filter((o) => o.prompted);
const detected = malicious.filter((o) => o.prompted);

const byGroup = (list: Outcome[], hit: (o: Outcome) => boolean) => {
  const m = new Map<string, { n: number; hit: number }>();
  for (const o of list) {
    const g = m.get(o.sample.group) ?? { n: 0, hit: 0 };
    g.n++;
    if (hit(o)) g.hit++;
    m.set(o.sample.group, g);
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
};

const suites = new Map<string, Map<string, { n: number; hit: number }>>();
for (const o of malicious) {
  for (const [k, v] of Object.entries(o.sample.suite ?? {})) {
    const suite = suites.get(k) ?? new Map();
    const cell = suite.get(v) ?? { n: 0, hit: 0 };
    cell.n++;
    if (o.prompted) cell.hit++;
    suite.set(v, cell);
    suites.set(k, suite);
  }
}
const worstSuite = Math.min(1, ...[...suites.values()].flatMap((m) => [...m.values()].map((c) => pct(c.hit, c.n))));

// Content only: what the commit check says with no custody at all (typed by hand, or no extension).
const contentOnlyFalse = benign.filter((o) => o.sample.kind !== 'oauth' && analyze(o.sample.text, { target: o.sample.target }).action !== 'allow');

const latency = {
  paste: { p50: quantile(timings.paste, 0.5), p95: quantile(timings.paste, 0.95), max: Math.max(0, ...timings.paste) },
  commit: { p50: quantile(timings.commit, 0.5), p95: quantile(timings.commit, 0.95), max: Math.max(0, ...timings.commit) },
};

const checks = [
  { name: 'False prompts on the benign corpus', target: `≤ ${fmt(TARGETS.falsePrompt)}`, value: fmt(pct(falsePrompts.length, benign.length)), pass: pct(falsePrompts.length, benign.length) <= TARGETS.falsePrompt },
  { name: 'Added delay at paste, p95 (engine)', target: `≤ ${TARGETS.pasteP95} ms`, value: `${latency.paste.p95.toFixed(2)} ms`, pass: latency.paste.p95 <= TARGETS.pasteP95 },
  { name: 'Added delay at commit, p95 (engine)', target: `≤ ${TARGETS.commitP95} ms`, value: `${latency.commit.p95.toFixed(2)} ms`, pass: latency.commit.p95 <= TARGETS.commitP95 },
  { name: `Warnings that render fully in EN, HI and KN (${findingIds.length} findings)`, target: '100%', value: fmt(pct(explained - explainFailures.length, explained)), pass: explainFailures.length === 0 },
];
if (malicious.length) {
  checks.unshift(
    { name: 'Detection, overall', target: `≥ ${fmt(TARGETS.detection)}`, value: fmt(pct(detected.length, malicious.length)), pass: pct(detected.length, malicious.length) >= TARGETS.detection },
    { name: 'Detection, worst suite', target: `≥ ${fmt(TARGETS.perSuite)}`, value: fmt(worstSuite), pass: worstSuite >= TARGETS.perSuite },
  );
}

// ------------------------------------------------------------------ report

const results = {
  generated: new Date().toISOString(),
  corpora: { benign: benign.length, malicious: malicious.length, files: ['corpus/benign.ts', ...extraFiles.map((f) => `corpus/${f}`)] },
  checks,
  latency,
  falsePrompts: falsePrompts.map((o) => ({ id: o.sample.id, group: o.sample.group, text: o.sample.text, checkpoints: o.checkpoints.map(({ verdict, ...c }) => ({ ...c, findings: verdict?.findings.map((f) => f.id) })) })),
  contentOnlyFalsePrompts: contentOnlyFalse.length,
  missed: malicious.filter((o) => !o.prompted).map((o) => ({ id: o.sample.id, group: o.sample.group, suite: o.sample.suite })),
  explainFailures,
};
mkdirSync(`${root}bench/results`, { recursive: true });
writeFileSync(`${root}bench/results/latest.json`, `${JSON.stringify(results, null, 2)}\n`);

const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
// Commands go into table cells as HTML <code>: every character that HTML, the table
// (|) or Markdown (` \ *) would interpret is written as an entity.
const codeCell = (t: string) =>
  `<code>${t.replace(/[&<>"'|`\\*_[\]]/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\r?\n/g, ' ⏎ ')}</code>`;

const md = `# OwlCept benchmark

Generated by \`node bench/run.ts\`. Do not edit by hand; CI regenerates it on every push.

## Targets

${table(['Metric', 'Target', 'Result', ''], checks.map((c) => [c.name, c.target, `**${c.value}**`, c.pass ? '✅' : '❌']))}

${malicious.length ? '' : `> **Detection is not scored yet.** The held-out malicious corpus (≥ 200 defanged ClickFix-family samples from URLhaus, ClickGrab and vendor reports, per the brief) is assembled by the team and dropped into \`bench/corpus/*.jsonl\`; see [bench/README.md](../bench/README.md). This report then adds overall and per-suite detection automatically.\n`}
## Benign corpus: ${benign.length} commands from official documentation

Each command is run through every checkpoint that would see it: copy (extension), paste (agent, with the custody record) and commit (Enter). A **false prompt** is any warning or block at any checkpoint.

${table(['Group', 'Commands', 'False prompts'], byGroup(benign, (o) => o.prompted).map(([g, c]) => [g, c.n, c.hit ? `**${c.hit}**` : 0]))}

${falsePrompts.length ? `### Commands that prompted\n\n${table(['Id', 'Command', 'Checkpoints'], falsePrompts.map((o) => [o.sample.id, codeCell(o.sample.text.slice(0, 110)), o.checkpoints.filter((c) => c.action !== 'allow').map((c) => `${c.name}: ${c.action} ${c.risk}`).join(', ')]))}\n` : 'No benign command prompted at any checkpoint.\n'}
**Content only** (no custody record, as for a command typed by hand): ${contentOnlyFalse.length} of ${benign.length} would prompt (${fmt(pct(contentOnlyFalse.length, benign.length))}). Provenance is what keeps developers' installers silent; without it the engine leans cautious.

${malicious.length ? `## Malicious corpus: ${malicious.length} samples\n\n${table(['Group', 'Samples', 'Detected'], byGroup(malicious, (o) => o.prompted).map(([g, c]) => [g, c.n, `${c.hit} (${fmt(pct(c.hit, c.n))})`]))}\n\n${[...suites].map(([k, m]) => `### Suite: ${k}\n\n${table(['Variant', 'Samples', 'Detected'], [...m].map(([v, c]) => [v, c.n, `${c.hit} (${fmt(pct(c.hit, c.n))})`]))}`).join('\n\n')}\n` : ''}
## Latency

Engine time per call, ${REPEATS} runs per sample after warm-up, on the machine that ran the benchmark (CI runs it on every push). The agent's own overhead (hooking, UI Automation) comes on top and is timed inside the agent.

${table(['Checkpoint', 'p50', 'p95', 'max'], [['Paste', latency.paste.p50.toFixed(3), latency.paste.p95.toFixed(3), latency.paste.max.toFixed(3)], ['Commit', latency.commit.p50.toFixed(3), latency.commit.p95.toFixed(3), latency.commit.max.toFixed(3)]].map((r) => [r[0], `${r[1]} ms`, `${r[2]} ms`, `${r[3]} ms`]))}

## Explanations

${explained} warnings rendered: each of the engine's ${findingIds.length} findings, plus every warning the corpora produced, in English, Hindi and Kannada. ${explainFailures.length ? `${explainFailures.length} failed:\n\n${explainFailures.map((f) => `- ${f}`).join('\n')}` : 'None had an empty sentence or an unfilled placeholder.'}
`;
writeFileSync(`${root}docs/BENCHMARK.md`, md);

for (const c of checks) console.log(`${c.pass ? '✓' : '✗'} ${c.name}: ${c.value} (target ${c.target})`);
console.log(`benign ${benign.length}, malicious ${malicious.length}; false prompts: ${falsePrompts.map((o) => o.sample.id).join(', ') || 'none'}`);
if (!process.argv.includes('--no-fail') && checks.some((c) => !c.pass)) process.exit(1);
