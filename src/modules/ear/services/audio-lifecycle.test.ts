// @vitest-environment jsdom
import { FakeAudioContext } from '@/modules/playback/fake-audio.test-helper';
import { AudioPlayer } from './audio-player';
import { releaseAudio, stretched } from './ear.service';
import { CancelledError } from './worker-client';
import type { DecodedAudio } from '../types';

const audio = (value: number): DecodedAudio => ({
  name: 'mismo.wav',
  duration: 1,
  sampleRate: 4,
  mono: Float32Array.from([value, value, value, value]),
  buffer: { duration: 1 } as AudioBuffer,
});
let requests = 0,
  hold = false;
class StretchWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror = null;
  postMessage(msg: { id: string; samples: Float32Array }) {
    requests++;
    if (!hold)
      queueMicrotask(() =>
        this.onmessage?.({ data: { id: msg.id, type: 'stretch_done', samples: msg.samples } } as MessageEvent),
      );
  }
  terminate() {}
}
beforeEach(() => {
  requests = 0;
  hold = false;
  vi.stubGlobal('Worker', StretchWorker);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  releaseAudio(audio(0));
  vi.restoreAllMocks();
});
it('la caché distingue audios del mismo nombre y se libera al cerrar', async () => {
  const a = audio(0.1),
    b = audio(0.9);
  const first = await stretched(a, [0, 1], 0.5);
  expect(await stretched(a, [0, 1], 0.5)).toBe(first);
  expect(requests).toBe(1);
  const second = await stretched(b, [0, 1], 0.5);
  expect(second.getChannelData(0)[0]).toBeCloseTo(0.9);
  expect(requests).toBe(2);
  releaseAudio(b);
  expect(await stretched(b, [0, 1], 0.5)).not.toBe(second);
  expect(requests).toBe(3);
  releaseAudio(b);
});
it('cerrar durante el estiramiento cancela sin retener el audio', async () => {
  hold = true;
  const a = audio(0.5);
  const pending = stretched(a, [0, 1], 0.5);
  const assertion = expect(pending).rejects.toBeInstanceOf(CancelledError);
  releaseAudio(a);
  await assertion;
});
it('ocultar la pestaña detiene el audio y dispose quita el listener', async () => {
  const p = new AudioPlayer(audio(0.5));
  p.attach();
  await p.play();
  expect(p.state.playing).toBe(true);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(p.state.playing).toBe(false);
  const remove = vi.spyOn(document, 'removeEventListener');
  p.dispose();
  expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
});
