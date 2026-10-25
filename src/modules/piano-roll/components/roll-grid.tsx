import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { midiName, type Note } from '@/core';
import { fitGrid, ROLL_LABEL } from '../services/grid-layout';
import { useRollGesture } from '../hooks/use-roll-gesture';
import type { DraftChange, TimedNote } from '../types';
import { S } from '../strings';
import styles from './piano-roll.module.css';

type Props = {
  notes: Note[];
  selected: number;
  page: number;
  bar: number;
  unit: number;
  change(next: DraftChange): void;
  select(index: number): void;
};
const LABEL = ROLL_LABEL;

type Ghost = { dx: number; dy: number; resize: boolean } | null;
function eventStyle(
  event: TimedNote,
  layout: { first: number; last: number; unit: number; high: number; rows: number; row: number },
  ghost: Ghost,
): CSSProperties {
  const { first, last, unit, high, rows, row: rowHeight } = layout;
  const { start, end, note } = event;
  const width = (Math.min(last, end) - Math.max(first, start)) * unit;
  const row = note.p === null ? rows : high - note.p;
  return {
    left: LABEL + Math.max(0, start - first) * unit,
    top: (row + 1) * rowHeight + 1,
    width: Math.max(8, width + (ghost?.resize ? ghost.dx : 0)),
    transform: ghost && !ghost.resize ? `translate(${ghost.dx}px, ${note.p === null ? 0 : ghost.dy}px)` : undefined,
  };
}

export function RollGrid({ notes, selected, page, bar, unit, change, select }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 300 });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth || 600, height: element.clientHeight || 300 });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const layout = fitGrid({ notes, page, bar, ...size, zoom: unit });
  const { high, rows, row, events } = layout;
  const pitches = Array.from({ length: rows }, (_, i) => high - i);
  const gesture = useRollGesture(notes, layout.unit, change, row);
  useEffect(() => {
    scroller.current
      ?.querySelector<HTMLElement>(`[data-roll-note="${selected}"]`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selected, page]);
  return (
    <div
      ref={scroller}
      className={styles.viewport}
      data-roll-scroll
      role="region"
      aria-label="Cuadrícula de altura y tiempo"
      tabIndex={0}
    >
      <div
        className={styles.grid}
        style={
          {
            width: layout.width,
            height: (pitches.length + 2) * row,
            '--unit': `${layout.unit}px`,
            '--row': `${row}px`,
          } as CSSProperties
        }
      >
        <div className={styles.ruler}>
          {Array.from({ length: layout.bars }, (_, i) => (
            <span key={i} style={{ left: LABEL + i * bar * layout.unit }}>
              {S.bar(page * 4 + i + 1)}
            </span>
          ))}
        </div>
        {pitches.map((pitch, i) => (
          <div key={pitch} className={styles.pitchRow} style={{ top: (i + 1) * row }}>
            <span>{midiName(pitch)}</span>
          </div>
        ))}
        <div className={styles.pitchRow} style={{ top: (pitches.length + 1) * row }}>
          <span>{S.silence}</span>
        </div>
        {events.map((timed) => {
          const { index, note } = timed;
          const ghost = gesture.ghost?.index === index ? gesture.ghost : null;
          return (
            <div
              key={index}
              className={`${styles.event} ${selected === index ? styles.selected : ''}`}
              style={eventStyle(timed, layout, ghost)}
              onPointerDown={(event) => {
                select(index);
                gesture.down(event, index);
              }}
              onPointerMove={gesture.move}
              onPointerUp={gesture.up}
              onPointerCancel={(event) => gesture.cancel(event.pointerId)}
              onLostPointerCapture={(event) => gesture.cancel(event.pointerId)}
            >
              <button
                type="button"
                className={styles.note}
                data-roll-note={index}
                aria-pressed={selected === index}
                aria-label={S.note(index, note.p === null ? S.silence : midiName(note.p), note.d)}
                onClick={(event) => {
                  if (!event.detail || !gesture.skipClick.current) select(index);
                }}
              >
                {note.c || (note.p === null ? '—' : midiName(note.p))}
              </button>
              <button
                type="button"
                className={styles.resize}
                data-resize
                aria-label={S.resize(index)}
                title={S.resize(index)}
                onClick={() => select(index)}
              >
                ⋮
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
