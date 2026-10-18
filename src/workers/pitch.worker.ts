import { detectMelodyMix, detectNotes } from '@/core/analysis';
import { errorCode, throttledProgress, type PitchRequest, type WorkerResponse } from './protocol';

const post = (m: WorkerResponse) => self.postMessage(m);

/** Voz sola (YIN) o melodía en mezcla, fuera del hilo principal (ear-spec 8, 10, 20). */
self.onmessage = (e: MessageEvent<PitchRequest>) => {
  const { id, mode, samples, sampleRate } = e.data;
  try {
    const progress = throttledProgress((value) => post({ id, type: 'progress', value }));
    const raw =
      mode === 'mix' ? detectMelodyMix(samples, sampleRate, progress) : detectNotes(samples, sampleRate, progress);
    post({ id, type: 'detect_done', raw });
  } catch (err) {
    post({ id, type: 'error', code: errorCode(err), message: String((err as Error)?.message ?? err) });
  }
};
