import { practiceTimeline } from './timeline';
import type { PracticeOptions } from '../types';

const settings: PracticeOptions = { start: 2, end: 2, bar: 16, beat: 4, speed: 1, repeat: true, metronome: true, countIn: true };
it('recorta notas ligadas a ambos lados sin cambiar índices, alturas o partitura', () => {
  const notes = [{ p: 60, d: 20 }, { p: null, d: 4 }, { p: 64, d: 16 }];
  const snapshot = structuredClone(notes);
  const result = practiceTimeline(notes, 120, settings);
  expect(result.events).toEqual([
    { i: 0, p: 60, s: 0, e: .5 }, { i: 1, p: null, s: .5, e: 1 }, { i: 2, p: 64, s: 1, e: 2 },
  ]);
  expect(result.duration).toBe(2);
  expect(notes).toEqual(snapshot);
});
it('50 y 75 % cambian solo tiempos y respetan el último compás incompleto', () => {
  const notes = [{ p: 67, d: 20 }];
  expect(practiceTimeline(notes, 120, { ...settings, speed: .5 }).duration).toBe(1);
  expect(practiceTimeline(notes, 120, { ...settings, speed: .75 }).duration).toBeCloseTo(2 / 3);
  expect(practiceTimeline(notes, 120, { ...settings, start: 4, end: 4 }).events).toEqual([]);
});
