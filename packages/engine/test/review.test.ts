import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReviewResult, reviewStats, seededSample, type ReviewResult, type Score } from '../src/index.ts';

const result = (reviewer: string, scores: Score[]): ReviewResult => ({
  format: 'owlcept-review-result', version: 1, packId: 'p1', reviewer, lang: 'en',
  scores: Object.fromEntries(scores.map((s, i) => [`w${i + 1}`, { score: s }])),
});

test('accuracy, all-correct share and Cohen kappa match a hand-worked example', () => {
  // 10 items. A: 8 correct. B: 7 correct. Both correct on 6, both not on 1 → po = 0.7.
  const A: Score[] = ['correct', 'correct', 'correct', 'correct', 'correct', 'correct', 'correct', 'correct', 'wrong', 'partly'];
  const B: Score[] = ['correct', 'correct', 'correct', 'correct', 'correct', 'correct', 'wrong', 'wrong', 'correct', 'wrong'];
  const s = reviewStats([result('A', A), result('B', B)]);
  assert.deepEqual(s.reviewers.map((r) => r.accuracy), [0.8, 0.7]);
  assert.equal(s.common, 10);
  assert.equal(s.allCorrect, 0.6);
  assert.ok(Math.abs(s.meanAccuracy - 0.75) < 1e-9);
  // pe = 0.8*0.7 + 0.2*0.3 = 0.62; kappa = (0.7 - 0.62) / 0.38
  assert.ok(Math.abs(s.kappa! - 0.08 / 0.38) < 1e-9);
  assert.equal(s.disagreements.length, 4);
  assert.deepEqual(s.wrong.map((w) => `${w.reviewer}:${w.id}`), ['A:w9', 'B:w7', 'B:w8', 'B:w10']);
});

test('perfect agreement gives kappa 1, even when everything is correct', () => {
  const all: Score[] = ['correct', 'correct', 'correct'];
  assert.equal(reviewStats([result('A', all), result('B', all)]).kappa, 1);
  assert.equal(reviewStats([result('A', all)]).kappa, null);
});

test('reviewer files are untrusted: junk scores are dropped', () => {
  const r = parseReviewResult(JSON.stringify({ format: 'owlcept-review-result', version: 1, packId: 'p', reviewer: 'R', lang: 'xx', scores: { a: { score: 'correct', note: ' ' }, b: { score: 'maybe' }, c: null, d: { score: 'wrong', note: 'misnames the host' } } }));
  assert.deepEqual(r.scores, { a: { score: 'correct' }, d: { score: 'wrong', note: 'misnames the host' } });
  assert.equal(r.lang, 'en');
  assert.throws(() => parseReviewResult('{}'), /not an OwlCept review result/);
});

test('seededSample is deterministic and draws without repeats', () => {
  const xs = Array.from({ length: 100 }, (_, i) => i);
  assert.deepEqual(seededSample(xs, 50, 7), seededSample(xs, 50, 7));
  assert.notDeepEqual(seededSample(xs, 50, 7), seededSample(xs, 50, 8));
  assert.equal(new Set(seededSample(xs, 50, 7)).size, 50);
});
