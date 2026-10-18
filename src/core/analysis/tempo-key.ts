import { normalizeFifths } from '../theory';
import type { RawNote } from './types';

/** Mediana de intervalos entre inicios + afinado contra una rejilla de corcheas (legacy `guessTempo`, ear-spec 14). */
export function guessTempo(raw: readonly RawNote[]): number {
  const ioi: number[] = [];
  for (let i = 0; i + 1 < raw.length; i++) {
    const v = (raw[i + 1] as RawNote).t0 - (raw[i] as RawNote).t0;
    if (v > 0.08) ioi.push(v);
  }
  if (!ioi.length) return 90;
  ioi.sort((a, b) => a - b);
  const md = ioi[Math.floor(ioi.length / 2)] as number;
  let bpm = 60 / (md >= 0.4 ? md : 2 * md);
  while (bpm > 150) bpm /= 2;
  while (bpm < 60) bpm *= 2;
  const o = (raw[0] as RawNote).t0;
  let best = bpm,
    bs = -Infinity;
  for (let b = bpm * 0.9; b <= bpm * 1.1; b += 0.25) {
    const e8 = 60 / b / 2;
    const sc = raw.reduce((a, r) => a + Math.cos((2 * Math.PI * (r.t0 - o)) / e8), 0);
    if (sc > bs + 1e-9) [bs, best] = [sc, b];
  }
  return Math.round(best);
}

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearson(a: readonly number[], b: readonly number[]): number {
  const ma = a.reduce((x, y) => x + y) / 12,
    mb = b.reduce((x, y) => x + y) / 12;
  let n = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < 12; i++) {
    n += ((a[i] as number) - ma) * ((b[i] as number) - mb);
    da += ((a[i] as number) - ma) ** 2;
    db += ((b[i] as number) - mb) ** 2;
  }
  return n / Math.sqrt(da * db || 1);
}

/** Krumhansl-Schmuckler; devuelve armadura (la menor → su relativa mayor) (ear-spec 15). */
export function guessKey(raw: readonly RawNote[]): number {
  const h = new Array<number>(12).fill(0);
  for (const r of raw) h[((r.m % 12) + 12) % 12] = (h[((r.m % 12) + 12) % 12] as number) + (r.t1 - r.t0);
  let best = -2,
    tonic = 0;
  for (let t = 0; t < 12; t++) {
    const rot = (p: number[]) => p.map((_, i) => p[(i - t + 12) % 12] as number);
    const cm = pearson(h, rot(MAJOR)),
      cn = pearson(h, rot(MINOR));
    if (cm > best) [best, tonic] = [cm, t];
    if (cn > best) [best, tonic] = [cn, (t + 3) % 12];
  }
  return normalizeFifths(tonic * 7);
}
