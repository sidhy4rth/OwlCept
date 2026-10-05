import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/index.ts';
import { encodePs } from './helpers.ts';

test('out of time with decoding left: at least a warning, never a silent pass', () => {
  const v = analyze(`powershell -enc ${encodePs('echo SIMULATED-CLICKFIX')}`, { target: 'terminal', budgetMs: 0 });
  assert.ok(v.findings.some((f) => f.id === 'analysis-incomplete'));
  assert.notEqual(v.action, 'allow');
});

test('a budget that runs out with nothing left to do changes nothing', () => {
  const v = analyze('git status', { target: 'terminal', budgetMs: 0 });
  assert.equal(v.action, 'allow');
  assert.ok(!v.findings.some((f) => f.id === 'analysis-incomplete'));
});

test('the default budget is never reached by ordinary input', () => {
  const v = analyze(`powershell -enc ${encodePs('echo SIMULATED-CLICKFIX')}`, { target: 'terminal' });
  assert.ok(!v.findings.some((f) => f.id === 'analysis-incomplete'));
  assert.ok(v.layers.some((l) => l.includes('SIMULATED-CLICKFIX')));
});
