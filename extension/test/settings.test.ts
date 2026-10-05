import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean } from '../src/settings-store.ts';
import { defang, reportUrl } from '../src/policy.ts';

test('clean keeps only well-formed settings (storage and policy are untrusted)', () => {
  assert.deepEqual(
    clean({ mode: 'strict', lang: 'kn', contact: '+91 98000-00000', trustedSites: ['https://Docs.Example.com/x', 'not a host', 'docs.example.com', 7], reportLures: true, allowCopyAnyway: false, deviceLabel: 'Lab PC 1', other: 'x' }),
    { mode: 'strict', lang: 'kn', contact: '+919800000000', trustedSites: ['docs.example.com'], reportLures: true, allowCopyAnyway: false, deviceLabel: 'Lab PC 1' },
  );
  assert.deepEqual(clean({ mode: 'off', lang: 'fr', reportLures: 'yes', trustedSites: 'example.com' }), {});
  assert.deepEqual(clean(undefined), {});
});

test('lure URLs are shown defanged and reported only to the public form', () => {
  assert.equal(defang('https://verify.example-lure.test/check?id=1'), 'hxxps://verify[.]example-lure[.]test/check?id=1');
  assert.equal(reportUrl('https://a.test/x?y=1'), 'https://safebrowsing.google.com/safebrowsing/report_phish/?url=https%3A%2F%2Fa.test%2Fx%3Fy%3D1');
});
