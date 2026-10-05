import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, isTrusted, normalizeSite, type PolicyInput } from '../src/policy.ts';

const base: PolicyInput = { action: 'block', mode: 'smart', trustedSites: [], host: 'example.test', agentConnected: false };

test('smart: block shows the banner and swaps the clipboard', () => {
  assert.deepEqual(decide(base), { show: 'banner', replaceClipboard: true, log: 'block' });
});
test('smart: warn is a toast, or silent when the agent will check the paste', () => {
  assert.equal(decide({ ...base, action: 'warn' }).show, 'toast');
  assert.equal(decide({ ...base, action: 'warn', agentConnected: true }).show, 'none');
  assert.equal(decide({ ...base, action: 'warn' }).replaceClipboard, false);
});
test('strict: a warning is handled like a block', () => {
  assert.deepEqual(decide({ ...base, action: 'warn', mode: 'strict' }), { show: 'banner', replaceClipboard: true, log: 'block' });
});
test('audit: never interrupts, still logs', () => {
  assert.deepEqual(decide({ ...base, mode: 'audit' }), { show: 'none', replaceClipboard: false, log: 'block', note: 'audit' });
});
test('allow is always silent and unlogged', () => {
  for (const mode of ['audit', 'smart', 'strict'] as const) assert.deepEqual(decide({ ...base, action: 'allow', mode }), { show: 'none', replaceClipboard: false, log: 'allow' });
});
test('trusted sites skip warnings but never blocks', () => {
  const trusted = { ...base, trustedSites: ['example.test'], host: 'docs.example.test' };
  assert.equal(decide({ ...trusted, action: 'warn' }).show, 'none');
  assert.equal(decide({ ...trusted, action: 'warn', mode: 'strict' }).show, 'none');
  assert.equal(decide({ ...trusted, action: 'block' }).show, 'banner');
});
test('trusted-site matching is by host and parent domain only', () => {
  assert.ok(isTrusted('docs.github.com', ['github.com']));
  assert.ok(isTrusted('github.com', ['https://GitHub.com/cli/cli']));
  assert.ok(!isTrusted('evilgithub.com', ['github.com']));
  assert.ok(!isTrusted('github.com.evil.test', ['github.com']));
  assert.ok(!isTrusted('github.com', ['not a host', '']));
});
test('normalizeSite accepts hosts and URLs, rejects junk', () => {
  assert.equal(normalizeSite(' https://Learn.Microsoft.com/en-us/ '), 'learn.microsoft.com');
  assert.equal(normalizeSite('*.example.com'), 'example.com');
  assert.equal(normalizeSite('localhost'), 'localhost');
  assert.equal(normalizeSite('javascript:alert(1)'), '');
  assert.equal(normalizeSite('hello world'), '');
});
