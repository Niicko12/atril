// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import { emptyScore, getInstrument, toMidi, toMusicXML } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { useImportWarnings } from '../store/warnings.store';
import { FindOverlay } from '../components/find-overlay';
import { ImportWarnings } from '../components/import-warnings';
import { detectFormat, openImported, parseFile, unzipMxl } from './import.service';

const sample = {
  ...emptyScore('flauta'),
  title: 'Prueba',
  notes: [
    { p: 72, d: 4 },
    { p: 74, d: 12 },
  ],
};
const xmlBytes = strToU8(toMusicXML(sample, getInstrument('flauta')));

beforeEach(() => {
  useScoreStore.getState().replaceScore(emptyScore('piano'));
  useImportWarnings.getState().set([]);
});

describe('detección de formato (T-IMP-01)', () => {
  it.each([
    ['a.mid', [0, 0], 'midi'],
    ['a.mxl', [0], 'mxl'],
    ['a.xml', [0], 'musicxml'],
    ['x.bin', [0x4d, 0x54, 0x68, 0x64], 'midi'],
    ['x.bin', [0x50, 0x4b], 'mxl'],
    ['x.txt', [...strToU8('  <score-partwise/>')], 'musicxml'],
    ['x', [...strToU8('X:1\nK:C\nC')], 'abc'],
    ['x.abc', [0], 'abc'],
    ['foto.jpg', [0xff, 0xd8], null],
  ])('%s', (name, bytes, format) => expect(detectFormat(name, new Uint8Array(bytes as number[]))).toBe(format));
});

describe('lectura de archivos (T-IMP-02/03)', () => {
  it('MusicXML, .mxl (con y sin container.xml), MIDI y ABC', () => {
    expect(parseFile('a.musicxml', xmlBytes).result.notes).toEqual(sample.notes);
    const container = strToU8('<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>');
    expect(unzipMxl(zipSync({ 'META-INF/container.xml': container, 'score.xml': xmlBytes }))).toContain(
      'score-partwise',
    );
    expect(parseFile('a.mxl', zipSync({ 'otra/partitura.musicxml': xmlBytes })).source).toBe('musicxml');
    expect(parseFile('a.mid', toMidi(sample, getInstrument('flauta'))).result.notes).toEqual(sample.notes);
    expect(parseFile('a.abc', strToU8('X:1\nL:1/4\nK:C\nc d|')).source).toBe('abc');
  });
  it('límites de tamaño, formato desconocido y .mxl vacío', () => {
    expect(() => parseFile('a.mid', new Uint8Array(3 * 1024 * 1024))).toThrow('máximo 2 MB');
    expect(() => parseFile('a.jpg', new Uint8Array([0xff]))).toThrow('no parece una partitura');
    expect(() => unzipMxl(zipSync({ 'leeme.txt': strToU8('x') }))).toThrow('no contiene una partitura');
    expect(() => unzipMxl(zipSync({ 'a.xml': new Uint8Array(21 * 1024 * 1024) }, { level: 9 }))).toThrow(
      'demasiado grande',
    );
  });
});

describe('abrir el resultado (T-IMP-04/05)', () => {
  it('reemplaza la partitura, usa el instrumento detectado y muestra avisos que se cierran al editar', async () => {
    const { result, source } = parseFile('a.abc', strToU8('X:1\nT:Con acordes\nL:1/4\nK:C\n[CE] D|'));
    await act(async () => void (await openImported(result, source, 'archivo')));
    expect([useScoreStore.getState().score.title, useScoreStore.getState().score.source]).toEqual([
      'Con acordes',
      'abc',
    ]);
    render(<ImportWarnings />);
    expect(screen.getByText('Había acordes o varias voces; se tomó la nota más aguda.')).toBeInTheDocument();
    act(() => useScoreStore.getState().addNote(60));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('FindOverlay', () => {
  it('pegar ABC abre la melodía y cierra; texto vacío avisa', async () => {
    const onClose = vi.fn();
    render(<FindOverlay onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir texto' }));
    expect(screen.getByText('Pega primero el texto ABC')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pegar texto ABC'), { target: { value: 'L:1/4\nK:G\nG A B c|' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir texto' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useScoreStore.getState().score.notes.map((n) => n.p)).toEqual([67, 69, 71, 72]);
  });
  it('los enlaces llevan la búsqueda codificada y rel=noopener noreferrer (T-LNK-01)', () => {
    render(<FindOverlay onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nombre de la canción'), { target: { value: 'La cucaracha' } });
    const link = screen.getByRole('link', { name: 'IMSLP (clásica) ↗' });
    expect(link).toHaveAttribute('href', expect.stringContaining('search=La%20cucaracha'));
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
