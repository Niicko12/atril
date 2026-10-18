import type { Alter, Fifths, Letter, Midi, Note, Units16 } from '../types';
import { MIDI_MAX, MIDI_MIN } from '../types';
import { NATURAL, normalizeFifths } from '../theory';

export interface Cursor {
  base: 16 | 8 | 4 | 2 | 1;
  dot: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Duración del cursor: con puntillo × 1,5 (no aplica a semicorchea). */
export function cursorUnits(c: Cursor): Units16 {
  return c.dot && c.base > 1 ? c.base * 1.5 : c.base;
}

/** Agrega al final o reemplaza el tono de la seleccionada y avanza (editor-spec 4.1). */
export function insertOrReplace(notes: readonly Note[], selection: number, midi: Midi | null, units: Units16) {
  if (selection >= 0 && selection < notes.length) {
    const next = notes.map((n, i) => (i === selection ? { ...n, p: midi } : n));
    return { notes: next, selection: selection + 1 < notes.length ? selection + 1 : -1, lastIndex: selection };
  }
  return { notes: [...notes, { p: midi, d: units }], selection: -1, lastIndex: notes.length };
}

/** Borra la seleccionada o la última (editor-spec 4.2). */
export function removeAt(notes: readonly Note[], selection: number) {
  if (!notes.length) return { notes: [...notes], selection: -1 };
  if (selection >= 0 && selection < notes.length) {
    const next = notes.filter((_, i) => i !== selection);
    return { notes: next, selection: Math.min(selection, next.length - 1) };
  }
  return { notes: notes.slice(0, -1), selection: -1 };
}

export function setDurationAt(notes: readonly Note[], index: number, units: Units16): Note[] {
  return notes.map((n, i) => (i === index ? { ...n, d: units } : n));
}

/** Mueve todas las alturas; cuenta las que quedaron recortadas al rango del piano (F15). */
export function shiftNotes(notes: readonly Note[], semitones: number) {
  let clipped = 0;
  const next = notes.map((n) => {
    if (n.p == null) return n;
    const target = n.p + semitones;
    const p = clamp(target, MIDI_MIN, MIDI_MAX);
    if (p !== target) clipped++;
    return { ...n, p };
  });
  return { notes: next, clipped };
}

/** Tonalidad tras mover medio tono (la octava no la cambia). */
export function shiftKey(key: Fifths, semitones: number): Fifths {
  return Math.abs(semitones) === 12 ? key : normalizeFifths(key + 7 * semitones);
}

export function octaveAt(notes: readonly Note[], index: number, dir: 1 | -1) {
  const n = notes[index];
  if (!n || n.p == null) return { notes: [...notes], changed: false };
  const p = n.p + 12 * dir;
  // Si la octava completa no cabe, no se mueve (recortar cambiaría la nota, no la octava).
  if (p < MIDI_MIN || p > MIDI_MAX) return { notes: [...notes], changed: false };
  return { notes: notes.map((x, i) => (i === index ? { ...x, p } : x)), changed: true };
}

/** Octava más cercana a la referencia; en empate gana la más grave (legacy `nearest`). */
export function nearestMidiForLetter(letter: Letter, alter: Alter | number, reference: Midi): Midi {
  let best: number | null = null;
  for (let o = 1; o <= 7; o++) {
    const m = (o + 1) * 12 + NATURAL[letter] + alter;
    if (best === null || Math.abs(m - reference) < Math.abs(best - reference)) best = m;
  }
  return best as number;
}

/** Altura de referencia para Do-Re-Mi: la seleccionada, si no la última con tono, si no Do4. */
export function referencePitch(notes: readonly Note[], selection: number): Midi {
  const sel = notes[selection];
  if (sel && sel.p != null) return sel.p;
  for (let i = notes.length - 1; i >= 0; i--) {
    const p = notes[i]?.p;
    if (p != null) return p;
  }
  return 60;
}

export function outOfRangeIndices(notes: readonly Note[], low: Midi, high: Midi): number[] {
  const out: number[] = [];
  notes.forEach((n, i) => {
    if (n.p != null && (n.p < low || n.p > high)) out.push(i);
  });
  return out;
}
