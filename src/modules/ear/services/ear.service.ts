import type { Score } from '@/core';
import { EAR_LIMITS, attachChords, chordsFor, guessKey, guessTempo, quantize, type RawNote } from '@/core/analysis';
import { useScoreStore } from '@/modules/editor';
import { prepareReplace } from '@/modules/library';
import { playbackEngine } from '@/modules/playback';
import { useEarSession } from '../store/ear-session.store';
import { S } from '../strings';
import type { DecodedAudio, EarMode, Region } from '../types';
import { cancelParts } from './parts.service';
import { CancelledError, createWorkerClient } from './worker-client';

export class EarError extends Error {}

const pitch = createWorkerClient(
  () => new Worker(new URL('../../../workers/pitch.worker.ts', import.meta.url), { type: 'module' }),
);
const stretcher = createWorkerClient(
  () => new Worker(new URL('../../../workers/stretch.worker.ts', import.meta.url), { type: 'module' }),
);

/** Promedio de canales a mono. */
export function toMono(buf: AudioBuffer): Float32Array {
  const mono = new Float32Array(buf.length);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) mono[i] = (mono[i] as number) + (d[i] as number) / buf.numberOfChannels;
  }
  return mono;
}

/** Decodifica en el hilo principal (decodeAudioData no existe en Workers; ear-spec 4.2). */
export async function decodeFile(file: File): Promise<DecodedAudio> {
  if (file.size > EAR_LIMITS.fileMaxBytes) throw new EarError(S.errSize);
  let buffer: AudioBuffer;
  try {
    buffer = await playbackEngine.getContext().decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new EarError(S.errDecode);
  }
  if (buffer.duration > EAR_LIMITS.durationMaxSec) throw new EarError(S.errDuration);
  return {
    name: file.name.replace(/\.[^.]+$/, ''),
    buffer,
    mono: toMono(buffer),
    sampleRate: buffer.sampleRate,
    duration: buffer.duration,
  };
}

/** Región A-B o todo el audio (ear-spec 6). */
export function regionOf(duration: number, a: number | null, b: number | null): Region {
  return a != null && b != null && b - a > 0.2 ? { a, b, loop: true } : { a: 0, b: duration, loop: false };
}

const MAX_SEC: Record<Exclude<EarMode, 'parts'>, number> = { solo: EAR_LIMITS.soloMaxSec, mix: EAR_LIMITS.mixMaxSec };

/** Analiza la región en el Worker; copia la región (el mono original se conserva para la onda; ear-spec 20.2). */
export async function analyze(
  audio: DecodedAudio,
  mode: Exclude<EarMode, 'parts'>,
  region: Region,
  onProgress: (v: number) => void,
): Promise<{ raw: RawNote[]; cut: boolean }> {
  const end = Math.min(region.b, region.a + MAX_SEC[mode]);
  const copy = audio.mono.slice(Math.floor(region.a * audio.sampleRate), Math.floor(end * audio.sampleRate));
  const res = await pitch.request<{ raw: RawNote[] }>(
    { type: 'detect', mode, samples: copy, sampleRate: audio.sampleRate },
    [copy.buffer],
    onProgress,
  );
  return { raw: res.raw.map((r) => ({ m: r.m, t0: r.t0 + region.a, t1: r.t1 + region.a })), cut: region.b > end };
}

export const cancelAnalysis = (): void => {
  pitch.cancel();
  cancelParts();
};

let stretchGeneration = 0;
let stretchCache: { audio: DecodedAudio; key: string; buffer: AudioBuffer } | null = null;

/** Segmento estirado con caché de una entrada (ear-spec 7.2). */
export async function stretched(audio: DecodedAudio, seg: [number, number], speed: number): Promise<AudioBuffer> {
  const key = `${audio.name}:${seg.join(':')}:${speed}`;
  if (stretchCache?.audio === audio && stretchCache.key === key) return stretchCache.buffer;
  const version = stretchGeneration;
  const sr = audio.sampleRate;
  const copy = audio.mono.slice(Math.floor(seg[0] * sr), Math.floor(seg[1] * sr));
  const { samples } = await stretcher.request<{ samples: Float32Array }>(
    { type: 'stretch', samples: copy, sampleRate: sr, speed },
    [copy.buffer],
  );
  if (version !== stretchGeneration) throw new CancelledError();
  const buffer = playbackEngine.getContext().createBuffer(1, samples.length, sr);
  buffer.getChannelData(0).set(samples);
  stretchCache = { audio, key, buffer };
  return buffer;
}

/** Libera el audio original retenido por la caché y cancela el trabajo lento al cerrar. */
export function releaseAudio(audio: DecodedAudio): void {
  stretchGeneration++;
  stretcher.cancel();
  if (stretchCache?.audio === audio) stretchCache = null;
}

/** Resultado → partitura nueva en el editor (ear-spec 17.1). */
export async function openResult(
  audio: DecodedAudio,
  mode: Exclude<EarMode, 'parts'>,
  raw: RawNote[],
  valid: () => boolean = () => true,
): Promise<{ notes: number; bpm: number } | null> {
  if (!valid() || !(await prepareReplace()) || !valid()) return null;
  const bpm = guessTempo(raw);
  const { notes, timeline } = quantize(raw, bpm);
  const s = useScoreStore.getState();
  const score: Score = {
    id: crypto.randomUUID(),
    title: `${audio.name || S.defaultTitle}${S.titleSuffix}`.slice(0, 120),
    composer: '',
    instrumentId: s.score.instrumentId,
    key: guessKey(raw),
    meter: '4/4',
    tempo: Math.min(240, Math.max(30, bpm)),
    showNames: false,
    showTab: false,
    notes,
    source: mode === 'mix' ? 'ear_mix' : 'ear_solo',
    savedAt: null,
  };
  useScoreStore.getState().replaceScore(score);
  useEarSession
    .getState()
    .set({ raw, origin: null, timeline, revisionAtImport: useScoreStore.getState().revision, scoreId: score.id });
  return { notes: notes.filter((n) => n.p != null).length, bpm };
}

/** Re-cuantiza con el tempo actual, sin volver a analizar; entra al historial (ear-spec 18). */
export function requantize(): number | null {
  const session = useEarSession.getState().session;
  if (!session || (session.scoreId && session.scoreId !== useScoreStore.getState().score.id)) return null;
  const tempo = useScoreStore.getState().score.tempo;
  const { notes, timeline } = quantize(session.raw, tempo, session.origin);
  const finalNotes =
    session.withChords && session.events
      ? attachChords(notes, chordsFor(session.events, tempo, session.origin ?? 0, useScoreStore.getState().score.key))
      : notes;
  useScoreStore.getState().replaceNotesKeepingMeta(finalNotes);
  useEarSession.getState().set({ ...session, timeline, revisionAtImport: useScoreStore.getState().revision });
  return tempo;
}
