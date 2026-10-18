import type { Measure, MeasurePart, Meter, Note } from '../types';

const SPLIT = [16, 12, 8, 6, 4, 3, 2, 1] as const;

/** Descompone una duración en valores escribibles (redonda, blanca con puntillo, …). */
export function splitDuration(units: number): number[] {
  const out: number[] = [];
  let rest = units;
  while (rest > 0) {
    const part = SPLIT.find((x) => x <= rest) ?? 1;
    out.push(part);
    rest -= part;
  }
  return out;
}

/** Reparte las notas en compases, partiendo y ligando las que cruzan la barra (legacy `toMeasures`). */
export function toMeasures(notes: readonly Note[], meter: Meter): Measure[] {
  const out: Measure[] = [];
  let cur: MeasurePart[] = [];
  let pos = 0;
  notes.forEach((n, idx) => {
    let rem = n.d;
    let first = true;
    while (rem > 0) {
      const take = Math.min(rem, meter.bar - pos);
      const parts = splitDuration(take);
      parts.forEach((d, k) => {
        const last = rem - take === 0 && k === parts.length - 1;
        cur.push({ idx, p: n.p, d, first, last, pos });
        first = false;
        pos += d;
        if (pos >= meter.bar) {
          out.push(cur);
          cur = [];
          pos = 0;
        }
      });
      rem -= take;
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

export function totalUnits(notes: readonly Note[]): number {
  return notes.reduce((a, n) => a + n.d, 0);
}

export function measureCount(notes: readonly Note[], meter: Meter): number {
  return Math.ceil(totalUnits(notes) / meter.bar);
}
