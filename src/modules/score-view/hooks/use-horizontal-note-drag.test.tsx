// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useHorizontalNoteDrag } from './use-horizontal-note-drag';

function setup() {
  const root = document.createElement('div');
  const notes = [20, 120, 220].map((x) => {
    const element = document.createElement('span');
    root.append(element);
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      left: x - 5, right: x + 5, top: 15, bottom: 25, width: 10, height: 10,
    } as DOMRect);
    return [element];
  });
  const move = vi.fn();
  const horizontalGesture = { current: false };
  const { unmount } = renderHook(() => useHorizontalNoteDrag({ current: root }, notes, move, horizontalGesture));
  const pointer = (target: EventTarget, type: string, x: number, options = {}) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { clientX: x, clientY: 20, button: 0, pointerType: 'mouse', pointerId: 1, ...options });
    target.dispatchEvent(event);
  };
  return { root, notes, move, pointer, unmount, horizontalGesture };
}

describe('arrastre horizontal de notas', () => {
  it('mantiene la nota cuando el puntero sigue más cerca de su origen', () => {
    const { notes, move, pointer } = setup();
    pointer(notes[0]![0]!, 'pointerdown', 20);
    pointer(window, 'pointerup', 40);
    expect(move).not.toHaveBeenCalled();
  });
  it('mueve hacia la nota más cercana al soltar', () => {
    const { notes, move, pointer } = setup();
    pointer(notes[0]![0]!, 'pointerdown', 20);
    pointer(window, 'pointerup', 120);
    expect(move).toHaveBeenCalledExactlyOnceWith(0, 1);
  });
  it('marca el gesto horizontal para evitar una segunda edición al soltar', () => {
    const { notes, move, pointer, horizontalGesture } = setup();
    pointer(notes[0]![0]!, 'pointerdown', 20);
    pointer(window, 'pointerup', 120);
    expect(move).toHaveBeenCalledExactlyOnceWith(0, 1);
    expect(horizontalGesture.current).toBe(true);
    pointer(notes[1]![0]!, 'pointerdown', 120);
    expect(horizontalGesture.current).toBe(false);
  });
  it('ignora otros punteros y conserva el arrastre original', () => {
    const { notes, move, pointer } = setup();
    pointer(notes[0]![0]!, 'pointerdown', 20);
    pointer(window, 'pointerup', 220, { pointerId: 2 });
    pointer(window, 'pointercancel', 220, { pointerId: 2 });
    expect(move).not.toHaveBeenCalled();
    pointer(window, 'pointerup', 120);
    expect(move).toHaveBeenCalledExactlyOnceWith(0, 1);
  });
  it('cancela el arrastre y retira los listeners al desmontar', () => {
    const { notes, move, pointer, unmount } = setup();
    pointer(notes[0]![0]!, 'pointerdown', 20);
    pointer(window, 'pointercancel', 20);
    pointer(window, 'pointerup', 120);
    pointer(notes[0]![0]!, 'pointerdown', 20);
    unmount();
    pointer(window, 'pointerup', 120);
    expect(move).not.toHaveBeenCalled();
  });
  it.each([{ pointerType: 'touch' }, { button: 2 }])('ignora gestos no admitidos: %o', (options) => {
    const { notes, move, pointer } = setup();
    pointer(notes[0]![0]!, 'pointerdown', 20, options);
    pointer(window, 'pointerup', 120);
    expect(move).not.toHaveBeenCalled();
  });
});
