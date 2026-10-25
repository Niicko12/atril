import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { io } from '@tensorflow/tfjs-core';

vi.mock('@tensorflow/tfjs-converter', async (original) => {
  const actual = await original<typeof import('@tensorflow/tfjs-converter')>();
  return {
    ...actual,
    loadGraphModel: vi.fn(async () => {
      const path = fileURLToPath(new URL('../../public/models/basic-pitch/', import.meta.url));
      const model = JSON.parse(readFileSync(path + 'model.json', 'utf8')) as {
        modelTopology: object;
        weightsManifest: { paths: string[]; weights: io.WeightsManifestEntry[] }[];
      };
      const data = readFileSync(path + model.weightsManifest[0]?.paths[0]);
      return actual.loadGraphModel({
        load: async () => ({
          modelTopology: model.modelTopology,
          weightSpecs: model.weightsManifest.flatMap((m) => m.weights),
          weightData: Uint8Array.from(data).buffer,
        }),
      });
    }),
  };
});

it('Basic Pitch real: modelo local, notas esperadas, CPU de respaldo y caché de sesión', async () => {
  const postMessage = vi.fn(),
    fetch = vi.fn(() => {
      throw new Error('La prueba no permite red');
    });
  const scope: {
    onmessage: ((e: MessageEvent) => Promise<void>) | null;
    postMessage: typeof postMessage;
    location: { origin: string };
  } = { onmessage: null, postMessage, location: { origin: 'https://atril.test' } };
  vi.stubGlobal('self', scope);
  vi.stubGlobal('fetch', fetch);
  await import('../../src/workers/basic-pitch.worker');
  const { syntheticAudio } = await import('../../src/spikes/basic-pitch/run');
  const samples22k = syntheticAudio();
  await scope.onmessage?.({ data: { id: 'one', type: 'parts', samples22k } } as MessageEvent);
  const messages = postMessage.mock.calls.map(([m]) => m);
  const result = messages.find((m) => m.type === 'parts_done');
  expect(result, JSON.stringify(messages.filter((m) => m.type === 'error'))).toBeDefined();
  const pitches = new Set(result.events.map((n: { m: number }) => n.m));
  for (const m of [60, 64, 67, 72]) expect(pitches.has(m), `MIDI ${m}`).toBe(true);
  expect(messages.some((m) => m.backend === 'cpu')).toBe(true);
  await scope.onmessage?.({ data: { id: 'two', type: 'parts', samples22k } } as MessageEvent);
  const { loadGraphModel } = await import('@tensorflow/tfjs-converter');
  expect(loadGraphModel).toHaveBeenCalledTimes(1);
  expect(loadGraphModel).toHaveBeenCalledWith('https://atril.test/models/basic-pitch/model.json');
  expect(fetch).not.toHaveBeenCalled();
}, 60000);
