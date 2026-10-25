import { startPracticeClock } from './clock';
import type { PracticeOptions } from '../types';

let frame: FrameRequestCallback;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function fixture(overrides: Partial<PracticeOptions> = {}) {
  const context = { currentTime: 0 };
  const play = vi.fn(), click = vi.fn(), position = vi.fn(), end = vi.fn();
  const stop = startPracticeClock({ context: context as AudioContext, play, click, position, end, duration: 2, unit: .125,
    events: [{ i: 5, s: 0, e: 1, p: 60 }, { i: 6, s: 1, e: 2, p: null }],
    settings: { start: 2, end: 2, bar: 16, beat: 4, speed: 1, repeat: true, metronome: true, countIn: true, ...overrides },
  });
  const advance = (time: number) => { context.currentTime = time; vi.advanceTimersByTime(25); frame(0); };
  return { play, click, position, end, stop, advance };
}

it('cuenta un compás, mantiene silencios y repite sin añadir cuenta ni pausas', () => {
  const f = fixture();
  expect(f.click).toHaveBeenCalledWith(.15, true);
  expect(f.play).not.toHaveBeenCalled();
  for (const time of [.5, 1, 1.5, 2, 2.2, 3.2, 4, 4.2]) f.advance(time);
  expect(f.play.mock.calls.map((call) => call[1])).toEqual([2.15, 4.15]);
  expect(f.position).toHaveBeenCalledWith(5);
  expect(f.position).toHaveBeenCalledWith(6);
  expect(f.end).not.toHaveBeenCalled();
  expect(f.click.mock.calls.filter((call) => call[1]).map((call) => call[0])).toEqual([.15, 2.15, 4.15]);
  f.stop();
  const calls = f.play.mock.calls.length;
  f.advance(10);
  expect(f.play).toHaveBeenCalledTimes(calls);
  expect(cancelAnimationFrame).toHaveBeenCalled();
});
it('sin cuenta ni repetición empieza directamente y acaba una vez', () => {
  const f = fixture({ countIn: false, repeat: false, metronome: false });
  expect(f.play).toHaveBeenCalledWith(expect.objectContaining({ i: 5 }), .15);
  expect(f.click).not.toHaveBeenCalled();
  f.advance(2.4);
  expect(f.end).toHaveBeenCalledOnce();
  f.stop();
});
it('el pulso compuesto 6/8 acentúa cada dos pulsos', () => {
  const f = fixture({ countIn: false, bar: 12, beat: 6 });
  for (const time of [.7, 1.5]) f.advance(time);
  expect(f.click.mock.calls.slice(0, 3)).toEqual([[.15, true], [.9, false], [1.65, true]]);
  f.stop();
});
