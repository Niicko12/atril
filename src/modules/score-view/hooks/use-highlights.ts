import { useEffect } from 'react';
import { usePlaybackPositionStore } from '@/modules/playback';

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

/** Clase .play en la nota que suena, sin volver a dibujar (notation-core-spec 13). */
export function usePlayHighlight(noteElements: Element[][]): void {
  const index = usePlaybackPositionStore((s) => s.index);
  useEffect(() => {
    const els = noteElements[index] ?? [];
    for (const e of els) e.classList.add('play');
    return () => {
      for (const e of els) e.classList.remove('play');
    };
  }, [noteElements, index]);
}
