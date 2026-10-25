import { downloadOnline, loadOnlineIndex, parseOnlineIndex, readLimited, searchOnline } from './online-catalog.service';
import { S } from '../strings';

const item = { path: 'music21/corpus/bach/bwv269.mxl', type: 'blob' };
const score = { path: item.path, title: 'BWV 269', composer: 'Johann Sebastian Bach' };
afterEach(() => vi.unstubAllGlobals());

describe('catálogo remoto', () => {
  it('limita el catálogo a compositores admitidos y formatos importables', () => {
    const scores = parseOnlineIndex({
      tree: [
        item,
        { path: 'music21/corpus/mozart/k545.xml', type: 'blob' },
        { path: 'music21/corpus/bach/readme.txt', type: 'blob' },
        { path: 'music21/corpus/bach/../secret.xml', type: 'blob' },
        { path: 'music21/corpus/unknown/song.mxl', type: 'blob' },
        { ...item, type: 'tree' },
        null,
      ],
    });
    expect(scores).toHaveLength(2);
    expect(scores[0]).toEqual(score);
    expect(searchOnline(scores, '  BACH bwv 269  ')).toEqual([score]);
    expect(searchOnline(scores, 'inexistente')).toEqual([]);
    expect(searchOnline([{ ...score, title: 'Canción' }], 'cancion')).toHaveLength(1);
  });
  it('filtra por artista sin confundir títulos con nombres de artistas', () => {
    const named = { ...score, title: 'Homenaje a Mozart' };
    expect(searchOnline([named], 'Mozart')).toEqual([named]);
    expect(searchOnline([named], 'Mozart', 'artist')).toEqual([]);
    expect(searchOnline([named], '  SEBASTIAN bach  ', 'artist')).toEqual([named]);
  });
  it('rechaza índices inválidos o incompletos', () => {
    for (const data of [null, {}, { tree: [], truncated: true }]) expect(() => parseOnlineIndex(data)).toThrow();
  });
  it('comprueba los estados HTTP y el límite declarado', async () => {
    await expect(readLimited(new Response('error', { status: 429 }), 10)).rejects.toThrow(S.onlineRateLimit);
    await expect(readLimited(new Response('error', { status: 404 }), 10)).rejects.toThrow(S.onlineFailed);
    await expect(readLimited(new Response('abc', { headers: { 'Content-Length': '100' } }), 10)).rejects.toThrow(
      S.onlineTooBig,
    );
  });
  it('limita la descarga real aunque no exista Content-Length y cancela la lectura', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(11));
      },
      cancel,
    });
    await expect(readLimited(new Response(stream), 10)).rejects.toThrow(S.onlineTooBig);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('descarga el archivo de la fuente fija sin credenciales y respeta la cancelación', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2])));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    expect(await downloadOnline(score, controller.signal)).toEqual(new Uint8Array([1, 2]));
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/raw.githubusercontent.com\/cuthbertLab\/music21\/master\/music21\/corpus\/bach\/bwv269.mxl$/,
      ),
      expect.objectContaining({ credentials: 'omit', signal: controller.signal }),
    );
    await expect(
      downloadOnline({ ...score, path: 'https://example.com/file.xml' }, controller.signal),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(new Response('abc'));
    controller.abort();
    await expect(downloadOnline(score, controller.signal)).rejects.toThrow();
  });
  it('consulta una vez el índice y reutiliza la caché local sin enviar la búsqueda', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tree: [item] })));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    expect(await loadOnlineIndex(controller.signal)).toEqual([score]);
    expect(await loadOnlineIndex(controller.signal)).toEqual([score]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
