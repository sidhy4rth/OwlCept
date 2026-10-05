// Draws the review pack for the brief's explanation-accuracy metric: a seeded random
// sample of real warnings, each with the command, its context and the warning exactly
// as OwlCept shows it in English, Hindi and Kannada. Open it in web/review.html.
//
//   node bench/review-pack.ts [--n 50] [--seed 2026]   → bench/review/pack.json

import { mkdirSync, writeFileSync } from 'node:fs';
import { analyze, classifySource, explain, seededSample, type ReviewItem, type ReviewPack } from '../packages/engine/src/index.ts';
import type { Lang } from '../packages/engine/src/types.ts';
import { custodyOf, loadSamples } from './load.ts';

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const N = arg('--n', 50);
const SEED = arg('--seed', 2026);
const LANGS: Lang[] = ['en', 'hi', 'kn'];

const { samples, extraFiles } = loadSamples();
const population: ReviewItem[] = [];
for (const s of samples) {
  if (s.kind === 'oauth') continue; // ConsentFix warnings are fixed templates, reviewed once by hand
  // The warning a person would actually read: at paste with custody, or at Enter when typed.
  for (const [variant, custody] of [['as copied', custodyOf(s)], ['typed by hand', null]] as const) {
    if (variant === 'as copied' && !custody) continue;
    const v = analyze(s.text, { target: s.target, custody });
    if (v.action === 'allow') continue;
    const src = classifySource(custody);
    population.push({
      id: `${s.id}${custody ? '' : '-typed'}`,
      sampleId: s.id,
      group: s.group,
      command: s.text,
      target: s.target,
      source: custody ? `${src.name || 'unknown'} (${variant})` : 'typed by hand',
      action: v.action,
      risk: v.risk,
      findings: v.findings.map((f) => f.id),
      warning: Object.fromEntries(LANGS.map((l) => {
        const e = explain(v, custody, l);
        return [l, { headline: e.headline, details: e.details, provenance: e.provenance, advice: e.advice }];
      })) as ReviewItem['warning'],
    });
  }
}

const items = seededSample(population, N, SEED).map((it, i) => ({ ...it, id: `w${String(i + 1).padStart(2, '0')}` }));
const pack: ReviewPack = {
  format: 'owlcept-review-pack',
  version: 1,
  id: `pack-${SEED}-${items.length}-${population.length}`,
  created: new Date().toISOString(),
  seed: SEED,
  population: population.length,
  items,
};
mkdirSync(new URL('./review/', import.meta.url).pathname, { recursive: true });
const out = new URL('./review/pack.json', import.meta.url).pathname;
writeFileSync(out, `${JSON.stringify(pack, null, 2)}\n`);
console.log(`${items.length} of ${population.length} warnings drawn (seed ${SEED}) from ${['corpus/benign.ts', ...extraFiles.map((f) => `corpus/${f}`)].join(', ')} → ${out}`);
if (items.length < N) console.log(`Only ${population.length} warnings exist. Add the team's corpus to bench/corpus/*.jsonl to reach ${N}.`);
