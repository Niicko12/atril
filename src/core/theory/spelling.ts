import type { Alter, Fifths, Letter, Midi, Spelling } from '../types';
import { LETTERS, NATURAL, keyAccidentals } from './keys';

function spellingScore(alter: number, keyAlter: number, fifths: Fifths): number {
  if (alter === keyAlter) return 0;
  if (alter === 0) return 1;
  if (alter === (fifths >= 0 ? 1 : -1)) return 2;
  return 3;
}

/**
 * Decide la letra y alteración de una altura según la armadura (legacy `spell`, sin cambios).
 * Empates: gana la primera letra en orden C…B. Nunca produce dobles alteraciones.
 */
export function spell(midi: Midi, fifths: Fifths): Spelling {
  const pc = ((midi % 12) + 12) % 12;
  const ka = keyAccidentals(fifths);
  let best: { letter: Letter; alter: number } = { letter: 'C', alter: 0 };
  let bestScore = 9;
  for (const letter of LETTERS) {
    const alter = ((((pc - NATURAL[letter] + 6) % 12) + 12) % 12) - 6;
    if (Math.abs(alter) > 1) continue;
    const score = spellingScore(alter, ka[letter], fifths);
    if (score < bestScore) {
      best = { letter, alter };
      bestScore = score;
    }
  }
  return { letter: best.letter, alter: best.alter as Alter, octave: Math.floor((midi - best.alter) / 12) - 1 };
}

/** Altura en ABC: Do4 → C, Do5 → c, Do6 → c', Do3 → C,. */
export function abcPitch(letter: Letter, octave: number): string {
  if (octave >= 5) return letter.toLowerCase() + "'".repeat(octave - 5);
  return letter + ','.repeat(Math.max(0, 4 - octave));
}
