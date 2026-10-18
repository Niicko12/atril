import type { Clef, Instrument, Note } from '../types';

/** Clave fija del instrumento, o automática (promedio de alturas escritas < La3 → Fa). */
export function clefFor(instrument: Instrument, notes: readonly Note[], transpose: number): Clef {
  if (instrument.clef !== 'auto') return instrument.clef;
  const pitches = notes.filter((n) => n.p != null).map((n) => (n.p as number) + transpose);
  const avg = pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 60;
  return avg < 57 ? 'bass' : 'treble';
}
