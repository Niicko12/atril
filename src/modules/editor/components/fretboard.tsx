import { memo, useMemo } from 'react';
import type { Fifths, Instrument, Midi } from '@/core';
import { INSTRUMENTS, midiName, noteName, spell } from '@/core';
import { S } from '../strings';
import styles from './fretboard.module.css';

const FRETS = 15;
const MARKS = new Set([3, 5, 7, 9, 12, 15]);
const BOWED = new Set(['violin', 'viola', 'cello', 'contrabajo']);
const GUITAR_STRINGS = INSTRUMENTS.find((i) => i.id === 'guitarra')?.strings ?? [];

interface Props {
  instrument: Instrument;
  fifths: Fifths;
  onNote(midi: Midi, el: HTMLElement): void;
}

export const fretStrings = (instrument: Instrument): readonly Midi[] => instrument.strings ?? GUITAR_STRINGS;

/** Diapasón de 15 trastes con la afinación del instrumento (editor-spec 8.2). */
export const Fretboard = memo(function Fretboard({ instrument, fifths, onNote }: Props) {
  const strings = fretStrings(instrument);
  const header = BOWED.has(instrument.id) ? S.position : null;
  const rows = useMemo(
    () =>
      strings.map((open) =>
        Array.from({ length: FRETS + 1 }, (_, f) => ({ f, m: open + f, name: noteName(spell(open + f, fifths)) })),
      ),
    [strings, fifths],
  );
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-midi]');
    if (el) onNote(Number(el.dataset.midi), el);
  };
  return (
    <div className={styles.scroll}>
      <div
        className={styles.fb}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={S.fretLabel}
      >
        <div className={styles.num}>{header ?? ''}</div>
        {Array.from({ length: FRETS + 1 }, (_, f) => (
          <div key={f} className={`${styles.num} ${MARKS.has(f) ? styles.mk : ''}`}>
            {f === 0 ? S.openString : f}
          </div>
        ))}
        {rows.map((cells, si) => [
          <div key={`l${si}`} className={styles.lab}>
            {noteName(spell(strings[si] as number, 0))}
          </div>,
          ...cells.map(({ f, m, name }) => (
            <button
              key={`${si}-${f}`}
              type="button"
              data-midi={m}
              className={`${styles.cell} ${f === 0 ? styles.open : ''}`}
              style={{ '--sw': `${(1 + si * 0.45).toFixed(2)}px` } as React.CSSProperties}
              aria-label={S.fretCell(si + 1, f, midiName(m, fifths))}
            >
              <span>{name}</span>
            </button>
          )),
        ])}
      </div>
    </div>
  );
});
