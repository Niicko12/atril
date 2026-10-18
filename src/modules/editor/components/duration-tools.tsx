import { useScoreStore } from '../store/score.store';
import { selectCanRedo, selectCanUndo, selectHasNotes } from '../store/selectors';
import { S } from '../strings';
import type { BaseDuration } from '../types';
import { DeleteIcon, DotIcon, NoteIcon, RestIcon, UndoIcon } from './note-icon';
import styles from './dock.module.css';

const DURATIONS: readonly BaseDuration[] = [16, 8, 4, 2, 1];

/** Duraciones, puntillo, silencio, deshacer, rehacer y borrar (editor-spec 9). */
export function DurationTools() {
  const cursor = useScoreStore((s) => s.cursor);
  const canUndo = useScoreStore(selectCanUndo);
  const canRedo = useScoreStore(selectCanRedo);
  const hasNotes = useScoreStore(selectHasNotes);
  const { setDuration, toggleDot, addNote, undo, redo, deleteNote } = useScoreStore.getState();

  return (
    <div className={styles.tools}>
      <div className={styles.group} role="group" aria-label={S.durationGroup}>
        {DURATIONS.map((u, i) => (
          <button
            key={u}
            type="button"
            className={styles.tool}
            aria-pressed={cursor.base === u}
            aria-label={S.durations[u]}
            title={`${S.durations[u]} (${i + 1})`}
            onClick={() => setDuration(u)}
          >
            <NoteIcon units={u} />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.tool}
        aria-pressed={cursor.dot}
        disabled={cursor.base === 1}
        aria-label={S.dot}
        title={`${S.dot} (.)`}
        onClick={toggleDot}
      >
        <DotIcon />
      </button>
      <button
        type="button"
        className={styles.tool}
        aria-label={S.rest}
        title={`${S.rest} (0)`}
        onClick={() => addNote(null)}
      >
        <RestIcon />
      </button>
      <div className={styles.sep} />
      <button
        type="button"
        className={styles.tool}
        disabled={!canUndo}
        aria-label={S.undo}
        title={`${S.undo} (Ctrl+Z)`}
        onClick={undo}
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className={styles.tool}
        disabled={!canRedo}
        aria-label={S.redo}
        title={`${S.redo} (Ctrl+Shift+Z)`}
        onClick={redo}
      >
        <UndoIcon flip />
      </button>
      <button
        type="button"
        className={styles.tool}
        disabled={!hasNotes}
        aria-label={S.del}
        title={`${S.del} (⌫)`}
        onClick={deleteNote}
      >
        <DeleteIcon />
      </button>
    </div>
  );
}
