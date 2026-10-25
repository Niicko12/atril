// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useEarAnalysis } from './use-ear-analysis';
import { runAnalysis, type AnalysisOutcome } from '../services/analysis-runner';
import { cancelAnalysis } from '../services/ear.service';
import { openPart } from '../services/parts.service';
import { WorkerFailure, CancelledError } from '../services/worker-client';
import type { DecodedAudio } from '../types';
import type { PartsAnalysis } from '@/core/analysis';
import { S } from '../strings';

vi.mock('../services/analysis-runner', () => ({ runAnalysis: vi.fn() }));
vi.mock('../services/ear.service', () => ({ cancelAnalysis: vi.fn() }));
vi.mock('../services/parts.service', () => ({ openPart: vi.fn() }));
const audio = { name: 'x' } as DecodedAudio,
  region = { a: 0, b: 3, loop: false };
const parts: PartsAnalysis = {
  bpm: 120,
  key: 0,
  origin: 0,
  events: [],
  chords: [],
  parts: [{ id: 'mel', name: 'Melodía', description: '', instrumentId: null, raw: [] }],
};
function deferred() {
  let resolve!: (value: AnalysisOutcome) => void;
  const promise = new Promise<AnalysisOutcome>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => vi.clearAllMocks());
it('doble toque no duplica análisis; cancelar ignora progreso y resultados tardíos', async () => {
  const pending = deferred();
  vi.mocked(runAnalysis).mockReturnValue(pending.promise);
  const { result } = renderHook(useEarAnalysis);
  let promise!: Promise<void>;
  act(() => {
    promise = result.current.run(audio, 'parts', region);
    void result.current.run(audio, 'parts', region);
  });
  expect(runAnalysis).toHaveBeenCalledTimes(1);
  const task = vi.mocked(runAnalysis).mock.calls[0]![3];
  act(() => result.current.cancel());
  act(() => task.progress(0.9, 'analyzing', 'cpu'));
  await act(async () => {
    pending.resolve({ kind: 'done', message: 'obsoleto', parts });
    await promise;
  });
  expect(result.current.state.kind).toBe('idle');
  expect(result.current.parts).toBeNull();
});
it('muestra preparación, aviso CPU y abre una parte', async () => {
  vi.mocked(runAnalysis).mockImplementation(async (_a, _m, _r, task) => {
    task.progress(0.1, 'loading_model');
    task.progress(0.5, 'analyzing', 'cpu');
    return { kind: 'done', message: 'listo', parts };
  });
  vi.mocked(openPart).mockResolvedValue(true);
  const { result } = renderHook(useEarAnalysis);
  await act(() => result.current.run(audio, 'parts', region));
  expect(result.current.slow).toBe(true);
  expect(result.current.parts).toBe(parts);
  await act(() => result.current.open(audio, parts.parts[0]!, true));
  expect(result.current.state).toEqual({ kind: 'done', message: S.partOpened('Melodía', 120) });
  expect(openPart).toHaveBeenCalledWith(audio, parts, parts.parts[0], expect.objectContaining({ withChords: true }));
});
it.each([
  [new WorkerFailure('model_load_failed'), S.errModel],
  [new WorkerFailure('out_of_memory'), S.errMemory],
  [new Error('fallo'), S.errInternal],
])('los errores dejan el panel recuperable: %s', async (error, message) => {
  vi.mocked(runAnalysis).mockRejectedValueOnce(error).mockResolvedValueOnce({ kind: 'done', message: 'recuperado' });
  const { result } = renderHook(useEarAnalysis);
  await act(() => result.current.run(audio, 'parts', region));
  expect(result.current.state).toEqual({ kind: 'error', message });
  await act(() => result.current.run(audio, 'solo', region));
  expect(result.current.state).toEqual({ kind: 'done', message: 'recuperado' });
});
it('cancelación del Worker y desmontaje limpian la tarea sin mensaje de error', async () => {
  vi.mocked(runAnalysis).mockRejectedValueOnce(new CancelledError());
  const { result, unmount } = renderHook(useEarAnalysis);
  await act(() => result.current.run(audio, 'solo', region));
  expect(result.current.state.kind).toBe('idle');
  unmount();
  expect(cancelAnalysis).toHaveBeenCalled();
});
