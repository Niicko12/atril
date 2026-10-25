import type { Note } from '@/core';
import { timeline } from './draft';

export const ROLL_LABEL = 54;
export function fitGrid(input: {
  notes: readonly Note[];
  page: number;
  bar: number;
  width: number;
  height: number;
  zoom: number;
}) {
  const first = input.page * input.bar * 4;
  const events = timeline(input.notes);
  const total = events.at(-1)?.end ?? 0;
  const bars = Math.max(1, Math.min(4, Math.ceil((total - first) / input.bar)));
  const units = bars * input.bar;
  const visible = events.filter((event) => event.start < first + units && event.end > first);
  const pitches = visible.flatMap(({ note }) => (note.p === null ? [] : [note.p]));
  const low = pitches.length ? Math.max(0, Math.min(...pitches) - 2) : 58;
  const high = pitches.length ? Math.min(127, Math.max(...pitches) + 2) : 74;
  const rows = high - low + 1;
  const row = Math.max(12, Math.min(24, Math.floor(input.height / (rows + 2))));
  const unit = input.zoom || Math.max(2, (input.width - ROLL_LABEL) / units);
  return {
    first,
    last: first + units,
    bars,
    low,
    high,
    rows,
    row,
    unit,
    events: visible,
    width: ROLL_LABEL + units * unit,
  };
}
