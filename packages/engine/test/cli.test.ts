import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const CLI = new URL('../cli/owlcept.ts', import.meta.url).pathname;
const run = (args: string[], input?: string) => spawnSync(process.execPath, [CLI, ...args], { input, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });

test('check: an everyday command is allowed with exit 0', () => {
  const r = run(['check', 'winget install --id Git.Git -e', '--target', 'terminal']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^ALLOW/);
});

test('check: exit status follows the verdict, and --json is parseable', () => {
  const r = run(['check', 'schtasks /create /tn Backup /tr C:\\b.bat /sc daily', '--json']);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.verdict.action, 'warn');
  assert.ok(out.explanation.details.length > 0);
});

test('check: custody flags reach the engine and the warning speaks Hindi', () => {
  const r = run(['check', '-', '--target', 'run', '--origin', 'https://example-lure.test/verify', '--hidden', '--lure', 'Win+R', '--lang', 'hi'], 'echo SIMULATED-CLICKFIX');
  const json = run(['check', '-', '--target', 'run', '--origin', 'https://example-lure.test/', '--hidden', '--lure', 'Win+R', '--json'], 'schtasks /create /tn x /tr y').stdout;
  assert.ok(JSON.parse(json).verdict.findings.some((f: { id: string }) => f.id === 'hidden-copy'));
  assert.ok([0, 1, 2].includes(r.status!));
  assert.match(r.stdout, /[\u0900-\u097F]/);
});

test('oauth: a sign-in code pasted into another site blocks with exit 2', () => {
  const code = `http://localhost:8400/?code=0.AXEA${'x'.repeat(120)}&state=a`;
  assert.equal(run(['oauth', code, '--page', 'https://example-lure.test/connect']).status, 2);
  assert.equal(run(['oauth', 'hello', '--page', 'https://example-lure.test/']).status, 0);
});

test('serve: one JSON reply per request line, errors reported per line', () => {
  const lines = [
    JSON.stringify({ id: 1, text: 'git status', context: { target: 'terminal' } }),
    'not json',
    JSON.stringify({ id: 3, kind: 'oauth', text: `0.AXEA${'y'.repeat(150)}`, pageUrl: 'https://example-lure.test/' }),
  ].join('\n');
  const out = run(['serve'], `${lines}\n`).stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(out.length, 3);
  assert.equal(out[0].id, 1);
  assert.equal(out[0].verdict.action, 'allow');
  assert.ok(out[1].error);
  assert.equal(out[2].block, true);
});

test('usage errors exit 64', () => {
  assert.equal(run(['check', 'x', '--target', 'moon']).status, 64);
  assert.equal(run(['frobnicate']).status, 64);
  assert.equal(run(['--version']).stdout.trim(), '0.2.0');
});
