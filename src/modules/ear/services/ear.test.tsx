// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { emptyScore } from '@/core';
import { EAR_LIMITS } from '@/core/analysis';
import { useScoreStore } from '@/modules/editor';
import { FakeAudioContext } from '@/modules/playback/fake-audio.test-helper';
import { useEarSession } from '../store/ear-session.store';
import { S, humanDuration } from '../strings';
import { AnalysisControls } from '../components/analysis-controls';
import { AudioTransport } from '../components/audio-transport';
import { AudioPlayer } from './audio-player';
import { openResult, regionOf, requantize, toMono } from './ear.service';
import { computePeaks, formatTime } from './peaks';
import { CancelledError, WorkerFailure, createWorkerClient } from './worker-client';
import type { DecodedAudio } from '../types';

const audio = (duration = 10): DecodedAudio => {
  const sr = 8000;
  const mono = new Float32Array(sr * duration);
  return {
    name: 'nota de voz',
    buffer: { duration, length: mono.length, sampleRate: sr } as AudioBuffer,
    mono,
    sampleRate: sr,
    duration,
  };
};

beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  useScoreStore.getState().replaceScore(emptyScore('saxalto'));
  useEarSession.getState().set(null);
});

describe('utilidades', () => {
  it('toMono promedia canales; regionOf usa A-B si dura > 0,2 s', () => {
    const buf = {
      length: 2,
      numberOfChannels: 2,
      getChannelData: (c: number) => Float32Array.from(c ? [1, 0] : [0, 0]),
    } as unknown as AudioBuffer;
    expect(Array.from(toMono(buf))).toEqual([0.5, 0]);
    expect(regionOf(30, 2, 2.1)).toEqual({ a: 0, b: 30, loop: false });
    expect(regionOf(30, 2, 6)).toEqual({ a: 2, b: 6, loop: true });
  });
  it('picos normalizados y tiempo m:ss', () => {
    const p = computePeaks(
      Float32Array.from({ length: 1000 }, (_, i) => (i < 500 ? 0.1 : 0.5)),
      10,
    );
    expect([p[0], p[9]]).toEqual([expect.closeTo(0.2, 5), 1]);
    expect([formatTime(0), formatTime(75.9), formatTime(-3)]).toEqual(['0:00', '1:15', '0:00']);
  });
  it('textos derivados de los límites (deuda 6, T-LIM-01)', () => {
    expect(humanDuration(EAR_LIMITS.partsMaxSec)).toBe('minuto y medio');
    expect(humanDuration(EAR_LIMITS.mixMaxSec)).toBe('3 minutos');
    expect(S.tipMix).toContain('3 minutos');
    expect(S.errDuration).toContain(humanDuration(EAR_LIMITS.durationMaxSec));
    expect(S.errSize).toContain('50 MB');
  });
});

describe('resultado al editor y reajustar ritmo (T-SVC-01/03)', () => {
  const raw = [0, 1, 2, 3].map((i) => ({ m: 60 + i * 2, t0: i * 0.5, t1: i * 0.5 + 0.45 }));
  it('abre la partitura "(de oído)" con el instrumento actual y guarda la sesión', async () => {
    const res = await act(() => openResult(audio(), 'solo', raw));
    const s = useScoreStore.getState().score;
    expect(res).toEqual({ notes: 4, bpm: 120 });
    expect([s.title, s.instrumentId, s.source, s.tempo]).toEqual(['nota de voz (de oído)', 'saxalto', 'ear_solo', 120]);
    expect(useEarSession.getState().session?.timeline).toHaveLength(4);
  });
  it('reajustar re-cuantiza con el tempo actual y se puede deshacer', async () => {
    await act(() => openResult(audio(), 'solo', raw));
    act(() => useScoreStore.getState().setMeta({ tempo: 60 }));
    act(() => void requantize());
    expect(useScoreStore.getState().score.notes.map((n) => n.d)).toEqual([2, 2, 2, 2]);
    act(() => useScoreStore.getState().undo());
    expect(useScoreStore.getState().score.notes.map((n) => n.d)).toEqual([4, 4, 4, 4]);
  });
});

describe('cliente de Worker (T-WRK-03/04)', () => {
  class FakeWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    terminated = false;
    constructor(private reply: (msg: { id: string }) => unknown[]) {}
    postMessage(msg: { id: string }) {
      queueMicrotask(() => this.reply(msg).forEach((data) => this.onmessage?.({ data } as MessageEvent)));
    }
    terminate() {
      this.terminated = true;
    }
  }
  it('progreso y respuesta', async () => {
    const progress = vi.fn();
    const c = createWorkerClient(
      () =>
        new FakeWorker((m) => [
          { id: m.id, type: 'progress', value: 0.5 },
          { id: m.id, type: 'detect_done', raw: [1] },
        ]) as unknown as Worker,
    );
    await expect(c.request({ type: 'detect' }, [], progress)).resolves.toMatchObject({ raw: [1] });
    expect(progress).toHaveBeenCalledWith(0.5);
  });
  it('error del Worker y cancelar terminan la promesa', async () => {
    let w = null as FakeWorker | null;
    const c = createWorkerClient(
      () =>
        (w = new FakeWorker((m) => [
          { id: m.id, type: 'error', code: 'out_of_memory', message: '' },
        ])) as unknown as Worker,
    );
    await expect(c.request({}, [])).rejects.toBeInstanceOf(WorkerFailure);
    const c2 = createWorkerClient(() => (w = new FakeWorker(() => [])) as unknown as Worker);
    const p = c2.request({}, []);
    c2.cancel();
    await expect(p).rejects.toBeInstanceOf(CancelledError);
    expect((w as FakeWorker | null)?.terminated).toBe(true);
  });
});

describe('reproductor y controles', () => {
  it('A-B mínimo 0,3 s; actualizar no reproduce si estaba en pausa', () => {
    const p = new AudioPlayer(audio(10));
    p.setLoop(4, 4.1);
    expect([p.state.a, p.state.b, p.state.pos]).toEqual([4, expect.closeTo(4.3, 5), 4]);
    p.update({ pos: 2 });
    expect(p.state.playing).toBe(false);
  });
  it('transporte: Desde aquí y Quitar repetición', () => {
    const p = new AudioPlayer(audio(10));
    p.update({ pos: 3 });
    const { rerender } = render(<AudioTransport player={p} state={p.state} duration={10} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desde aquí' }));
    expect([p.state.a, p.state.b]).toEqual([3, 7]);
    rerender(<AudioTransport player={p} state={p.state} duration={10} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar repetición' }));
    expect(p.state.a).toBeNull();
  });
  it('controles: Cancelar solo durante el análisis; Reajustar con sesión', () => {
    const fns = { onMode: vi.fn(), onDetect: vi.fn(), onCancel: vi.fn(), onRequantize: vi.fn() };
    const { rerender } = render(
      <AnalysisControls mode="solo" state={{ kind: 'running', progress: 0.42 }} hasSession {...fns} />,
    );
    expect(screen.getByText('Escuchando la melodía… 42 %')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(fns.onCancel).toHaveBeenCalled();
    rerender(<AnalysisControls mode="mix" state={{ kind: 'idle' }} hasSession {...fns} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reajustar ritmo al tempo' }));
    expect(fns.onRequantize).toHaveBeenCalled();
  });
});
