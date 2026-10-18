// @vitest-environment jsdom
import { FakeAudioContext } from './fake-audio.test-helper';
import { resetContextForTests } from './engine/context';
import { resetUnlockForTests } from './engine/ios-unlock';
import { playbackEngine } from './engine';
import { usePlaybackPositionStore } from './store/playback-position.store';
import { useToastStore } from '@/shared/toast';

let frames: FrameRequestCallback[] = [];
const runFrame = () => {
  const fs = frames;
  frames = [];
  fs.forEach((f) => f(0));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => (frames = []));
  resetContextForTests();
  resetUnlockForTests();
  playbackEngine.stopAll();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ctx = () => FakeAudioContext.last as FakeAudioContext;
const notes = [
  { p: 60, d: 4 },
  { p: null, d: 4 },
  { p: 64, d: 4 },
];

describe('playbackEngine', () => {
  it('reproduce, informa la nota que suena y termina solo (T-POS-02)', () => {
    const onEnd = vi.fn();
    const seen: number[] = [];
    playbackEngine.play({ notes, fromIndex: 0, tempo: 120, timbre: 'flute', onPosition: (i) => seen.push(i), onEnd });
    expect(playbackEngine.isPlaying).toBe(true);
    for (const t of [0.2, 0.7, 1.2, 2.0]) {
      ctx().currentTime = t;
      vi.advanceTimersByTime(25);
      runFrame();
    }
    expect(seen).toEqual([0, 1, 2]);
    expect(onEnd).toHaveBeenCalled();
    expect(playbackEngine.isPlaying).toBe(false);
  });
  it('arranca desde fromIndex y stopAll detiene y limpia la posición (T-SCH-03, T-STP-01)', () => {
    playbackEngine.play({ notes, fromIndex: 2, tempo: 120, timbre: 'piano' });
    ctx().currentTime = 0.2;
    runFrame();
    expect(usePlaybackPositionStore.getState().index).toBe(2);
    playbackEngine.stopAll();
    expect([playbackEngine.isPlaying, usePlaybackPositionStore.getState().index]).toEqual([false, -1]);
  });
  it('sin notas no reproduce; los suscriptores reciben los cambios', () => {
    const fn = vi.fn();
    const off = playbackEngine.subscribe(fn);
    playbackEngine.play({ notes: [], fromIndex: 0, tempo: 100, timbre: 'piano' });
    expect(fn).not.toHaveBeenCalled();
    playbackEngine.play({ notes, fromIndex: 0, tempo: 100, timbre: 'piano' });
    playbackEngine.stopAll();
    expect(fn.mock.calls).toEqual([[true], [false]]);
    off();
  });
  it('vista previa crea una nota; ocultar la pestaña detiene la reproducción (D5)', () => {
    playbackEngine.preview(67, 'reed');
    expect(ctx().sources('osc').length).toBeGreaterThan(0);
    playbackEngine.play({ notes, fromIndex: 0, tempo: 100, timbre: 'piano' });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(playbackEngine.isPlaying).toBe(false);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });
  it('sin Web Audio: no suena, avisa una vez y no rompe (S13)', () => {
    vi.stubGlobal('AudioContext', undefined);
    useToastStore.getState().clear();
    playbackEngine.preview(60, 'piano');
    expect(useToastStore.getState().message).toBe('Tu navegador no puede reproducir sonido.');
    expect(() => playbackEngine.play({ notes, fromIndex: 0, tempo: 100, timbre: 'piano' })).not.toThrow();
  });
});
