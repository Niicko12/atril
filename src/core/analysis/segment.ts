import type { RawNote } from './types';

type Seg = { m: number | null; s: number; e: number };

/** Mediana móvil de 5 tramas; null si más de la mitad son null. */
function median5(q: readonly (number | null)[]): (number | null)[] {
  return q.map((_, i) => {
    const w = q.slice(Math.max(0, i - 2), i + 3);
    if (w.filter((v) => v == null).length > w.length / 2) return null;
    const vs = (w.filter((v) => v != null) as number[]).sort((a, b) => a - b);
    return vs[Math.floor(vs.length / 2)] ?? null;
  });
}

function runs(values: readonly (number | null)[]): Seg[] {
  const segs: Seg[] = [];
  values.forEach((v, i) => {
    const last = segs[segs.length - 1];
    if (last && last.m === v) last.e = i;
    else segs.push({ m: v, s: i, e: i });
  });
  return segs;
}

/** Absorbe un segmento corto en sus vecinos; devuelve si cambió algo. */
function absorbShort(segs: Seg[], min: number): boolean {
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i] as Seg;
    if (g.e - g.s + 1 >= min) continue;
    const p = segs[i - 1];
    const nx = segs[i + 1];
    if (p && nx && p.m === nx.m) {
      p.e = nx.e;
      segs.splice(i, 2);
    } else if (p) {
      p.e = g.e;
      segs.splice(i, 1);
    } else if (nx) {
      nx.s = g.s;
      segs.splice(i, 1);
    } else continue;
    return true;
  }
  return false;
}

/** Tramas cuantizadas → notas (legacy `segmentNotes`, ear-spec 9). */
export function segmentNotes(
  q: readonly (number | null)[],
  times: readonly number[],
  hopSec: number,
  min: number,
): RawNote[] {
  const segs = runs(median5(q));
  for (let guard = 0; guard < 100000 && absorbShort(segs, min); guard++);
  const merged = runs(segs.flatMap((g) => Array.from({ length: g.e - g.s + 1 }, () => g.m)));
  return merged
    .filter((g) => g.m != null && g.m >= 28 && g.m <= 100)
    .map((g) => ({ m: g.m as number, t0: times[g.s] as number, t1: (times[g.e] as number) + hopSec }));
}
