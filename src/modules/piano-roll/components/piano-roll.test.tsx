// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { emptyScore } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { playbackEngine } from '@/modules/playback';
import { PianoRollOverlay } from './piano-roll-overlay';
import { S } from '../strings';

beforeEach(() => {
  useScoreStore.getState().replaceScore({
    ...emptyScore('piano'),
    title: 'Mi canción',
    notes: [
      { p: 60, d: 4, c: 'Am' },
      { p: null, d: 4 },
      { p: 67, d: 8 },
    ],
  });
});
afterEach(() => vi.restoreAllMocks());
const editPitch = (value = '65') => fireEvent.change(screen.getByLabelText(S.pitch), { target: { value } });

describe('editor visual: aplicar y descartar', () => {
  it('editar solo modifica el borrador; cancelar conserva notas e historial', () => {
    const close = vi.fn();
    render(<PianoRollOverlay onClose={close} />);
    editPitch();
    expect(screen.getByLabelText(S.pitch)).toHaveValue(65);
    expect(useScoreStore.getState().score.notes[0]?.p).toBe(60);
    expect(useScoreStore.getState().past).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: S.cancel }));
    expect(close).toHaveBeenCalledOnce();
    expect(useScoreStore.getState().score.title).toBe('Mi canción');
  });
  it('aplica todo como una sola acción y deshacer restaura notas, silencios y cifrado', () => {
    const close = vi.fn();
    render(<PianoRollOverlay onClose={close} />);
    editPitch();
    fireEvent.change(screen.getByLabelText(S.duration), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: S.apply }));
    expect(close).toHaveBeenCalledOnce();
    expect(useScoreStore.getState().score.notes[0]).toEqual({ p: 65, d: 8, c: 'Am' });
    expect(useScoreStore.getState().past).toHaveLength(1);
    act(() => useScoreStore.getState().undo());
    expect(useScoreStore.getState().score.notes).toEqual([
      { p: 60, d: 4, c: 'Am' },
      { p: null, d: 4 },
      { p: 67, d: 8 },
    ]);
  });
  it('reinicia sin guardar y no permite aplicar un borrador idéntico', () => {
    render(<PianoRollOverlay onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: S.apply })).toBeDisabled();
    editPitch();
    fireEvent.click(screen.getByRole('button', { name: S.reset }));
    expect(screen.getByLabelText(S.pitch)).toHaveValue(60);
    expect(screen.getByRole('button', { name: S.apply })).toBeDisabled();
  });
  it('evita sobrescribir una partitura que cambió después de abrir', () => {
    render(<PianoRollOverlay onClose={vi.fn()} />);
    editPitch();
    act(() => useScoreStore.getState().setMeta({ title: 'Otra versión' }));
    expect(screen.getByRole('alert')).toHaveTextContent(S.conflict);
    expect(screen.getByRole('button', { name: S.apply })).toBeDisabled();
    expect(useScoreStore.getState().score.title).toBe('Otra versión');
  });
  it('un guardado automático no invalida el borrador', () => {
    render(<PianoRollOverlay onClose={vi.fn()} />);
    editPitch();
    act(() => useScoreStore.getState().markSaved('2026-10-25T12:00:00Z'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: S.apply })).toBeEnabled();
  });
  it('escucha las notas del borrador y detiene el audio al desmontar', () => {
    const play = vi.spyOn(playbackEngine, 'play').mockImplementation(() => undefined);
    const stop = vi.spyOn(playbackEngine, 'stopAll');
    const { unmount } = render(<PianoRollOverlay onClose={vi.fn()} />);
    editPitch();
    fireEvent.click(screen.getByRole('button', { name: S.listen }));
    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.arrayContaining([{ p: 65, d: 4, c: 'Am' }]),
        fromIndex: 0,
        onPosition: expect.any(Function),
      }),
    );
    const calls = stop.mock.calls.length;
    unmount();
    expect(stop.mock.calls.length).toBeGreaterThan(calls);
  });
  it('añade una nota a una partitura vacía y permite trabajar con silencios', () => {
    useScoreStore.getState().replaceScore(emptyScore('piano'));
    render(<PianoRollOverlay onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: S.add }));
    expect(screen.getByLabelText(S.selected)).toHaveValue(1);
    fireEvent.click(screen.getByText('Más acciones de la nota'));
    fireEvent.click(screen.getByRole('button', { name: 'Convertir en silencio' }));
    expect(screen.getByLabelText(S.pitch)).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: S.apply }));
    expect(useScoreStore.getState().score.notes).toEqual([{ p: null, d: 4 }]);
  });
});
