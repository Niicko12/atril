// Base IndexedDB `atril` (technical-decisions 7, library-spec 4). Sin dependencias.
export const DB_NAME = 'atril';
export const DB_VERSION = 1;
export type StoreName = 'scores' | 'audio' | 'prefs';

type Migration = (db: IDBDatabase) => void;

const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: (db) => {
    const scores = db.createObjectStore('scores', { keyPath: 'id' });
    scores.createIndex('by_updated', 'updatedAt');
    scores.createIndex('by_deleted', 'deletedAt');
    const audio = db.createObjectStore('audio', { keyPath: 'id' });
    audio.createIndex('by_score', 'scoreId');
    db.createObjectStore('prefs');
  },
};

export class StorageError extends Error {
  constructor(
    public readonly kind: 'unavailable' | 'quota' | 'blocked',
    message: string,
  ) {
    super(message);
  }
}

export function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(toStorageError(req.error));
  });
}

export function toStorageError(e: unknown): StorageError {
  const name = (e as DOMException | null)?.name;
  if (name === 'QuotaExceededError') return new StorageError('quota', 'Sin espacio');
  return new StorageError('unavailable', String((e as Error | null)?.message ?? e));
}

let opening: Promise<IDBDatabase> | null = null;
const listeners = new Set<(event: 'blocked' | 'versionchange') => void>();

export const onDbEvent = (fn: (event: 'blocked' | 'versionchange') => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Abre (una vez por pestaña) y migra la base. */
export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      for (let v = ev.oldVersion + 1; v <= DB_VERSION; v++) MIGRATIONS[v]?.(req.result);
    };
    req.onblocked = () => listeners.forEach((fn) => fn('blocked'));
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
        listeners.forEach((fn) => fn('versionchange'));
      };
      resolve(db);
    };
    req.onerror = () => reject(toStorageError(req.error));
  }).catch((e: unknown) => {
    opening = null;
    throw e instanceof StorageError ? e : toStorageError(e);
  });
  return opening;
}

/** Ejecuta una operación en una transacción y espera a que termine. */
export async function tx<T>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  const t = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(toStorageError(t.error));
    t.onabort = () => reject(toStorageError(t.error));
  });
  const result = await fn(t);
  await done;
  return result;
}

/** ¿Hay IndexedDB usable? (modo privado antiguo, navegadores integrados). Timeout de 2 s. */
export async function isIndexedDbAvailable(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<boolean> {
  if (!factory) return false;
  const probe = new Promise<boolean>((resolve) => {
    try {
      const req = factory.open('atril-probe');
      req.onsuccess = () => {
        req.result.close();
        resolve(true);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));
  return Promise.race([probe, timeout]);
}

export async function deleteDatabase(): Promise<void> {
  const db = await opening?.catch(() => null);
  db?.close();
  opening = null;
  await requestToPromise(indexedDB.deleteDatabase(DB_NAME) as unknown as IDBRequest<unknown>);
}

/** Solo para tests. */
export function resetDbForTests(): void {
  opening = null;
}
