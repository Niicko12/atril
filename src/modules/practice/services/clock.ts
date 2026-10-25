import type { PracticeEvent, PracticeOptions } from '../types';

interface ClockOptions {
  context: AudioContext;
  events: PracticeEvent[];
  duration: number;
  unit: number;
  settings: PracticeOptions;
  play: (event: PracticeEvent, when: number) => void;
  click: (when: number, accent: boolean) => void;
  position: (index: number) => void;
  end: () => void;
}

function scheduleCycle(options: ClockOptions, state: { cycle: number; next: number }, start: number) {
  const { events, duration, context, settings } = options;
  const horizon = context.currentTime + 0.2;
  while (start + state.cycle * duration < horizon) {
    const base = start + state.cycle * duration;
    while (state.next < events.length) {
      const event = events[state.next] as PracticeEvent;
      if (base + event.s >= horizon) return;
      if (event.p !== null) options.play(event, base + event.s);
      state.next++;
    }
    if (!settings.repeat) return;
    state.cycle++;
    state.next = 0;
  }
}

function schedulePulses(options: ClockOptions, state: { cycle: number; pulse: number }, start: number) {
  const { settings, duration, context, unit } = options;
  const step = settings.beat * unit;
  const horizon = context.currentTime + 0.2;
  while (start + state.cycle * duration + state.pulse * step < horizon) {
    const offset = state.pulse * step;
    if (offset >= duration) {
      if (!settings.repeat) return;
      state.cycle++;
      state.pulse = 0;
      continue;
    }
    options.click(start + state.cycle * duration + offset, (state.pulse * settings.beat) % settings.bar === 0);
    state.pulse++;
  }
}

function countIn(options: ClockOptions, state: { pulse: number }, start: number, music: number) {
  const step = options.settings.beat * options.unit;
  while (start + state.pulse * step < Math.min(music, options.context.currentTime + 0.2)) {
    options.click(start + state.pulse * step, state.pulse === 0);
    state.pulse++;
  }
}

function positionAt(options: ClockOptions, elapsed: number): number {
  if (elapsed < 0) return -1;
  const time = options.settings.repeat ? elapsed % options.duration : elapsed;
  let low = 0, high = options.events.length - 1, found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((options.events[middle] as PracticeEvent).s <= time) { found = middle; low = middle + 1; }
    else high = middle - 1;
  }
  const event = options.events[found];
  return event && time < event.e ? event.i : -1;
}

/** Horizonte corto y ciclos anclados al reloj de audio: ningún temporizador reinicia el bucle. */
export function startPracticeClock(options: ClockOptions): () => void {
  if (options.duration <= 0) {
    options.end();
    return () => {};
  }
  const start = options.context.currentTime + 0.15;
  const music = start + (options.settings.countIn ? options.settings.bar * options.unit : 0);
  const notes = { cycle: 0, next: 0 };
  const pulses = { cycle: 0, pulse: 0 };
  const entry = { pulse: 0 };
  const schedule = () => {
    countIn(options, entry, start, music);
    scheduleCycle(options, notes, music);
    if (options.settings.metronome) schedulePulses(options, pulses, music);
  };
  let frameId = 0;
  let last = -2;
  const frame = () => {
    const elapsed = options.context.currentTime - music;
    if (!options.settings.repeat && elapsed > options.duration + 0.2) return options.end();
    const index = positionAt(options, elapsed);
    if (index !== last) options.position((last = index));
    frameId = requestAnimationFrame(frame);
  };
  schedule();
  const timer = setInterval(schedule, 25);
  frameId = requestAnimationFrame(frame);
  return () => {
    clearInterval(timer);
    cancelAnimationFrame(frameId);
  };
}
