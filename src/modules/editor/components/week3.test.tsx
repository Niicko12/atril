// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { emptyScore, getInstrument } from '@/core';
import { useToastStore } from '@/shared/toast';
import { useScoreStore } from '../store/score.store';
import { initialState } from '../store/state';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { Fretboard, fretStrings } from './fretboard';
import { NameButtons } from './name-buttons';
import { ScoreMetaForm, parseTempo } from './score-meta-form';
import { ViewBar } from './view-bar';

const store = () => useScoreStore.getState();
beforeEach(() => {
  useScoreStore.setState(initialState(emptyScore('piano')));
  useToastStore.getState().clear();
});

describe('Fretboard (T-CMP-04..06)', () => {
  it('guitarra: 6 cuerdas × 16 posiciones; cuerda 1 al aire = Mi4', () => {
    render(<Fretboard instrument={getInstrument('guitarra')} fifths={0} onNote={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(96);
    expect(screen.getByRole('button', { name: 'Cuerda 1, traste 0: Mi4' })).toBeInTheDocument();
  });
  it('violín rotula "Posición"; piano usa la afinación de guitarra', () => {
    render(<Fretboard instrument={getInstrument('violin')} fifths={0} onNote={() => {}} />);
    expect(screen.getByText('Posición')).toBeInTheDocument();
    expect(fretStrings(getInstrument('piano'))).toEqual(getInstrument('guitarra').strings);
  });
  it('pointerdown llama onNote con la altura de la posición', () => {
    const onNote = vi.fn();
    render(<Fretboard instrument={getInstrument('guitarra')} fifths={0} onNote={onNote} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Cuerda 6, traste 3: Sol2' }));
    expect(onNote).toHaveBeenCalledWith(43, expect.any(HTMLElement));
  });
});

describe('NameButtons (T-CMP-07/08)', () => {
  it('en Sol mayor el botón Fa es Fa♯; ♯ pendiente afecta a todas y se apaga tras la nota', () => {
    act(() => store().setMeta({ key: 1 }));
    const onNote = vi.fn();
    render(<NameButtons onNote={onNote} />);
    expect(screen.getByRole('button', { name: 'Fa♯' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sostenido para la próxima nota' }));
    expect(screen.getByRole('button', { name: 'Do♯' })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Do♯' }));
    expect(onNote).toHaveBeenCalledWith(61, expect.any(HTMLElement));
  });
});

describe('ScoreMetaForm (T-CMP-11/12)', () => {
  it.each([
    ['300', 240],
    ['', 100],
    ['abc', 100],
    ['20', 30],
    ['96.4', 96],
  ])('tempo "%s" → %i', (raw, t) => expect(parseTempo(raw)).toBe(t));
  it('el tempo se aplica al salir del campo y se corrige', () => {
    render(<ScoreMetaForm />);
    const input = screen.getByLabelText('Tempo ♩ =');
    fireEvent.change(input, { target: { value: '300' } });
    expect(store().score.tempo).toBe(96);
    fireEvent.blur(input);
    expect([store().score.tempo, (input as HTMLInputElement).value]).toEqual([240, '240']);
  });
  it('cambiar el instrumento actualiza la partitura', () => {
    render(<ScoreMetaForm />);
    fireEvent.change(screen.getByLabelText('Instrumento'), { target: { value: 'clarinete' } });
    expect(store().score.instrumentId).toBe('clarinete');
  });
});

describe('ViewBar (T-CMP-13..15)', () => {
  it('"Sonido real" solo con transpositores; tablatura solo con guitarra/bajo', () => {
    const { rerender } = render(<ViewBar />);
    expect(screen.getByRole('button', { name: 'Sonido real' })).toBeDisabled();
    expect(screen.queryByLabelText('Tablatura')).toBeNull();
    act(() => store().setMeta({ instrumentId: 'guitarra' }));
    rerender(<ViewBar />);
    expect(screen.getByRole('button', { name: 'Sonido real' })).toBeEnabled();
    expect(screen.getByLabelText('Tablatura')).toBeInTheDocument();
  });
  it('mover todo con recorte muestra el aviso con Deshacer (F15)', () => {
    act(() => store().addNote(108));
    render(<ViewBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Subir una octava' }));
    expect(useToastStore.getState().message).toBe('1 nota quedó en el límite del rango (La0–Do8).');
    act(() => useToastStore.getState().action?.run());
    expect(store().score.notes[0]?.p).toBe(108);
  });
});

describe('atajos de teclado (T-KEY)', () => {
  const press = (key: string, opts: KeyboardEventInit = {}) =>
    act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts })));
  const setup = () => {
    const enter = vi.fn((m: number) => store().addNote(m));
    const togglePlay = vi.fn();
    renderHook(() => useKeyboardShortcuts({ enter, togglePlay }));
    return { enter, togglePlay };
  };
  it('a → Do4, l → Re5, z baja la octava hasta 2 (T-KEY-01..03)', () => {
    const { enter } = setup();
    press('a');
    press('l');
    expect(enter.mock.calls.map(([m]) => m)).toEqual([60, 74]);
    press('z');
    press('z');
    press('z');
    expect(store().keyboardOctave).toBe(2);
  });
  it('3 = negra, r y 0 = silencio, ⌫ borra, espacio reproduce (T-KEY-04/05/11/12)', () => {
    const { togglePlay } = setup();
    press('2');
    expect(store().cursor.base).toBe(8);
    press('r');
    press('0');
    expect(store().score.notes).toEqual([
      { p: null, d: 8 },
      { p: null, d: 8 },
    ]);
    press('Backspace');
    expect(store().score.notes).toHaveLength(1);
    press(' ');
    expect(togglePlay).toHaveBeenCalled();
  });
  it('Ctrl/Cmd+Z deshace y Ctrl+Shift+Z / Ctrl+Y rehacen (T-KEY-08/09)', () => {
    const { enter } = setup();
    enter(60);
    press('z', { metaKey: true });
    expect(store().score.notes).toHaveLength(0);
    press('z', { ctrlKey: true, shiftKey: true });
    expect(store().score.notes).toHaveLength(1);
    press('z', { ctrlKey: true });
    press('y', { ctrlKey: true });
    expect(store().score.notes).toHaveLength(1);
  });
  it('tecla mantenida y foco en un campo se ignoran (T-KEY-06/10)', () => {
    const { enter } = setup();
    press('a', { repeat: true });
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => void input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })));
    expect(enter).not.toHaveBeenCalled();
  });
});
