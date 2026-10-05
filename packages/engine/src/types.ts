// Shared types for the OwlCept engine. Kept free of runtime code so every
// consumer (extension, agent host, web checker, bench) can import them.

/** Where the text is about to land. */
export type PasteTarget = 'run' | 'terminal' | 'explorer' | 'web' | 'unknown';

/** What the browser extension (or agent clipboard listener) saw at copy time. */
export interface CustodyRecord {
  /** SHA-256 of the clipboard text, hex. The text itself is never stored. */
  hash?: string;
  /** 'browser' when the extension wrote the record, 'app' for the agent listener. */
  sourceKind?: 'browser' | 'app' | 'unknown';
  /** Process name for app sources, e.g. "WhatsApp.exe", "OUTLOOK.EXE". */
  sourceApp?: string;
  /** Page URL the text was copied from (browser sources only). */
  originUrl?: string;
  /** True when a page script wrote the clipboard rather than the user selecting text. */
  scriptWritten?: boolean;
  /** True when the copied text matched what was visible on screen; false when it did not. */
  visibleMatch?: boolean | null;
  /** Lure phrases found near the click ("Win+R", "verify you are human", ...). */
  lureWords?: string[];
  /** A CAPTCHA-looking widget that was not served by a real CAPTCHA provider. */
  fakeCaptcha?: boolean;
  /** Epoch milliseconds of the copy. */
  time?: number;
}

export interface AnalyzeContext {
  target?: PasteTarget;
  custody?: CustodyRecord | null;
  /**
   * Time budget in ms (default 150). The extension stops waiting at 400 ms, so an
   * input that outlasts the budget gets at least a warning rather than nothing.
   */
  budgetMs?: number;
  /** Rules set by the organisation (browser policy), applied on every checkpoint. */
  org?: OrgRules;
}

export interface OrgRules {
  /** Hosts (and their subdomains) a command may never contact, e.g. lure sites from the fleet view. */
  blockedHosts?: string[];
  /** SHA-256 (hex) of normalizeForHash(text) for exact commands IT has approved. */
  approvedHashes?: string[];
}

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** One reason the engine raised (or lowered) the risk. */
export interface Finding {
  /** Stable id, also the key into the explanation templates. */
  id: string;
  /** 'behaviour' comes from the command text, 'context' from custody and target. */
  kind: 'behaviour' | 'obfuscation' | 'context';
  weight: number;
  severity: Severity;
  /** Values interpolated into the explanation, e.g. { host: "example-lure.test" }. */
  params?: Record<string, string>;
}

export type Action = 'allow' | 'warn' | 'block';

export interface Verdict {
  action: Action;
  /** 0-100 after context adjustments. */
  risk: number;
  findings: Finding[];
  /** Every decoded layer, outermost first; layers[0] is the normalised input. */
  layers: string[];
  /** Hosts the command talks to, after decoding. */
  hosts: string[];
  /** How each layer was reached: the decode path, step by step (parallel to `layers`). */
  trace: TraceStep[];
  target: PasteTarget;
  /** Engine time in milliseconds. */
  ms: number;
}

export type Lang = 'en' | 'hi' | 'kn';

/** A disguise the deobfuscator can undo. */
export type Trick =
  | 'invisible-chars'
  | 'caret-escapes'
  | 'backtick-escapes'
  | 'quote-splitting'
  | 'string-splitting'
  | 'format-reorder'
  | 'string-replace'
  | 'char-codes'
  | 'env-slicing'
  | 'variable-indirection'
  | 'base64'
  | 'hex'
  | 'url-encoding'
  | 'padding';

export interface TraceStep {
  /** The text at this step, after simplification. */
  text: string;
  /** Step it was decoded from; null for what was pasted. */
  from: number | null;
  /** Decoder that produced it from that step. */
  decodedBy: Trick | null;
  /** Disguises undone within this step. */
  undid: Trick[];
}

export interface Explanation {
  lang: Lang;
  headline: string;
  /** What the command would do, one plain sentence per behaviour. */
  details: string[];
  /** Where it came from, when custody is known. */
  provenance?: string;
  advice: string;
}
