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
  vi.spyOn(window, 'open').mockReturnValue(null);
  render(<WhatsAppButton disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
  expect(await screen.findByRole('dialog', { name: 'Compartir por WhatsApp' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Descargar PDF' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF y abrir WhatsApp' }));
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
it('ofrece descargar cuando el navegador no tiene la función completa de compartir', async () => {
  vi.spyOn(download, 'canShareFiles').mockReturnValue(false);
  render(<WhatsAppButton disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
  expect(await screen.findByRole('button', { name: 'Descargar PDF y abrir WhatsApp' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Compartir PDF · elegir WhatsApp' })).not.toBeInTheDocument();
});
it('abre el diálogo con progreso antes de terminar el PDF y permite reintentar un fallo', async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(scorePdf).mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  render(<WhatsAppButton disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Preparando');
  await waitFor(() => expect(scorePdf).toHaveBeenCalled());
  reject(new Error('PDF failed'));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar el PDF');
  fireEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }));
  expect(await screen.findByRole('button', { name: 'Descargar PDF y abrir WhatsApp' })).toBeInTheDocument();
});
it('la alternativa descarga el PDF y abre WhatsApp con un solo toque explícito', async () => {
  vi.spyOn(download, 'canShareFiles').mockReturnValue(false);
  const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => undefined);
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  render(<WhatsAppButton disabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Descargar PDF y abrir WhatsApp' }));
  expect(save).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/?text='), '_blank', 'noopener,noreferrer');
  expect(screen.getByRole('status')).toHaveTextContent('adjunta el archivo');
});
