import { DurationTools } from './duration-tools';
import { PianoKeyboard } from './piano-keyboard';
import { useNoteInput } from '../hooks/use-note-input';
import { S } from '../strings';
import styles from './dock.module.css';

/** Dock fijo inferior: herramientas + superficie de entrada (editor-spec 2). Diapasón y Do-Re-Mi: semana 3. */
export function InputDock() {
  const enter = useNoteInput();
  return (
    <div className={styles.dock}>
      <DurationTools />
      <div className={styles.hint}>{S.hintPiano}</div>
      <div className={styles.surface}>
        <PianoKeyboard onNote={enter} />
      </div>
    </div>
  );
}
