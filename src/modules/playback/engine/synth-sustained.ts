import type { SustainedPreset } from './presets';
import { frequency } from './synth-plucked';
import type { Voice } from './voice';
import { track } from './voices';

const releaseEnd = (v: Voice): number => v.t0 + v.dur + 0.25;

const waveCache = new WeakMap<BaseAudioContext, Map<SustainedPreset, PeriodicWave>>();
function wave(c: AudioContext, p: SustainedPreset): PeriodicWave | null {
  if (!p.harmonics) return null;
  let cache = waveCache.get(c);
  if (!cache) {
    cache = new Map();
    waveCache.set(c, cache);
  }
  let result = cache.get(p);
  if (!result) {
    result = c.createPeriodicWave(new Float32Array(p.harmonics.length + 1), Float32Array.from([0, ...p.harmonics]));
    cache.set(p, result);
  }
  return result;
}

function vibrato(v: Voice, p: SustainedPreset, oscs: OscillatorNode[]): void {
  const lfo = v.c.createOscillator();
  const lg = v.c.createGain();
  lfo.frequency.value = p.vibrato;
  lg.gain.setValueAtTime(0, v.t0);
  lg.gain.setValueAtTime(0, v.t0 + p.vibratoDelay);
  lg.gain.linearRampToValueAtTime(1200 * Math.log2(1 + p.depth), v.t0 + p.vibratoDelay + 0.2);
  lfo.connect(lg);
  oscs.forEach((o) => lg.connect(o.detune));
  lfo.start(v.t0);
  lfo.stop(releaseEnd(v) + 0.1);
  track(lfo);
}

function breath(v: Voice, level: number, f: number, env: GainNode): void {
  const nb = v.c.createBuffer(1, Math.floor(v.c.sampleRate * 0.5), v.c.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = v.rand() * 2 - 1;
  const ns = v.c.createBufferSource();
  const bp = v.c.createBiquadFilter();
  const g = v.c.createGain();
  ns.buffer = nb;
  ns.loop = true;
  bp.type = 'bandpass';
  bp.frequency.value = f * 2;
  bp.Q.value = 2;
  g.gain.value = level;
  ns.connect(bp);
  bp.connect(g);
  g.connect(env);
  ns.start(v.t0);
  ns.stop(releaseEnd(v) + 0.05);
  track(ns);
}

function filter(v: Voice, p: SustainedPreset, f: number): AudioNode {
  const lp = v.c.createBiquadFilter();
  const target = Math.min(9000, p.lowpass(f));
  lp.type = 'lowpass';
  lp.frequency.value = target;
  lp.Q.value = p.q;
  if (p.sweep) {
    lp.frequency.setValueAtTime(p.lowpass(f) * 0.4, v.t0);
    lp.frequency.exponentialRampToValueAtTime(target, v.t0 + 0.08);
  }
  let tail: AudioNode = lp;
  for (const [hz, gain] of p.body ?? []) {
    const body = v.c.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = hz;
    body.Q.value = 1.2;
    body.gain.value = gain;
    tail.connect(body);
    tail = body;
  }
  return tail;
}

function oscillators(v: Voice, p: SustainedPreset, f: number, into: AudioNode): OscillatorNode[] {
  const custom = wave(v.c, p);
  return p.types.map((type, i) => {
    const o = v.c.createOscillator();
    const g = v.c.createGain();
    if (custom) o.setPeriodicWave(custom);
    else o.type = type;
    o.frequency.value = f;
    o.detune.value = i ? p.detune : -p.detune;
    g.gain.value = i ? 0.5 : 0.7;
    o.connect(g);
    g.connect(into);
    return o;
  });
}

/** Cuerda frotada, flauta, lengüeta, metal y voz (playback-spec 7.3). */
export function sustained(v: Voice, p: SustainedPreset): void {
  const f = frequency(v.midi);
  const lp = filter(v, p, f);
  const env = v.c.createGain();
  lp.connect(env);
  env.connect(v.out);
  const oscs = oscillators(v, p, f, lp);
  const attack = Math.min(p.attack, v.dur * 0.35);
  const hold = v.t0 + v.dur;
  const release = Math.min(0.18, Math.max(0.025, v.dur * 0.3));
  if (p.vibrato && v.dur > p.vibratoDelay + 0.08) vibrato(v, p, oscs);
  if (p.breath) breath(v, p.breath, f, env);
  env.gain.setValueAtTime(0.0001, v.t0);
  env.gain.exponentialRampToValueAtTime(p.peak, v.t0 + attack);
  env.gain.linearRampToValueAtTime(p.peak * 0.85, hold);
  env.gain.exponentialRampToValueAtTime(0.0003, hold + release);
  for (const o of oscs) {
    o.start(v.t0);
    o.stop(hold + 0.25);
    track(o);
  }
}
