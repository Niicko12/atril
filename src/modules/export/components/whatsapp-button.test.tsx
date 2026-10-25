// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emptyScore } from '@/core';
import { useScoreStore } from '@/modules/editor';
import * as download from '@/infra/download';
import { scorePdf } from '../services/pdf.service';
import { WhatsAppButton } from './whatsapp-button';
vi.mock('../services/pdf.service', () => ({ scorePdf: vi.fn() }));
beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(scorePdf).mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  useScoreStore.getState().replaceScore({ ...emptyScore('piano'), title: 'Canción & prueba' });
});
it('prepara el PDF y ofrece descargar y abrir WhatsApp sin adjuntar automáticamente', async () => {
  const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => undefined);
  vi.spyOn(download, 'canShareFiles').mockReturnValue(false);
  render(<WhatsAppButton disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
  expect(await screen.findByRole('dialog', { name: 'Compartir por WhatsApp' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute(
    'href',
    expect.stringContaining('https://wa.me/?text='),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
  expect(save).toHaveBeenCalledWith(expect.stringContaining('Piano.pdf'), expect.any(Blob));
});
it('compartir necesita un segundo toque con el archivo listo y cancelar no es error', async () => {
  vi.spyOn(download, 'canShareFiles').mockReturnValue(true);
  const share = vi.spyOn(download, 'shareBlob').mockResolvedValue('cancelled');
  render(<WhatsAppButton disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
  const button = await screen.findByRole('button', { name: 'Compartir PDF · elegir WhatsApp' });
  expect(share).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(share).toHaveBeenCalledOnce());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
