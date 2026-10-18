import { useEffect } from 'react';

/** Clases .oor (fuera de rango) y .sel (seleccionada) tras cada dibujo (notation-core-spec 13). */
export function useHighlights(
  noteElements: Element[][],
  tick: number,
  selection: number,
  outOfRange: readonly number[],
): void {
  useEffect(() => {
    for (const i of outOfRange) for (const e of noteElements[i] ?? []) e.classList.add('oor');
    for (const e of noteElements[selection] ?? []) {
      e.classList.remove('oor');
      e.classList.add('sel');
    }
    return () => {
      for (const els of noteElements) for (const e of els ?? []) e.classList.remove('sel', 'oor');
    };
  }, [noteElements, tick, selection, outOfRange]);
}
