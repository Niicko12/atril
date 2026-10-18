import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ExportBar } from '@/modules/export';

import { emptyScore } from '@/core';
import {
  InputDock,
  ScoreMetaForm,
  ViewBar,
  selectInstrument,
  useKeyboardShortcuts,
  useNoteInput,
  useScoreStore,
} from '@/modules/editor';
import {
  InstallHint,
  SaveBadge,
  libraryStrings as L,
  loadLibraryOverlay,
  prepareReplace,
  startAutosave,
  useTabGuard,
} from '@/modules/library';
import { playbackEngine } from '@/modules/playback';
import { ScoreSheet, ScoreStatus } from '@/modules/score-view';
import { buttonStyles as b } from '@/shared/components/overlay';
import { useArmed } from '@/shared/hooks/use-armed';
import { Toast } from '@/shared/toast';
import styles from './app-shell.module.css';

const LibraryOverlay = lazy(loadLibraryOverlay);

function togglePlay(): void {
  if (playbackEngine.isPlaying) return playbackEngine.stopAll();
  const s = useScoreStore.getState();
  playbackEngine.play({
    notes: s.score.notes,
    fromIndex: Math.max(0, s.selection),
    tempo: s.score.tempo,
    timbre: selectInstrument(s).timbre,
  });
}

async function newScore(): Promise<void> {
  if (!(await prepareReplace())) return;
  useScoreStore.getState().replaceScore(emptyScore(useScoreStore.getState().score.instrumentId));
  scrollTo({ top: 0 });
}

/** Layout de atril (editor-spec 2) con biblioteca y guardado automático (library-spec). */
export function AppShell() {
  const [library, setLibrary] = useState(false);
  const enter = useNoteInput();
  const enterFromKeyboard = useCallback(
    (midi: number) => enter(midi, document.querySelector<HTMLElement>(`[data-midi="${midi}"]`)),
    [enter],
  );
  const isOverlayOpen = useCallback(() => library, [library]);
  useKeyboardShortcuts({ enter: enterFromKeyboard, togglePlay, isOverlayOpen });
  useEffect(() => startAutosave(), []);
  const { otherTabOpen, otherTabSaved } = useTabGuard();
  const fresh = useArmed(() => void newScore());
  const closeLibrary = useCallback(() => setLibrary(false), []);

  return (
    <>
      <main className={styles.wrap}>
        <header className={styles.top}>
          <div className={styles.brand}>
            <h1>Atril</h1>
            <p>Escribe, escucha y transporta partituras para tu instrumento</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={b.btn} onClick={() => setLibrary(true)}>
              {L.library}
            </button>
            <button type="button" className={`${b.btn} ${fresh.armed ? b.warn : ''}`} onClick={fresh.press}>
              {fresh.armed ? '¿Empezar de cero?' : 'Nueva'}
            </button>
          </div>
        </header>
        <InstallHint />
        {(otherTabOpen || otherTabSaved) && (
          <p className={styles.banner}>{otherTabSaved ? L.otherTabSaved : L.otherTab}</p>
        )}
        <ScoreMetaForm />
        <ViewBar />
        <ScoreSheet />
        <div className={styles.statusRow}>
          <ScoreStatus />
          <SaveBadge />
        </div>
        <ExportBar />
        <Toast />
      </main>
      <InputDock />
      {library && (
        <Suspense fallback={null}>
          <LibraryOverlay onClose={closeLibrary} />
        </Suspense>
      )}
    </>
  );
}
