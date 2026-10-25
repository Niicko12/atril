import { EAR_LIMITS, type PartsAnalysis } from '@/core/analysis';
import type { DecodedAudio, EarMode, Region } from '../types';
import { S } from '../strings';
import { analyze, openResult } from './ear.service';
import { detectParts } from './parts.service';

export interface AnalysisTask {
  valid(): boolean;
  progress(value: number, stage?: 'loading_model' | 'analyzing', backend?: string): void;
}
export type AnalysisOutcome = { kind: 'idle' } | { kind: 'error' | 'done'; message: string; parts?: PartsAnalysis };
async function partsResult(audio: DecodedAudio, region: Region, task: AnalysisTask): Promise<AnalysisOutcome> {
  const result = await detectParts(audio, region, task.progress);
  if (!task.valid()) return { kind: 'idle' };
  if (!result.analysis?.parts.length) return { kind: 'error', message: S.errNoParts };
  return {
    kind: 'done',
    parts: result.analysis,
    message: S.partsReady + (result.cut ? ` ${S.cut(EAR_LIMITS.partsMaxSec)}` : ''),
  };
}
/** Flujo sin estado React; valida la identidad de la tarea antes de modificar el editor. */
export async function runAnalysis(
  audio: DecodedAudio,
  mode: EarMode,
  region: Region,
  task: AnalysisTask,
): Promise<AnalysisOutcome> {
  if (mode === 'parts') return partsResult(audio, region, task);
  const { raw, cut } = await analyze(audio, mode, region, task.progress);
  if (!task.valid()) return { kind: 'idle' };
  if (raw.length < 2) return { kind: 'error', message: mode === 'mix' ? S.errNoNotesMix : S.errNoNotesSolo };
  const res = await openResult(audio, mode, raw, task.valid);
  if (!res) return { kind: 'idle' };
  const limit = mode === 'mix' ? EAR_LIMITS.mixMaxSec : EAR_LIMITS.soloMaxSec;
  return { kind: 'done', message: S.done(res.notes, res.bpm, mode === 'mix') + (cut ? ` ${S.cut(limit)}` : '') };
}
