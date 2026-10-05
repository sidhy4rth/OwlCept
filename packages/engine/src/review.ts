// Explanation review, for the brief's "explanation accuracy: 90% judged correct,
// two reviewers score 50 random warnings". bench/review-pack.ts draws the sample;
// web/review.html lets each reviewer score it; reviewStats merges the results.

import type { Lang } from './types.ts';

export interface ReviewItem {
  id: string;
  /** Corpus sample the warning came from. */
  sampleId: string;
  group: string;
  command: string;
  target: string;
  /** Where it was copied from, as the warning would describe it. */
  source: string;
  action: 'warn' | 'block';
  risk: number;
  findings: string[];
  /** The warning exactly as OwlCept shows it, per language. */
  warning: Record<Lang, { headline: string; details: string[]; provenance?: string; advice: string }>;
}

export interface ReviewPack {
  format: 'owlcept-review-pack';
  version: 1;
  id: string;
  created: string;
  seed: number;
  /** How many warnings were available to draw from. */
  population: number;
  items: ReviewItem[];
}

export type Score = 'correct' | 'partly' | 'wrong';

export interface ReviewResult {
  format: 'owlcept-review-result';
  version: 1;
  packId: string;
  reviewer: string;
  lang: Lang;
  scores: Record<string, { score: Score; note?: string }>;
}

const SCORES = new Set<Score>(['correct', 'partly', 'wrong']);
const LANGS = new Set<Lang>(['en', 'hi', 'kn']);

/** Reads a reviewer's file; keeps only well-formed entries. Throws with a readable message otherwise. */
export function parseReviewResult(text: string): ReviewResult {
  let r: Record<string, unknown>;
  try {
    r = JSON.parse(text);
  } catch {
    throw new Error('This file is not JSON.');
  }
  if (!r || r.format !== 'owlcept-review-result' || r.version !== 1) throw new Error('This is not an OwlCept review result.');
  if (typeof r.packId !== 'string' || typeof r.reviewer !== 'string') throw new Error('The result has no pack id or reviewer.');
  const scores: ReviewResult['scores'] = {};
  for (const [id, v] of Object.entries((r.scores ?? {}) as Record<string, { score?: unknown; note?: unknown }>).slice(0, 5000)) {
    if (!v || !SCORES.has(v.score as Score)) continue;
    scores[id.slice(0, 80)] = { score: v.score as Score, ...(typeof v.note === 'string' && v.note.trim() ? { note: v.note.slice(0, 1000) } : {}) };
  }
  return { format: 'owlcept-review-result', version: 1, packId: r.packId.slice(0, 80), reviewer: r.reviewer.slice(0, 80) || 'anonymous', lang: LANGS.has(r.lang as Lang) ? (r.lang as Lang) : 'en', scores };
}

export interface ReviewStats {
  reviewers: { reviewer: string; lang: Lang; scored: number; correct: number; accuracy: number }[];
  /** Items scored by every reviewer. */
  common: number;
  /** Share of common items every reviewer judged correct. */
  allCorrect: number;
  /** Mean of the reviewers' accuracies. */
  meanAccuracy: number;
  /** Cohen's kappa on correct / not correct, for the first two reviewers; null with fewer than two. */
  kappa: number | null;
  disagreements: { id: string; scores: Record<string, Score> }[];
  /** Items any reviewer judged wrong, with notes. */
  wrong: { id: string; reviewer: string; note?: string }[];
}

export function reviewStats(results: ReviewResult[], itemIds?: string[]): ReviewStats {
  const ids = itemIds ?? [...new Set(results.flatMap((r) => Object.keys(r.scores)))];
  const reviewers = results.map((r) => {
    const scored = ids.filter((id) => r.scores[id]);
    const correct = scored.filter((id) => r.scores[id].score === 'correct').length;
    return { reviewer: r.reviewer, lang: r.lang, scored: scored.length, correct, accuracy: scored.length ? correct / scored.length : 0 };
  });
  const common = ids.filter((id) => results.length > 0 && results.every((r) => r.scores[id]));
  const allCorrect = common.length ? common.filter((id) => results.every((r) => r.scores[id].score === 'correct')).length / common.length : 0;

  let kappa: number | null = null;
  if (results.length >= 2 && common.length) {
    const [a, b] = results;
    const yes = (r: ReviewResult, id: string) => r.scores[id].score === 'correct';
    const n = common.length;
    const po = common.filter((id) => yes(a, id) === yes(b, id)).length / n;
    const pa = common.filter((id) => yes(a, id)).length / n;
    const pb = common.filter((id) => yes(b, id)).length / n;
    const pe = pa * pb + (1 - pa) * (1 - pb);
    kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  }

  return {
    reviewers,
    common: common.length,
    allCorrect,
    meanAccuracy: reviewers.length ? reviewers.reduce((s, r) => s + r.accuracy, 0) / reviewers.length : 0,
    kappa,
    disagreements: common
      .filter((id) => new Set(results.map((r) => r.scores[id].score)).size > 1)
      .map((id) => ({ id, scores: Object.fromEntries(results.map((r) => [r.reviewer, r.scores[id].score])) })),
    wrong: results.flatMap((r) => ids.filter((id) => r.scores[id]?.score === 'wrong').map((id) => ({ id, reviewer: r.reviewer, note: r.scores[id].note }))),
  };
}

/** Deterministic shuffle so a pack can be re-drawn exactly from its seed. */
export function seededSample<T>(items: T[], n: number, seed: number): T[] {
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (s * 1_103_515_245 + 12_345) >>> 0) / 2 ** 32);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
