import { prepareSounds, sampledTone } from './samples';
function context() {
  const buffer = {
    length: 3000,
    numberOfChannels: 1,
    duration: 3,
    sampleRate: 1000,
    getChannelData: () => new Float32Array(3000),
  };
  const source = {
    buffer: null,
    playbackRate: { value: 1 },
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  const api = {
    decodeAudioData: vi.fn().mockResolvedValue(buffer),
    createBufferSource: vi.fn(() => source),
    createGain: () => gain,
  };
  return { api: api as unknown as AudioContext, source, gain, decode: api.decodeAudioData };
}
afterEach(() => vi.unstubAllGlobals());
describe('muestras por instrumento', () => {
  it('descarga solo anclas necesarias, deduplica y distingue violín de viola', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Uint8Array([1, 2]))));
    vi.stubGlobal('fetch', fetcher);
    const c = context();
    expect(await prepareSounds(c.api, 'violin', [69, 70, 72])).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toContain('/violin-mp3/C5.mp3');
    expect(await prepareSounds(c.api, 'violin', [69])).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await prepareSounds(c.api, 'viola', [69])).toBe(true);
    expect(fetcher.mock.calls[1]?.[0]).toContain('/viola-mp3/C5.mp3');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });
  it('afina la muestra y conserva sustain y liberación de la nota solicitada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('mp3')));
    const c = context(),
      track = vi.fn(),
      output = {} as AudioNode;
    expect(sampledTone({ context: c.api, output, id: 'violin', midi: 69, start: 2, duration: 4, track })).toBe(false);
    await prepareSounds(c.api, 'violin', [69]);
    expect(sampledTone({ context: c.api, output, id: 'violin', midi: 69, start: 2, duration: 4, track })).toBe(true);
    expect(c.source.playbackRate.value).toBeCloseTo(2 ** (-3 / 12));
    expect(c.source.loop).toBe(true);
    expect(c.source.start).toHaveBeenCalledWith(2);
    expect(c.source.stop).toHaveBeenCalledWith(6.1);
    expect(track).toHaveBeenCalledWith(c.source);
    expect(c.gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 6.08);
  });
  it('falla de forma explícita y permite reintentar, sin evaluar scripts remotos', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('no', { status: 404 }))
      .mockResolvedValueOnce(new Response('mp3'));
    vi.stubGlobal('fetch', fetcher);
    const c = context();
    expect(await prepareSounds(c.api, 'violin', [60])).toBe(false);
    expect(c.decode).not.toHaveBeenCalled();
    expect(await prepareSounds(c.api, 'violin', [60])).toBe(true);
    expect(c.decode).toHaveBeenCalledWith(expect.any(ArrayBuffer));
  });
  it('rechaza archivos grandes y muestras fuera del límite de duración', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('mp3', { headers: { 'content-length': '2000000' } })),
    );
    const c = context();
    expect(await prepareSounds(c.api, 'violin', [60])).toBe(false);
    expect(c.decode).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('mp3')));
    c.decode.mockResolvedValue({ length: 999999, duration: 20, numberOfChannels: 1 });
    expect(await prepareSounds(c.api, 'violin', [60])).toBe(false);
  });
});
