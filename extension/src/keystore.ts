// The device's signing key, kept in the extension's IndexedDB. CryptoKey objects
// are stored as-is, so the private half stays non-extractable: it signs exports
// but no script, including this extension's, can read it out.

import { generateDeviceKey, keyIdOf } from '@owlcept/engine';

const DB = 'owlcept';
const STORE = 'keys';
const SLOT = 'device';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let cached: Promise<CryptoKeyPair> | null = null;

/** This device's key pair, created on first use. */
export function deviceKeys(): Promise<CryptoKeyPair> {
  cached ??= (async () => {
    const db = await open();
    const existing = await tx<CryptoKeyPair | undefined>(db, 'readonly', (s) => s.get(SLOT));
    if (existing?.privateKey && existing.publicKey) return existing;
    const fresh = await generateDeviceKey();
    await tx(db, 'readwrite', (s) => s.put(fresh, SLOT));
    return fresh;
  })();
  return cached;
}

export async function deviceKeyId(): Promise<string> {
  return keyIdOf((await deviceKeys()).publicKey);
}
