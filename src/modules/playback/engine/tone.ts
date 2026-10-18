import type { Midi, Timbre } from '@/core';
import { getContext, getMaster } from './context';
import { DEFAULT_PRESET, PRESETS } from './presets';
import { piano } from './synth-piano';
import { plucked } from './synth-plucked';
import { sustained } from './synth-sustained';
import type { Voice } from './voice';

/** Una nota con el timbre de su familia; ignora valores inválidos (playback-spec 15, P3/P4). */
export function tone(midi: Midi, t0: number, dur: number, timbre: Timbre): void {
  if (!(midi >= 0 && midi <= 127) || !(dur > 0)) return;
  const c = getContext();
  const out = c.createGain();
  out.connect(getMaster());
  const v: Voice = { c, out, midi, t0, dur, rand: Math.random };
  if (timbre === 'guitar' || timbre === 'bass') plucked(v, timbre === 'bass');
  else if (timbre === 'piano') piano(v);
  else sustained(v, PRESETS[timbre] ?? DEFAULT_PRESET);
}
