// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { emptyScore } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { useLibraryVersion } from '../services/autosave.service';
import { useTabGuard } from './use-tab-guard';

class Channel {
  static instances: Channel[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
  constructor() {
    Channel.instances.push(this);
  }
  receive(data: unknown) {
    act(() => this.onmessage?.({ data }));
  }
}
const savedAt = '2026-10-24T10:00:00.000Z';
let id: string;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(savedAt));
  Channel.instances = [];
  vi.stubGlobal('BroadcastChannel', Channel);
  const score = { ...emptyScore('piano'), savedAt };
  id = score.id;
  useScoreStore.getState().replaceScore(score);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('solo avisa de guardados más recientes de la partitura actual', () => {
  const { result } = renderHook(() => useTabGuard());
  const ch = Channel.instances[0]!;
  const version = useLibraryVersion.getState().v;
  ch.receive({ type: 'saved', tab: 'other', id, updatedAt: '2026-10-24T09:00:00.000Z' });
  expect(result.current.otherTabSaved).toBe(false);
  ch.receive({ type: 'saved', tab: 'other', id, updatedAt: '2026-10-24T11:00:00.000Z' });
  expect(result.current.otherTabSaved).toBe(true);
  expect(useLibraryVersion.getState().v).toBe(version + 2);
  act(() => useScoreStore.getState().replaceScore(emptyScore('piano')));
  expect(result.current.otherTabSaved).toBe(false);
});

it('descarta mensajes inválidos y propios sin modificar el aviso', () => {
  const { result } = renderHook(() => useTabGuard());
  const ch = Channel.instances[0]!;
  const ownTab = ch.postMessage.mock.calls[0]![0].tab;
  for (const message of [
    null,
    {},
    { type: 'saved', tab: 1 },
    { type: 'saved', tab: 'other', id, updatedAt: 'invalid' },
    { type: 'saved', tab: ownTab, id },
  ])
    ch.receive(message);
  expect(result.current).toEqual({ otherTabOpen: false, otherTabSaved: false });
});

it('vence los latidos y cierra canal y temporizador al desmontar', () => {
  const { result, unmount } = renderHook(() => useTabGuard());
  const ch = Channel.instances[0]!;
  ch.receive({ type: 'open', tab: 'other', id });
  expect(result.current.otherTabOpen).toBe(true);
  act(() => vi.advanceTimersByTime(30000));
  expect(result.current.otherTabOpen).toBe(false);
  ch.receive({ type: 'open', tab: 'other', id });
  expect(result.current.otherTabOpen).toBe(true);
  ch.receive({ type: 'close', tab: 'other' });
  expect(result.current.otherTabOpen).toBe(false);
  unmount();
  expect(ch.close).toHaveBeenCalledOnce();
  expect(ch.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'close' }));
  expect(vi.getTimerCount()).toBe(0);
});

it('funciona sin BroadcastChannel', () => {
  vi.stubGlobal('BroadcastChannel', undefined);
  const { result } = renderHook(() => useTabGuard());
  expect(result.current).toEqual({ otherTabOpen: false, otherTabSaved: false });
});
