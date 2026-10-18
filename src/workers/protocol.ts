import type { RawNote } from '@/core/analysis';

/** Mensajes entre la app y los Workers (technical-decisions 8.7). */
export type PitchRequest = {
  id: string;
  type: 'detect';
  mode: 'solo' | 'mix';
  samples: Float32Array;
  sampleRate: number;
};
export type StretchRequest = { id: string; type: 'stretch'; samples: Float32Array; sampleRate: number; speed: number };

export type WorkerResponse =
  | { id: string; type: 'progress'; value: number }
  | { id: string; type: 'detect_done'; raw: RawNote[] }
  | { id: string; type: 'stretch_done'; samples: Float32Array }
  | { id: string; type: 'error'; code: 'out_of_memory' | 'internal'; message: string };

/** Progreso como máximo cada 100 ms (ear-spec 20.3). */
export function throttledProgress(post: (v: number) => void, everyMs = 100): (v: number) => void {
  let last = 0;
  return (v) => {
    const now = Date.now();
    if (now - last >= everyMs || v >= 1) {
      last = now;
      post(v);
    }
  };
}

export const errorCode = (e: unknown): 'out_of_memory' | 'internal' =>
  e instanceof RangeError || /memory/i.test(String((e as Error)?.message)) ? 'out_of_memory' : 'internal';
