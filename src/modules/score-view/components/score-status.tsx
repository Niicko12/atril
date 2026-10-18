import { isTransposing, keyName, measureCount, meterOf, midiName, outOfRangeIndices, writtenFifths } from '@/core';
import { selectInstrument, useScoreStore } from '@/modules/editor';
import { S } from '../strings';
import styles from './score-status.module.css';

/** Barra de estado (notation-core-spec 15). */
export function ScoreStatus() {
  const score = useScoreStore((s) => s.score);
  const selection = useScoreStore((s) => s.selection);
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
      {selected && <span className={styles.tip}>{S.selected(selection, what)}</span>}
    </div>
  );
}
