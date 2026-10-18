import { useEffect, useMemo, useRef, useState } from 'react';
import { computePeaks } from '../services/peaks';
import type { PlayerState } from '../services/audio-player';
import { S } from '../strings';
import styles from './ear.module.css';

interface Props {
  mono: Float32Array;
  duration: number;
  state: PlayerState;
  onSeek(pos: number): void;
  onLoop(a: number, b: number): void;
}

const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const DRAG_PX = 6;

/** Onda con región A-B y cursor; tocar mueve, arrastrar repite un pedazo (ear-spec 5.1-5.2). */
export function Waveform({ mono, duration, state, onSeek, onLoop }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ x0: number; w: number; moved: boolean } | null>(null);
  const peaks = useMemo(() => (width ? computePeaks(mono, Math.round(width)) : null), [mono, width]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(e?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext('2d');
    if (!el || !g || !peaks) return;
    const dpr = devicePixelRatio || 1;
    const w = peaks.length;
    const h = el.clientHeight;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = (t: number) => (t / duration) * w;
    if (state.a != null && state.b != null) {
      g.fillStyle = css('--accent-soft');
      g.fillRect(X(state.a), 0, X(state.b) - X(state.a), h);
    }
    g.fillStyle = css('--muted');
    peaks.forEach((p, x) => {
      const v = Math.max(0.5, p * (h / 2 - 3));
      g.fillRect(x, h / 2 - v, 1, v * 2);
    });
    g.fillStyle = css('--accent');
    g.fillRect(X(state.pos) - 1, 0, 2, h);
  }, [peaks, duration, state.a, state.b, state.pos]);

  const at = (e: React.PointerEvent) => e.clientX - e.currentTarget.getBoundingClientRect().left;
  return (
    <canvas
      ref={canvas}
      className={styles.wave}
      aria-label={S.waveLabel}
      onPointerDown={(e) => {
        drag.current = { x0: at(e), w: e.currentTarget.getBoundingClientRect().width, moved: false };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current && Math.abs(at(e) - drag.current.x0) > DRAG_PX) drag.current.moved = true;
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        const toT = (x: number) => (Math.max(0, Math.min(d.w, x)) / d.w) * duration;
        if (!d.moved) onSeek(toT(at(e)));
        else onLoop(toT(Math.min(d.x0, at(e))), toT(Math.max(d.x0, at(e))));
      }}
    />
  );
}
