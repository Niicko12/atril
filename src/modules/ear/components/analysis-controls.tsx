import { buttonStyles as b } from '@/shared/components/overlay';
import type { AnalysisState } from '../hooks/use-ear-analysis';
import { S } from '../strings';
import type { EarMode } from '../types';
import styles from './ear.module.css';

interface Props {
  mode: EarMode;
  state: AnalysisState;
  hasSession: boolean;
  onMode(mode: EarMode): void;
  onDetect(): void;
  onCancel(): void;
  onRequantize(): void;
}

/** Modo, "Escribir la melodía sola", Cancelar, progreso y "Reajustar ritmo" (ear-spec 17-20). */
export function AnalysisControls({ mode, state, hasSession, onMode, onDetect, onCancel, onRequantize }: Props) {
  const running = state.kind === 'running';
  const pct = state.kind === 'running' ? Math.min(99, Math.round(state.progress * 100)) : 0;
  return (
    <>
      <div className={styles.row}>
        <select
          className={styles.select}
          aria-label={S.modeLabel}
          value={mode}
          disabled={running}
          onChange={(e) => onMode(e.target.value as EarMode)}
        >
          <option value="solo">{S.modes.solo}</option>
          <option value="mix">{S.modes.mix}</option>
        </select>
        <button type="button" className={`${b.btn} ${b.primary}`} disabled={running} onClick={onDetect}>
          {S.detect}
        </button>
        {running && (
          <button type="button" className={b.btn} onClick={onCancel}>
            {S.cancel}
          </button>
        )}
        {hasSession && !running && (
          <button type="button" className={b.btn} onClick={onRequantize}>
            {S.requant}
          </button>
        )}
      </div>
      {running && (
        <>
          <progress className={styles.progress} max={100} value={pct} aria-label={S.detect} />
          <span className={styles.msg} aria-live="polite">
            {(mode === 'mix' ? S.listeningMix : S.listeningSolo)(pct)}
          </span>
        </>
      )}
    </>
  );
}
