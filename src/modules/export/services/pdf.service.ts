import type { Instrument, Score, View } from '@/core';
import { renderCanvas } from './render-canvas';

const MARGIN = 36;

/** Fila de píxeles blanca (muestreo cada 4 píxeles, canal R ≥ 245). */
export function isBlankRow(data: Uint8ClampedArray): boolean {
  for (let i = 0; i < data.length; i += 16) if ((data[i] as number) < 245) return false;
  return true;
}

/** Fin del corte: busca hacia arriba una fila blanca para no partir un sistema (formats-spec 9.1). */
export function sliceEnd(y: number, sliceH: number, height: number, blankAt: (row: number) => boolean): number {
  const end = Math.min(height, y + sliceH);
  if (end >= height) return end;
  let k = end;
  while (k > y + sliceH * 0.5 && !blankAt(k)) k -= 2;
  return k > y + sliceH * 0.5 ? k : end;
}

/** PDF tamaño carta a partir del dibujo (carga jsPDF solo al usarse). */
export async function scorePdf(score: Score, instrument: Instrument, view: View): Promise<Blob> {
  const [{ jsPDF }, c] = await Promise.all([import('jspdf'), renderCanvas(score, instrument, view)]);
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  pdf.setProperties({ title: score.title || 'Sin título', author: score.composer, creator: 'Atril' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const scale = (pw - 2 * MARGIN) / c.width;
  const sliceH = Math.floor((ph - 2 * MARGIN) / scale);
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const blankAt = (row: number) => isBlankRow(g.getImageData(0, row, c.width, 1).data);
  for (let y = 0, page = 0; y < c.height - 4; page++) {
    const end = sliceEnd(y, sliceH, c.height, blankAt);
    const part = document.createElement('canvas');
    part.width = c.width;
    part.height = end - y;
    part.getContext('2d')?.drawImage(c, 0, y, c.width, end - y, 0, 0, c.width, end - y);
    if (page) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, c.width * scale, (end - y) * scale);
    y = end;
  }
  return pdf.output('blob');
}
