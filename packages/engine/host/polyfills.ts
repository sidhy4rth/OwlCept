// Minimal stand-ins for the web APIs the engine uses, for hosts that embed a
// bare JavaScript engine (the Windows agent runs it in Jint). Each is only
// installed when the host does not already provide it.

const g = globalThis as Record<string, unknown>;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

if (typeof g.atob !== 'function') {
  g.atob = (input: string): string => {
    const s = String(input).replace(/[\t\n\f\r ]+/g, '').replace(/=+$/, '');
    if (s.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(s)) throw new Error('InvalidCharacterError');
    let out = '';
    let buf = 0;
    let bits = 0;
    for (const c of s) {
      buf = (buf << 6) | B64.indexOf(c);
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out += String.fromCharCode((buf >> bits) & 0xff);
      }
    }
    return out;
  };
}

if (typeof g.TextDecoder !== 'function') {
  g.TextDecoder = class {
    private readonly enc: string;
    constructor(encoding = 'utf-8') {
      this.enc = encoding.toLowerCase();
    }
    decode(bytes: Uint8Array): string {
      if (this.enc === 'utf-16le') {
        let s = '';
        for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
        return s;
      }
      let s = '';
      for (let i = 0; i < bytes.length; ) {
        const b = bytes[i];
        if (b < 0x80) {
          s += String.fromCharCode(b);
          i++;
          continue;
        }
        // Continuation bytes that follow a 110xxxxx / 1110xxxx / 11110xxx lead byte.
        const need = b >= 0xf0 && b < 0xf8 ? 3 : b >= 0xe0 && b < 0xf0 ? 2 : b >= 0xc0 && b < 0xe0 ? 1 : 0;
        let cp = b & (0x3f >> need);
        let k = 1;
        for (; need && k <= need; k++) {
          const c = bytes[i + k];
          if (c === undefined || (c & 0xc0) !== 0x80) break;
          cp = (cp << 6) | (c & 0x3f);
        }
        if (!need || k <= need) {
          s += '�';
          i++;
          continue;
        }
        s += String.fromCodePoint(cp);
        i += need + 1;
      }
      return s;
    }
  };
}

if (typeof g.URLSearchParams !== 'function') {
  g.URLSearchParams = class {
    private readonly map = new Map<string, string>();
    constructor(init = '') {
      const dec = (v: string) => {
        try {
          return decodeURIComponent(v.replace(/\+/g, ' '));
        } catch {
          return v;
        }
      };
      for (const part of String(init).replace(/^\?/, '').split('&')) {
        if (!part) continue;
        const i = part.indexOf('=');
        const k = dec(i < 0 ? part : part.slice(0, i));
        if (!this.map.has(k)) this.map.set(k, i < 0 ? '' : dec(part.slice(i + 1)));
      }
    }
    get(k: string): string | null {
      return this.map.has(k) ? this.map.get(k)! : null;
    }
    has(k: string): boolean {
      return this.map.has(k);
    }
  };
}

if (typeof g.URL !== 'function') {
  g.URL = class {
    readonly href: string;
    readonly protocol: string;
    readonly hostname: string;
    readonly port: string;
    readonly pathname: string;
    readonly search: string;
    readonly hash: string;
    constructor(input: string) {
      const m = /^([a-z][a-z0-9+.\-]*:)\/\/(?:[^@\/?#]*@)?(\[[^\]]+\]|[^:\/?#]*)(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(String(input).trim());
      if (!m) throw new TypeError('Invalid URL');
      this.protocol = m[1].toLowerCase();
      this.hostname = m[2].toLowerCase();
      this.port = m[3] ?? '';
      this.pathname = m[4] || '/';
      this.search = m[5] && m[5] !== '?' ? m[5] : '';
      this.hash = m[6] && m[6] !== '#' ? m[6] : '';
      this.href = `${this.protocol}//${this.hostname}${this.port ? `:${this.port}` : ''}${this.pathname}${this.search}${this.hash}`;
    }
  };
}
