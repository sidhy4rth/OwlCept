import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, describeTrick } from '../src/index.ts';
import type { Trick } from '../src/types.ts';
import { caret, encodePs } from './helpers.ts';

test('the trace has one step per layer, the first being what was pasted', () => {
  const v = analyze('git status');
  assert.equal(v.trace.length, v.layers.length);
  assert.deepEqual(v.trace[0], { text: 'git status', from: null, decodedBy: null, undid: [] });
});

test('each decoded layer points back to its parent and names its decoder', () => {
  const v = analyze(`powershell -enc ${encodePs('echo SIMULATED-CLICKFIX')}`);
  const step = v.trace.find((s) => s.text.includes('SIMULATED-CLICKFIX'))!;
  assert.equal(step.from, 0);
  assert.equal(step.decodedBy, 'base64');
});

test('disguises undone inside a layer are listed on that layer', () => {
  const v = analyze(caret('cmd /c echo SIMULATED-CLICKFIX'));
  assert.ok(v.trace[0].undid.includes('caret-escapes'));
  assert.ok(v.trace[0].text.includes('cmd /c echo'));
});

test('every disguise has a step label in every language', () => {
  const tricks: Trick[] = ['invisible-chars', 'caret-escapes', 'backtick-escapes', 'quote-splitting', 'string-splitting', 'format-reorder', 'string-replace', 'char-codes', 'env-slicing', 'variable-indirection', 'base64', 'hex', 'url-encoding', 'padding'];
  for (const t of tricks) for (const lang of ['en', 'hi', 'kn'] as const) assert.ok(describeTrick(t, lang)?.length > 3, `${t} ${lang}`);
});
