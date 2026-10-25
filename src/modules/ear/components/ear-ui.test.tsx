// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emptyScore } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { FakeAudioContext } from '@/modules/playback/fake-audio.test-helper';
import { AudioPlayer } from '../services/audio-player';
import { EarPanel } from './ear-panel';
import { Waveform } from './waveform';

/** Worker simulado: responde a "detect" con una escala. */
class FakePitchWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(msg: { id: string; type?: string }) {
    const raw = [60, 62, 64, 65].map((m, i) => ({ m, t0: i * 0.5, t1: i * 0.5 + 0.45 }));
    queueMicrotask(() => {
      this.onmessage?.({ data: { id: msg.id, type: 'progress', value: 0.5 } } as MessageEvent);
      const events = raw.flatMap((n) => [n, { ...n, m: n.m - 24 }]);
      this.onmessage?.({
        data:
          msg.type === 'parts' ? { id: msg.id, type: 'parts_done', events } : { id: msg.id, type: 'detect_done', raw },
      } as MessageEvent);
    });
  }
  terminate() {}
}

class DecodingContext extends FakeAudioContext {
  decodeAudioData() {
    const length = 8000 * 3;
    const data = new Float32Array(length);
    return Promise.resolve({ duration: 3, length, sampleRate: 8000, numberOfChannels: 1, getChannelData: () => data });
  }
}

class OfflineContext {
  destination = {};
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {} };
  }
  startRendering() {
    return Promise.resolve({ getChannelData: () => new Float32Array(22050 * 3) });
  }
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', DecodingContext);
  vi.stubGlobal('Worker', FakePitchWorker);
  vi.stubGlobal('OfflineAudioContext', OfflineContext);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  useScoreStore.getState().replaceScore(emptyScore('piano'));
});

describe('EarPanel', () => {
  it('cargar audio, analizar y abrir la partitura; consejos y privacidad visibles', async () => {
    render(<EarPanel onClose={() => {}} />);
    expect(screen.getByText('Tu audio no sale de tu teléfono.')).toBeInTheDocument();
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File([new Uint8Array(10)], 'voz.m4a', { type: 'audio/mp4' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(10) });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('voz · 0:03')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Escribir la melodía sola' }));
    expect(await screen.findByText(/^Listo: 4 notas/)).toBeInTheDocument();
    await waitFor(() => expect(useScoreStore.getState().score.title).toBe('voz (de oído)'));
    expect(screen.getByRole('button', { name: 'Reajustar ritmo al tempo' })).toBeInTheDocument();
  });
  it('separa partes, muestra rango/acordes y permite abrir el bajo', async () => {
    render(<EarPanel onClose={() => {}} />);
    const file = new File([new Uint8Array(10)], 'canción.wav');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(10) });
    fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, { target: { files: [file] } });
    await screen.findByText('canción · 0:03');
    fireEvent.change(screen.getByLabelText('Tipo de audio'), { target: { value: 'parts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Separar melodía, bajo y acordes' }));
    expect(await screen.findByRole('heading', { name: 'Partes encontradas' })).toBeInTheDocument();
    expect(screen.getByText(/voz o instrumento principal/)).toHaveTextContent('Do4–Fa4');
    fireEvent.click(screen.getByLabelText('Poner los acordes arriba de la partitura'));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Bajo' }));
    await waitFor(() => expect(useScoreStore.getState().score.source).toBe('ear_parts'));
    expect(useScoreStore.getState().score.instrumentId).toBe('bajo');
    expect(useScoreStore.getState().score.notes.every((n) => !n.c)).toBe(true);
  });
  it('archivo demasiado grande', async () => {
    render(<EarPanel onClose={() => {}} />);
    const file = new File([], 'grande.wav');
    Object.defineProperty(file, 'size', { value: 60 * 1024 * 1024 });
    fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, { target: { files: [file] } });
    expect(await screen.findByText(/demasiado grande/)).toBeInTheDocument();
  });
});

describe('Waveform', () => {
  const state = { pos: 0, playing: false, a: null, b: null, speed: 1, preparing: false };
  const rect = { left: 0, width: 100, top: 0, height: 76, right: 100, bottom: 76, x: 0, y: 0, toJSON: () => ({}) };
  it('las flechas permiten mover la posición sin arrastrar con el ratón', () => {
    const onSeek = vi.fn();
    render(
      <Waveform
        mono={new Float32Array(1000)}
        duration={10}
        state={{ ...state, pos: 5 }}
        onSeek={onSeek}
        onLoop={() => {}}
      />,
    );
    const wave = screen.getByRole('slider');
    fireEvent.keyDown(wave, { key: 'ArrowRight' });
    fireEvent.keyDown(wave, { key: 'ArrowLeft' });
    expect(onSeek.mock.calls.map(([pos]) => pos)).toEqual([6, 4]);
    expect(wave).toHaveAttribute('aria-valuetext', '5 de 10 segundos');
  });
  it('tocar mueve la posición; arrastrar crea la región A-B', () => {
    const onSeek = vi.fn();
    const onLoop = vi.fn();
    render(<Waveform mono={new Float32Array(1000)} duration={10} state={state} onSeek={onSeek} onLoop={onLoop} />);
    const c = screen.getByLabelText(/Onda del audio/);
    c.getBoundingClientRect = () => rect as DOMRect;
    fireEvent.pointerDown(c, { clientX: 50 });
    fireEvent.pointerUp(c, { clientX: 50 });
    expect(onSeek).toHaveBeenCalledWith(5);
    fireEvent.pointerDown(c, { clientX: 20 });
    fireEvent.pointerMove(c, { clientX: 60 });
    fireEvent.pointerUp(c, { clientX: 60 });
    expect(onLoop).toHaveBeenCalledWith(2, 6);
  });
});

describe('AudioPlayer.play', () => {
  it('a velocidad normal reproduce el buffer en bucle A-B y se detiene', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const buffer = { duration: 10 } as AudioBuffer;
    const p = new AudioPlayer({ name: 'x', buffer, mono: new Float32Array(10), sampleRate: 8000, duration: 10 });
    p.attach();
    p.setLoop(2, 4);
    await act(() => p.play());
    const src = (FakeAudioContext.last as FakeAudioContext).sources('buffer').at(-1) as unknown as {
      loop: boolean;
      loopStart: number;
      started: number;
    };
    expect([p.state.playing, src.loop, src.loopStart]).toEqual([true, true, 2]);
    p.stop();
    expect(p.state.playing).toBe(false);
    p.dispose();
  });
});
describe('regresiones de reproducción asíncrona', () => {
  const player = () =>
    new AudioPlayer({
      name: 'x',
      buffer: { duration: 10 } as AudioBuffer,
      mono: new Float32Array(10),
      sampleRate: 8000,
      duration: 10,
    });
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  it('detener antes de terminar la preparación impide que arranque tarde', async () => {
    const p = player();
    const pending = p.play();
    p.stop();
    await pending;
    expect(p.state.playing).toBe(false);
    expect((FakeAudioContext.last as FakeAudioContext).sources('buffer').at(-1)?.started).toBeNull();
    p.dispose();
  });
  it('dos solicitudes rápidas solo arrancan la más reciente', async () => {
    const p = player();
    await Promise.all([p.play(), p.play()]);
    const sources = (FakeAudioContext.last as FakeAudioContext).sources('buffer').slice(-2);
    expect(sources.map((s) => s.started)).toEqual([null, 0]);
    expect(p.state.playing).toBe(true);
    p.dispose();
  });
  it('la región A-B al final sigue teniendo duración positiva', () => {
    const p = player();
    p.setLoop(10, 10);
    expect(p.state.a).toBeCloseTo(9.7);
    expect(p.state.b).toBe(10);
    p.dispose();
  });
});
