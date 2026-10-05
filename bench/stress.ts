// Worst-case timing for the engine. The extension lets a clipboard write through
// unchanged if a verdict takes longer than 400 ms, so slow inputs are a bypass, not
// just a performance bug. This feeds the engine pathological text — long runs of
// every character and of every token its patterns look for, plus seeded random
// text — and fails if any analysis is slower than the budget.
//
//   node bench/stress.ts [--budget 50] [--quick]

import { performance } from 'node:perf_hooks';
import { analyze } from '../packages/engine/src/index.ts';

const args = process.argv.slice(2);
const BUDGET = Number(args[args.indexOf('--budget') + 1]) || 50;
const QUICK = args.includes('--quick');
const SIZES = QUICK ? [4_096, 65_536] : [1_024, 8_192, 65_536, 200_000];

// Tokens the deobfuscator and rules react to: quoting, escapes, concatenation,
// slicing, encodings, flags, separators and the like. Generic syntax only.
const TOKENS = [
  '^', '`', '"', "'", '""', "''", '+', "'+'", '"+"', '(', ')', '[', ']', '{', '}', '$', '%', '&', '|', ';', ',', '#', '\\', '/', ':', '=',
  '%a:~', '%a:~1,1%', '[char]', '[char]65+', '-f ', '{0}', '-replace', '-join', '-split', '$a=', 'set a=', '%%', '-w ', '-e ', '-enc ', '/c ',
  'http://', 'https://a.', '\\\\', '@ssl\\', 'a.b', '0x41,', '41', 'QUJD', 'AAAA', '==', '%41', '​', ' ', '\t', '\n', '\r\n', ' ',
  'iex ', 'echo ', 'rem ', ':: ', 'for /f ', 'nslookup ', 'a@b ', '-q=txt ', '$env:', '[a]', 'a.b.c', '-', '--', '*', '?', '!', '~',
];

// Seeded PRNG so a failure reproduces.
let seed = 0x0c1f;
const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) >>> 0) / 2 ** 32);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

interface Case { name: string; text: string }
const cases: Case[] = [];
for (const size of SIZES) {
  for (const tok of TOKENS) cases.push({ name: `repeat ${JSON.stringify(tok)} ×${size}`, text: tok.repeat(Math.ceil(size / tok.length)).slice(0, size) });
  for (let c = 32; c < 127; c++) cases.push({ name: `repeat char ${c} ×${size}`, text: String.fromCharCode(c).repeat(size) });
  // Alternations of two tokens defeat simple "one char repeated" checks in regexes.
  for (let i = 0; i < (QUICK ? 40 : 200); i++) {
    const a = pick(TOKENS), b = pick(TOKENS);
    cases.push({ name: `alternate ${JSON.stringify(a)}/${JSON.stringify(b)} ×${size}`, text: (a + b).repeat(Math.ceil(size / (a.length + b.length))).slice(0, size) });
  }
  // Random soup of tokens and letters.
  for (let i = 0; i < (QUICK ? 10 : 50); i++) {
    let t = '';
    while (t.length < size) t += rand() < 0.6 ? pick(TOKENS) : String.fromCharCode(97 + Math.floor(rand() * 26));
    cases.push({ name: `soup #${i} ×${size}`, text: t.slice(0, size) });
  }
  // Long runs of an encoding alphabet with a valid-looking prefix.
  cases.push({ name: `base64 run ×${size}`, text: `-enc ${'QUJD'.repeat(size / 4)}` });
  cases.push({ name: `hex run ×${size}`, text: `0x${'41'.repeat(size / 2)}` });
  cases.push({ name: `nested parens ×${size}`, text: '('.repeat(size / 2) + ')'.repeat(size / 2) });
  cases.push({ name: `nested quotes ×${size}`, text: `"'`.repeat(size / 2) });
}

const slow: { name: string; ms: number }[] = [];
let worst = { name: '', ms: 0 };
const started = performance.now();
for (const c of cases) {
  const t = performance.now();
  analyze(c.text, { target: 'terminal' });
  const ms = performance.now() - t;
  if (ms > worst.ms) worst = { name: c.name, ms };
  if (ms > BUDGET) slow.push({ name: c.name, ms });
}
console.log(`${cases.length} inputs in ${((performance.now() - started) / 1000).toFixed(1)} s; worst ${worst.ms.toFixed(1)} ms (${worst.name}); budget ${BUDGET} ms`);
for (const s of slow.sort((a, b) => b.ms - a.ms).slice(0, 25)) console.log(`  ✗ ${s.ms.toFixed(0).padStart(6)} ms  ${s.name}`);
if (slow.length) {
  console.log(`${slow.length} input(s) over budget`);
  process.exit(1);
}
console.log('✓ every input within budget');
