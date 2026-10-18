import type { Score } from '../types';
import { MAX_NOTES, TEMPO_MAX, TEMPO_MIN } from '../types';
import { INSTRUMENTS } from '../instruments';
import { METERS } from '../rhythm';

type Rule = readonly [name: string, ok: (x: Record<string, unknown>) => boolean];

const isInt = (v: unknown, lo: number, hi: number): boolean =>
  Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isText = (v: unknown, max: number): boolean => typeof v === 'string' && v.length <= max;

const NOTE_RULES: readonly Rule[] = [
  ['p', (n) => n.p === null || isInt(n.p, 0, 127)],
  ['d', (n) => isInt(n.d, 1, 48)],
  ['c', (n) => n.c === undefined || isText(n.c, 12)],
];

const SCORE_RULES: readonly Rule[] = [
  ['id', (x) => typeof x.id === 'string' && x.id.length > 0],
  ['title', (x) => isText(x.title, 120)],
  ['composer', (x) => isText(x.composer, 120)],
  ['instrumentId', (x) => INSTRUMENTS.some((i) => i.id === x.instrumentId)],
  ['key', (x) => isInt(x.key, -6, 6)],
  ['meter', (x) => typeof x.meter === 'string' && x.meter in METERS],
  ['tempo', (x) => isInt(x.tempo, TEMPO_MIN, TEMPO_MAX)],
  ['showNames', (x) => typeof x.showNames === 'boolean'],
  ['showTab', (x) => typeof x.showTab === 'boolean'],
  ['notes', (x) => Array.isArray(x.notes) && x.notes.length <= MAX_NOTES],
];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function check(rules: readonly Rule[], x: Record<string, unknown>, prefix: string): void {
  for (const [name, ok] of rules) if (!ok(x)) throw new Error(`Partitura inválida: ${prefix}${name}`);
}

/** Reglas V1-V7 (editor-spec 13). Lanza con mensaje técnico. */
export function validateScore(s: unknown): asserts s is Score {
  if (!isObject(s)) throw new Error('Partitura inválida: no es un objeto');
  check(SCORE_RULES, s, '');
  (s.notes as unknown[]).forEach((n, i) => {
    if (!isObject(n)) throw new Error(`Partitura inválida: nota ${i}`);
    check(NOTE_RULES, n, `nota ${i}: `);
  });
}
