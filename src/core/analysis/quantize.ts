import type { Note } from '../types';
import { MAX_NOTES } from '../types';
import type { RawNote } from './types';

/** Por nota (no silencio): de qué tramo del audio original salió (F16). */
export interface TimelineEntry {
  index: number;
  t0: number;
  t1: number;
}

/** Hueco de 1 semicorchea → alarga la nota anterior; mayor → silencio. */
function addGap(notes: Note[], gap: number): void {
  if (gap <= 0) return;
  const last = notes[notes.length - 1];
  if (gap <= 1 && last && last.p != null) last.d += gap;
  else notes.push({ p: null, d: gap });
}

/** Cuantiza a semicorcheas; huecos de 1 semicorchea alargan la nota anterior (legacy `quantize`, ear-spec 16). */
export function quantize(
  raw: readonly RawNote[],
  bpm: number,
  origin?: number | null,
): { notes: Note[]; timeline: TimelineEntry[] } {
  if (!raw.length) return { notes: [], timeline: [] };
  const u = 60 / bpm / 4;
  const o = origin ?? (raw[0] as RawNote).t0;
  const notes: Note[] = [];
  const timeline: TimelineEntry[] = [];
  let prev = 0;
  for (const r of raw) {
    let s = Math.round((r.t0 - o) / u);
    let e = Math.round((r.t1 - o) / u);
    if (s < prev) s = prev;
    if (e <= s) e = s + 1;
    addGap(notes, s - prev);
    timeline.push({ index: notes.length, t0: r.t0, t1: r.t1 });
    notes.push({ p: r.m, d: e - s });
    prev = e;
  }
  return { notes: notes.slice(0, MAX_NOTES), timeline: timeline.filter((t) => t.index < MAX_NOTES) };
}

/** Índice por búsqueda binaria; los huecos entre notas no resaltan nada (F16). */
export function timelineIndex(timeline: readonly TimelineEntry[], time: number): number {
  if (!Number.isFinite(time)) return -1;
  let low = 0,
    high = timeline.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1,
      entry = timeline[mid];
    if (!entry) return -1;
    if (time < entry.t0) high = mid - 1;
    else if (time >= entry.t1) low = mid + 1;
    else return entry.index;
  }
  return -1;
}
