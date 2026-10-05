// Bundle entry for embedded hosts (the Windows agent). Exposes a small
// string-in / string-out API on globalThis.OwlCept so the host never has to
// marshal JavaScript objects.

import './polyfills.ts';
import { analyze, explain, normalizeForHash } from '../src/index.ts';
import type { AnalyzeContext, Lang } from '../src/types.ts';

interface HostRequest {
  text: string;
  context?: AnalyzeContext;
  lang?: Lang;
}

function analyzeJson(requestJson: string): string {
  const req = JSON.parse(requestJson) as HostRequest;
  const verdict = analyze(req.text, req.context ?? {});
  const explanation = explain(verdict, req.context?.custody ?? null, req.lang ?? 'en');
  return JSON.stringify({ verdict, explanation });
}

(globalThis as Record<string, unknown>).OwlCept = { analyzeJson, normalizeForHash, version: '0.3.0' };
