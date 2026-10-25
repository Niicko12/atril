import type { Note } from '@/core';
import { measureOfNote, playbackAtMeasure } from './measure-navigation';

const notes: Note[] = [
  { p: 60, d: 24 },
  { p: null, d: 12 },
  { p: 64, d: 8 },
];

describe('navegación por compases', () => {
  it('calcula el compás original de notas y silencios con duración cruzada', () => {
    expect(measureOfNote(notes, -1, 16)).toBe(0);
    expect(measureOfNote(notes, 1, 16)).toBe(1);
    expect(measureOfNote(notes, 2, 16)).toBe(2);
    expect(measureOfNote(notes, 2, 12)).toBe(3);
  });
  it('empieza dentro de una nota ligada sin cambiar la partitura o sus índices', () => {
    const before = structuredClone(notes);
    const segment = playbackAtMeasure(notes, 1, 16);
    expect(segment.fromIndex).toBe(0);
    expect(segment.notes[0]).toEqual({ p: 60, d: 8 });
    expect(segment.notes[1]).toBe(notes[1]);
    expect(notes).toEqual(before);
  });
  it('recorta silencios cruzados en vez de saltarlos y mantiene el índice original', () => {
    const segment = playbackAtMeasure(notes, 2, 16);
    expect(segment.fromIndex).toBe(1);
    expect(segment.notes[1]).toEqual({ p: null, d: 4 });
    expect(segment.notes[2]).toEqual({ p: 64, d: 8 });
  });
  it('respeta un límite exacto de compás, el inicio y el final', () => {
    const exact: Note[] = [
      { p: 60, d: 16 },
      { p: 62, d: 16 },
    ];
    expect(playbackAtMeasure(exact, 1, 16).fromIndex).toBe(1);
    expect(playbackAtMeasure(exact, -1, 16).fromIndex).toBe(0);
    expect(playbackAtMeasure(exact, 2, 16).fromIndex).toBe(-1);
    expect(playbackAtMeasure([], 0, 16).fromIndex).toBe(-1);
  });
});
