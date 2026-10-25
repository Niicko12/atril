import { midiName } from '@/core';
import type { AudioPart, PartsAnalysis } from '@/core/analysis';
import { buttonStyles as b } from '@/shared/components/overlay';
import { S } from '../strings';
import styles from './ear.module.css';

interface Props {
  analysis: PartsAnalysis;
  withChords: boolean;
  disabled: boolean;
  onChords(value: boolean): void;
  onOpen(part: AudioPart): void;
}
/** Partes con rango y cifrado opcional (ear-spec 13.3, 17.2). */
export function PartsList({ analysis, withChords, disabled, onChords, onOpen }: Props) {
  return (
    <div className={styles.parts}>
      <h3>{S.partsTitle}</h3>
      <label>
        <input type="checkbox" checked={withChords} disabled={disabled} onChange={(e) => onChords(e.target.checked)} />{' '}
        {S.withChords}
      </label>
      {analysis.chords.length > 0 && (
        <p className={styles.muted}>
          {S.chords}:{' '}
          {analysis.chords
            .slice(0, 12)
            .map((c) => c.name)
            .join(' · ')}
          {analysis.chords.length > 12 ? '…' : ''}
        </p>
      )}
      <ul className={styles.partList}>
        {analysis.parts.map((part) => {
          const pitches = part.raw.map((n) => n.m);
          return (
            <li key={part.id}>
              <div>
                <strong>{part.name}</strong>
                <span className={styles.muted}>
                  {part.description} · {part.raw.length} notas · {midiName(Math.min(...pitches), analysis.key)}–
                  {midiName(Math.max(...pitches), analysis.key)}
                </span>
              </div>
              <button
                type="button"
                className={`${b.btn} ${b.primary}`}
                disabled={disabled}
                aria-label={`${S.openPart} ${part.name}`}
                onClick={() => onOpen(part)}
              >
                {S.openPart}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
