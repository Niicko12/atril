import { useEffect, type RefObject } from 'react';

function indexAtTarget(target: EventTarget | null, noteElements: Element[][]): number {
  if (!(target instanceof Node)) return -1;
  return noteElements.findIndex((elements) => elements.some((el) => el === target || el.contains(target)));
}

function centerOf(elements: Element[]): { x: number; y: number } | null {
  const rects = elements.map((el) => el.getBoundingClientRect()).filter((r) => r.width || r.height);
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function closestNote(noteElements: Element[][], x: number, y: number, source: number): number {
  let index = source;
  let distance = Number.POSITIVE_INFINITY;
  noteElements.forEach((elements, i) => {
    const center = centerOf(elements);
    if (!center) return;
    const candidate = Math.hypot(center.x - x, center.y - y);
    if (candidate < distance) {
      index = i;
      distance = candidate;
    }
  });
  return index;
}

type DragStart = { index: number; pointerId: number; x: number; y: number; center: { x: number; y: number } };

/** Permite reordenar eventos arrastrándolos lateralmente en la partitura. */
export function useHorizontalNoteDrag(
  host: RefObject<HTMLElement | null>,
  noteElements: Element[][],
  move: (from: number, to: number) => void,
  horizontalGesture?: RefObject<boolean>,
): void {
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let start: DragStart | null = null;

    const onDown = (event: PointerEvent) => {
      if (horizontalGesture) horizontalGesture.current = false;
      if (event.button !== 0 || event.pointerType === 'touch') return;
      start = null;
      const index = indexAtTarget(event.target, noteElements);
      const center = centerOf(noteElements[index] ?? []);
      if (index >= 0 && center)
        start = { index, pointerId: event.pointerId, x: event.clientX, y: event.clientY, center };
    };
    const onUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) return;
      const [dx, dy] = [event.clientX - start.x, event.clientY - start.y];
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (horizontalGesture) horizontalGesture.current = true;
        const destination = closestNote(noteElements, start.center.x + dx, start.center.y + dy, start.index);
        if (destination !== start.index) move(start.index, destination);
      }
      start = null;
    };
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId === start?.pointerId) start = null;
    };

    const controller = new AbortController();
    const options = { signal: controller.signal };
    root.addEventListener('pointerdown', onDown, options);
    window.addEventListener('pointerup', onUp, options);
    window.addEventListener('pointercancel', onCancel, options);
    return () => controller.abort();
  }, [host, move, noteElements, horizontalGesture]);
}
