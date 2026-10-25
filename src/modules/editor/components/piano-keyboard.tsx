import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { Midi } from '@/core';
import { midiName } from '@/core';
import { S } from '../strings';
import styles from './piano-keyboard.module.css';

export const PIANO_LOW = 36;
export const PIANO_HIGH = 84;
export const WHITE_WIDTH = 40;
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

interface KeyItem {
  midi: Midi;
  black: boolean;
  left: number;
  label: string;
}

export function keyLayout(low: Midi, high: Midi): { keys: KeyItem[]; whiteCount: number } {
  const keys: KeyItem[] = [];
  let whites = 0;
  for (let m = low; m <= high; m++) {
    const pc = m % 12;
    const black = BLACK_PCS.has(pc);
    const left = black ? whites * WHITE_WIDTH - 13 : whites * WHITE_WIDTH;
    keys.push({ midi: m, black, left, label: pc === 0 ? `Do${Math.floor(m / 12) - 1}` : '' });
    if (!black) whites++;
  }
  return { keys, whiteCount: whites };
}

interface Props {
  onNote(midi: Midi, el: HTMLElement): void;
}

/** Piano en pantalla Do2–Do6 con delegación de eventos (editor-spec 8.1). */
export const PianoKeyboard = memo(function PianoKeyboard({ onNote }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const { keys, whiteCount } = useMemo(() => keyLayout(PIANO_LOW, PIANO_HIGH), []);

  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const center = () => {
      const keyWidth = sc.scrollWidth / whiteCount;
      sc.scrollLeft = Math.max(0, Math.round(14.5 * keyWidth - sc.clientWidth / 2));
    };
    center();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(center);
    observer.observe(sc);
    return () => observer.disconnect();
  }, [whiteCount]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-midi]');
    if (el) onNote(Number(el.dataset.midi), el);
  };

  return (
    <div className={styles.scroll} ref={scroller}>
      <div
        className={styles.kbd}
        style={{ '--white-count': whiteCount, minWidth: whiteCount * WHITE_WIDTH } as CSSProperties}
        onPointerDown={handlePointerDown}
        onClick={(e) => {
          if (e.detail !== 0) return;
          const el = (e.target as HTMLElement).closest<HTMLElement>('[data-midi]');
          if (el) onNote(Number(el.dataset.midi), el);
        }}
        onContextMenu={(e) => e.preventDefault()}
        role="group"
        aria-label={S.pianoLabel}
      >
        {keys.map((k) => (
          <button
            key={k.midi}
            type="button"
            data-midi={k.midi}
            className={k.black ? styles.black : `${styles.white} ${k.label ? styles.c : ''}`}
            style={{ left: `${(k.left / (whiteCount * WHITE_WIDTH)) * 100}%` }}
            aria-label={midiName(k.midi)}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
});
