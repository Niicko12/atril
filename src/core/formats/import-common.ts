import type { ImportResult, ImportWarning, InstrumentId, MeterId, Note } from '../types';
import { MAX_NOTES, TEMPO_MAX, TEMPO_MIN } from '../types';
import { METERS } from '../rhythm';
import { splitLong } from './mono';

/** Compás soportado o aproximación (legacy `pickMeter`). */
export function pickMeter(num: number, den: number): { meter: MeterId; exact: boolean } {
  const m = `${num}/${den}`;
  if (m in METERS) return { meter: m as MeterId, exact: true };
  return { meter: den === 8 ? '6/8' : '4/4', exact: false };
}

/** Subcadenas en orden de prioridad (formats-spec 12.7). */
const GUESS: readonly [string, InstrumentId][] = [
  ['bajo', 'bajo'],
  ['bass guitar', 'bajo'],
  ['electric bass', 'bajo'],
  ['contrab', 'contrabajo'],
  ['double bass', 'contrabajo'],
  ['ukul', 'ukulele'],
  ['guitar', 'guitarra'],
  ['violonc', 'cello'],
  ['cello', 'cello'],
  ['viola', 'viola'],
  ['viol', 'violin'],
  ['recorder', 'flautadulce'],
  ['flauta dulce', 'flautadulce'],
  ['dulce', 'flautadulce'],
  ['flaut', 'flauta'],
  ['flute', 'flauta'],
  ['oboe', 'oboe'],
  ['clarinet', 'clarinete'],
  ['alto sax', 'saxalto'],
  ['sax alto', 'saxalto'],
  ['saxofón alto', 'saxalto'],
  ['tenor sax', 'saxtenor'],
  ['sax tenor', 'saxtenor'],
  ['trumpet', 'trompeta'],
  ['trompet', 'trompeta'],
  ['horn', 'corno'],
  ['corno', 'corno'],
  ['trombon', 'trombon'],
  ['trombone', 'trombon'],
  ['tuba', 'tuba'],
  ['voice', 'voz'],
  ['voz', 'voz'],
  ['vocal', 'voz'],
  ['soprano', 'voz'],
  ['piano', 'piano'],
];

export function guessInstrument(name: string): InstrumentId | null {
  const s = name.toLowerCase();
  return GUESS.find(([k]) => s.includes(k))?.[1] ?? null;
}

export interface Draft {
  title: string;
  composer: string;
  key: number;
  meter: MeterId;
  tempo: number;
  notes: Note[];
  instrumentId: InstrumentId | null;
  warnings: ImportWarning[];
}

/** Recorta a 3 000 notas, limita el tempo y parte notas > 48 (formats-spec 3). */
export function finalize(d: Draft): ImportResult {
  const notes = splitLong(d.notes);
  const warnings = [...d.warnings];
  if (notes.length > MAX_NOTES) warnings.push({ code: 'truncated' });
  const tempo = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(d.tempo) || 100));
  return { ...d, tempo, notes: notes.slice(0, MAX_NOTES), warnings };
}

export const hasPitches = (notes: readonly Note[]): boolean => notes.some((n) => n.p != null);
