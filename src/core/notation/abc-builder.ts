import type { AbcBuildOptions, AbcBuildResult, Instrument, Score, View } from '../types';
import { normalizeFifths } from '../theory';
import { meterOf } from '../rhythm';
import { clefFor } from '../instruments';
import { buildHeader } from './abc-header';
import { buildBody } from './abc-body';

export type AbcScore = Pick<Score, 'title' | 'composer' | 'key' | 'meter' | 'tempo' | 'notes'>;

/** Texto ABC que dibuja abcjs + mapa carácter → índice de nota (notation-core-spec 10). */
export function buildAbc(
  score: AbcScore,
  instrument: Instrument,
  view: View,
  opts: AbcBuildOptions = {},
): AbcBuildResult {
  const transpose = view === 'written' ? instrument.transpose : 0;
  const fifths = view === 'written' ? normalizeFifths(score.key + 7 * transpose) : score.key;
  const meter = meterOf(score.meter);
  const clef = clefFor(instrument, score.notes, transpose);
  const head = buildHeader({ score, instrument, view, fifths, clef });
  const charMap = new Map<number, number>();
  if (!score.notes.length) return { abc: `${head}x${meter.bar}|]`, charMap, fifths, transpose };
  const body = buildBody({ notes: score.notes, transpose, fifths, opts }, meter, head.length, charMap);
  return { abc: head + body.replace(/\|$/, '') + '|]', charMap, fifths, transpose };
}
