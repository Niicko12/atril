/** Número de nota MIDI (21 = La0, 60 = Do4, 108 = Do8). */
export type Midi = number;

/** Duración en semicorcheas (1 = semicorchea, 4 = negra, 16 = redonda). Entero ≥ 1. */
export type Units16 = number;

/** Armadura en quintas: −7 (Do♭ mayor) .. 7 (Do♯ mayor). La app usa −6..6. */
export type Fifths = number;

/** Semitonos de transposición escrita respecto al sonido real (positivo = se escribe más agudo). */
export type Semitones = number;

/** Segundos de audio. */
export type Seconds = number;

/** Letra de nota en notación anglosajona. */
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** Alteración: −2 doble bemol .. 2 doble sostenido. */
export type Alter = -2 | -1 | 0 | 1 | 2;

export const MIDI_MIN = 21;
export const MIDI_MAX = 108;
export const MAX_NOTES = 3000;
export const TEMPO_MIN = 30;
export const TEMPO_MAX = 240;
