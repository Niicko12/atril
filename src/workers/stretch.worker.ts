import { wsola } from '@/core/analysis';
import { errorCode, type StretchRequest, type WorkerResponse } from './protocol';

/** Audio más lento sin cambio de tono (ear-spec 7). La respuesta se transfiere sin copiar. */
self.onmessage = (e: MessageEvent<StretchRequest>) => {
  const { id, samples, sampleRate, speed } = e.data;
  try {
    const out = wsola(samples, sampleRate, speed);
    self.postMessage({ id, type: 'stretch_done', samples: out } satisfies WorkerResponse, { transfer: [out.buffer] });
  } catch (err) {
    self.postMessage({ id, type: 'error', code: errorCode(err), message: String(err) } satisfies WorkerResponse);
  }
};
