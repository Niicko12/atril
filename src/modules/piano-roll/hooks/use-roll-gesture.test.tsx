// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { useRollGesture } from './use-roll-gesture';

const notes = [
  { p: 60, d: 4 },
  { p: 64, d: 4 },
];
function setup() {
  const change = vi.fn();
  const root = document.createElement('div');
  root.setAttribute('data-roll-scroll', '');
  const button = document.createElement('button');
  root.append(button);
  const hook = renderHook(({ events }) => useRollGesture(events, 20, change), { initialProps: { events: notes } });
  const event = (x: number, y = 0, pointerId = 1) =>
    ({
      clientX: x,
      clientY: y,
      pointerId,
      button: 0,
      currentTarget: root,
      target: button,
    }) as unknown as PointerEvent<HTMLDivElement>;
  return { ...hook, event, change, root, button };
}
describe('gestos en la rejilla', () => {
  it('muestra vista previa y aplica movimiento cuantizado solo al soltar', () => {
    const { result, event, change } = setup();
    act(() => result.current.down(event(0), 0));
    act(() => result.current.move(event(80, -22)));
    expect(result.current.ghost).toMatchObject({ dx: 80, dy: -22, index: 0 });
    expect(change).not.toHaveBeenCalled();
    act(() => result.current.up(event(80, -22)));
    expect(change).toHaveBeenCalledExactlyOnceWith({
      notes: [
        { p: 64, d: 4 },
        { p: 61, d: 4 },
      ],
      selection: 1,
    });
    expect(result.current.ghost).toBeNull();
  });
  it('cancelar descarta el gesto y otros punteros no lo terminan', () => {
    const { result, event, change } = setup();
    act(() => result.current.down(event(0), 0));
    act(() => result.current.up(event(80, 0, 2)));
    act(() => result.current.cancel(2));
    expect(change).not.toHaveBeenCalled();
    act(() => result.current.cancel(1));
    act(() => result.current.up(event(80)));
    expect(change).not.toHaveBeenCalled();
  });
  it('redimensiona desde el borde y tiene en cuenta el desplazamiento del lienzo', () => {
    const { result, event, change, root, button } = setup();
    button.setAttribute('data-resize', '');
    act(() => result.current.down(event(0), 0));
    root.scrollLeft = 20;
    act(() => result.current.up(event(20)));
    expect(change).toHaveBeenCalledExactlyOnceWith({
      notes: [
        { p: 60, d: 6 },
        { p: 64, d: 4 },
      ],
      selection: 0,
    });
  });
  it('una edición intervenida invalida el gesto en lugar de sobrescribirla', () => {
    const { result, event, change, rerender } = setup();
    act(() => result.current.down(event(0), 0));
    rerender({ events: [{ p: 72, d: 4 }] });
    act(() => result.current.up(event(80)));
    expect(change).not.toHaveBeenCalled();
  });
});
