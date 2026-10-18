// Spike 1.10/1.11 (plan semana 1): ¿Basic Pitch corre en Worker con WebGL en Safari? ¿La CSP lo permite?
import * as tf from '@tensorflow/tfjs-core';
// El código de Basic Pitch usa métodos encadenados (tensor.slice, reshape…), que el núcleo suelto no registra solo.
import '@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import { loadGraphModel } from '@tensorflow/tfjs-converter';
import { installBasicPitch } from '@/vendor/basic-pitch/basic-pitch.js';

const SR = 22050;
/** Notas esperadas: escala Do4 Mi4 Sol4 Do5 (0,5 s c/u) y luego acorde Do-Mi-Sol (2 s). */
export const EXPECTED = [60, 64, 67, 72];

export interface SpikeResult {
  where: 'worker' | 'main';
  backend: string;
  offscreenCanvas: boolean;
  loadMs: number;
  inferMs: number;
  audioSec: number;
  notes: number[];
  found: number[];
}

function tone(out: Float32Array, midi: number, start: number, dur: number): void {
  const f = 440 * 2 ** ((midi - 69) / 12);
  const s0 = Math.floor(start * SR);
  const n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 50) * Math.exp(-t * 1.5);
    const v =
      Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.25 * Math.sin(6 * Math.PI * f * t);
    out[s0 + i] = (out[s0 + i] ?? 0) + 0.2 * env * v;
  }
}

export function syntheticAudio(): Float32Array {
  const out = new Float32Array(SR * 5);
  EXPECTED.forEach((m, i) => tone(out, m, i * 0.5, 0.48));
  for (const m of [60, 64, 67]) tone(out, m, 2.5, 2);
  return out;
}

async function pickBackend(): Promise<string> {
  try {
    if (await tf.setBackend('webgl')) {
      await tf.ready();
      return tf.getBackend();
    }
  } catch {
    // sigue con CPU
  }
  await tf.setBackend('cpu');
  await tf.ready();
  return tf.getBackend();
}

export async function runSpike(
  where: SpikeResult['where'],
  modelUrl: string,
  log: (m: string) => void,
): Promise<SpikeResult> {
  const backend = await pickBackend();
  log(`Motor de TensorFlow.js: ${backend}`);
  (globalThis as unknown as { tf: typeof tf }).tf = tf;
  const lib = installBasicPitch();
  let t0 = performance.now();
  const model = await loadGraphModel(modelUrl);
  const loadMs = performance.now() - t0;
  log(`Modelo cargado en ${loadMs.toFixed(0)} ms`);
  const bp = new lib.BasicPitch(model);
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const audio = syntheticAudio();
  t0 = performance.now();
  await bp.evaluateModel(
    audio,
    (f, o) => {
      frames.push(...f);
      onsets.push(...o);
    },
    (p) => log(`Analizando… ${Math.round(p * 100)} %`),
  );
  const inferMs = performance.now() - t0;
  const events = lib.noteFramesToTime(lib.outputToNotesPoly(frames, onsets, 0.5, 0.3, 8));
  const notes = [...new Set(events.map((e) => e.pitchMidi))].sort((a, b) => a - b);
  return {
    where,
    backend,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    loadMs,
    inferMs,
    audioSec: audio.length / SR,
    notes,
    found: EXPECTED.filter((m) => notes.includes(m)),
  };
}
