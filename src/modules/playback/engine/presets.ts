import type { Timbre } from '@/core';

export interface SustainedPreset {
  types: readonly [OscillatorType, OscillatorType];
  detune: number;
  lowpass: (f: number) => number;
  q: number;
  attack: number;
  peak: number;
  vibrato: number;
  vibratoDelay: number;
  depth: number;
  breath?: number;
  sweep?: boolean;
}

/** Tabla 7.3 de playback-spec (valores de legacy). */
export const PRESETS: Readonly<Partial<Record<Timbre, SustainedPreset>>> = {
  bow: {
    types: ['sawtooth', 'sawtooth'],
    detune: 7,
    lowpass: (f) => 1300 + f * 1.2,
    q: 1,
    attack: 0.08,
    peak: 0.38,
    vibrato: 5.5,
    vibratoDelay: 0.25,
    depth: 0.004,
  },
  flute: {
    types: ['sine', 'triangle'],
    detune: 0,
    lowpass: () => 5000,
    q: 0.7,
    attack: 0.06,
    peak: 0.55,
    vibrato: 5,
    vibratoDelay: 0.3,
    depth: 0.003,
    breath: 0.025,
  },
  reed: {
    types: ['square', 'sawtooth'],
    detune: 4,
    lowpass: (f) => 900 + f * 1.6,
    q: 2,
    attack: 0.04,
    peak: 0.3,
    vibrato: 5,
    vibratoDelay: 0.35,
    depth: 0.002,
  },
  brass: {
    types: ['sawtooth', 'sawtooth'],
    detune: 3,
    lowpass: (f) => 700 + f * 2,
    q: 1.5,
    attack: 0.05,
    peak: 0.34,
    vibrato: 0,
    vibratoDelay: 0,
    depth: 0,
    sweep: true,
  },
  voice: {
    types: ['sawtooth', 'triangle'],
    detune: 5,
    lowpass: () => 1100,
    q: 3,
    attack: 0.07,
    peak: 0.42,
    vibrato: 5.3,
    vibratoDelay: 0.2,
    depth: 0.006,
  },
};

export const DEFAULT_PRESET: SustainedPreset = {
  types: ['triangle', 'sine'],
  detune: 0,
  lowpass: () => 3000,
  q: 0.7,
  attack: 0.02,
  peak: 0.5,
  vibrato: 0,
  vibratoDelay: 0,
  depth: 0,
};
