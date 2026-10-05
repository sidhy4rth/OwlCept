// One benchmark sample. The benign corpus is built in corpus/benign.ts; any
// other corpus (for example the team's defanged ClickFix collection) is read
// from corpus/*.jsonl, one Sample per line. See README.md for the format.

import type { CustodyRecord, PasteTarget } from '../packages/engine/src/types.ts';

export interface Sample {
  id: string;
  label: 'benign' | 'malicious';
  /** Free-form family, e.g. "winget" or "installer"; reported per group. */
  group: string;
  /** The clipboard text. For kind "oauth", the pasted sign-in URL or code. */
  text: string;
  target: PasteTarget;
  /** Page the text was copied from (browser sources). */
  origin?: string;
  /**
   * How it reached the clipboard: a visible copy button, a manual selection,
   * a script writing text the page never showed, or typed by hand (no custody).
   */
  copy?: 'button' | 'manual' | 'script-hidden' | 'typed';
  /** Lure phrases near the copy ("Win+R", "verify you are human", ...). */
  lure?: string[];
  fakeCaptcha?: boolean;
  /** Desktop app the text was copied from, e.g. "WhatsApp.exe" (sets sourceKind "app"). */
  app?: string;
  /** Full custody record; overrides everything derived from the fields above. */
  custody?: CustodyRecord | null;
  /** "oauth" samples are checked with the ConsentFix guard against pageUrl. */
  kind?: 'command' | 'oauth';
  pageUrl?: string;
  /** Attack-suite tags for per-suite rates, e.g. { obfuscation: "base64", visibility: "1px" }. */
  suite?: Record<string, string>;
}
