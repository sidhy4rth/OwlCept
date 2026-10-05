// Corpus loading and custody records, shared by the benchmark and the review pack.

import { readFileSync, readdirSync } from 'node:fs';
import type { CustodyRecord } from '../packages/engine/src/types.ts';
import { BENIGN } from './corpus/benign.ts';
import type { Sample } from './types.ts';

const corpusDir = new URL('./corpus/', import.meta.url).pathname;

/** The built-in benign corpus plus every corpus/*.jsonl file (one Sample per line). */
export function loadSamples(): { samples: Sample[]; extraFiles: string[] } {
  const samples: Sample[] = [...BENIGN];
  const extraFiles = readdirSync(corpusDir).filter((f) => f.endsWith('.jsonl')).sort();
  for (const f of extraFiles) {
    readFileSync(corpusDir + f, 'utf8').split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      try {
        samples.push(JSON.parse(line) as Sample);
      } catch {
        throw new Error(`${f}:${i + 1} is not valid JSON`);
      }
    });
  }
  return { samples, extraFiles };
}

/** The custody record the extension (or agent) would have written for this sample. */
export function custodyOf(s: Sample): CustodyRecord | null {
  if (s.custody !== undefined) return s.custody;
  if (s.copy === 'typed') return null;
  if (s.app) return { sourceKind: 'app', sourceApp: s.app, lureWords: s.lure ?? [], time: Date.now() };
  return {
    sourceKind: 'browser',
    originUrl: s.origin,
    scriptWritten: s.copy === 'button' || s.copy === 'script-hidden',
    visibleMatch: s.copy !== 'script-hidden',
    lureWords: s.lure ?? [],
    fakeCaptcha: s.fakeCaptcha ?? false,
    time: Date.now(),
  };
}
