import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, parseReport, summarize, type ActivityEvent } from '../src/index.ts';

const NOW = new Date('2026-10-05T12:00:00').getTime();
const DAY = 86_400_000;
const H = 'a'.repeat(64);
const events: ActivityEvent[] = [
  { time: NOW - 1000, kind: 'copy-block', host: 'example-lure.test', ids: ['download-exec', 'hidden-copy', 'script-copy'], hash: H, url: 'https://example-lure.test/verify' },
  { time: NOW - DAY, kind: 'copy-block', host: 'other-lure.test', ids: ['download-exec', 'lure-words'], hash: H },
  { time: NOW - 2 * DAY, kind: 'copy-warn', host: 'admin.example.test', ids: ['persistence'], note: 'trusted-site' },
  { time: NOW - 3 * DAY, kind: 'consentfix', host: 'connect.example-lure.test', ids: ['consentfix', 'Microsoft'] },
  { time: NOW - 3 * DAY, kind: 'override', host: 'admin.example.test', ids: ['persistence'] },
  { time: NOW - 40 * DAY, kind: 'copy-block', host: 'old.test', ids: ['download-exec'] },
];

test('summarize counts the window and ranks hosts, reasons and repeated items', () => {
  const s = summarize(events, { now: NOW, days: 30 });
  assert.equal(s.total, 5);
  assert.deepEqual([s.blocked, s.warned, s.consentfix, s.overrides, s.silent], [2, 1, 1, 1, 1]);
  assert.equal(s.byDay.length, 30);
  assert.equal(s.byDay.at(-1)!.blocked, 1);
  assert.deepEqual(s.topReasons[0], ['download-exec', 2]);
  assert.ok(!s.topReasons.some(([id]) => id === 'script-copy' || id === 'Microsoft'));
  assert.deepEqual(s.repeatedHashes, [[H, 2]]);
});

test('reports round-trip through parseReport', () => {
  const r = buildReport(events, { id: 'dev-1', label: 'Library PC 4' }, { name: 'OwlCept extension', version: '0.2.0' }, 'smart', new Date(NOW));
  const back = parseReport(JSON.stringify(r));
  assert.deepEqual(back, r);
});

test('parseReport rejects other files with a readable message', () => {
  assert.throws(() => parseReport('not json'), /not JSON/);
  assert.throws(() => parseReport('{"hello":1}'), /not an OwlCept activity export/);
  assert.throws(() => parseReport('{"format":"owlcept-activity","version":9,"events":[]}'), /version 9/);
});

test('parseReport keeps only known, well-formed fields', () => {
  const hostile = JSON.stringify({
    format: 'owlcept-activity', version: 1, device: { id: 'x', label: '<img src=x onerror=alert(1)>'.repeat(10) }, events: [
      { time: 1, kind: 'copy-block', host: 'A.TEST', ids: ['x', 5, 'y'], hash: 'nothex', url: 'javascript:alert(1)', text: 'clipboard text must never be kept', extra: 1 },
      { time: 'soon', kind: 'copy-block', host: 'b.test', ids: [] },
      { time: 2, kind: 'delete-everything', host: 'c.test', ids: [] },
    ],
  });
  const r = parseReport(hostile);
  assert.equal(r.events.length, 1);
  assert.deepEqual(r.events[0], { time: 1, kind: 'copy-block', host: 'a.test', ids: ['x', 'y'] });
  assert.equal(r.device.label.length, 80);
});
