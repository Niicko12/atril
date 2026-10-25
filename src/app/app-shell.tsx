import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { loadHelpOverlay } from '@/modules/help';
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
import { LazyPanelBoundary } from '@/shared/components/lazy-panel';
import { Toast } from '@/shared/toast';
import styles from './app-shell.module.css';
import { ImportWarnings, importStrings as I, loadFindOverlay } from '@/modules/import';
import { earStrings as E, loadEarPanel } from '@/modules/ear';

const LibraryOverlay = lazy(loadLibraryOverlay);
const FindOverlay = lazy(loadFindOverlay);
const EarPanel = lazy(loadEarPanel);
const HelpOverlay = lazy(loadHelpOverlay);

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
  const [find, setFind] = useState(false);
  const [ear, setEar] = useState(false);
  const [help, setHelp] = useState(false);
  const enter = useNoteInput();
  const enterFromKeyboard = useCallback(
    (midi: number) => enter(midi, document.querySelector<HTMLElement>(`[data-midi="${midi}"]`)),
    [enter],
  );
  const isOverlayOpen = useCallback(() => library || find || help, [library, find, help]);
  useKeyboardShortcuts({ enter: enterFromKeyboard, togglePlay, isOverlayOpen });
  useEffect(() => startAutosave(), []);
  const { otherTabOpen, otherTabSaved } = useTabGuard();
  const fresh = useArmed(() => void newScore());
  const closeLibrary = useCallback(() => setLibrary(false), []);
  const closeFind = useCallback(() => setFind(false), []);
  const closeHelp = useCallback(() => setHelp(false), []);
  const closeEar = useCallback(() => setEar(false), []);

  return (
    <>
      <main className={styles.wrap}>
        <header className={styles.top}>
          <div className={styles.brand}>
            <h1>Atril</h1>
            <p>Escribe, escucha y transporta partituras para tu instrumento</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={b.btn} onClick={() => setHelp(true)}>
              Ayuda
            </button>
            <button type="button" className={`${b.btn} ${b.primary}`} onClick={() => setFind(true)}>
              {I.find}
            </button>
            <button type="button" className={b.btn} aria-pressed={ear} onClick={() => setEar((v) => !v)}>
              {E.open}
            </button>
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
        {ear && (
          <Suspense fallback={null}>
            <LazyPanelBoundary onClose={closeEar}>
              <EarPanel onClose={closeEar} />
            </LazyPanelBoundary>
          </Suspense>
        )}
        <ImportWarnings />
        <ScoreSheet />
        <div className={styles.statusRow}>
          <ScoreStatus />
          <SaveBadge />
        </div>
        <ExportBar />
        <Toast />
      </main>
      <InputDock />
      {find && (
        <Suspense fallback={null}>
          <LazyPanelBoundary onClose={closeFind}>
            <FindOverlay onClose={closeFind} />
          </LazyPanelBoundary>
        </Suspense>
      )}
      {help && (
        <Suspense fallback={null}>
          <LazyPanelBoundary onClose={closeHelp}>
            <HelpOverlay
              onClose={closeHelp}
              onEar={() => {
                setHelp(false);
                setEar(true);
              }}
              onLibrary={() => {
                setHelp(false);
                setLibrary(true);
              }}
            />
          </LazyPanelBoundary>
        </Suspense>
      )}
      {library && (
        <Suspense fallback={null}>
          <LazyPanelBoundary onClose={closeLibrary}>
            <LibraryOverlay onClose={closeLibrary} />
          </LazyPanelBoundary>
        </Suspense>
      )}
    </>
  );
}
