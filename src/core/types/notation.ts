import type { Letter, Alter, Units16, Midi } from './units';

export interface Spelling {
  letter: Letter;
  alter: Alter;
  /** Octava científica (Do4 = Do central). */
  octave: number;
}

/** Fragmento de una nota dentro de un compás (una nota larga puede partirse y ligarse). */
export interface MeasurePart {
  /** Índice de la nota original en Score.notes. */
  idx: number;
  p: Midi | null;
  d: Units16;
  /** Primer fragmento de la nota original. */
  first: boolean;
  /** Último fragmento de la nota original. */
  last: boolean;
  /** Posición dentro del compás, en semicorcheas. */
  pos: Units16;
}

export type Measure = MeasurePart[];

export interface Meter {
  /** Semicorcheas por compás. */
  bar: Units16;
  /** Semicorcheas por pulso (agrupación de barras de corchea). */
  beat: Units16;
}

export interface AbcBuildOptions {
  names?: boolean;
  chords?: boolean;
}

export interface AbcBuildResult {
  abc: string;
  /** Posición de carácter en `abc` → índice de nota. */
  charMap: Map<number, number>;
  /** Armadura usada al escribir. */
  fifths: number;
  /** Transposición aplicada. */
  transpose: number;
}
