// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { emptyScore } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { usePlaybackPositionStore } from '@/modules/playback';
import { useFollowAudio } from './use-follow-audio';
import { useEarSession } from '../store/ear-session.store';
import type { AudioPlayer } from '../services/audio-player';

function playerMock() {
  let listener = () => {};
  const player = {
    state: { pos: 1.23, playing: true },
    subscribe: (fn: () => void) => {
      listener = fn;
      return () => {
        listener = () => {};
      };
    },
  };
  return {
    player: player as unknown as AudioPlayer,
    tick: (pos: number, playing = true) => {
      player.state = { pos, playing };
      listener();
    },
  };
}
beforeEach(() => {
  useScoreStore.getState().replaceScore(emptyScore('piano'));
  const editor = useScoreStore.getState();
  useEarSession.getState().set({
    raw: [],
    origin: null,
    timeline: [
      { index: 0, t0: 1, t1: 2 },
      { index: 2, t0: 3, t1: 4 },
    ],
    scoreId: editor.score.id,
    revisionAtImport: editor.revision,
  });
  usePlaybackPositionStore.getState().set(-1);
});
it('sigue el tiempo corregido del reproductor, limpia silencios y pausa', () => {
  const { player, tick } = playerMock();
  const { unmount } = renderHook(() => useFollowAudio(player));
  expect(usePlaybackPositionStore.getState().index).toBe(0);
  act(() => tick(2.5));
  expect(usePlaybackPositionStore.getState().index).toBe(-1);
  act(() => tick(3.5));
  expect(usePlaybackPositionStore.getState().index).toBe(2);
  act(() => tick(3.5, false));
  expect(usePlaybackPositionStore.getState().index).toBe(-1);
  unmount();
});
it('editar invalida el seguimiento; cambiar de partitura descarta la sesión', () => {
  const { player, tick } = playerMock();
  const { result } = renderHook(() => useFollowAudio(player));
  act(() => useScoreStore.getState().addNote(60));
  expect(result.current).toBe(true);
  act(() => tick(1.23));
  expect(usePlaybackPositionStore.getState().index).toBe(-1);
  act(() => useScoreStore.getState().replaceScore(emptyScore('piano')));
  expect(useEarSession.getState().session).toBeNull();
});
it('no borra la posición del sintetizador si el audio no controla el resaltado', () => {
  useEarSession.getState().set(null);
  usePlaybackPositionStore.getState().set(5);
  const { unmount } = renderHook(() => useFollowAudio(null));
  unmount();
  expect(usePlaybackPositionStore.getState().index).toBe(5);
});
