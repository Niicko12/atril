import type { Note } from '@/core';

/** Compás de inicio de una nota original, antes de dividirla para dibujar ligaduras. */
export function measureOfNote(notes: readonly Note[], index: number, bar: number): number {
  const start = notes.slice(0, Math.max(0, index)).reduce((total, note) => total + note.d, 0);
  return Math.floor(start / bar);
}

/** Ubica el evento que suena al empezar un compás y recorta solo su copia de reproducción. */
export function playbackAtMeasure(notes: readonly Note[], measure: number, bar: number) {
  const target = Math.max(0, measure) * bar;
  let start = 0;
  const index = notes.findIndex((note) => {
    if (start + note.d > target) return true;
    start += note.d;
    return false;
  });
  if (index < 0) return { notes, fromIndex: -1 };
  const current = notes[index] as Note;
  const remaining = current.d - (target - start);
  const copy = notes.map((note, i) => (i === index ? { ...note, d: remaining } : note));
  return { notes: copy, fromIndex: index };
}
