import type { Fifths, Letter } from '../types';

/** Índice = fifths + 7 (de −7 a 7). */
export const MAJOR_NAMES = ['Do♭', 'Sol♭', 'Re♭', 'La♭', 'Mi♭', 'Si♭', 'Fa', 'Do', 'Sol', 'Re', 'La', 'Mi', 'Si', 'Fa♯', 'Do♯'] as const;
export const MINOR_NAMES = ['La♭', 'Mi♭', 'Si♭', 'Fa', 'Do', 'Sol', 'Re', 'La', 'Mi', 'Si', 'Fa♯', 'Do♯', 'Sol♯', 'Re♯', 'La♯'] as const;
export const ABC_KEYS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'] as const;

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NATURAL: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const SHARP_ORDER: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Alteración de cada letra según la armadura. */
export function keyAccidentals(fifths: Fifths): Record<Letter, number> {
  const acc: Record<Letter, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  for (let i = 0; i < fifths; i++) acc[SHARP_ORDER[i] as Letter] = 1;
  for (let i = 0; i < -fifths; i++) acc[FLAT_ORDER[i] as Letter] = -1;
  return acc;
}

/** Normaliza a −5..6 (legacy `normF`): −6 pasa a 6 (Sol♭ → Fa♯). */
export function normalizeFifths(fifths: number): Fifths {
  let v = ((fifths % 12) + 12) % 12;
  if (v > 6) v -= 12;
  return v;
}

/** Armadura escrita para un instrumento que transpone `transpose` semitonos. */
export function writtenFifths(key: Fifths, transpose: number): Fifths {
  return normalizeFifths(key + 7 * transpose);
}

/** "Mi♭ mayor". */
export function keyName(fifths: Fifths): string {
  return `${MAJOR_NAMES[fifths + 7] ?? MAJOR_NAMES[7]} mayor`;
}

/** Texto del selector: "Mi♭ mayor / Do menor". */
export function keyOptionLabel(fifths: Fifths): string {
  return `${MAJOR_NAMES[fifths + 7]} mayor / ${MINOR_NAMES[fifths + 7]} menor`;
}

/** Código de tonalidad ABC ("Eb"). */
export function abcKey(fifths: Fifths): string {
  return ABC_KEYS[fifths + 7] ?? 'C';
}
