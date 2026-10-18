import type { EditorMode } from '../types';
import { S } from '../strings';
import styles from './mode-switch.module.css';

const MODES: readonly EditorMode[] = ['piano', 'fret', 'names'];

interface Props {
  mode: EditorMode;
  hint: string;
  onChange(mode: EditorMode): void;
}

export function ModeSwitch({ mode, hint, onChange }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.seg} role="group" aria-label={S.modeGroup}>
        {MODES.map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => onChange(m)}>
            {S.modes[m]}
          </button>
        ))}
      </div>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
