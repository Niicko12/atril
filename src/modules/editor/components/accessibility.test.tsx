// @vitest-environment jsdom
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyScore, getInstrument } from '@/core';
import { useScoreStore } from '../store/score.store';
import { initialState } from '../store/state';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { PianoKeyboard } from './piano-keyboard';
import { Fretboard } from './fretboard';
import { NameButtons } from './name-buttons';
import { InputDock } from './input-dock';
import { useModeStore } from '@/shared/prefs/mode.store';

beforeEach(() => {
  useScoreStore.setState(initialState(emptyScore('piano')));
  useModeStore.getState().setMode('piano');
});
it('Enter/Espacio en el piano agregan una nota sin activar atajos globales', async () => {
  const onNote = vi.fn(),
    enter = vi.fn(),
    togglePlay = vi.fn(),
    user = userEvent.setup();
  render(<PianoKeyboard onNote={onNote} />);
  renderHook(() => useKeyboardShortcuts({ enter, togglePlay }));
  const key = screen.getByRole('button', { name: 'Do4' });
  key.focus();
  await user.keyboard('{Enter}');
  await user.keyboard(' ');
  expect(onNote).toHaveBeenCalledTimes(2);
  expect(onNote).toHaveBeenCalledWith(60, key);
  expect(enter).not.toHaveBeenCalled();
  expect(togglePlay).not.toHaveBeenCalled();
});
it('la secuencia táctil pointerdown + click de ratón no duplica la nota', () => {
  const onNote = vi.fn();
  render(<PianoKeyboard onNote={onNote} />);
  const key = screen.getByRole('button', { name: 'Re4' });
  fireEvent.pointerDown(key);
  fireEvent.click(key, { detail: 1 });
  expect(onNote).toHaveBeenCalledTimes(1);
});
it('diapasón y Do-Re-Mi aceptan activación accesible', () => {
  const onNote = vi.fn();
  const { unmount } = render(<Fretboard instrument={getInstrument('guitarra')} fifths={0} onNote={onNote} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cuerda 6, traste 3: Sol2' }), { detail: 0 });
  expect(onNote).toHaveBeenLastCalledWith(43, expect.any(HTMLElement));
  unmount();
  render(<NameButtons onNote={onNote} />);
  fireEvent.click(screen.getByRole('button', { name: 'Do' }), { detail: 0 });
  expect(onNote).toHaveBeenLastCalledWith(60, expect.any(HTMLElement));
});
it('anuncia nombre y duración, manteniendo el estado musical fuera del lector', () => {
  render(<InputDock />);
  fireEvent.click(screen.getByRole('button', { name: 'Corchea' }));
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Mi4' }));
  expect(screen.getByRole('status')).toHaveTextContent('Mi4, corchea');
});
it('las letras en un botón o enlace no escriben notas ni interceptan espacio', () => {
  const enter = vi.fn(),
    togglePlay = vi.fn();
  render(
    <>
      <button>Guardar</button>
      <a href="#">Enlace</a>
    </>,
  );
  renderHook(() => useKeyboardShortcuts({ enter, togglePlay }));
  const button = screen.getByRole('button');
  expect(fireEvent.keyDown(button, { key: ' ' })).toBe(true);
  fireEvent.keyDown(screen.getByRole('link'), { key: 'a' });
  expect(enter).not.toHaveBeenCalled();
  expect(togglePlay).not.toHaveBeenCalled();
});
