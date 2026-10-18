import type { Midi, Semitones } from './units';

export type InstrumentId =
  | 'piano' | 'voz' | 'guitarra' | 'bajo' | 'ukulele'
  | 'violin' | 'viola' | 'cello' | 'contrabajo'
  | 'flauta' | 'oboe' | 'clarinete' | 'saxalto' | 'saxtenor'
  | 'trompeta' | 'corno' | 'trombon' | 'tuba' | 'flautadulce';

export type Clef = 'treble' | 'bass' | 'alto';
export type ClefRule = Clef | 'auto';

/** Familia de timbre para el sintetizador. */
export type Timbre = 'piano' | 'voice' | 'guitar' | 'bass' | 'bow' | 'flute' | 'reed' | 'brass';

export type TabKind = 'guitar' | 'bass';

export interface Instrument {
  id: InstrumentId;
  /** Nombre visible en español. */
  name: string;
  /** Transposición escrita (ver Semitones). */
  transpose: Semitones;
  clef: ClefRule;
  /** Rango en sonido real. */
  low: Midi;
  high: Midi;
  timbre: Timbre;
  /** Programa General MIDI (0-127). */
  gmProgram: number;
  tab?: TabKind;
  /** Cuerdas al aire de aguda a grave, en sonido real. */
  strings?: readonly Midi[];
  /** Nota visible, p. ej. "Escrita una octava arriba de como suena". */
  note?: string;
}
