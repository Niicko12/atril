import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import { loadGraphModel } from '@tensorflow/tfjs-converter';
import { installBasicPitch } from '@/vendor/basic-pitch/basic-pitch.js';
import type { BasicPitchModel, BasicPitchTimedNote } from '@/vendor/basic-pitch/basic-pitch.js';
import type { PolyNote } from '@/core/analysis';
import { errorCode, throttledProgress } from './protocol';

let model: Promise<BasicPitchModel> | null = null;
async function getModel(): Promise<BasicPitchModel> {
  try {
    if (!(await tf.setBackend('webgl'))) await tf.setBackend('cpu');
  } catch {
    await tf.setBackend('cpu');
  }
  await tf.ready();
  (globalThis as unknown as { tf: typeof tf }).tf = tf;
  const lib = installBasicPitch();
  return new lib.BasicPitch(await loadGraphModel(new URL('/models/basic-pitch/model.json', self.location.origin).href));
}

const rawEvent = (n: BasicPitchTimedNote): PolyNote => ({
  m: n.pitchMidi,
  t0: n.startTimeSeconds,
  t1: n.startTimeSeconds + n.durationSeconds,
  amplitude: n.amplitude,
});

self.onmessage = async (e: MessageEvent<{ id: string; type: 'parts'; samples22k: Float32Array }>) => {
  const { id, samples22k } = e.data;
  const post = (data: Record<string, unknown>) => self.postMessage({ id, ...data });
  post({ type: 'progress', value: 0, stage: 'loading_model' });
  let bp: BasicPitchModel;
  try {
    bp = await (model ??= getModel());
  } catch {
    model = null;
    post({ type: 'error', code: 'model_load_failed' });
    return;
  }
  try {
    post({ type: 'progress', value: 0, stage: 'analyzing', backend: tf.getBackend() });
    const frames: number[][] = [],
      onsets: number[][] = [];
    const progress = throttledProgress((value) =>
      post({ type: 'progress', value, stage: 'analyzing', backend: tf.getBackend() }),
    );
    const lib = installBasicPitch();
    await bp.evaluateModel(
      samples22k,
      (f, o) => {
        for (const r of f) frames.push(r);
        for (const r of o) onsets.push(r);
      },
      progress,
    );
    const events: PolyNote[] = lib.noteFramesToTime(lib.outputToNotesPoly(frames, onsets, 0.5, 0.3, 8)).map(rawEvent);
    post({ type: 'parts_done', events });
  } catch (error) {
    post({ type: 'error', code: errorCode(error) });
  }
};
