import { create } from 'zustand';
import { SAMPLES, fromSample, type Sample } from '@/core';
import { isIndexedDbAvailable, StorageError } from '@/infra/idb';
import { useScoreStore } from '@/modules/editor';
import { useModeStore } from '@/shared/prefs/mode.store';
import { toast } from '@/shared/toast';
import { useSaveStore } from '../store/save.store';
import { S } from '../strings';
import { askPersistOnce } from './persistence';
import { prefs } from './prefs.service';
import { scoreRepository } from './score-repository';

export const AUTOSAVE_DELAY_MS = 800;

/** Versión de la biblioteca: sube con cada guardado para refrescar la lista (sustituye a TanStack Query). */
export const useLibraryVersion = create<{ v: number; bump(): void }>((set) => ({
  v: 0,
  bump: () => set((s) => ({ v: s.v + 1 })),
}));

let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
const savedListeners = new Set<(id: string, updatedAt: string) => void>();
export const onSaved = (fn: (id: string, updatedAt: string) => void) => (
  savedListeners.add(fn),
  () => savedListeners.delete(fn)
);

const message = (e: unknown) =>
  e instanceof StorageError && e.kind === 'quota' ? S.storageQuota : S.storageUnavailable;

async function saveNow(): Promise<void> {
  const s = useScoreStore.getState();
  if (useSaveStore.getState().memoryOnly || s.revision === s.loadedRevision || !s.dirty) return;
  useSaveStore.getState().set({ kind: 'saving' });
  try {
    const { updatedAt, restoredFromTrash } = await scoreRepository.save(s.score);
    if (useScoreStore.getState().revision === s.revision) useScoreStore.getState().markSaved(updatedAt);
    useSaveStore.getState().set({ kind: 'saved', at: updatedAt });
    useLibraryVersion.getState().bump();
    savedListeners.forEach((fn) => fn(s.score.id, updatedAt));
    if (restoredFromTrash) toast(S.restoredByEdit);
    await prefs.set('lastOpenId', s.score.id);
    await askPersistOnce();
  } catch (e) {
    useSaveStore.getState().set({ kind: 'error', message: message(e) });
  }
}

function run(): Promise<void> {
  running = (running ?? Promise.resolve()).then(saveNow).finally(() => (running = null));
  return running;
}

export function scheduleSave(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void run();
  }, AUTOSAVE_DELAY_MS);
}

/** Guarda ya lo pendiente (library-spec 6.1). */
export async function flushSave(): Promise<void> {
  const pending = timer !== null;
  if (timer) clearTimeout(timer);
  timer = null;
  if (pending) await run();
  else await running;
}

/** Antes de reemplazar la partitura: la actual queda guardada. false si no se pudo (no reemplazar). */
export async function prepareReplace(): Promise<boolean> {
  const hadChanges =
    useScoreStore.getState().dirty && useScoreStore.getState().revision !== useScoreStore.getState().loadedRevision;
  await flushSave();
  if (useSaveStore.getState().state.kind === 'error') return false;
  if (hadChanges) toast(S.keptPrevious);
  return true;
}

/** Arranque: abre la última partitura o el primer ejemplo (library-spec 7.1). */
export async function bootLibrary(): Promise<void> {
  if (!(await isIndexedDbAvailable())) {
    prefs.useMemoryOnly();
    useSaveStore.getState().setMemoryOnly(true);
    return;
  }
  try {
    useModeStore.getState().setMode(await prefs.get('inputMode'));
    const id = await prefs.get('lastOpenId');
    const score = id ? await scoreRepository.get(id) : null;
    const instrument = await prefs.get('defaultInstrument');
    useScoreStore.getState().replaceScore(score ?? fromSample(SAMPLES[0] as Sample, instrument));
    if (score) useSaveStore.getState().set({ kind: 'saved', at: score.savedAt ?? '' });
    void scoreRepository.purgeExpired(30);
  } catch {
    useSaveStore.getState().setMemoryOnly(true);
  }
}

/** Suscripciones: cambios del editor, modo de entrada, salida de la página. Devuelve la función para quitarlas. */
export function startAutosave(): () => void {
  const offScore = useScoreStore.subscribe((s, prev) => {
    if (s.revision !== prev.revision && s.revision !== s.loadedRevision) scheduleSave();
    if (s.score.instrumentId !== prev.score.instrumentId) void prefs.set('defaultInstrument', s.score.instrumentId);
  });
  const offMode = useModeStore.subscribe((m) => void prefs.set('inputMode', m.mode));
  const onHide = () => document.visibilityState === 'hidden' && void flushSave();
  const onPageHide = () => void flushSave();
  document.addEventListener('visibilitychange', onHide);
  addEventListener('pagehide', onPageHide);
  return () => {
    offScore();
    offMode();
    document.removeEventListener('visibilitychange', onHide);
    removeEventListener('pagehide', onPageHide);
  };
}
