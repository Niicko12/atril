import type { InstrumentId, Score } from '@/core';
import {
  analyzeParts,
  attachChords,
  quantize,
  type AudioPart,
  type PartsAnalysis,
  type PolyNote,
  EAR_LIMITS,
} from '@/core/analysis';
import { useScoreStore } from '@/modules/editor';
import { prepareReplace } from '@/modules/library';
import { useEarSession } from '../store/ear-session.store';
import type { DecodedAudio, Region } from '../types';
import { createWorkerClient } from './worker-client';

const worker = createWorkerClient(
  () => new Worker(new URL('../../../workers/basic-pitch.worker.ts', import.meta.url), { type: 'module' }),
);
let generation = 0;
export const cancelParts = (): void => {
  generation++;
  worker.cancel();
};

/** OfflineAudioContext existe en el hilo principal; solo se transfiere la copia remuestreada. */
async function resample(audio: DecodedAudio, region: Region): Promise<Float32Array> {
  const end = Math.min(region.b, region.a + EAR_LIMITS.partsMaxSec);
  const samples = audio.mono.slice(Math.floor(region.a * audio.sampleRate), Math.floor(end * audio.sampleRate));
  const context = new OfflineAudioContext(1, Math.ceil((samples.length * 22050) / audio.sampleRate), 22050);
  const buffer = context.createBuffer(1, samples.length, audio.sampleRate);
  buffer.getChannelData(0).set(samples);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  return (await context.startRendering()).getChannelData(0).slice();
}
export async function detectParts(
  audio: DecodedAudio,
  region: Region,
  progress: (value: number, stage?: 'loading_model' | 'analyzing', backend?: string) => void,
): Promise<{ analysis: PartsAnalysis | null; cut: boolean }> {
  const token = ++generation;
  const samples22k = await resample(audio, region);
  if (token !== generation) throw new DOMException('Cancelled', 'AbortError');
  const { events } = await worker.request<{ events: PolyNote[] }>(
    { type: 'parts', samples22k },
    [samples22k.buffer],
    progress,
  );
  if (token !== generation) throw new DOMException('Cancelled', 'AbortError');
  return {
    analysis: analyzeParts(events.map((n) => ({ ...n, t0: n.t0 + region.a, t1: n.t1 + region.a }))),
    cut: region.b - region.a > EAR_LIMITS.partsMaxSec,
  };
}
function partInstrument(part: AudioPart, current: InstrumentId): InstrumentId {
  return part.instrumentId ?? (['bajo', 'contrabajo'].includes(current) ? 'piano' : current);
}
/** Abre una parte con el mismo origen que sus hermanas y conserva el cifrado opcional. */
export async function openPart(
  audio: DecodedAudio,
  analysis: PartsAnalysis,
  part: AudioPart,
  options: { withChords: boolean; valid?: () => boolean },
): Promise<boolean> {
  const valid = options.valid ?? (() => true);
  if (!valid() || !(await prepareReplace()) || !valid()) return false;
  const { withChords } = options;
  const current = useScoreStore.getState().score;
  const { notes, timeline } = quantize(part.raw, analysis.bpm, analysis.origin);
  const score: Score = {
    ...current,
    id: crypto.randomUUID(),
    title: `${audio.name || 'Canción'} – ${part.name}`.slice(0, 120),
    composer: '',
    instrumentId: partInstrument(part, current.instrumentId),
    key: analysis.key,
    meter: '4/4',
    tempo: analysis.bpm,
    showNames: false,
    showTab: false,
    notes: withChords ? attachChords(notes, analysis.chords) : notes,
    source: 'ear_parts',
    savedAt: null,
  };
  useScoreStore.getState().replaceScore(score);
  useEarSession.getState().set({
    raw: part.raw,
    origin: analysis.origin,
    timeline,
    revisionAtImport: useScoreStore.getState().revision,
    scoreId: score.id,
    events: analysis.events,
    withChords,
  });
  return true;
}
