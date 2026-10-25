import type { InstrumentId } from '../types';
import { guessKey, guessTempo } from './tempo-key';
import type { PolyNote, RawNote } from './types';
export type { PolyNote } from './types';
import { chordsFor, type ChordEvent } from './chords';

export interface AudioPart {
  id: 'mel' | 'bass';
  name: string;
  description: string;
  raw: RawNote[];
  instrumentId: InstrumentId | null;
}
export interface PartsAnalysis {
  events: PolyNote[];
  parts: AudioPart[];
  bpm: number;
  key: number;
  origin: number;
  chords: ChordEvent[];
}

/** Skyline monofónico; no muta los eventos originales (ear-spec 12.1). */
export function skyline(events: readonly RawNote[], high: boolean): RawNote[] {
  const out: RawNote[] = [];
  const sorted = [...events].sort((a, b) => a.t0 - b.t0 || (high ? b.m - a.m : a.m - b.m));
  for (const n of sorted) {
    const last = out.at(-1);
    if (!last || n.t0 >= last.t1 - 0.04) {
      out.push({ ...n });
      continue;
    }
    if (high ? n.m > last.m : n.m < last.m) {
      if (n.t0 - last.t0 < 0.06) out[out.length - 1] = { ...n };
      else {
        last.t1 = n.t0;
        out.push({ ...n });
      }
    } else if (n.t1 > last.t1 + 0.25 && n.t0 > last.t0 + 0.06) out.push({ ...n, t0: last.t1 });
  }
  return out.filter((n) => n.t1 - n.t0 >= 0.06);
}
const median = (notes: readonly RawNote[]): number => {
  const ps = notes.map((n) => n.m).sort((a, b) => a - b);
  return ps[Math.floor(ps.length / 2)] ?? 0;
};
/** La melodía usa todas las alturas: Fa3/Fa♯3 ya no quedan en un hueco (deuda 4). */
export function splitParts(events: readonly RawNote[]): { melody: RawNote[]; bass: RawNote[] } {
  const melody = skyline(events, true);
  const remaining = events.filter(
    (n) =>
      n.m <= 60 &&
      !melody.some((m) => m.m === n.m && Math.min(m.t1, n.t1) - Math.max(m.t0, n.t0) >= (n.t1 - n.t0) * 0.5),
  );
  const bass = skyline(remaining, false);
  return { melody, bass: median(bass) >= median(melody) - 5 ? [] : bass };
}

/** Eventos polifónicos → partes, origen común y cifrado (ear-spec 11.5). */
export function analyzeParts(events: readonly PolyNote[]): PartsAnalysis | null {
  const valid = events
    .filter(
      (n) =>
        Number.isFinite(n.m) &&
        Number.isFinite(n.t0) &&
        Number.isFinite(n.t1) &&
        n.t1 - n.t0 >= 0.06 &&
        n.m >= 28 &&
        n.m <= 96,
    )
    .sort((a, b) => a.t0 - b.t0 || b.m - a.m);
  if (valid.length < 4) return null;
  const { melody, bass } = splitParts(valid);
  const bpm = guessTempo(melody.length >= 4 ? melody : valid);
  const key = guessKey(valid),
    origin = valid[0]?.t0 ?? 0;
  const parts: AudioPart[] = [
    { id: 'mel', name: 'Melodía', description: 'voz o instrumento principal', raw: melody, instrumentId: null },
    { id: 'bass', name: 'Bajo', description: 'la línea más grave', raw: bass, instrumentId: 'bajo' },
  ];
  return {
    events: valid,
    parts: parts.filter((p) => p.raw.length >= 3),
    bpm,
    key,
    origin,
    chords: chordsFor(valid, bpm, origin, key),
  };
}
