import type { WorkerResponse } from '@/workers/protocol';
type WorkerProgress = (v: number, stage?: 'loading_model' | 'analyzing', backend?: string) => void;

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

export class WorkerFailure extends Error {
  constructor(public readonly code: 'out_of_memory' | 'internal' | 'model_load_failed') {
    super(code);
  }
}

/**
 * Un Worker por tipo de tarea, creado bajo demanda. Cancelar lo termina y se recrea en el próximo uso
 * (las funciones de análisis son síncronas; ear-spec 20.4).
 */
export function createWorkerClient(factory: () => Worker) {
  let worker: Worker | null = null;
  let pending: { id: string; reject(e: Error): void } | null = null;
  const ensure = () => (worker ??= factory());
  return {
    request<T>(msg: Record<string, unknown>, transfer: Transferable[], onProgress?: WorkerProgress): Promise<T> {
      if (pending) this.cancel();
      const id = crypto.randomUUID();
      const w = ensure();
      return new Promise<T>((resolve, reject) => {
        pending = { id, reject };
        w.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const m = e.data;
          if (m.id !== id || pending?.id !== id) return;
          if (m.type === 'progress') onProgress?.(m.value, m.stage, m.backend);
          else if (m.type === 'error') reject(new WorkerFailure(m.code));
          else resolve(m as T);
          if (m.type !== 'progress') pending = null;
        };
        w.onerror = () => {
          if (pending?.id !== id) return;
          pending = null;
          worker?.terminate();
          worker = null;
          reject(new WorkerFailure('internal'));
        };
        w.postMessage({ ...msg, id }, transfer);
      });
    },
    cancel(): void {
      worker?.terminate();
      worker = null;
      pending?.reject(new CancelledError());
      pending = null;
    },
  };
}
