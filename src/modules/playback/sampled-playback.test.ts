// @vitest-environment jsdom
import { FakeAudioContext } from './fake-audio.test-helper';
import { resetContextForTests } from './engine/context';
import { playbackEngine } from './engine';
import { prepareSounds, sampledTone } from '@/modules/sound-library';
vi.mock('@/modules/sound-library', async (original) => ({
  ...(await original<typeof import('@/modules/sound-library')>()),
  prepareSounds: vi.fn(),
  sampledTone: vi.fn(() => true),
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  resetContextForTests();
  playbackEngine.stopAll();
});
afterEach(() => {
  playbackEngine.stopAll();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const options = {
  notes: [{ p: 69, d: 4 }],
  fromIndex: 0,
  tempo: 100,
  timbre: 'bow' as const,
  instrumentId: 'violin' as const,
};
it('espera las muestras antes de programar y usa el instrumento real', async () => {
  vi.mocked(prepareSounds).mockResolvedValue(true);
  playbackEngine.play(options);
  expect(sampledTone).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(sampledTone).toHaveBeenCalledWith(expect.objectContaining({ id: 'violin', midi: 69 }));
});
it('detener durante la carga impide que arranque después', async () => {
  let resolve!: (ready: boolean) => void;
  vi.mocked(prepareSounds).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  playbackEngine.play(options);
  expect(playbackEngine.isPlaying).toBe(true);
  playbackEngine.stopAll();
  resolve(true);
  await Promise.resolve();
  expect(sampledTone).not.toHaveBeenCalled();
  expect(playbackEngine.isPlaying).toBe(false);
});
it('un error usa el sintetizador como respaldo sin llamar muestras inexistentes', async () => {
  vi.mocked(prepareSounds).mockResolvedValue(false);
  playbackEngine.play(options);
  await Promise.resolve();
  expect(sampledTone).not.toHaveBeenCalled();
  expect(FakeAudioContext.last?.sources('osc').length).toBeGreaterThan(0);
});
