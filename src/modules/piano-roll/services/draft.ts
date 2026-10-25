import { MAX_NOTES, type Note } from '@/core';
import type { DraftChange, TimedNote } from '../types';

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
export function timeline(notes: readonly Note[]): TimedNote[] {
  let start = 0;
  return notes.map((note, index) => {
    const event = { index, start, end: start + note.d, note };
    start = event.end;
    return event;
  });
}
export function reorder(notes: readonly Note[], from: number, to: number): DraftChange {
  const copy = [...notes];
  if (!copy[from] || to < 0 || to >= copy.length) return { notes: copy, selection: from };
  const [note] = copy.splice(from, 1);
  if (note) copy.splice(to, 0, note);
  return { notes: copy, selection: to };
}
export function editNote(notes: readonly Note[], index: number, patch: Partial<Note>): Note[] {
  return notes.map((note, i) => (i === index ? { ...note, ...patch } : note));
}
/** Un arrastre termina en un único cambio de borrador; nunca modifica la partitura. */
export function dragNote(
  notes: readonly Note[],
  index: number,
  delta: { units: number; steps: number; resize: boolean },
): DraftChange {
  const { units, steps, resize } = delta;
  const source = notes[index];
  if (!source) return { notes: [...notes], selection: -1 };
  if (resize) return { notes: editNote(notes, index, { d: clamp(source.d + units, 1, 48) }), selection: index };
  const events = timeline(notes);
  const origin = events[index] as TimedNote;
  const x = origin.start + source.d / 2 + units;
  const target = events.reduce(
    (best, event) =>
      Math.abs((event.start + event.end) / 2 - x) < Math.abs((best.start + best.end) / 2 - x) ? event : best,
    origin,
  );
  const p = source.p === null ? null : clamp(source.p - steps, 0, 127);
  return reorder(editNote(notes, index, { p }), index, target.index);
}
export function insertNote(notes: readonly Note[], selection: number, p: number | null): DraftChange {
  if (notes.length >= MAX_NOTES) return { notes: [...notes], selection };
  const index = selection >= 0 && selection < notes.length ? selection + 1 : notes.length;
  const copy = [...notes];
  copy.splice(index, 0, { p, d: 4 });
  return { notes: copy, selection: index };
}
export function deleteNote(notes: readonly Note[], selection: number): DraftChange {
  return { notes: notes.filter((_, i) => i !== selection), selection: Math.min(selection, notes.length - 2) };
}
export function pitchRange(notes: readonly Note[]): { low: number; high: number } {
  const pitches = notes.flatMap((n) => (n.p === null ? [] : [n.p]));
  return { low: Math.max(0, Math.min(48, ...pitches) - 2), high: Math.min(127, Math.max(72, ...pitches) + 2) };
}
export const sameNotes = (a: readonly Note[], b: readonly Note[]) =>
  a.length === b.length && a.every((n, i) => n.p === b[i]?.p && n.d === b[i]?.d && n.c === b[i]?.c);
