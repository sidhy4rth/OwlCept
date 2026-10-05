// Signed activity exports. Each browser profile holds an ECDSA P-256 key whose
// private half is non-extractable; an export is signed over a canonical form of
// exactly the fields parseReport keeps, so the fleet view can tell an untouched
// export from one edited on the way (shared drive, USB stick, email).
//
// What a signature proves: the file is what that key signed. It does not prove
// the key belongs to a PC IT trusts; the fleet view shows each device's key id so
// it can be compared with the one on that PC's dashboard, and flags a device
// whose key changes between files.

import { parseReport, type ActivityReport } from './activity.ts';

export interface ReportSignature {
  alg: 'ES256';
  /** Public half of the device key. */
  publicKey: { kty: 'EC'; crv: 'P-256'; x: string; y: string };
  /** First 16 hex digits of SHA-256 over the raw public key: what a person compares. */
  keyId: string;
  /** base64url of the 64-byte r||s signature. */
  value: string;
}

export type SignedReport = ActivityReport & { signature?: ReportSignature };

export interface Verification {
  status: 'verified' | 'unsigned' | 'invalid';
  keyId?: string;
  reason?: string;
}

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto is not available here.');
  return s;
};
const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const;

/** JSON with sorted keys and no whitespace: the same object always gives the same bytes. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(',')}}`;
}

/** The bytes that are signed: the report as parseReport keeps it, without the signature. */
export function signingPayload(report: ActivityReport): string {
  const { signature: _drop, ...rest } = report as SignedReport;
  return canonicalJson(parseReport(JSON.stringify(rest)));
}

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A new device key; the private half cannot be exported. */
export function generateDeviceKey(): Promise<CryptoKeyPair> {
  return subtle().generateKey(ALG, false, ['sign', 'verify']) as Promise<CryptoKeyPair>;
}

export async function keyIdOf(publicKey: CryptoKey): Promise<string> {
  const raw = await subtle().exportKey('raw', publicKey);
  return hex(await subtle().digest('SHA-256', raw)).slice(0, 16);
}

export async function signReport(report: ActivityReport, keys: CryptoKeyPair): Promise<SignedReport> {
  const jwk = await subtle().exportKey('jwk', keys.publicKey);
  const sig = await subtle().sign(SIGN, keys.privateKey, new TextEncoder().encode(signingPayload(report)));
  return {
    ...report,
    signature: { alg: 'ES256', publicKey: { kty: 'EC', crv: 'P-256', x: jwk.x!, y: jwk.y! }, keyId: await keyIdOf(keys.publicKey), value: b64url(sig) },
  };
}

const B64URL = /^[A-Za-z0-9_-]+$/;

/** Reads the signature block from an untrusted file; null when absent or malformed. */
export function readSignature(raw: unknown): ReportSignature | null {
  const s = (raw as { signature?: Record<string, unknown> })?.signature;
  const k = s?.publicKey as Record<string, unknown> | undefined;
  if (!s || s.alg !== 'ES256' || !k || k.kty !== 'EC' || k.crv !== 'P-256') return null;
  if (![k.x, k.y].every((v) => typeof v === 'string' && v.length === 43 && B64URL.test(v))) return null;
  if (typeof s.value !== 'string' || s.value.length !== 86 || !B64URL.test(s.value)) return null;
  if (typeof s.keyId !== 'string' || !/^[0-9a-f]{16}$/.test(s.keyId)) return null;
  return { alg: 'ES256', publicKey: { kty: 'EC', crv: 'P-256', x: k.x as string, y: k.y as string }, keyId: s.keyId, value: s.value };
}

/** Checks an export. `rawJson` is the file text; the report is what parseReport made of it. */
export async function verifyReport(rawJson: string): Promise<Verification> {
  let raw: unknown;
  try {
    raw = JSON.parse(rawJson);
  } catch {
    return { status: 'invalid', reason: 'not JSON' };
  }
  const hasBlock = !!(raw as { signature?: unknown })?.signature;
  const sig = readSignature(raw);
  if (!sig) return hasBlock ? { status: 'invalid', reason: 'malformed signature' } : { status: 'unsigned' };
  try {
    const key = await subtle().importKey('jwk', { ...sig.publicKey, ext: true }, ALG, true, ['verify']);
    const keyId = await keyIdOf(key);
    if (keyId !== sig.keyId) return { status: 'invalid', keyId, reason: 'key id does not match the key' };
    const ok = await subtle().verify(SIGN, key, fromB64url(sig.value), new TextEncoder().encode(signingPayload(parseReport(rawJson))));
    return ok ? { status: 'verified', keyId } : { status: 'invalid', keyId, reason: 'contents changed after signing' };
  } catch {
    return { status: 'invalid', reason: 'unusable key or signature' };
  }
}
