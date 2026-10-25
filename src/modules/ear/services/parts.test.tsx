// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act } from '@testing-library/react';
import { emptyScore } from '@/core';
import { analyzeParts, type PartsAnalysis } from '@/core/analysis';
import { useScoreStore } from '@/modules/editor';
import { useEarSession } from '../store/ear-session.store';
import { cancelParts, detectParts, openPart } from './parts.service';
import { requantize } from './ear.service';
import type { DecodedAudio } from '../types';

const events = [0, 1, 2, 3].flatMap((t) => [
  { m: 60 + t, t0: t + 1, t1: t + 1.8, amplitude: 0.8 },
  { m: 36 + t, t0: t, t1: t + 0.8, amplitude: 0.8 },
]);
const audio = { name: 'canción', duration: 120, sampleRate: 100, mono: new Float32Array(12000) } as DecodedAudio;
let requestedSamples = 0;
let finishRender: (() => void) | null = null;
let deferRender = false;
class Offline {
  destination = {};
  constructor(
    _channels: number,
    private length: number,
  ) {}
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {} };
  }
  startRendering() {
    const result = { getChannelData: () => new Float32Array(this.length) };
    return deferRender
      ? new Promise((resolve) => {
          finishRender = () => resolve(result);
        })
      : Promise.resolve(result);
  }
}
class PartsWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror = null;
  postMessage(msg: { id: string; samples22k: Float32Array }) {
    requestedSamples = msg.samples22k.length;
    queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, type: 'parts_done', events } } as MessageEvent));
  }
  terminate() {}
}
beforeEach(() => {
  cancelParts();
  deferRender = false;
  finishRender = null;
  requestedSamples = 0;
  vi.stubGlobal('OfflineAudioContext', Offline);
  vi.stubGlobal('Worker', PartsWorker);
  useScoreStore.getState().replaceScore(emptyScore('bajo'));
  useEarSession.getState().set(null);
});
afterEach(() => cancelParts());
const analysis = (): PartsAnalysis => {
  const result = analyzeParts(events)!;
  return {
    ...result,
    parts: result.parts.map((p) => ({ ...p, raw: events.filter((n) => (p.id === 'mel' ? n.m >= 60 : n.m < 60)) })),
    chords: [{ u: 0, name: 'Do' }],
  };
};
it('limita a 90 s, remuestrea y conserva el desplazamiento A-B', async () => {
  const result = await detectParts(audio, { a: 10, b: 120, loop: true }, () => {});
  expect(requestedSamples).toBe(90 * 22050);
  expect(result.cut).toBe(true);
  expect(result.analysis?.origin).toBe(10);
  expect(audio.mono.byteLength).toBe(12000 * 4);
});
it('cancelar durante el remuestreo no inicia un Worker obsoleto', async () => {
  deferRender = true;
  const promise = detectParts(audio, { a: 0, b: 3, loop: false }, () => {});
  const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  cancelParts();
  (finishRender as (() => void) | null)?.();
  await assertion;
  expect(requestedSamples).toBe(0);
});
it('melodía y bajo mantienen origen común, instrumentos y acordes opcionales', async () => {
  const a = analysis();
  await act(() => openPart(audio, a, a.parts[0]!, { withChords: true }));
  let score = useScoreStore.getState().score;
  expect([score.instrumentId, score.source, score.title]).toEqual(['piano', 'ear_parts', 'canción – Melodía']);
  expect(score.notes[0]?.p).toBeNull();
  expect(score.notes.some((n) => n.c === 'Do')).toBe(true);
  expect(useEarSession.getState().session?.origin).toBe(0);
  await act(() => openPart(audio, a, a.parts[1]!, { withChords: false }));
  score = useScoreStore.getState().score;
  expect(score.instrumentId).toBe('bajo');
  expect(score.notes[0]?.p).toBe(36);
  expect(score.notes.every((n) => !n.c)).toBe(true);
});
it('reajusta acordes, permite deshacer y nunca modifica una partitura ajena', async () => {
  const a = analysis();
  await act(() => openPart(audio, a, a.parts[0]!, { withChords: true }));
  act(() => useScoreStore.getState().setMeta({ tempo: 60 }));
  act(() => {
    expect(requantize()).toBe(60);
  });
  expect(useScoreStore.getState().score.notes.some((n) => n.c)).toBe(true);
  const revision = useEarSession.getState().session?.revisionAtImport;
  act(() => useScoreStore.getState().undo());
  expect(useScoreStore.getState().revision).not.toBe(revision);
  act(() => useScoreStore.getState().replaceScore(emptyScore('piano')));
  expect(requantize()).toBeNull();
});
it('un resultado cancelado antes de abrir no reemplaza el editor', async () => {
  const a = analysis(),
    id = useScoreStore.getState().score.id;
  await expect(openPart(audio, a, a.parts[0]!, { withChords: true, valid: () => false })).resolves.toBe(false);
  expect(useScoreStore.getState().score.id).toBe(id);
});
it('cancelar mientras se prepara el reemplazo tampoco aplica una parte', async () => {
  const a = analysis(),
    id = useScoreStore.getState().score.id;
  let current = true;
  const promise = openPart(audio, a, a.parts[0]!, { withChords: false, valid: () => current });
  current = false;
  await expect(promise).resolves.toBe(false);
  expect(useScoreStore.getState().score.id).toBe(id);
});
