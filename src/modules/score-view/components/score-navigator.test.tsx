// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { emptyScore, type Note } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { playbackEngine } from '@/modules/playback';
import { ScoreNavigator } from './score-navigator';

const playback = vi.hoisted(() => ({ playing: false }));

vi.mock('@/modules/playback', () => ({
  playbackEngine: { stopAll: vi.fn(), play: vi.fn() },
  usePlayback: () => ({ playing: playback.playing }),
}));

const reset = (notes: Note[], selection = -1) => {
  act(() => {
    useScoreStore.getState().replaceScore({ ...emptyScore('piano'), notes });
    useScoreStore.getState().select(selection);
  });
  vi.clearAllMocks();
  playback.playing = false;
};
const input = () => screen.getByRole('spinbutton', { name: 'Ir al compás' });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('ScoreNavigator', () => {
  it('deshabilita los controles para partituras vacías', () => {
    reset([]);
    render(<ScoreNavigator />);
    expect(input()).toBeDisabled();
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
  it('avanza por compases dentro de una misma nota ligada y respeta los límites', () => {
    reset([
      { p: 60, d: 48 },
      { p: 62, d: 16 },
    ]);
    render(<ScoreNavigator />);
    expect(screen.getByRole('button', { name: 'Compás anterior' })).toBeDisabled();
    click('Compás siguiente');
    expect(input()).toHaveValue(2);
    expect(useScoreStore.getState().selection).toBe(0);
    click('Compás siguiente');
    expect(input()).toHaveValue(3);
    click('Compás siguiente');
    expect(input()).toHaveValue(4);
    expect(useScoreStore.getState().selection).toBe(1);
    expect(screen.getByRole('button', { name: 'Compás siguiente' })).toBeDisabled();
    click('Compás anterior');
    expect(input()).toHaveValue(3);
    expect(playbackEngine.stopAll).toHaveBeenCalledTimes(4);
  });
  it('escucha desde el compás dentro de un silencio sin modificar score ni índices', () => {
    reset([
      { p: 60, d: 24 },
      { p: null, d: 12 },
      { p: 64, d: 8 },
    ]);
    const before = structuredClone(useScoreStore.getState().score);
    render(<ScoreNavigator />);
    fireEvent.change(input(), { target: { value: '3' } });
    click('Escuchar desde este compás');
    expect(playbackEngine.play).toHaveBeenCalledWith(
      expect.objectContaining({
        fromIndex: 1,
        tempo: 96,
        notes: [
          { p: 60, d: 24 },
          { p: null, d: 4 },
          { p: 64, d: 8 },
        ],
      }),
    );
    expect(useScoreStore.getState().score).toEqual(before);
    expect(useScoreStore.getState().dirty).toBe(false);
  });
  it('desde selección usa la nota completa y desde inicio usa índice cero', () => {
    reset(
      [
        { p: 60, d: 16 },
        { p: 62, d: 8 },
      ],
      1,
    );
    render(<ScoreNavigator />);
    expect(input()).toHaveValue(2);
    click('Desde la nota seleccionada');
    expect(playbackEngine.play).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromIndex: 1, notes: useScoreStore.getState().score.notes }),
    );
    click('Desde el inicio');
    expect(playbackEngine.play).toHaveBeenLastCalledWith(expect.objectContaining({ fromIndex: 0 }));
  });
  it('ofrece detener cuando el motor está reproduciendo', () => {
    reset([{ p: 60, d: 16 }]);
    playback.playing = true;
    render(<ScoreNavigator />);
    click('Detener');
    expect(playbackEngine.stopAll).toHaveBeenCalledOnce();
  });
  it('sincroniza selección externa, cambio de compás y otra partitura', () => {
    reset([
      { p: 60, d: 16 },
      { p: 62, d: 16 },
      { p: 64, d: 16 },
    ]);
    render(<ScoreNavigator />);
    act(() => useScoreStore.getState().select(2));
    expect(input()).toHaveValue(3);
    act(() => useScoreStore.getState().setMeta({ meter: '3/4' }));
    expect(input()).toHaveValue(3);
    reset([{ p: 67, d: 8 }]);
    expect(input()).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Desde la nota seleccionada' })).toBeDisabled();
  });
});
