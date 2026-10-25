import type { InstrumentId } from '@/core';

const BANK = 'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/';
const NAMES: Record<InstrumentId, string> = {
  piano: 'acoustic_grand_piano',
  voz: 'choir_aahs',
  guitarra: 'acoustic_guitar_nylon',
  ukulele: 'acoustic_guitar_nylon',
  bajo: 'electric_bass_finger',
  violin: 'violin',
  viola: 'viola',
  cello: 'cello',
  contrabajo: 'contrabass',
  flauta: 'flute',
  flautadulce: 'recorder',
  oboe: 'oboe',
  clarinete: 'clarinet',
  saxalto: 'alto_sax',
  saxtenor: 'tenor_sax',
  trompeta: 'trumpet',
  corno: 'french_horn',
  trombon: 'trombone',
  tuba: 'tuba',
};
const BUDGET = 32 * 1024 * 1024;
type Sample = { buffer: AudioBuffer; bytes: number };
type Cache = { entries: Map<string, Sample>; pending: Map<string, Promise<void>>; bytes: number };
const caches = new WeakMap<BaseAudioContext, Cache>();
export const sampleRoot = (midi: number) => Math.max(24, Math.min(96, Math.round(midi / 12) * 12));
const keyOf = (id: InstrumentId, midi: number) => `${NAMES[id]}:${sampleRoot(midi)}`;
function cacheOf(context: BaseAudioContext): Cache {
  let cache = caches.get(context);
  if (!cache) {
    cache = { entries: new Map(), pending: new Map(), bytes: 0 };
    caches.set(context, cache);
  }
  return cache;
}
function keep(cache: Cache, key: string, buffer: AudioBuffer): void {
  const bytes = buffer.length * buffer.numberOfChannels * 4;
  if (bytes > BUDGET) throw new Error('Muestra demasiado grande');
  while (cache.bytes + bytes > BUDGET && cache.entries.size) {
    const first = cache.entries.keys().next().value as string;
    cache.bytes -= (cache.entries.get(first) as Sample).bytes;
    cache.entries.delete(first);
  }
  cache.entries.set(key, { buffer, bytes });
  cache.bytes += bytes;
}
function smoothSustain(buffer: AudioBuffer): void {
  if (buffer.duration <= 0.6) return;
  const rate = buffer.sampleRate;
  const start = Math.floor(rate * 0.25);
  const end = Math.floor(rate * Math.min(buffer.duration - 0.15, 1.5));
  const fade = Math.max(1, Math.floor(rate * 0.025));
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < fade; i++) {
      const mix = (i + 1) / fade;
      data[end - fade + i] = (data[end - fade + i] as number) * (1 - mix) + (data[start - fade + i] as number) * mix;
    }
  }
}

async function fetchSample(context: AudioContext, id: InstrumentId, midi: number): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const root = sampleRoot(midi);
    const response = await fetch(`${BANK}${NAMES[id]}-mp3/C${root / 12 - 1}.mp3`, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok || Number(response.headers.get('content-length')) > 1024 * 1024)
      throw new Error('Muestra no disponible');
    const data = await response.arrayBuffer();
    if (data.byteLength > 1024 * 1024) throw new Error('Muestra demasiado grande');
    const buffer = await context.decodeAudioData(data);
    if (buffer.duration > 12) throw new Error('Muestra demasiado larga');
    if (!['piano', 'guitarra', 'ukulele', 'bajo'].includes(id)) smoothSustain(buffer);
    keep(cacheOf(context), keyOf(id, midi), buffer);
  } finally {
    clearTimeout(timeout);
  }
}
async function loadSample(context: AudioContext, id: InstrumentId, midi: number): Promise<void> {
  const cache = cacheOf(context),
    key = keyOf(id, midi);
  if (cache.entries.has(key)) return;
  let pending = cache.pending.get(key);
  if (!pending) {
    pending = fetchSample(context, id, midi).finally(() => {
      cache.pending.delete(key);
    });
    cache.pending.set(key, pending);
  }
  await pending;
}
export async function prepareSounds(
  context: AudioContext,
  id: InstrumentId,
  midis: readonly number[],
): Promise<boolean> {
  if (typeof context.decodeAudioData !== 'function') return false;
  try {
    await Promise.all([...new Set(midis.map(sampleRoot))].map((midi) => loadSample(context, id, midi)));
    return true;
  } catch {
    return false;
  }
}
export function sampledTone(input: {
  context: AudioContext;
  output: AudioNode;
  id: InstrumentId;
  midi: number;
  start: number;
  duration: number;
  track(source: AudioScheduledSourceNode): void;
}): boolean {
  const cache = cacheOf(input.context),
    key = keyOf(input.id, input.midi);
  const sample = cache.entries.get(key);
  if (!sample) return false;
  cache.entries.delete(key);
  cache.entries.set(key, sample);
  const source = input.context.createBufferSource(),
    gain = input.context.createGain();
  source.buffer = sample.buffer;
  source.playbackRate.value = 2 ** ((input.midi - sampleRoot(input.midi)) / 12);
  const end = input.start + input.duration;
  if (!['piano', 'guitarra', 'ukulele', 'bajo'].includes(input.id) && sample.buffer.duration > 0.6) {
    source.loop = true;
    source.loopStart = 0.25;
    source.loopEnd = Math.min(sample.buffer.duration - 0.15, 1.5);
  }
  gain.gain.setValueAtTime(0, input.start);
  gain.gain.linearRampToValueAtTime(0.7, input.start + Math.min(0.008, input.duration / 4));
  gain.gain.setValueAtTime(0.7, end);
  gain.gain.linearRampToValueAtTime(0, end + 0.08);
  source.connect(gain);
  gain.connect(input.output);
  source.start(input.start);
  source.stop(end + 0.1);
  input.track(source);
  return true;
}
