import abcjs from 'abcjs';
import type { Instrument, Score, View } from '@/core';
import { buildAbc } from '@/core';
import { scoreRenderOptions, showsTab } from '@/modules/score-view';

const SCALE = 2.5;
const PAD = 30;

function svgToImage(svg: SVGSVGElement): Promise<{ img: HTMLImageElement; w: number; h: number }> {
  const r = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(r.width));
  clone.setAttribute('height', String(r.height));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, w: r.width, h: r.height });
    img.onerror = () => reject(new Error('svg'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  });
}

/** Dibujo limpio fuera de pantalla → canvas a escala 2,5 con fondo blanco (formats-spec 8.1). */
export async function renderCanvas(score: Score, instrument: Instrument, view: View): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'absolute', left: '-10000px', top: '0', width: '800px' });
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  try {
    const abc = buildAbc(score, instrument, view, { names: score.showNames }).abc;
    const opts = scoreRenderOptions('export', 800, showsTab(score.showTab, instrument, view) ? instrument : null);
    try {
      abcjs.renderAbc(host, abc, opts);
    } catch {
      delete opts.tablature;
      abcjs.renderAbc(host, abc, opts);
    }
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('sin partitura');
    const { img, w, h } = await svgToImage(svg);
    const c = document.createElement('canvas');
    c.width = Math.round((w + PAD * 2) * SCALE);
    c.height = Math.round((h + PAD * 2) * SCALE);
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, PAD * SCALE, PAD * SCALE, w * SCALE, h * SCALE);
    return c;
  } finally {
    host.remove();
  }
}

export const canvasToBlob = (c: HTMLCanvasElement, type = 'image/png', q?: number): Promise<Blob> =>
  new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), type, q));
