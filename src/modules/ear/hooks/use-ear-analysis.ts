import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioPart, PartsAnalysis } from '@/core/analysis';
import { cancelAnalysis } from '../services/ear.service';
import { runAnalysis } from '../services/analysis-runner';
import { openPart } from '../services/parts.service';
import { CancelledError, WorkerFailure } from '../services/worker-client';
import { S } from '../strings';
import type { DecodedAudio, EarMode, Region } from '../types';

export type AnalysisState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: number; stage?: 'loading_model' | 'analyzing' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };
function failure(e: unknown): AnalysisState {
  if (e instanceof CancelledError || (e instanceof DOMException && e.name === 'AbortError')) return { kind: 'idle' };
  let message: string = S.errInternal;
  if (e instanceof WorkerFailure && e.code === 'model_load_failed') message = S.errModel;
  if (e instanceof WorkerFailure && e.code === 'out_of_memory') message = S.errMemory;
  return { kind: 'error', message };
}
function useTask() {
  const state = useRef({ generation: 0, busy: false });
  const invalidate = useCallback(() => {
    state.current.generation++;
    state.current.busy = false;
    cancelAnalysis();
  }, []);
  const begin = useCallback(() => {
    if (state.current.busy) return null;
    state.current.busy = true;
    const token = ++state.current.generation;
    return () => token === state.current.generation;
  }, []);
  const finish = useCallback((valid: () => boolean) => {
    if (valid()) state.current.busy = false;
  }, []);
  useEffect(() => invalidate, [invalidate]);
  return { begin, finish, invalidate };
}
function useOpenPart(
  parts: PartsAnalysis | null,
  setState: (s: AnalysisState) => void,
  task: ReturnType<typeof useTask>,
) {
  return useCallback(
    async (audio: DecodedAudio, part: AudioPart, withChords: boolean) => {
      if (!parts) return;
      const valid = task.begin();
      if (!valid) return;
      try {
        const opened = await openPart(audio, parts, part, { withChords, valid });
        if (opened && valid()) setState({ kind: 'done', message: S.partOpened(part.name, parts.bpm) });
      } catch (e) {
        if (valid()) setState(failure(e));
      } finally {
        task.finish(valid);
      }
    },
    [parts, setState, task],
  );
}
/** Una tarea activa; invalida callbacks al cancelar, cambiar audio o desmontar. */
export function useEarAnalysis() {
  const [state, setState] = useState<AnalysisState>({ kind: 'idle' });
  const [parts, setParts] = useState<PartsAnalysis | null>(null);
  const [slow, setSlow] = useState(false);
  const task = useTask();
  const cancel = () => {
    task.invalidate();
    setState({ kind: 'idle' });
    setParts(null);
    setSlow(false);
  };
  const run = async (audio: DecodedAudio, mode: EarMode, region: Region) => {
    const valid = task.begin();
    if (!valid) return;
    setParts(null);
    setSlow(false);
    setState({ kind: 'running', progress: 0 });
    try {
      const result = await runAnalysis(audio, mode, region, {
        valid,
        progress: (progress, stage, backend) => {
          if (!valid()) return;
          setState({ kind: 'running', progress, ...(stage ? { stage } : {}) });
          if (backend === 'cpu') setSlow(true);
        },
      });
      if (valid()) {
        setState(result);
        if ('parts' in result) setParts(result.parts ?? null);
      }
    } catch (e) {
      if (valid()) setState(failure(e));
    } finally {
      task.finish(valid);
    }
  };
  return { state, run, cancel, setState, parts, open: useOpenPart(parts, setState, task), slow };
}
