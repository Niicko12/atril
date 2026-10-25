import { track } from './engine/voices';
import { prepareSounds, sampledTone, soundStatus } from '@/modules/sound-library';
import { toast } from '@/shared/toast';
import { getContext, getMaster, isAudioSupported } from './engine/context';
import { unlock } from './engine/ios-unlock';
import { buildEvents, type PlayEvent } from './engine/scheduler';
import { startPracticeClock, practiceTimeline, metronomeClick } from '@/modules/practice';
import { tone } from './engine/tone';
import { stopVoices } from './engine/voices';
import { usePlaybackPositionStore } from './store/playback-position.store';
import type { PlaybackEngine, PlayOptions } from './types';

const PREVIEW_SEC = 0.45;
const NO_AUDIO = 'Tu navegador no puede reproducir sonido.';

let warned = false;
/** false (y aviso único) si no hay Web Audio. */
function audioReady(): boolean {
  if (isAudioSupported()) return true;
  if (!warned) toast(NO_AUDIO);
  warned = true;
  return false;
}
const DUR_FACTOR = 0.92;

let cancelClock: (() => void) | undefined;
let playing = false;
let generation = 0;
const listeners = new Set<(playing: boolean) => void>();
const setPositionDefault = (i: number) => usePlaybackPositionStore.getState().set(i);

function setPlaying(v: boolean): void {
  if (playing === v) return;
  playing = v;
  listeners.forEach((fn) => fn(v));
}

function stopAll(): void {
  generation++;
  if (soundStatus.get().startsWith('Cargando')) soundStatus.set('Carga de sonido detenida');
  cancelClock?.();
  cancelClock = undefined;
  stopVoices();
  setPositionDefault(-1);
  setPlaying(false);
}

function startClock(events: PlayEvent[], opts: PlayOptions, samples = false): void {
  const settings = opts.practice ?? { start: 1, end: 1, bar: 16, beat: 4, speed: 1,
    repeat: false, metronome: false, countIn: false };
  const timeline = opts.practice
    ? practiceTimeline(opts.notes, opts.tempo, settings)
    : {
        events,
        duration: events.at(-1)?.e ?? 0,
        unit: 0,
      };
  cancelClock = startPracticeClock({
    ...timeline,
    settings,
    context: getContext(),
    play: (ev, when) => playTone(ev.p as number, when, (ev.e - ev.s) * DUR_FACTOR, { ...opts, samples }),
    click: (when, accent) => metronomeClick({ context: getContext(), output: getMaster(), track }, when, accent),
    position: opts.onPosition ?? setPositionDefault,
    end: () => {
      stopAll();
      opts.onEnd?.();
    },
  });
}

function playTone(midi: number, start: number, duration: number, opts: PlayOptions & { samples: boolean }): void {
  if (
    opts.samples &&
    opts.instrumentId &&
    sampledTone({ context: getContext(), output: getMaster(), id: opts.instrumentId, midi, start, duration, track })
  )
    return;
  tone(midi, start, duration, opts.timbre);
}
function startPrepared(opts: PlayOptions, events: PlayEvent[], token: number): void {
  if (!opts.instrumentId) {
    startClock(events, opts);
    return;
  }
  soundStatus.set('Cargando muestras del instrumento…');
  void prepareSounds(
    getContext(),
    opts.instrumentId,
    events.flatMap((event) => (event.p === null ? [] : [event.p])),
  ).then((samples) => {
    if (token !== generation) return;
    soundStatus.set(
      samples
        ? 'Sonido: muestras de instrumento · FluidR3'
        : 'Sin muestras: sonido sintetizado de respaldo. Comprueba tu conexión.',
    );
    startClock(events, opts, samples);
  });
}

/** Motor de reproducción (playback-spec 3, 8-12). */
export const playbackEngine: PlaybackEngine = {
  getContext,
  unlock() {
    if (isAudioSupported()) unlock();
  },
  preview(midi, timbre, instrumentId) {
    if (!audioReady()) return;
    unlock();
    if (!instrumentId) {
      tone(midi, getContext().currentTime + 0.01, PREVIEW_SEC, timbre);
      return;
    }
    const token = generation;
    soundStatus.set('Cargando muestra del instrumento…');
    void prepareSounds(getContext(), instrumentId, [midi]).then((samples) => {
      if (token !== generation) return;
      soundStatus.set(
        samples
          ? 'Sonido: muestras de instrumento · FluidR3'
          : 'Sin muestras: sonido sintetizado de respaldo. Comprueba tu conexión.',
      );
      playTone(midi, getContext().currentTime + 0.01, PREVIEW_SEC, {
        notes: [],
        tempo: 100,
        fromIndex: 0,
        timbre,
        instrumentId,
        samples,
      });
    });
  },
  play(opts) {
    stopAll();
    if (!opts.notes.length || !audioReady()) return;
    unlock();
    const from = Math.min(Math.max(0, opts.fromIndex), opts.notes.length - 1);
    const events = opts.practice
      ? practiceTimeline(opts.notes, opts.tempo, opts.practice).events
      : buildEvents(opts.notes, from, opts.tempo);
    if (!events.length) return;
    setPlaying(true);
    startPrepared(opts, events, generation);
  },
  stopAll,
  get isPlaying() {
    return playing;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.hidden && playing && stopAll());
  addEventListener('pagehide', () => stopAll());
}
