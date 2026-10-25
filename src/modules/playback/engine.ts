import { track } from './engine/voices';
import { prepareSounds, sampledTone, soundStatus } from '@/modules/sound-library';
import { toast } from '@/shared/toast';
import { getContext, getMaster, isAudioSupported } from './engine/context';
import { unlock } from './engine/ios-unlock';
import { START_DELAY_SEC, TICK_MS, buildEvents, eventAt, scheduleWindow, type PlayEvent } from './engine/scheduler';
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

let timer: ReturnType<typeof setInterval> | null = null;
let raf = 0;
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
  if (timer) clearInterval(timer);
  timer = null;
  if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
  stopVoices();
  setPositionDefault(-1);
  setPlaying(false);
}

function startClock(events: PlayEvent[], startAt: number, opts: PlayOptions, samples = false): void {
  const c = getContext();
  const onPosition = opts.onPosition ?? setPositionDefault;
  const total = events.length ? (events[events.length - 1] as PlayEvent).e : 0;
  let next = 0;
  let last = -2;
  const schedule = () => {
    next = scheduleWindow({ events, next, startAt, now: c.currentTime }, (ev, when) =>
      playTone(ev.p as number, when, (ev.e - ev.s) * DUR_FACTOR, { ...opts, samples }),
    );
    if (next >= events.length && timer) clearInterval(timer);
  };
  const frame = () => {
    const t = c.currentTime - startAt;
    if (t > total + 0.2) {
      stopAll();
      opts.onEnd?.();
      return;
    }
    const i = eventAt(events, t);
    if (i !== last) onPosition((last = i));
    raf = requestAnimationFrame(frame);
  };
  schedule();
  timer = setInterval(schedule, TICK_MS);
  raf = requestAnimationFrame(frame);
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
    startClock(events, getContext().currentTime + START_DELAY_SEC, opts);
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
    startClock(events, getContext().currentTime + START_DELAY_SEC, opts, samples);
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
    const events = buildEvents(opts.notes, from, opts.tempo);
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
