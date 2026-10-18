import type { ImportResult, ImportWarning, Letter, Note } from '../types';
import { ImportError } from '../types';
import { LETTERS, NATURAL, normalizeFifths } from '../theory';
import { finalize, hasPitches, pickMeter } from './import-common';

/** Forma mínima del árbol de abcjs que se usa (el núcleo no depende de abcjs). */
export interface AbcPitch {
  pitch: number;
  accidental?: string;
  startTie?: unknown;
}
export interface AbcElement {
  el_type: string;
  type?: string;
  duration?: number;
  rest?: { type: string };
  pitches?: AbcPitch[];
  accidentals?: { note: string; acc: string }[];
  startTriplet?: number;
  tripletMultiplier?: number;
  endTriplet?: boolean;
  startEnding?: string;
}
export interface AbcTuneLike {
  lines?: { staff?: { key?: { accidentals?: { note: string; acc: string }[] }; voices?: AbcElement[][] }[] }[];
  metaText?: { title?: string; composer?: string; tempo?: { bpm?: number; duration?: number[] } };
  getMeterFraction?(): { num: number; den: number };
}

const ACC: Readonly<Record<string, number>> = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2 };

interface State {
  notes: Note[];
  keyMap: Record<string, number>;
  bar: Record<string, number>;
  pos: number;
  trip: number;
  tie: { pending: boolean; key: string };
  flags: Set<'polyphony' | 'tuplets' | 'repeats'>;
}

const keyMapOf = (accs: { note: string; acc: string }[] = []) =>
  Object.fromEntries(accs.map((a) => [a.note.toUpperCase(), ACC[a.acc] ?? 0]));

/** Semicorcheas del elemento con acumulado (tresillos incluidos). */
function advance(st: State, el: AbcElement): number {
  if (el.startTriplet) {
    st.trip = el.tripletMultiplier ?? 1;
    st.flags.add('tuplets');
  }
  const start = Math.round(st.pos * 16);
  st.pos += (el.duration ?? 0) * st.trip;
  if (el.endTriplet) st.trip = 1;
  return Math.round(st.pos * 16) - start;
}

function topPitch(st: State, pitches: AbcPitch[]): { top: AbcPitch; L: Letter; k: string; oct: number } {
  if (pitches.length > 1) st.flags.add('polyphony');
  const top = pitches.reduce((a, b) => (b.pitch > a.pitch ? b : a));
  const L = LETTERS[((top.pitch % 7) + 7) % 7] as Letter;
  const oct = 4 + Math.floor(top.pitch / 7);
  return { top, L, k: L + oct, oct };
}

function alterOf(st: State, L: Letter, k: string): number {
  if (k in st.bar) return st.bar[k] as number;
  return st.keyMap[L] ?? 0;
}

function addPitch(st: State, pitches: AbcPitch[], u: number): void {
  const { top, L, k, oct } = topPitch(st, pitches);
  const prev = st.notes[st.notes.length - 1];
  const tied = st.tie.pending && prev !== undefined && prev.p != null;
  if (tied && k === st.tie.key && !top.accidental) prev.d += u;
  else {
    if (top.accidental) st.bar[k] = ACC[top.accidental] ?? 0;
    const m = (oct + 1) * 12 + NATURAL[L] + alterOf(st, L, k);
    if (tied && prev.p === m) prev.d += u;
    else st.notes.push({ p: m, d: u });
  }
  st.tie = { pending: pitches.some((x) => x.startTie), key: k };
}

function readBar(st: State, el: AbcElement): void {
  st.bar = {};
  if (/repeat/.test(el.type ?? '') || el.startEnding) st.flags.add('repeats');
}

const isPlayable = (el: AbcElement): boolean =>
  el.el_type === 'note' && el.duration != null && el.rest?.type !== 'spacer';

function readNote(st: State, el: AbcElement): void {
  const u = advance(st, el);
  if (u <= 0) return;
  if (el.rest) {
    st.notes.push({ p: null, d: u });
    st.tie.pending = false;
  } else if (el.pitches?.length) addPitch(st, el.pitches, u);
}

function readElement(st: State, el: AbcElement): void {
  if (el.el_type === 'bar') readBar(st, el);
  else if (el.el_type === 'key' && el.accidentals) st.keyMap = keyMapOf(el.accidentals);
  else if (isPlayable(el)) readNote(st, el);
}

const sumFifths = (accs: { acc: string }[] = []): number =>
  accs.reduce((s, a) => s + (a.acc === 'sharp' ? 1 : a.acc === 'flat' ? -1 : 0), 0);

type Line = NonNullable<AbcTuneLike['lines']>[number];

/** Lee una línea; devuelve la armadura de la primera clave encontrada. */
function readLine(st: State, line: Line, fifths: number | null): number | null {
  const staff = line.staff?.[0];
  if (!staff) return fifths;
  let f = fifths;
  if (staff.key) {
    st.keyMap = keyMapOf(staff.key.accidentals);
    f ??= sumFifths(staff.key.accidentals);
  }
  st.bar = {};
  for (const el of staff.voices?.[0] ?? []) readElement(st, el);
  return f;
}

const FLAG_CODES = { polyphony: 'polyphony_reduced', tuplets: 'tuplets_rounded', repeats: 'repeats_ignored' } as const;

/** Árbol de abcjs → melodía (legacy `parseAbcTune` + avisos; formats-spec 14). */
export function parseAbcTune(tune: AbcTuneLike | undefined): ImportResult {
  if (!tune?.lines) throw new ImportError('parse_failed', 'No se pudo leer el texto ABC.');
  const st: State = {
    notes: [],
    keyMap: {},
    bar: {},
    pos: 0,
    trip: 1,
    tie: { pending: false, key: '' },
    flags: new Set(),
  };
  let fifths: number | null = null;
  for (const line of tune.lines) fifths = readLine(st, line, fifths);
  if (!hasPitches(st.notes)) throw new ImportError('no_notes', 'No se encontraron notas en el texto ABC.');
  const warnings = [...st.flags].map((f): ImportWarning => ({ code: FLAG_CODES[f] }));
  return finalize({
    ...metaOf(tune),
    key: normalizeFifths(fifths ?? 0),
    notes: st.notes,
    instrumentId: null,
    warnings,
  });
}

function meterOfTune(tune: AbcTuneLike): ImportResult['meter'] {
  try {
    const mf = tune.getMeterFraction?.();
    return mf?.num ? pickMeter(mf.num, mf.den).meter : '4/4';
  } catch {
    return '4/4';
  }
}

function tempoOfTune(tune: AbcTuneLike): number {
  const t = tune.metaText?.tempo;
  if (!t?.bpm) return 100;
  return Math.round(t.bpm * (t.duration?.[0] ?? 0.25) * 4);
}

function metaOf(tune: AbcTuneLike): Pick<ImportResult, 'title' | 'composer' | 'meter' | 'tempo'> {
  const meta = tune.metaText ?? {};
  return { title: meta.title ?? '', composer: meta.composer ?? '', meter: meterOfTune(tune), tempo: tempoOfTune(tune) };
}
