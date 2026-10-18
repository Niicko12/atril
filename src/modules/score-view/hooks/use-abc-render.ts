import { useEffect, useRef, useState } from 'react';
import abcjs, { type AbcVisualParams } from 'abcjs';

interface RenderedItem {
  el_type?: string;
  startChar?: number;
  abselem?: { elemset?: Element[] };
}
interface RenderedTune {
  lines?: { staff?: { voices?: RenderedItem[][] }[] }[];
}

const RESIZE_THRESHOLD = 20;

/** Elementos de la primera voz del primer pentagrama de cada línea. */
const firstVoiceItems = (tune: RenderedTune | undefined): RenderedItem[] =>
  (tune?.lines ?? []).flatMap((line) => line.staff?.[0]?.voices?.[0] ?? []);

const noteIndex = (el: RenderedItem, charMap: Map<number, number>): number | undefined =>
  el.el_type === 'note' && el.startChar != null ? charMap.get(el.startChar) : undefined;

/** Índice de nota → elementos SVG (notation-core-spec 11.3). */
function noteElementsOf(tune: RenderedTune | undefined, charMap: Map<number, number>): Element[][] {
  const out: Element[][] = [];
  for (const el of firstVoiceItems(tune)) {
    const idx = noteIndex(el, charMap);
    if (idx != null) (out[idx] ??= []).push(...(el.abselem?.elemset ?? []));
  }
  return out;
}

function draw(
  target: HTMLElement,
  abc: string,
  opts: AbcVisualParams,
): { tune: RenderedTune | undefined; tabFailed: boolean } {
  try {
    return { tune: abcjs.renderAbc(target, abc, opts)[0] as unknown as RenderedTune, tabFailed: false };
  } catch (e) {
    if (!opts.tablature) throw e;
    const rest = { ...opts };
    delete rest.tablature;
    return { tune: abcjs.renderAbc(target, abc, rest)[0] as unknown as RenderedTune, tabFailed: true };
  }
}

export interface AbcRender {
  noteElements: Element[][];
  tick: number;
  error: 'render' | 'tab' | null;
}

/** Dibuja con abcjs en el siguiente frame y al cambiar el ancho > 20 px (notation-core-spec 12.2). */
export function useAbcRender(
  target: React.RefObject<HTMLElement | null>,
  abc: string,
  charMap: Map<number, number>,
  options: (width: number) => AbcVisualParams,
): AbcRender {
  const [state, setState] = useState<AbcRender>({ noteElements: [], tick: 0, error: null });
  const [width, setWidth] = useState(0);
  const lastWidth = useRef(0);

  useEffect(() => {
    const el = target.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0;
      if (Math.abs(w - lastWidth.current) > RESIZE_THRESHOLD) setWidth((lastWidth.current = w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [target]);

  useEffect(() => {
    const el = target.current;
    if (!el || !width) return;
    const raf = requestAnimationFrame(() => {
      try {
        const { tune, tabFailed } = draw(el, abc, options(width));
        setState((s) => ({
          noteElements: noteElementsOf(tune, charMap),
          tick: s.tick + 1,
          error: tabFailed ? 'tab' : null,
        }));
      } catch {
        setState((s) => ({ noteElements: [], tick: s.tick + 1, error: 'render' }));
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [target, abc, charMap, options, width]);

  return state;
}
