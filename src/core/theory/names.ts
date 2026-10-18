import type { Fifths, Letter, Midi, Spelling } from '../types';
import { spell } from './spelling';

export const SOLFEGE: Readonly<Record<Letter, string>> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

/** "Fa♯", "Si♭", "Do". */
export function noteName(s: Pick<Spelling, 'letter' | 'alter'>): string {
  return SOLFEGE[s.letter] + (s.alter > 0 ? '♯' : s.alter < 0 ? '♭' : '');
}

/** "Fa♯4". */
export function midiName(midi: Midi, fifths: Fifths = 0): string {
  const s = spell(midi, fifths);
  return noteName(s) + s.octave;
}
