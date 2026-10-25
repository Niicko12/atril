import type { Note } from '@/core';
import type { PracticeEvent, PracticeOptions } from '../types';

/** Recorta ambos límites, manteniendo los índices de las notas originales. */
export function practiceTimeline(notes: readonly Note[], tempo: number, options: PracticeOptions) {
  const total = notes.reduce((sum, note) => sum + note.d, 0);
  const start = Math.max(0, Math.min(total, (options.start - 1) * options.bar));
  const end = Math.max(start, Math.min(total, options.end * options.bar));
  const unit = 60 / Math.min(240, Math.max(30, tempo || 100)) / 4 / options.speed;
  const events: PracticeEvent[] = [];
  let position = 0;
  notes.forEach((note, i) => {
    const left = Math.max(position, start);
    const right = Math.min(position + note.d, end);
    if (right > left) events.push({ i, s: (left - start) * unit, e: (right - start) * unit, p: note.p });
    position += note.d;
  });
  return { events, duration: (end - start) * unit, unit };
}
