// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Toast, toast, useToastStore } from '.';

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.getState().clear();
});
afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('muestra el mensaje y lo quita a los 4 s', () => {
    render(<Toast />);
    act(() => toast('Guardada'));
    expect(screen.getByRole('status')).toHaveTextContent('Guardada');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
  it('el nuevo reemplaza al anterior y la acción se ejecuta una vez', () => {
    const run = vi.fn();
    render(<Toast />);
    act(() => toast('Uno'));
    act(() => toast('Dos', { label: 'Deshacer', run }));
    expect(screen.getByRole('status')).toHaveTextContent('Dos');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });
});
