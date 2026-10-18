import { frequency } from './synth-plucked';
import { track } from './voices';
import type { Voice } from './voice';

const AMPS = [1, 0.42, 0.26, 0.14, 0.09, 0.05] as const;
const INHARMONICITY = 0.0003;

/** Decaimiento base: los graves duran más (playback-spec 7.2). */
export const pianoDecay = (f: number): number => Math.min(6, Math.max(0.8, 3.2 * Math.sqrt(261.6 / f)));

/** Frecuencias de los parciales con inarmonicidad; omite los que pasan 12 kHz. */
export const pianoPartials = (f: number): { f: number; amp: number; k: number }[] =>
  AMPS.map((amp, k) => ({ f: f * (k + 1) * Math.sqrt(1 + INHARMONICITY * (k + 1) ** 2), amp, k })).filter(
    (p) => p.f <= 12000,
  );

function hammer({ c, out, t0, rand }: Voice, f: number): void {
  const nb = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (rand() * 2 - 1) * (1 - i / d.length) ** 3;
  const ns = c.createBufferSource();
  const bp = c.createBiquadFilter();
  const g = c.createGain();
  ns.buffer = nb;
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(6000, f * 6);
  bp.Q.value = 1.2;
  g.gain.value = 0.08;
  ns.connect(bp);
  bp.connect(g);
  g.connect(out);
  ns.start(t0);
  track(ns);
}

/** Piano aditivo de 6 parciales + martillo (legacy). */
export function piano(v: Voice): void {
  const { c, out, midi, t0, dur } = v;
  const f0 = frequency(midi);
  const t1 = pianoDecay(f0);
  const stopAt = t0 + Math.min(dur, t1) + 0.6;
  for (const p of pianoPartials(f0)) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = p.f;
    o.detune.value = p.k % 2 ? 3 : -2;
    const T = t1 / (1 + 0.7 * p.k);
    const a = p.amp * 0.32;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(a, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, a * 0.001), t0 + 0.004 + T);
    g.gain.cancelScheduledValues(t0 + dur);
    g.gain.setTargetAtTime(0.0001, t0 + dur, 0.08);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(stopAt);
    track(o);
  }
  hammer(v, f0);
}
