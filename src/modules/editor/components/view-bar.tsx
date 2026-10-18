import { getInstrument, isTransposing } from '@/core';
import { toast } from '@/shared/toast';
import { useScoreStore } from '../store/score.store';
import { selectEffectiveView } from '../store/selectors';
import { S } from '../strings';
import styles from './form.module.css';

const MOVES: readonly [number, string, string][] = [
  [-1, '−½', S.semiDown],
  [1, '+½', S.semiUp],
  [-12, '8↓', S.octDown],
  [12, '8↑', S.octUp],
];

/** Vista, nombres, tablatura y "Mover todo" con aviso de recorte (editor-spec 10.2, F15). */
export function ViewBar() {
  const score = useScoreStore((s) => s.score);
  const view = useScoreStore(selectEffectiveView);
  const { setView, setMeta, shiftAll, undo } = useScoreStore.getState();
  const instrument = getInstrument(score.instrumentId);
  const transposing = isTransposing(instrument);
  const hasPitches = score.notes.some((n) => n.p != null);
  const move = (semitones: number) => {
    const { clipped } = shiftAll(semitones);
    if (clipped > 0) toast(S.clipped(clipped), { label: S.undo, run: undo });
  };
  return (
    <section className={styles.viewbar} aria-label={S.viewLabel}>
      <div className={styles.seg} role="group" aria-label={S.viewGroup}>
        <button type="button" aria-pressed={view === 'written'} onClick={() => setView('written')}>
          {S.view.written}
        </button>
        <button
          type="button"
          aria-pressed={view === 'concert'}
          disabled={!transposing}
          title={transposing ? '' : S.concertDisabled}
          onClick={() => setView('concert')}
        >
          {S.view.concert}
        </button>
      </div>
      <label className={styles.chk}>
        <input type="checkbox" checked={score.showNames} onChange={(e) => setMeta({ showNames: e.target.checked })} />{' '}
        {S.showNames}
      </label>
      {instrument.tab && (
        <label className={styles.chk}>
          <input type="checkbox" checked={score.showTab} onChange={(e) => setMeta({ showTab: e.target.checked })} />{' '}
          {S.showTab}
        </label>
      )}
      <div className={styles.move} role="group" aria-label={S.moveAll}>
        {S.moveAll}
        {MOVES.map(([n, label, aria]) => (
          <button
            key={n}
            type="button"
            className={styles.btn}
            disabled={!hasPitches}
            aria-label={aria}
            onClick={() => move(n)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
