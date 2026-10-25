import { useEffect, useRef } from 'react';
import { keyName, midiName, type Note } from '@/core';
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

function readNote(note: Note | undefined, key: number): string {
  if (!note) return '';
  const base = [16, 8, 4, 2, 1].find((d) => d === note.d || d * 1.5 === note.d);
  const pitch = note.p == null ? S.rest : midiName(note.p, key);
  const duration = base ? S.durations[base]?.toLowerCase() : `${note.d} semicorcheas`;
  return `${pitch}, ${duration}${base && note.d !== base ? ' con puntillo' : ''}`;
}

export function InputDock() {
  const dock = useRef<HTMLDivElement>(null);
  useDockHeight(dock);
  const enter = useNoteInput();
  const { mode, setMode } = useModeStore();
  const instrument = useScoreStore(selectInstrument);
  const key = useScoreStore((s) => s.score.key);
  const lastIndex = useScoreStore((s) => s.lastIndex);
  const lastNote = useScoreStore((s) => s.score.notes[s.lastIndex]);
  const hint =
    mode === 'piano'
      ? S.hintPiano
      : mode === 'fret'
        ? S.hintFret((instrument.strings ? instrument : { name: 'guitarra' }).name.toLowerCase())
        : S.hintNames(keyName(key));
  return (
    <div className={styles.dock} ref={dock}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        <span key={lastIndex}>{readNote(lastNote, key)}</span>
      </div>
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
