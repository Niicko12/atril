import type { InstrumentId } from '@/core';
import type { EditorMode } from '@/shared/prefs/mode.store';
import { requestToPromise, tx } from '@/infra/idb';

/** Preferencias en el store `prefs` (library-spec 15). */
export interface Prefs {
  inputMode: EditorMode;
  defaultInstrument: InstrumentId;
  lastOpenId: string | null;
  lastBackupAt: string | null;
  lastBackupCount: number;
  persistAsked: boolean;
  persistGranted: boolean;
  installHintShownAt: string | null;
  installHintDismissed: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  inputMode: 'piano',
  defaultInstrument: 'piano',
  lastOpenId: null,
  lastBackupAt: null,
  lastBackupCount: 0,
  persistAsked: false,
  persistGranted: false,
  installHintShownAt: null,
  installHintDismissed: false,
};

let cache: Partial<Prefs> = {};
let memoryOnly = false;

export const prefs = {
  /** Sin IndexedDB las preferencias viven solo en memoria. */
  useMemoryOnly(): void {
    memoryOnly = true;
  },
  async get<K extends keyof Prefs>(key: K): Promise<Prefs[K]> {
    if (key in cache) return cache[key] as Prefs[K];
    if (memoryOnly) return DEFAULT_PREFS[key];
    const v = (await tx('prefs', 'readonly', (t) => requestToPromise(t.objectStore('prefs').get(key)))) as
      Prefs[K] | undefined;
    cache[key] = v ?? DEFAULT_PREFS[key];
    return cache[key] as Prefs[K];
  },
  async set<K extends keyof Prefs>(key: K, value: Prefs[K]): Promise<void> {
    cache[key] = value;
    if (!memoryOnly) await tx('prefs', 'readwrite', (t) => void t.objectStore('prefs').put(value, key));
  },
  resetForTests(): void {
    cache = {};
    memoryOnly = false;
  },
};
