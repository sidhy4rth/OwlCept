import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, canonicalJson, generateDeviceKey, signReport, verifyReport, type ActivityEvent } from '../src/index.ts';

const events: ActivityEvent[] = [
  { time: 1_760_000_000_000, kind: 'copy-block', host: 'verify.example-lure.test', ids: ['download-exec', 'hidden-copy'], hash: 'a'.repeat(64), url: 'https://verify.example-lure.test/x' },
  { time: 1_760_000_100_000, kind: 'override', host: 'admin.example.test', ids: ['persistence'] },
];
const report = () => buildReport(events, { id: 'dev-1', label: 'Lab PC 1' }, { name: 'OwlCept extension', version: '0.3.0' }, 'smart', new Date('2026-10-05T00:00:00Z'));

test('canonical JSON ignores key order and whitespace', () => {
  assert.equal(canonicalJson({ b: 1, a: [true, null, { d: 'x', c: 2 }] }), '{"a":[true,null,{"c":2,"d":"x"}],"b":1}');
  assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}');
});

test('a signed export verifies, and shows its key id', async () => {
  const keys = await generateDeviceKey();
  const signed = await signReport(report(), keys);
  const v = await verifyReport(JSON.stringify(signed, null, 2));
  assert.equal(v.status, 'verified');
  assert.equal(v.keyId, signed.signature!.keyId);
  assert.match(v.keyId!, /^[0-9a-f]{16}$/);
});

test('the private key cannot be exported', async () => {
  const keys = await generateDeviceKey();
  await assert.rejects(crypto.subtle.exportKey('jwk', keys.privateKey));
});

test('any edit to a kept field after signing is caught', async () => {
  const signed = await signReport(report(), await generateDeviceKey());
  const edits: ((r: any) => void)[] = [
    (r) => (r.events[0].host = 'harmless.example.test'),
    (r) => r.events.splice(1, 1),
    (r) => (r.events[0].kind = 'copy-warn'),
    (r) => (r.device.label = 'Another PC'),
    (r) => (r.mode = 'audit'),
    (r) => (r.events[0].time += 1),
  ];
  for (const edit of edits) {
    const copy = JSON.parse(JSON.stringify(signed));
    edit(copy);
    const v = await verifyReport(JSON.stringify(copy));
    assert.equal(v.status, 'invalid', edit.toString());
    assert.equal(v.reason, 'contents changed after signing');
  }
});

test('fields the fleet view ignores can change without breaking the signature', async () => {
  const signed: any = await signReport(report(), await generateDeviceKey());
  signed.comment = 'added by IT';
  signed.events[0].extra = 'ignored';
  assert.equal((await verifyReport(JSON.stringify(signed))).status, 'verified');
});

test('swapping in another key, or a bad signature block, is invalid; no block is unsigned', async () => {
  const signed: any = await signReport(report(), await generateDeviceKey());
  const other = await signReport(report(), await generateDeviceKey());
  assert.equal((await verifyReport(JSON.stringify({ ...signed, signature: { ...signed.signature, publicKey: other.signature!.publicKey } }))).status, 'invalid');
  assert.equal((await verifyReport(JSON.stringify({ ...signed, signature: { ...signed.signature, value: 'x' } }))).reason, 'malformed signature');
  const { signature: _s, ...unsigned } = signed;
  assert.equal((await verifyReport(JSON.stringify(unsigned))).status, 'unsigned');
});
