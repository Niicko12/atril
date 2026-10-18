import { decimate } from './downmix';
import { fft, nextPow2 } from './fft';
import { segmentNotes } from './segment';
import type { Progress, RawNote } from './types';

const THRESHOLD = 0.15;

interface YinSetup {
  y: Float32Array;
  s: number;
  W: number;
  hop: number;
  tMin: number;
  tMax: number;
  N: number;
  sq: Float64Array;
  /** Buffers reutilizados para las FFT. */
  bufs: [Float64Array, Float64Array, Float64Array, Float64Array];
}

/** Parámetros de legacy: diezmado a ~11 kHz, ventana 46 ms, salto 20 ms, f0 65–1100 Hz (ear-spec 8.1). */
function setup(x: Float32Array, sr: number): YinSetup {
  const f = Math.max(1, Math.round(sr / 11025));
  const y = decimate(x, f);
  const s = sr / f;
  const W = Math.round(s * 0.046);
  const tMax = Math.ceil(s / 65);
  const sq = new Float64Array(y.length + 1);
  for (let i = 0; i < y.length; i++) sq[i + 1] = (sq[i] as number) + (y[i] as number) ** 2;
  const N = nextPow2(W + tMax + 2);
  const bufs = [0, 0, 0, 0].map(() => new Float64Array(N)) as YinSetup['bufs'];
  return { y, s, W, hop: Math.round(s * 0.02), tMin: Math.floor(s / 1100), tMax, N, sq, bufs };
}

/**
 * Diferencia normalizada acumulada d'(τ) para τ = 0..tMax+1 (ear-spec 8.2).
 * d(τ) = E(i..i+W) + E(i+τ..i+τ+W) − 2·r(τ), con r(τ) por correlación vía FFT.
 */
function cmnd(c: YinSetup, i: number): Float64Array {
  const [re, im, re2, im2] = c.bufs;
  re.fill(0);
  im.fill(0);
  re2.fill(0);
  im2.fill(0);
  for (let j = 0; j < c.W; j++) re[j] = c.y[i + j] as number;
  for (let j = 0; j < c.W + c.tMax + 2 && i + j < c.y.length; j++) re2[j] = c.y[i + j] as number;
  fft(re, im);
  fft(re2, im2);
  for (let k = 0; k < c.N; k++) {
    const a = re[k] as number,
      b = -(im[k] as number),
      x = re2[k] as number,
      z = im2[k] as number;
    re[k] = a * x - b * z;
    im[k] = -(a * z + b * x);
  }
  fft(re, im);
  const e0 = (c.sq[i + c.W] as number) - (c.sq[i] as number);
  const d = new Float64Array(c.tMax + 2);
  d[0] = 1;
  let run = 0;
  for (let t = 1; t <= c.tMax + 1; t++) {
    const r = (re[t] as number) / c.N;
    const diff = Math.max(0, e0 + (c.sq[i + t + c.W] as number) - (c.sq[i + t] as number) - 2 * r);
    run += diff;
    d[t] = run ? (diff * t) / run : 1;
  }
  return d;
}

/** Primer mínimo bajo el umbral + interpolación parabólica → f0 (legacy). */
function pickF0(d: Float64Array, c: YinSetup): number | null {
  for (let t = c.tMin; t < c.tMax; t++) {
    if ((d[t] as number) >= THRESHOLD) continue;
    while (t + 1 < c.tMax && (d[t + 1] as number) < (d[t] as number)) t++;
    const a = d[t - 1] as number,
      b = d[t] as number,
      cc = d[t + 1] as number;
    const den = a - 2 * b + cc;
    return c.s / (t + (den ? (0.5 * (a - cc)) / den : 0));
  }
  return null;
}

export interface YinFrame {
  t: number;
  f0: number | null;
  rms: number;
}

/** Tramas de f0 y energía (ear-spec 8). */
export function yinFrames(x: Float32Array, sr: number, onProgress?: Progress): { frames: YinFrame[]; hopSec: number } {
  const c = setup(x, sr);
  const frames: YinFrame[] = [];
  const total = Math.max(1, Math.floor((c.y.length - c.W - c.tMax) / c.hop));
  for (let i = 0; i + c.W + c.tMax + 1 < c.y.length; i += c.hop) {
    const rms = Math.sqrt(((c.sq[i + c.W] as number) - (c.sq[i] as number)) / c.W);
    frames.push({ t: i / c.s, f0: pickF0(cmnd(c, i), c), rms });
    if (frames.length % 150 === 0) onProgress?.(frames.length / total);
  }
  return { frames, hopSec: c.hop / c.s };
}

/** f0 → semitonos con compensación de afinación global (mediana de desviaciones, ear-spec 8.3). */
export function framesToSemitones(frames: readonly YinFrame[]): (number | null)[] {
  const mx = frames.reduce((m, f) => Math.max(m, f.rms), 0);
  const mf = frames.map((f) => (f.f0 && f.rms > mx * 0.08 ? 69 + 12 * Math.log2(f.f0 / 440) : null));
  const devs = (mf.filter((v) => v != null) as number[]).map((v) => v - Math.round(v)).sort((a, b) => a - b);
  const off = devs.length ? (devs[Math.floor(devs.length / 2)] as number) : 0;
  return mf.map((v) => (v == null ? null : Math.round(v - off)));
}

/** Voz o instrumento solo → notas (legacy `detectNotes`). */
export function detectNotes(x: Float32Array, sr: number, onProgress?: Progress): RawNote[] {
  const { frames, hopSec } = yinFrames(x, sr, onProgress);
  onProgress?.(1);
  return segmentNotes(
    framesToSemitones(frames),
    frames.map((f) => f.t),
    hopSec,
    3,
  );
}
