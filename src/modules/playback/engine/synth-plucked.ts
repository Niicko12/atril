import { track } from './voices';
import type { Voice } from './voice';

const CACHE_LIMIT = 128;
const cache = new Map<string, AudioBuffer>();

export const frequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export interface KsParams {
  midi: number;
  sustain: number;
  bright: number;
}

/** Karplus-Strong precalculado (legacy `ksBuffer`) con caché LRU de 128 (playback-spec 7.1). */
export function ksBuffer(
  c: BaseAudioContext,
  { midi, sustain, bright }: KsParams,
  rand: () => number = Math.random,
): AudioBuffer {
  const key = `${midi}:${sustain}:${bright}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const sr = c.sampleRate;
  const f = frequency(midi);
  const len = Math.floor(sr * Math.min(sustain + 0.2, 4));
  const n = Math.max(2, Math.round(sr / f));
  const buf = c.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const ring = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) ring[i] = prev = prev + bright * (rand() * 2 - 1 - prev);
  const decay = 0.001 ** (1 / (f * sustain));
  let idx = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx] as number;
    out[i] = a;
    peak = Math.max(peak, Math.abs(a));
    ring[idx] = (a + (ring[(idx + 1) % n] as number)) * 0.5 * decay;
    idx = (idx + 1) % n;
  }
  const g = peak ? 0.8 / peak : 1;
  for (let i = 0; i < len; i++) out[i] = (out[i] as number) * g;
  cache.set(key, buf);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return buf;
}

export const ksCacheSize = (): number => cache.size;

/** Guitarra y bajo. */
export function plucked({ c, out, midi, t0, dur, rand }: Voice, bass: boolean): void {
  const src = c.createBufferSource();
  src.buffer = ksBuffer(c, { midi, sustain: bass ? 3 : 2.2, bright: bass ? 0.35 : 0.6 }, rand);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = bass ? 1800 : 5000;
  src.connect(lp);
  lp.connect(out);
  const level = bass ? 1.1 : 0.9;
  const relEnd = t0 + dur + 0.25;
  out.gain.setValueAtTime(level, t0);
  out.gain.setValueAtTime(level, t0 + dur);
  out.gain.exponentialRampToValueAtTime(0.0005, relEnd);
  src.start(t0);
  src.stop(relEnd + 0.05);
  track(src);
}
