import type { Clef, Instrument, Score, View } from '../types';
import { abcKey } from '../theory';
import { escapeAbcText } from './abc-escape';

type HeaderScore = Pick<Score, 'title' | 'composer' | 'meter' | 'tempo'>;

/** Nombre de la parte (segundo T:), notation-core-spec 7.3. */
export function partName(instrument: Instrument, view: View): string {
  if (view === 'concert' && instrument.transpose !== 0) return `${instrument.name} · sonido real`;
  if (view === 'written' && instrument.note) return `${instrument.name} · ${instrument.note.toLowerCase()}`;
  return instrument.name;
}

export interface HeaderArgs {
  score: HeaderScore;
  instrument: Instrument;
  view: View;
  fifths: number;
  clef: Clef;
}

export function buildHeader({ score, instrument, view, fifths, clef }: HeaderArgs): string {
  let head = `X:1\nT:${escapeAbcText(score.title || 'Sin título')}\nT:${partName(instrument, view)}\n`;
  if (score.composer) head += `C:${escapeAbcText(score.composer)}\n`;
  head += `M:${score.meter === '4/4' ? 'C' : score.meter}\nL:1/16\nQ:1/4=${score.tempo || 100}\n`;
  head += `K:${abcKey(fifths)} clef=${clef}\n`;
  return head;
}
