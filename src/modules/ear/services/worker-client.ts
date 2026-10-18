import type { WorkerResponse } from '@/workers/protocol';

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

export class WorkerFailure extends Error {
  constructor(public readonly code: 'out_of_memory' | 'internal') {
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
    request<T>(msg: Record<string, unknown>, transfer: Transferable[], onProgress?: (v: number) => void): Promise<T> {
      const id = crypto.randomUUID();
      const w = ensure();
      return new Promise<T>((resolve, reject) => {
        pending = { id, reject };
        w.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const m = e.data;
          if (m.id !== id) return;
          if (m.type === 'progress') onProgress?.(m.value);
          else if (m.type === 'error') reject(new WorkerFailure(m.code));
          else resolve(m as T);
          if (m.type !== 'progress') pending = null;
        };
        w.onerror = () => reject(new WorkerFailure('internal'));
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
