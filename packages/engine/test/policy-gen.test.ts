import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPolicy, EXTENSION_ID } from '../src/index.ts';

const H = 'b'.repeat(64);
const HOSTILE = [
  "a.test'; Remove-Item C:\\ -Recurse; '",
  'b.test"\r\n[HKEY_LOCAL_MACHINE\\SOFTWARE\\Evil]',
  'c.test,$(whoami)',
  '-BlockedHosts',
  'localhost',
  '',
  'x'.repeat(300) + '.test',
];

test('only strict host names and 64-hex fingerprints reach the output', () => {
  for (const format of ['powershell', 'reg', 'json'] as const) {
    const out = buildPolicy({ blockedHosts: ['Verify.Example-Lure.test', ...HOSTILE], approvedCommands: [H, 'nothex', H.toUpperCase()] }, format);
    assert.ok(out.text.includes('verify.example-lure.test'), format);
    for (const bad of ['Remove-Item', 'Evil', 'whoami', 'nothex', 'localhost', '-BlockedHosts \'-']) assert.ok(!out.text.includes(bad), `${format} leaked ${bad}`);
    assert.equal(out.rejected.length, 7, format);
    assert.equal(out.text.split(H).length - 1, format === 'reg' ? 2 : 1, `${format}: fingerprint deduplicated`);
  }
});

test('PowerShell output is one command line with quoted lists', () => {
  const out = buildPolicy({ blockedHosts: ['b.test', 'a.test'], approvedCommands: [H] }, 'powershell');
  assert.equal(out.text, `.\\Set-OwlCeptPolicy.ps1 -BlockedHosts 'a.test','b.test' -ApprovedCommands '${H}'\n`);
});

test('.reg output clears each list before writing it, for Chrome and Edge', () => {
  const out = buildPolicy({ blockedHosts: ['a.test'] }, 'reg').text.split('\r\n');
  assert.equal(out[0], 'Windows Registry Editor Version 5.00');
  for (const root of ['Google\\Chrome', 'Microsoft\\Edge']) {
    const key = `HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\${root}\\3rdparty\\extensions\\${EXTENSION_ID}\\policy\\blockedHosts`;
    const del = out.indexOf(`[-${key}]`);
    assert.ok(del > 0 && out[del + 2] === `[${key}]` && out[del + 3] === '"1"="a.test"', root);
  }
});

test('JSON output is the browser policy shape', () => {
  const json = JSON.parse(buildPolicy({ blockedHosts: ['a.test'], approvedCommands: [H] }, 'json').text);
  assert.deepEqual(json, { '3rdparty': { extensions: { [EXTENSION_ID]: { blockedHosts: ['a.test'], approvedCommands: [H] } } } });
});
