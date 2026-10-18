// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { emptyScore } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { ScoreSheet } from './score-sheet';
import { ScoreStatus } from './score-status';

class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    this.cb([{ contentRect: { width: 700 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  disconnect() {}
  unobserve() {}
}

const reset = (patch: Partial<ReturnType<typeof emptyScore>> = {}) =>
  act(() => useScoreStore.getState().replaceScore({ ...emptyScore('piano'), ...patch }));

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});

describe('ScoreSheet (T-SV-*)', () => {
  it('partitura vacía muestra la ayuda y un pentagrama', async () => {
    reset();
    const { container } = render(<ScoreSheet />);
    expect(screen.getByText('Toca el teclado de abajo para escribir notas')).toBeInTheDocument();
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(container.querySelector('svg')).not.toBeNull();
  });
  it('etiqueta accesible con título, instrumento y compases', () => {
    reset({
      title: 'Prueba',
      notes: [
        { p: 60, d: 16 },
        { p: 62, d: 4 },
      ],
    });
    render(<ScoreSheet />);
    expect(screen.getByRole('img', { name: 'Partitura: Prueba, Piano, 2 compases' })).toBeInTheDocument();
  });
  it('marca en .oor las notas fuera del rango y en .sel la seleccionada (T-SV-05/06)', async () => {
    reset({
      instrumentId: 'violin',
      notes: [
        { p: 40, d: 4 },
        { p: 67, d: 4 },
      ],
    });
    const { container } = render(<ScoreSheet />);
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(container.querySelectorAll('.oor').length).toBeGreaterThan(0);
    act(() => useScoreStore.getState().select(0));
    expect(container.querySelectorAll('.sel').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.oor').length).toBe(0);
  });
});

describe('ScoreStatus (T-STA-01/02)', () => {
  it('conteo, tonalidad escrita, fuera de rango y selección', () => {
    reset({
      instrumentId: 'saxalto',
      notes: [
        { p: 40, d: 4 },
        { p: 60, d: 4 },
      ],
    });
    act(() => useScoreStore.getState().select(1));
    render(<ScoreStatus />);
    expect(screen.getByText('2 notas · 1 compases')).toBeInTheDocument();
    expect(screen.getByText('Tonalidad escrita: La mayor')).toBeInTheDocument();
    expect(screen.getByText('1 nota fuera del rango de saxofón alto en mi♭ (Do♯3–La5)')).toBeInTheDocument();
    expect(screen.getByText('Nota 2 seleccionada (Do4) · toca otra nota para cambiarla')).toBeInTheDocument();
  });
});
