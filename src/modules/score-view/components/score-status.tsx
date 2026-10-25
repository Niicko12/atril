import { isTransposing, keyName, measureCount, meterOf, midiName, outOfRangeIndices, writtenFifths } from '@/core';
import { selectInstrument, useScoreStore } from '@/modules/editor';
import { S } from '../strings';
import styles from './score-status.module.css';

/** Barra de estado (notation-core-spec 15). */
export function ScoreStatus() {
  const score = useScoreStore((s) => s.score);
  const selection = useScoreStore((s) => s.selection);
  const deleteNote = useScoreStore((s) => s.deleteNote);
  const moveNotePosition = useScoreStore((s) => s.moveNotePosition);
  const instrument = useScoreStore(selectInstrument);
  const oor = outOfRangeIndices(score.notes, instrument.low, instrument.high).length;
  const selected = score.notes[selection];
  const what = selected ? (selected.p != null ? midiName(selected.p, score.key) : S.rest) : '';

  return (
    <div className={styles.status} aria-live="polite">
      <span>{S.counts(score.notes.length, measureCount(score.notes, meterOf(score.meter)))}</span>
      {isTransposing(instrument) && (
        <span>{S.writtenKey(keyName(writtenFifths(score.key, instrument.transpose)))}</span>
      )}
      {oor > 0 && (
        <span className={styles.warn}>
          {S.outOfRange(oor, instrument.name, `${midiName(instrument.low)}–${midiName(instrument.high)}`)}
        </span>
      )}
      {selected && (
        <>
          <span className={styles.tip}>{S.selected(selection, what)}</span>
          <button
            className={styles.move}
            type="button"
            disabled={selection === 0}
            onClick={() => moveNotePosition(selection, selection - 1)}
            aria-label={S.earlier}
            title={S.earlier}
          >
            ←
          </button>
          <button
            className={styles.move}
            type="button"
            disabled={selection === score.notes.length - 1}
            onClick={() => moveNotePosition(selection, selection + 1)}
            aria-label={S.later}
            title={S.later}
          >
            →
          </button>
          <button className={styles.delete} type="button" onClick={deleteNote} aria-label={`${S.deleteSelected}: ${what}`}>
            {S.deleteSelected}
          </button>
        </>
      )}
    </div>
  );
}
