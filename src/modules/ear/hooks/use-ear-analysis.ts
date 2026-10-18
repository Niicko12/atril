import { useCallback, useState } from 'react';
import { analyze, cancelAnalysis, openResult } from '../services/ear.service';
import { CancelledError, WorkerFailure } from '../services/worker-client';
import { S } from '../strings';
import type { DecodedAudio, EarMode, Region } from '../types';

export type AnalysisState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: number }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

const failure = (e: unknown): string =>
  e instanceof WorkerFailure && e.code === 'out_of_memory' ? S.errMemory : S.errInternal;

/** Analiza en el Worker y abre el resultado en el editor (ear-spec 17.1, 23). */
export function useEarAnalysis() {
  const [state, setState] = useState<AnalysisState>({ kind: 'idle' });
  const run = useCallback(async (audio: DecodedAudio, mode: EarMode, region: Region) => {
    setState({ kind: 'running', progress: 0 });
    try {
      const { raw, cut } = await analyze(audio, mode, region, (progress) => setState({ kind: 'running', progress }));
      if (raw.length < 2)
        return setState({ kind: 'error', message: mode === 'mix' ? S.errNoNotesMix : S.errNoNotesSolo });
      const res = await openResult(audio, mode, raw);
      if (!res) return setState({ kind: 'idle' });
      const extra = cut ? ` ${S.cut(mode === 'mix' ? 180 : 300)}` : '';
      setState({ kind: 'done', message: S.done(res.notes, res.bpm, mode === 'mix') + extra });
    } catch (e) {
      setState(e instanceof CancelledError ? { kind: 'idle' } : { kind: 'error', message: failure(e) });
    }
  }, []);
  const cancel = useCallback(() => cancelAnalysis(), []);
  return { state, run, cancel, setState };
}
