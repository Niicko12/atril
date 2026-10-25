import { useRef, useState, type RefObject, type PointerEvent } from 'react';
import type { Note } from '@/core';
import { dragNote } from '../services/draft';
import type { DraftChange, Gesture } from '../types';

export const ROW = 22;
function begin(
  event: PointerEvent<HTMLDivElement>,
  index: number,
  notes: readonly Note[],
  refs: { active: RefObject<Gesture | null>; skipClick: RefObject<boolean> },
) {
  const { active, skipClick } = refs;
  if (event.button !== 0 || active.current) return;
  const scroller = event.currentTarget.closest('[data-roll-scroll]');
  active.current = {
    index,
    x: event.clientX,
    y: event.clientY,
    pointerId: event.pointerId,
    resize: event.target instanceof Element && Boolean(event.target.closest('[data-resize]')),
    notes,
    scrollX: scroller?.scrollLeft ?? 0,
    scrollY: scroller?.scrollTop ?? 0,
  };
  skipClick.current = false;
  event.currentTarget.setPointerCapture?.(event.pointerId);
}
function movement(event: PointerEvent<HTMLDivElement>, start: Gesture) {
  const scroller = event.currentTarget.closest('[data-roll-scroll]');
  return {
    dx: event.clientX - start.x + (scroller?.scrollLeft ?? 0) - start.scrollX,
    dy: event.clientY - start.y + (scroller?.scrollTop ?? 0) - start.scrollY,
  };
}
export function useRollGesture(notes: readonly Note[], unit: number, change: (next: DraftChange) => void, row = ROW) {
  const active = useRef<Gesture | null>(null);
  const [ghost, setGhost] = useState<{ index: number; dx: number; dy: number; resize: boolean } | null>(null);
  const skipClick = useRef(false);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = active.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setGhost({ index: start.index, ...movement(event, start), resize: start.resize });
  };
  const cancel = (pointerId?: number) => {
    if (pointerId !== undefined && pointerId !== active.current?.pointerId) return;
    active.current = null;
    setGhost(null);
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const start = active.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const { dx, dy } = movement(event, start);
    cancel();
    if (start.notes !== notes || Math.hypot(dx, dy) < 4) return;
    skipClick.current = true;
    change(
      dragNote(notes, start.index, { units: Math.round(dx / unit), steps: Math.round(dy / row), resize: start.resize }),
    );
  };
  const down = (event: PointerEvent<HTMLDivElement>, index: number) =>
    begin(event, index, notes, { active, skipClick });
  return { down, move, up, cancel, ghost, skipClick };
}
