// Peels the disguises attackers put on paste-and-run commands so the rules
// see what will actually execute. Everything here is static text rewriting:
// nothing is ever evaluated.

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

export interface Decoded {
  /** layers[0] is the simplified input; later entries are decoded payloads. */
  layers: string[];
  tricks: Set<Trick>;
  /** Trailing comments that were split off ("# I am not a robot ..."). */
  comments: string[];
  /** True when the time budget ran out with decoding work left undone. */
  incomplete: boolean;
}

const ZERO_WIDTH = /[\u200B-\u200D\u2060\u180E\uFEFF]/g;
const ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const MAX_DEPTH = 4;
const MAX_PASSES = 6;

// Default values used to resolve %VAR:~n,m% and $env:VAR[i] slicing.
// Real attacks lean on variables whose value is the same on every machine.
const ENV: Record<string, string> = {
  comspec: 'C:\\WINDOWS\\system32\\cmd.exe',
  windir: 'C:\\WINDOWS',
  systemroot: 'C:\\WINDOWS',
  systemdrive: 'C:',
  public: 'C:\\Users\\Public',
  programdata: 'C:\\ProgramData',
  allusersprofile: 'C:\\ProgramData',
  programfiles: 'C:\\Program Files',
  'programfiles(x86)': 'C:\\Program Files (x86)',
  commonprogramfiles: 'C:\\Program Files\\Common Files',
  pathext: '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC',
  os: 'Windows_NT',
  processor_architecture: 'AMD64',
  psmodulepath: 'C:\\Program Files\\WindowsPowerShell\\Modules;C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules',
  driverdata: 'C:\\Windows\\System32\\Drivers\\DriverData',
};

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** `deadline` is a clock() time; work still left when it passes is skipped and reported as incomplete. */
export function deobfuscate(input: string, deadline = Infinity): Decoded {
  const out: Decoded = { layers: [], tricks: new Set(), comments: [], incomplete: false };
  const seen = new Set<string>();
  walk(input, 0, out, seen, deadline);
  return out;
}

function walk(raw: string, depth: number, out: Decoded, seen: Set<string>, deadline: number): void {
  const text = simplify(normalise(raw, out.tricks), out, deadline);
  if (seen.has(text)) return;
  seen.add(text);
  out.layers.push(text);
  if (depth >= MAX_DEPTH) return;
  for (const inner of decodeBlobs(text, out.tricks)) {
    if (clock() > deadline) {
      out.incomplete = true;
      return;
    }
    walk(inner, depth + 1, out, seen, deadline);
  }
}

// ---------------------------------------------------------------- normalise

function normalise(s: string, tricks: Set<Trick>): string {
  if (ZERO_WIDTH.test(s)) tricks.add('invisible-chars');
  return s
    .replace(ZERO_WIDTH, '')
    .replace(ODD_SPACES, ' ')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\r\n?/g, '\n');
}

// ---------------------------------------------------------------- simplify

function simplify(s: string, out: Decoded, deadline: number): string {
  const t = out.tricks;
  s = splitComment(s, out);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (pass > 0 && clock() > deadline) {
      out.incomplete = true;
      break;
    }
    const before = s;
    s = unescape(s, t);
    s = charCodes(s, t);
    s = envSlicing(s, t);
    s = stringReplace(s, t);
    s = formatOperator(s, t);
    s = foldConcat(s, t);
    s = substituteVariables(s, t);
    if (s === before) break;
  }
  return s.replace(/[ \t]{2,}/g, ' ').trim();
}

/** Splits a trailing decoy comment off the command and records padding. */
function splitComment(s: string, out: Decoded): string {
  if (/[ \t]{25,}/.test(s)) out.tricks.add('padding');
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    // PowerShell comment: '#' at the start of a token.
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      out.comments.push(s.slice(i + 1).trim());
      return s.slice(0, i);
    }
    // cmd comments chained after '&': "& rem ..." or "& :: ..."
    if (c === '&') {
      const m = /^&\s*(?:rem\b|::)(.*)$/is.exec(s.slice(i));
      if (m) {
        out.comments.push(m[1].trim());
        return s.slice(0, i);
      }
    }
  }
  return s;
}

function unescape(s: string, t: Set<Trick>): string {
  if ((s.match(/\w\^\w/g) ?? []).length >= 2) t.add('caret-escapes');
  if ((s.match(/\w`\w/g) ?? []).length >= 2) t.add('backtick-escapes');
  s = s.replace(/\^(.)/gs, '$1');
  s = s.replace(/`\n/g, ' ').replace(/`([A-Za-z\-])/g, '$1');
  // p''ower""shell and p"ow"ershell both still run; collapse them.
  const collapsed = s
    .replace(/(\w)(?:''|"")(?=\w)/g, '$1')
    .replace(/\b([A-Za-z]+)"([A-Za-z]+)"([A-Za-z]*)\b/g, '$1$2$3');
  if (collapsed !== s) t.add('quote-splitting');
  return collapsed;
}

function charCodes(s: string, t: Set<Trick>): string {
  const toChar = (n: string) => String.fromCharCode(n.toLowerCase().startsWith('0x') ? parseInt(n, 16) : parseInt(n, 10));
  const quoted = (v: string) => `'${v.replace(/'/g, '')}'`;
  let r = s.replace(/\[char\[\]\]\s*\(\s*((?:(?:0x[0-9a-f]+|\d+)\s*,\s*)*(?:0x[0-9a-f]+|\d+))\s*\)/gi, (_m, list: string) =>
    quoted(list.split(',').map((n) => toChar(n.trim())).join('')),
  );
  r = r.replace(/\[char\]\s*\(?\s*(0x[0-9a-f]+|\d+)\s*\)?/gi, (_m, n: string) => quoted(toChar(n)));
  // (105,101,120|%{[char]$_})-join'' style
  r = r.replace(/\(\s*((?:\d+\s*,\s*){2,}\d+)\s*\|\s*(?:%|foreach(?:-object)?)\s*\{\s*\[char\]\s*\$_\s*\}\s*\)/gi, (_m, list: string) =>
    quoted(list.split(',').map((n) => toChar(n.trim())).join('')),
  );
  if (r !== s) t.add('char-codes');
  return r.replace(/'\s*-join\s*(?:''|"")/gi, "'").replace(/-join\s*('[^']*')/gi, '$1');
}

function sliceEnv(name: string, start: number, len?: number): string | null {
  const v = ENV[name.toLowerCase()];
  if (v === undefined) return null;
  let from = start < 0 ? Math.max(0, v.length + start) : start;
  let to = v.length;
  if (len !== undefined) to = len < 0 ? v.length + len : from + len;
  return v.slice(from, Math.max(from, to));
}

function envSlicing(s: string, t: Set<Trick>): string {
  let r = s.replace(/%([\w()]+):~(-?\d+)(?:,(-?\d+))?%/g, (m, name: string, a: string, b?: string) => {
    const v = sliceEnv(name, Number(a), b === undefined ? undefined : Number(b));
    return v === null ? m : v;
  });
  r = r.replace(/\$env:([\w()]+)\[\s*((?:-?\d+\s*,\s*)*-?\d+)\s*\]/gi, (m, name: string, idx: string) => {
    const v = ENV[name.toLowerCase()];
    if (v === undefined) return m;
    const chars = idx.split(',').map((i) => {
      const n = Number(i.trim());
      return v[n < 0 ? v.length + n : n] ?? '';
    });
    return `'${chars.join('')}'`;
  });
  if (r !== s) {
    t.add('env-slicing');
    r = r.replace(/'\s*-join\s*(?:''|"")/gi, "'");
  }
  return r;
}

/**
 * End (exclusive) of the quoted literal that opens at s[i], or -1 if it does not
 * close on the same line. Linear overall: on any line at most one ' and one "
 * can be left open, so the scans to end-of-line are bounded.
 */
function literalEnd(s: string, i: number): number {
  const q = s[i];
  for (let k = i + 1; k < s.length; k++) {
    if (s[k] === q) return k + 1;
    if (s[k] === '\n') return -1;
  }
  return -1;
}

const isQuote = (c: string | undefined) => c === "'" || c === '"';

// The tail after a literal: .Replace('a','b') or -replace 'a','b' (sticky, tried only where a literal ends).
const REPLACE_TAIL = /\s*(?:\.replace\(\s*|-replace\s*\(?\s*)(['"])([^\n]*?)\1\s*,\s*(['"])([^\n]*?)\3\s*\)?/iy;

function stringReplace(s: string, t: Set<Trick>): string {
  if (!/replace/i.test(s)) return s;
  let out = '';
  let i = 0;
  let changed = false;
  while (i < s.length) {
    if (!isQuote(s[i])) {
      out += s[i++];
      continue;
    }
    const end = literalEnd(s, i);
    if (end < 0) {
      out += s[i++];
      continue;
    }
    const q = s[i];
    let body = s.slice(i + 1, end - 1);
    let j = end;
    // Chains like 'x'.replace('a','b').replace('c','d') apply in order.
    for (;;) {
      REPLACE_TAIL.lastIndex = j;
      const m = REPLACE_TAIL.exec(s);
      if (!m) break;
      if (m[2]) body = body.split(m[2]).join(m[4]);
      j = REPLACE_TAIL.lastIndex;
      changed = true;
    }
    out += q + body + q;
    i = j;
  }
  if (changed) t.add('string-replace');
  return changed ? out : s;
}

function formatOperator(s: string, t: Set<Trick>): string {
  const r = s.replace(
    /(?:\(\s*)?(['"])((?:\{\d+\}|[^'"{}])*\{\d+\}(?:\{\d+\}|[^'"{}])*)\1\s*-f\s*((?:(['"])(?:(?!\4).)*\4\s*,\s*)*(['"])(?:(?!\5).)*\5)\s*\)?/gi,
    (m, q: string, fmt: string, args: string) => {
      const parts = [...args.matchAll(/(['"])((?:(?!\1).)*)\1/g)].map((a) => a[2]);
      const filled = fmt.replace(/\{(\d+)\}/g, (_x, i: string) => parts[Number(i)] ?? '');
      return filled === fmt ? m : `${q}${filled}${q}`;
    },
  );
  if (r !== s) t.add('format-reorder');
  return r;
}

/** 'pow' + 'er' + "shell" → 'powershell', in one linear pass. */
function foldConcat(s: string, t: Set<Trick>): string {
  if (!s.includes('+')) return s;
  let out = '';
  let i = 0;
  let folds = 0;
  const skipSpace = (k: number) => {
    while (k < s.length && (s[k] === ' ' || s[k] === '\t')) k++;
    return k;
  };
  while (i < s.length) {
    if (!isQuote(s[i])) {
      out += s[i++];
      continue;
    }
    const end = literalEnd(s, i);
    if (end < 0) {
      out += s[i++];
      continue;
    }
    const q = s[i];
    let body = s.slice(i + 1, end - 1);
    let j = end;
    for (;;) {
      let k = skipSpace(j);
      if (s[k] !== '+') break;
      k = skipSpace(k + 1);
      if (!isQuote(s[k])) break;
      const e2 = literalEnd(s, k);
      if (e2 < 0) break;
      body += s.slice(k + 1, e2 - 1);
      j = e2;
      folds++;
    }
    out += q + body + q;
    i = j;
  }
  if (folds >= 2) t.add('string-splitting');
  return folds ? out : s;
}

/** Inlines `$x = 'literal'` (PowerShell) and `set x=literal` (cmd) so later rules see the value. */
function substituteVariables(s: string, t: Set<Trick>): string {
  const vars = new Map<string, string>();
  for (const m of s.matchAll(/\$(\w+)\s*=\s*(['"])((?:(?!\2).)*)\2/g)) vars.set(m[1].toLowerCase(), m[3]);
  const cmdVars = new Map<string, string>();
  for (const m of s.matchAll(/\bset\s+"?(\w+)=([^&"\n]*)"?/gi)) cmdVars.set(m[1].toLowerCase(), m[2].trim());

  let r = s;
  if (vars.size) {
    r = r.replace(/\$(\w+)\b(?!\s*=[^=])/g, (m, name: string) => vars.get(name.toLowerCase()) ?? m);
  }
  if (cmdVars.size) {
    r = r.replace(/%(\w+)%/g, (m, name: string) => cmdVars.get(name.toLowerCase()) ?? m);
  }
  if (r !== s && /(?:iex|invoke-expression|powershell|mshta|http)/i.test([...vars.values(), ...cmdVars.values()].join(' '))) {
    t.add('variable-indirection');
  }
  return r;
}

// ---------------------------------------------------------------- decoders

function printableRatio(s: string): number {
  if (!s.length) return 0;
  let ok = 0;
  for (const c of s) {
    const code = c.charCodeAt(0);
    if ((code >= 0x20 && code < 0x7f) || code === 9 || code === 10 || code === 13 || code > 0x9f) ok++;
  }
  return ok / s.length;
}

function base64Bytes(b64: string): Uint8Array | null {
  const clean = b64.replace(/\s+/g, '');
  if (clean.length < 8 || clean.length % 4 === 1) return null;
  try {
    const bin = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, '='));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** UTF-16LE when every second byte is zero (PowerShell -EncodedCommand), UTF-8 otherwise. */
function bytesToText(bytes: Uint8Array): string {
  let zeros = 0;
  for (let i = 1; i < bytes.length; i += 2) if (bytes[i] === 0) zeros++;
  const utf16 = bytes.length >= 4 && zeros / Math.floor(bytes.length / 2) > 0.8;
  return new TextDecoder(utf16 ? 'utf-16le' : 'utf-8', { fatal: false }).decode(bytes);
}

function decodeBase64Text(b64: string): string | null {
  const bytes = base64Bytes(b64);
  if (!bytes) return null;
  const text = bytesToText(bytes);
  return printableRatio(text) >= 0.9 && /[a-z]{3}/i.test(text) ? text : null;
}

function decodeBlobs(s: string, t: Set<Trick>): string[] {
  const found: string[] = [];
  const push = (v: string | null, trick: Trick) => {
    if (v && v.trim() && !found.includes(v)) {
      found.push(v);
      t.add(trick);
    }
  };

  // powershell -e / -ec / -enc / -EncodedCommand <base64>: any unique prefix works.
  for (const m of s.matchAll(/(?:^|\s)[-\/](?:e|ec|en|enc|enco|encod|encode|encoded|encodedc\w*)\s+["']?([A-Za-z0-9+\/=]{8,})/gi)) {
    push(decodeBase64Text(m[1]), 'base64');
  }
  // [Convert]::FromBase64String('...')
  for (const m of s.matchAll(/frombase64string\s*\(\s*["']([A-Za-z0-9+\/=\s]{8,})["']/gi)) push(decodeBase64Text(m[1]), 'base64');
  // echo <b64> | base64 -d   (macOS / Linux)
  for (const m of s.matchAll(/(?:echo|printf)\s+(?:-n\s+)?["']?([A-Za-z0-9+\/=]{12,})["']?\s*\|\s*base64\s+(?:-d|-D|--decode)/gi)) {
    push(decodeBase64Text(m[1]), 'base64');
  }
  // Any other long base64-looking token.
  for (const m of s.matchAll(/[A-Za-z0-9+\/]{40,}={0,2}/g)) {
    if (/^[0-9a-f]+$/i.test(m[0])) continue; // hashes and hex are handled below
    push(decodeBase64Text(m[0]), 'base64');
  }
  // Long hex strings and \x41 escapes.
  for (const m of s.matchAll(/\b(?:0x)?((?:[0-9a-fA-F]{2}){16,})\b/g)) {
    const text = m[1].match(/../g)!.map((h) => String.fromCharCode(parseInt(h, 16))).join('');
    if (printableRatio(text) >= 0.95 && /[a-z]{3}/i.test(text)) push(text, 'hex');
  }
  for (const m of s.matchAll(/(?:\\x[0-9a-fA-F]{2}){6,}/g)) {
    push(m[0].replace(/\\x([0-9a-fA-F]{2})/g, (_x, h: string) => String.fromCharCode(parseInt(h, 16))), 'hex');
  }
  // %69%65%78 url-encoding
  for (const m of s.matchAll(/(?:%[0-9a-fA-F]{2}){6,}/g)) {
    try {
      push(decodeURIComponent(m[0]), 'url-encoding');
    } catch {
      /* not valid UTF-8, ignore */
    }
  }
  return found;
}
