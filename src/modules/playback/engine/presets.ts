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
  harmonics?: readonly number[];
  body?: readonly (readonly [hz: number, gain: number])[];
}

/** Perfiles locales de familias; revisión de color y articulación en playback-spec 24. */
export const PRESETS: Readonly<Partial<Record<Timbre, SustainedPreset>>> = {
  bow: {
    types: ['sawtooth', 'sawtooth'],
    detune: 0.6,
    harmonics: [1, 0.58, 0.76, 0.4, 0.34, 0.21, 0.24, 0.14, 0.11, 0.08, 0.06, 0.04],
    body: [
      [460, 3],
      [1200, -2],
      [2700, 4],
    ],
    breath: 0.012,
    lowpass: (f) => 2200 + f * 2.2,
    q: 0.7,
    attack: 0.045,
    peak: 0.32,
    vibrato: 5.5,
    vibratoDelay: 0.25,
    depth: 0.003,
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
    detune: 0.5,
    harmonics: [1, 0.15, 0.52, 0.1, 0.28, 0.07, 0.15, 0.04, 0.08],
    body: [
      [1200, 2],
      [2500, -2],
    ],
    lowpass: (f) => 900 + f * 1.6,
    q: 0.8,
    attack: 0.04,
    peak: 0.3,
    vibrato: 5,
    vibratoDelay: 0.35,
    depth: 0.002,
  },
  brass: {
    types: ['sawtooth', 'sawtooth'],
    detune: 0.4,
    harmonics: [1, 0.7, 0.4, 0.25, 0.16, 0.1, 0.06, 0.04],
    body: [
      [900, 2],
      [2200, 2],
    ],
    lowpass: (f) => 700 + f * 2,
    q: 0.8,
    attack: 0.05,
    peak: 0.34,
    vibrato: 0,
    vibratoDelay: 0,
    depth: 0,
    sweep: true,
  },
  voice: {
    types: ['sawtooth', 'triangle'],
    detune: 0.8,
    harmonics: [1, 0.48, 0.26, 0.15, 0.09, 0.06, 0.03],
    body: [
      [650, 4],
      [1400, 3],
      [2600, 2],
    ],
    lowpass: () => 3400,
    q: 0.7,
    attack: 0.07,
    peak: 0.42,
    vibrato: 5.3,
    vibratoDelay: 0.2,
    depth: 0.0025,
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
