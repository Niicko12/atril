import { useCallback } from 'react';
import {
  InputDock,
  ScoreMetaForm,
  ViewBar,
  selectInstrument,
  useKeyboardShortcuts,
  useNoteInput,
  useScoreStore,
} from '@/modules/editor';
import { playbackEngine } from '@/modules/playback';
import { ScoreSheet, ScoreStatus } from '@/modules/score-view';
import { Toast } from '@/shared/toast';
import styles from './app-shell.module.css';

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

/** Layout de atril: cabecera, formulario, vista, hoja, estado y dock de entrada (editor-spec 2). */
export function AppShell() {
  const enter = useNoteInput();
  const enterFromKeyboard = useCallback(
    (midi: number) => enter(midi, document.querySelector<HTMLElement>(`[data-midi="${midi}"]`)),
    [enter],
  );
  useKeyboardShortcuts({ enter: enterFromKeyboard, togglePlay });
  return (
    <>
      <main className={styles.wrap}>
        <header className={styles.brand}>
          <h1>Atril</h1>
          <p>Escribe, escucha y transporta partituras para tu instrumento</p>
        </header>
        <ScoreMetaForm />
        <ViewBar />
        <ScoreSheet />
        <ScoreStatus />
        <Toast />
      </main>
      <InputDock />
    </>
  );
}
