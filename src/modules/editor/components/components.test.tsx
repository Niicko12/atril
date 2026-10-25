// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { emptyScore } from '@/core';
import { useScoreStore } from '../store/score.store';
import { initialState } from '../store/state';
import { DurationTools } from './duration-tools';
import { PianoKeyboard, keyLayout } from './piano-keyboard';
import { InputDock } from './input-dock';

beforeEach(() => useScoreStore.setState(initialState(emptyScore('piano'))));

describe('PianoKeyboard (T-CMP-01..03)', () => {
  it('49 teclas: 29 blancas y 20 negras con nombre accesible', () => {
    const { keys, whiteCount } = keyLayout(36, 84);
    expect([keys.length, whiteCount, keys.filter((k) => k.black).length]).toEqual([49, 29, 20]);
    render(<PianoKeyboard onNote={() => {}} />);
    expect(screen.getByRole('button', { name: 'Do4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do♯4' })).toBeInTheDocument();
  });
  it('centra Do4 usando el ancho real y vuelve a medir al cambiar de pantalla', () => {
    let resize: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<PianoKeyboard onNote={() => {}} />);
    const keyboard = screen.getByLabelText('Teclado de piano');
    const scroll = keyboard.parentElement as HTMLDivElement;
    Object.defineProperty(scroll, 'clientWidth', { value: 390, configurable: true });
    Object.defineProperty(scroll, 'scrollWidth', { value: 1160, configurable: true });
    act(() => resize?.());
    expect(scroll.scrollLeft).toBe(385);
    Object.defineProperty(scroll, 'clientWidth', { value: 1920, configurable: true });
    Object.defineProperty(scroll, 'scrollWidth', { value: 1920, configurable: true });
    act(() => resize?.());
    expect(scroll.scrollLeft).toBe(0);
    expect(screen.getByRole('button', { name: 'Do6' }).style.left).toMatch(/%$/);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('pointerdown en Do4 llama onNote(60) y bloquea el menú contextual', () => {
    const onNote = vi.fn();
    render(<PianoKeyboard onNote={onNote} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Do4' }));
    expect(onNote).toHaveBeenCalledWith(60, expect.any(HTMLElement));
    const kbd = screen.getByLabelText('Teclado de piano');
    expect(fireEvent.contextMenu(kbd)).toBe(false);
  });
});

describe('DurationTools (T-CMP-09/10)', () => {
  it('puntillo deshabilitado con semicorchea; negra pulsada por defecto', () => {
    render(<DurationTools />);
    expect(screen.getByRole('button', { name: 'Negra' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Semicorchea' }));
    expect(screen.getByRole('button', { name: 'Puntillo' })).toBeDisabled();
  });
  it('deshacer/rehacer/borrar se habilitan según el estado', () => {
    render(<DurationTools />);
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeDisabled();
    act(() => useScoreStore.getState().addNote(60));
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeEnabled();
  });
});

describe('InputDock', () => {
  it('tocar una tecla agrega la nota con la duración actual', () => {
    render(<InputDock />);
    fireEvent.click(screen.getByRole('button', { name: 'Corchea' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Re4' }));
    expect(useScoreStore.getState().score.notes).toEqual([{ p: 62, d: 2 }]);
  });
});
