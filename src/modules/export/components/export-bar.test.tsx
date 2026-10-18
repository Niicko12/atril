// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emptyScore } from '@/core';
import * as download from '@/infra/download';
import { useScoreStore } from '@/modules/editor';
import { useToastStore } from '@/shared/toast';
import { ExportBar } from './export-bar';
import { ImageOverlay } from './image-overlay';

beforeEach(() => {
  useScoreStore.getState().replaceScore({ ...emptyScore('piano'), title: 'Prueba', notes: [{ p: 60, d: 4 }] });
  useToastStore.getState().clear();
  vi.restoreAllMocks();
});

describe('ExportBar', () => {
  it('ZIP para MuseScore descarga con el nombre correcto', async () => {
    const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
    render(<ExportBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar para MuseScore' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('Prueba - Piano.zip', expect.any(Blob)));
    expect(useToastStore.getState().message).toBe('Listo: Prueba - Piano.zip');
  });
  it('copiar ABC usa el portapapeles; si falla abre el texto (T-EXP-06)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('no'));
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ExportBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar texto ABC' }));
    await waitFor(() => expect(useToastStore.getState().message).toBe('Selecciona y copia el texto'));
    expect(
      (screen.getByRole('textbox', { name: 'Texto ABC (para otros programas)' }) as HTMLTextAreaElement).value,
    ).toContain('T:Prueba');
  });
  it('sin Web Share no aparece Compartir (T-EXP-04)', () => {
    render(<ExportBar />);
    expect(screen.queryByRole('button', { name: 'Compartir' })).toBeNull();
  });
});

describe('ImageOverlay', () => {
  it('muestra la imagen y descarga el PNG', () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
    render(<ImageOverlay blob={new Blob(['x'], { type: 'image/png' })} name="a.png" onClose={() => {}} />);
    expect(screen.getByAltText('Partitura como imagen')).toHaveAttribute('src', 'blob:x');
    fireEvent.click(screen.getByRole('button', { name: 'Descargar imagen' }));
    expect(save).toHaveBeenCalledWith('a.png', expect.any(Blob));
  });
});
