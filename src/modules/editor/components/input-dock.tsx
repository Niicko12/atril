import { useEffect, useRef } from 'react';
import { keyName } from '@/core';
import { DurationTools } from './duration-tools';
import { Fretboard } from './fretboard';
import { ModeSwitch } from './mode-switch';
import { NameButtons } from './name-buttons';
import { PianoKeyboard } from './piano-keyboard';
import { useNoteInput } from '../hooks/use-note-input';
import { useModeStore } from '@/shared/prefs/mode.store';
import { useScoreStore } from '../store/score.store';
import { selectInstrument } from '../store/selectors';
import { S } from '../strings';
import styles from './dock.module.css';

/** Dock fijo inferior: herramientas, modo de entrada y superficie activa (editor-spec 2, 8). */
/** Publica el alto real del dock en --dock-h para que el contenido y los avisos no queden tapados (legacy sizeDock). */
function useDockHeight(ref: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const set = () => document.documentElement.style.setProperty('--dock-h', `${el.offsetHeight}px`);
    const ro = new ResizeObserver(set);
    ro.observe(el);
    set();
    return () => ro.disconnect();
  }, [ref]);
}

export function InputDock() {
  const dock = useRef<HTMLDivElement>(null);
  useDockHeight(dock);
  const enter = useNoteInput();
  const { mode, setMode } = useModeStore();
  const instrument = useScoreStore(selectInstrument);
  const key = useScoreStore((s) => s.score.key);
  const hint =
    mode === 'piano'
      ? S.hintPiano
      : mode === 'fret'
        ? S.hintFret((instrument.strings ? instrument : { name: 'guitarra' }).name.toLowerCase())
        : S.hintNames(keyName(key));
  return (
    <div className={styles.dock} ref={dock}>
      <DurationTools />
      <ModeSwitch mode={mode} hint={hint} onChange={setMode} />
      <div className={styles.surface}>
        {mode === 'piano' && <PianoKeyboard onNote={enter} />}
        {mode === 'fret' && <Fretboard instrument={instrument} fifths={key} onNote={enter} />}
        {mode === 'names' && <NameButtons onNote={enter} />}
      </div>
    </div>
  );
}
