// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { PracticeControls } from './practice-controls';

it('envía el fragmento inclusivo y la velocidad; cambiar ajustes detiene la reproducción', () => {
  const onPlay = vi.fn(), onStop = vi.fn();
  render(<PracticeControls count={8} bar={16} beat={4} playing={false} onStop={onStop} onPlay={onPlay} />);
  fireEvent.click(screen.getByText('Modo práctica'));
  fireEvent.change(screen.getByLabelText('Practicar desde compás'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Velocidad'), { target: { value: '0.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Practicar fragmento' }));
  expect(onStop).toHaveBeenCalledTimes(2);
  expect(onPlay).toHaveBeenCalledWith({ start: 5, end: 8, bar: 16, beat: 4, speed: .5,
    repeat: true, countIn: true, metronome: false });
});
it('restringe el intervalo a los compases existentes al acortarse la partitura', () => {
  const onPlay = vi.fn(), onStop = vi.fn();
  const { rerender } = render(<PracticeControls count={8} bar={16} beat={4} playing onStop={onStop} onPlay={onPlay} />);
  fireEvent.click(screen.getByText('Modo práctica'));
  fireEvent.change(screen.getByLabelText('Practicar desde compás'), { target: { value: '7' } });
  rerender(<PracticeControls count={2} bar={16} beat={4} playing onStop={onStop} onPlay={onPlay} />);
  fireEvent.click(screen.getByRole('button', { name: 'Practicar fragmento' }));
  expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ start: 2, end: 2 }));
  fireEvent.click(screen.getByRole('button', { name: 'Detener práctica' }));
  expect(onStop).toHaveBeenCalledTimes(2);
});
