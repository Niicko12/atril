import { strFromU8, unzipSync } from 'fflate';
import { getInstrument, emptyScore } from '@/core';
import { baseName, fileName } from './file-names';
import { isBlankRow, sliceEnd } from './pdf.service';
import { museScoreZip } from './zip.service';

describe('nombres de archivo (T-FN-01, X26/X27)', () => {
  it('título + instrumento sin ♭/♯ ni caracteres prohibidos', () => {
    expect(fileName('Cielito: lindo/2', getInstrument('saxalto'), 'pdf')).toBe(
      'Cielito lindo2 - Saxofón alto en Mib.pdf',
    );
    expect(baseName('  ', getInstrument('piano'))).toBe('partitura - Piano');
  });
});

describe('ZIP para MuseScore (T-EXP-01)', () => {
  it('4 archivos con nombres correctos y LEEME con CRLF', async () => {
    const score = { ...emptyScore('clarinete'), title: 'Prueba', notes: [{ p: 60, d: 4 }] };
    const files = unzipSync(new Uint8Array(await museScoreZip(score, getInstrument('clarinete')).arrayBuffer()));
    const base = 'Prueba - Clarinete en Sib';
    expect(Object.keys(files).sort()).toEqual([`${base}.abc`, `${base}.mid`, `${base}.musicxml`, 'LEEME.txt'].sort());
    expect(strFromU8(files['LEEME.txt']!)).toContain('\r\n');
    expect(strFromU8(files[`${base}.musicxml`]!)).toContain('<transpose>');
    expect(files[`${base}.mid`]![0]).toBe(0x4d);
  });
});

describe('cortes del PDF (formats-spec 9.1)', () => {
  it('isBlankRow muestrea el canal rojo cada 4 píxeles', () => {
    const white = new Uint8ClampedArray(64).fill(255);
    const dark = white.slice();
    dark[32] = 10;
    expect([isBlankRow(white), isBlankRow(dark)]).toEqual([true, false]);
  });
  it('corta en una fila blanca y no parte sistemas; si no hay, corta al límite', () => {
    const blankRows = new Set([140]);
    expect(sliceEnd(0, 200, 1000, (r) => blankRows.has(r))).toBe(140);
    expect(sliceEnd(0, 200, 1000, () => false)).toBe(200);
    expect(sliceEnd(900, 200, 1000, () => false)).toBe(1000);
  });
});
