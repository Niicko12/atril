// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { zipSync } from 'fflate';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emptyScore, getInstrument, toMusicXML } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { OnlineCatalog } from './online-catalog';
import { downloadOnline, loadOnlineIndex } from '../services/online-catalog.service';
import { S } from '../strings';

vi.mock('../services/online-catalog.service', async (original) => ({
  ...(await original<typeof import('../services/online-catalog.service')>()),
  loadOnlineIndex: vi.fn(),
  downloadOnline: vi.fn(),
}));
const score = { path: 'music21/corpus/bach/bwv269.mxl', title: 'BWV 269', composer: 'Johann Sebastian Bach' };
const xml = new TextEncoder().encode(
  toMusicXML({ ...emptyScore('piano'), title: 'Coral', notes: [{ p: 60, d: 16 }] }, getInstrument('piano')),
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadOnlineIndex).mockResolvedValue([score]);
  vi.mocked(downloadOnline).mockResolvedValue(zipSync({ 'score.musicxml': xml }));
  useScoreStore.getState().replaceScore(emptyScore('flauta'));
});
const props = () => ({ query: '', blocked: false, onBusy: vi.fn(), onLoaded: vi.fn() });
const load = async () => {
  fireEvent.click(screen.getByRole('button', { name: S.onlineSearch }));
  await screen.findByRole('button', { name: S.onlineOpen });
};

describe('búsqueda e importación en línea', () => {
  it('requiere elección explícita y filtra por la consulta compartida', async () => {
    const p = props();
    const { rerender } = render(<OnlineCatalog {...p} />);
    expect(loadOnlineIndex).not.toHaveBeenCalled();
    await load();
    expect(screen.getByText('BWV 269')).toBeInTheDocument();
    rerender(<OnlineCatalog {...p} query="mozart" />);
    expect(screen.getByText(S.onlineNone)).toBeInTheDocument();
    expect(loadOnlineIndex).toHaveBeenCalledOnce();
  });
  it('muestra las partituras del artista automáticamente al escribir', async () => {
    render(<OnlineCatalog {...props()} query="Bach" searchMode="artist" />);
    expect(await screen.findByText('BWV 269')).toBeInTheDocument();
    expect(loadOnlineIndex).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: S.onlineOpen })).toBeInTheDocument();
  });
  it('carga las notas reales en el editor y cierra al terminar', async () => {
    const p = props();
    render(<OnlineCatalog {...p} />);
    await load();
    fireEvent.click(screen.getByRole('button', { name: S.onlineOpen }));
    await waitFor(() => expect(p.onLoaded).toHaveBeenCalledOnce());
    expect(useScoreStore.getState().score.title).toBe('Coral');
    expect(useScoreStore.getState().score.notes).toEqual([{ p: 60, d: 16 }]);
  });
  it('un fallo permite reintentar y conserva la partitura actual', async () => {
    vi.mocked(loadOnlineIndex).mockRejectedValueOnce(new Error(S.onlineRateLimit));
    render(<OnlineCatalog {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: S.onlineSearch }));
    expect(await screen.findByRole('alert')).toHaveTextContent(S.onlineRateLimit);
    expect(useScoreStore.getState().score.notes).toHaveLength(0);
    await load();
  });
  it.each(['cancelar', 'cerrar'])('no importa una respuesta tardía después de %s', async (action) => {
    let resolve!: (bytes: Uint8Array) => void;
    vi.mocked(downloadOnline).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const p = props();
    const { unmount } = render(<OnlineCatalog {...p} />);
    await load();
    fireEvent.click(screen.getByRole('button', { name: S.onlineOpen }));
    if (action === 'cancelar') fireEvent.click(screen.getByRole('button', { name: S.onlineCancel }));
    else unmount();
    await act(async () => resolve(xml));
    expect(p.onLoaded).not.toHaveBeenCalled();
    expect(useScoreStore.getState().score.notes).toHaveLength(0);
  });
});
