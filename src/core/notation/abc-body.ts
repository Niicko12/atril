import type { AbcBuildOptions, MeasurePart, Meter, Note } from '../types';
import { abcPitch, keyAccidentals, noteName, spell } from '../theory';
import { toMeasures } from '../rhythm';
import { escapeAnnotation } from './abc-escape';

const ACCIDENTAL: Readonly<Record<number, string>> = { 2: '^^', 1: '^', 0: '=', [-1]: '_', [-2]: '__' };

interface BodyContext {
  notes: readonly Note[];
  transpose: number;
  fifths: number;
  opts: AbcBuildOptions;
  keyAcc: Record<string, number>;
}

const dur = (d: number): string => (d === 1 ? '' : String(d));

function emitPrefix(part: MeasurePart, ctx: BodyContext): string {
  if (!part.first) return '';
  let pre = '';
  const chord = ctx.notes[part.idx]?.c;
  if (chord && ctx.opts.chords !== false) pre += `"^${escapeAnnotation(chord)}"`;
  if (part.p != null && ctx.opts.names) pre += `"_${noteName(spell(part.p + ctx.transpose, ctx.fifths))}"`;
  return pre;
}

/** D1: la alteración se emite en cualquier fragmento cuya alteración difiera de la vigente en el compás. */
function emitPitch(part: MeasurePart & { p: number }, ctx: BodyContext, state: Record<string, number>): string {
  const sp = spell(part.p + ctx.transpose, ctx.fifths);
  const k = sp.letter + sp.octave;
  const current = k in state ? state[k] : ctx.keyAcc[sp.letter];
  let tok = '';
  if (sp.alter !== current) {
    tok += ACCIDENTAL[sp.alter];
    state[k] = sp.alter;
  }
  return tok + abcPitch(sp.letter, sp.octave) + dur(part.d) + (part.last ? '' : '-');
}

/** Cuerpo ABC; registra en charMap la posición de cada fragmento (offset = longitud del encabezado). */
export function buildBody(
  ctx: Omit<BodyContext, 'keyAcc'>,
  meter: Meter,
  offset: number,
  charMap: Map<number, number>,
): string {
  const full: BodyContext = { ...ctx, keyAcc: keyAccidentals(ctx.fifths) };
  let body = '';
  for (const measure of toMeasures(ctx.notes, meter)) {
    const state: Record<string, number> = {};
    for (const part of measure) {
      if (part.pos % meter.beat === 0 && body.length) body += ' ';
      const start = offset + body.length;
      charMap.set(start, part.idx);
      const pre = emitPrefix(part, full);
      const tok = part.p != null ? emitPitch({ ...part, p: part.p }, full, state) : `z${dur(part.d)}`;
      if (pre) charMap.set(start + pre.length, part.idx);
      body += pre + tok;
    }
    body += '|';
  }
  return body;
}
