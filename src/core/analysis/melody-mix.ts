import { decimate } from './downmix';
import { fft } from './fft';
import { segmentNotes } from './segment';
import type { Progress, RawNote } from './types';

const N = 2048;
const LO = 50;
const HI = 84;
const K = HI - LO + 1;
const HARMONICS = 10;

type Bins = [number, number, number][];

/** Por candidato MIDI 50–84: bins de 10 armónicos ±1,5 % con peso 0,8^(h−1) (ear-spec 10.1, etapa 2). */
function harmonicCandidates(s: number): Bins[] {
  return Array.from({ length: K }, (_, k) => {
    const f0 = 440 * 2 ** ((LO + k - 69) / 12);
    const list: Bins = [];
    for (let h = 1; h <= HARMONICS; h++) {
      const b = (f0 * h * N) / s;
      if (b >= N / 2 - 2) break;
      list.push([Math.floor(b * 0.985), Math.ceil(b * 1.015), 0.8 ** (h - 1)]);
    }
    return list;
  });
}

interface Salience {
  sal: Float32Array[];
  rms: number[];
  times: number[];
}

function frameSalience(mag: Float32Array, cand: Bins[]): Float32Array {
  const row = new Float32Array(K);
  for (let k = 0; k < K; k++) {
    let sum = 0;
    for (const [b0, b1, w] of cand[k] as Bins) {
      let m = 0;
      for (let b = b0; b <= b1; b++) m = Math.max(m, mag[b] as number);
      sum += w * m;
    }
    row[k] = sum;
  }
  return row;
}

/** Saliencia armónica por trama, ventana Hann 2048, salto 11,6 ms, magnitud √|X| (etapa 3). */
function salienceFrames(y: Float32Array, s: number, onProgress?: Progress): Salience & { hop: number } {
  const hop = Math.round(s * 0.0116);
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const cand = harmonicCandidates(s);
  const re = new Float32Array(N),
    im = new Float32Array(N),
    mag = new Float32Array(N / 2);
  const out: Salience = { sal: [], rms: [], times: [] };
  const total = Math.max(1, Math.floor((y.length - N) / hop));
  for (let i = 0, fi = 0; i + N < y.length; i += hop, fi++) {
    let e = 0;
    for (let j = 0; j < N; j++) {
      const v = y[i + j] as number;
      e += v * v;
      re[j] = v * (win[j] as number);
      im[j] = 0;
    }
    fft(re, im);
    for (let b = 0; b < N / 2; b++) mag[b] = Math.sqrt(Math.sqrt((re[b] as number) ** 2 + (im[b] as number) ** 2));
    out.sal.push(frameSalience(mag, cand));
    out.rms.push(Math.sqrt(e / N));
    out.times.push(i / s);
    if (fi % 120 === 0) onProgress?.((0.9 * fi) / total);
  }
  return { ...out, hop };
}

/** Camino más probable con penalización por salto (etapa 4, legacy). */
function viterbiPath(sal: Float32Array[]): Uint8Array {
  const T = sal.length;
  const back = new Uint8Array(T * K);
  let prev = Float64Array.from(sal[0] as Float32Array, (v) => Math.log(v + 1e-6));
  let curr = new Float64Array(K);
  for (let t = 1; t < T; t++) {
    for (let j = 0; j < K; j++) {
      let best = -Infinity,
        bi = 0;
      for (let i = 0; i < K; i++) {
        const dd = Math.abs(i - j);
        const v = (prev[i] as number) - (dd ? 1.6 + 0.08 * Math.min(12, dd) : 0);
        if (v > best) [best, bi] = [v, i];
      }
      curr[j] = best + Math.log(((sal[t] as Float32Array)[j] as number) + 1e-6);
      back[t * K + j] = bi;
    }
    [prev, curr] = [curr, prev];
  }
  const path = new Uint8Array(T);
  let bk = 0;
  for (let k = 1; k < K; k++) if ((prev[k] as number) > (prev[bk] as number)) bk = k;
  path[T - 1] = bk;
  for (let t = T - 1; t > 0; t--) path[t - 1] = back[t * K + (path[t] as number)] as number;
  return path;
}

/** Trama con voz si sobresale: > 0,7·mediana de máximos, > 1,35·media y RMS > 4 % (etapa 5). */
function voicing({ sal, rms }: Salience, path: Uint8Array): (number | null)[] {
  const maxS = sal.map((r) => r.reduce((m, v) => Math.max(m, v), 0));
  const medS = [...maxS].sort((a, b) => a - b)[Math.floor(maxS.length / 2)] as number;
  const mr = rms.reduce((m, v) => Math.max(m, v), 0);
  return Array.from(path, (k, t) => {
    const row = sal[t] as Float32Array;
    const v = row[k] as number;
    const mean = row.reduce((a, b) => a + b, 0) / K;
    return v > medS * 0.7 && v > mean * 1.35 && (rms[t] as number) > mr * 0.04 ? LO + k : null;
  });
}

/** Quita notas cortas (< 0,45 s) que saltan > 9 semitonos respecto a ambos vecinos (etapa 7). */
function dropOutliers(notes: RawNote[]): RawNote[] {
  return notes.filter((nt, i) => {
    const a = notes[i - 1],
      b = notes[i + 1];
    const far = (!a || Math.abs(a.m - nt.m) > 9) && (!b || Math.abs(b.m - nt.m) > 9);
    return !(far && nt.t1 - nt.t0 < 0.45);
  });
}

/** Canción completa → melodía principal (legacy `detectMelodyMix`, ear-spec 10). */
export function detectMelodyMix(x: Float32Array, sr: number, onProgress?: Progress): RawNote[] {
  const f = Math.max(1, Math.round(sr / 22050));
  const s = sr / f;
  const frames = salienceFrames(decimate(x, f), s, onProgress);
  if (frames.sal.length < 4) return [];
  const q = voicing(frames, viterbiPath(frames.sal));
  onProgress?.(1);
  const hopSec = frames.hop / s;
  return dropOutliers(segmentNotes(q, frames.times, hopSec, Math.round(0.11 / hopSec)));
}
