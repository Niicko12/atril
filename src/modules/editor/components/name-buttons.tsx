import type { Letter, Midi } from '@/core';
import { LETTERS, SOLFEGE, keyAccidentals, nearestMidiForLetter, referencePitch } from '@/core';
import { useScoreStore } from '../store/score.store';
import { S } from '../strings';
import type { PendingAccidental } from '../types';
import styles from './name-buttons.module.css';

const ACCS: readonly [Exclude<PendingAccidental, null>, string][] = [
  [-1, '♭'],
  [0, '♮'],
  [1, '♯'],
];
const sign = (a: number) => (a > 0 ? '♯' : a < 0 ? '♭' : '');

interface Props {
  onNote(midi: Midi, el: HTMLElement): void;
}

/** Botones Do-Re-Mi con alteración de un solo uso y 8↓ 8↑ (editor-spec 8.3). */
export function NameButtons({ onNote }: Props) {
  const key = useScoreStore((s) => s.score.key);
  const pending = useScoreStore((s) => s.pendingAccidental);
  const { setPendingAccidental, octaveLast } = useScoreStore.getState();
  const ka = keyAccidentals(key);
  const alterOf = (L: Letter) => (pending === null ? ka[L] : pending);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-letter]');
    if (!el) return;
    const s = useScoreStore.getState();
    const L = el.dataset.letter as Letter;
    onNote(nearestMidiForLetter(L, alterOf(L), referencePitch(s.score.notes, s.selection)), el);
  };

  return (
    <div className={styles.names}>
      <div className={styles.row7} onPointerDown={handlePointerDown} onContextMenu={(e) => e.preventDefault()}>
        {LETTERS.map((L) => (
          <button
            key={L}
            type="button"
            data-letter={L}
            className={styles.nb}
            aria-label={SOLFEGE[L] + sign(alterOf(L))}
          >
            {SOLFEGE[L] + sign(alterOf(L))}
            <small>{L}</small>
          </button>
        ))}
      </div>
      <div className={styles.row2}>
        {ACCS.map(([v, symbol]) => (
          <button
            key={v}
            type="button"
            className={styles.tool}
            aria-pressed={pending === v}
            title={S.accidentals[v]}
            aria-label={S.accidentals[v]}
            onClick={() => setPendingAccidental(v)}
          >
            {symbol}
          </button>
        ))}
        <span className={styles.sep} />
        <button
          type="button"
          className={styles.tool}
          title={S.octaveDown}
          aria-label={S.octaveDown}
          onClick={() => octaveLast(-1)}
        >
          8↓
        </button>
        <button
          type="button"
          className={styles.tool}
          title={S.octaveUp}
          aria-label={S.octaveUp}
          onClick={() => octaveLast(1)}
        >
          8↑
        </button>
        <span className={styles.info}>{S.namesInfo}</span>
      </div>
    </div>
  );
}
