import { runSpike } from './run';

self.onmessage = async (e: MessageEvent<{ modelUrl: string }>) => {
  try {
    const result = await runSpike('worker', e.data.modelUrl, (m) => self.postMessage({ type: 'log', m }));
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', m: String((err as Error)?.stack ?? err) });
  }
};
