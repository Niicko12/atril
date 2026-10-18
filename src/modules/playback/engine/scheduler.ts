import type { Note } from '@/core';

export interface PlayEvent {
  i: number;
  s: number;
  e: number;
  p: number | null;
}

export const LOOKAHEAD_SEC = 0.2;
export const TICK_MS = 25;
export const START_DELAY_SEC = 0.15;

/** Eventos en tiempo relativo, sin crear nodos (playback-spec 10.2). */
export function buildEvents(notes: readonly Note[], fromIndex: number, tempo: number): PlayEvent[] {
  const spu = 60 / Math.min(240, Math.max(30, tempo || 100)) / 4;
  const events: PlayEvent[] = [];
  let t = 0;
  for (let i = Math.max(0, fromIndex); i < notes.length; i++) {
    const n = notes[i] as Note;
    events.push({ i, s: t, e: t + n.d * spu, p: n.p });
    t += n.d * spu;
  }
  return events;
}

/** Índice del evento que suena en `t` (búsqueda binaria; −1 antes del inicio). */
export function eventAt(events: readonly PlayEvent[], t: number): number {
  let lo = 0;
  let hi = events.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((events[mid] as PlayEvent).s <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found >= 0 && t < (events[found] as PlayEvent).e ? (events[found] as PlayEvent).i : -1;
}

/** Programa los eventos que caen dentro del horizonte; devuelve el siguiente índice pendiente. */
export interface WindowArgs {
  events: readonly PlayEvent[];
  next: number;
  startAt: number;
  now: number;
}

export function scheduleWindow(
  { events, next, startAt, now }: WindowArgs,
  play: (ev: PlayEvent, when: number) => void,
): number {
  let k = next;
  while (k < events.length && startAt + (events[k] as PlayEvent).s < now + LOOKAHEAD_SEC) {
    const ev = events[k] as PlayEvent;
    if (ev.p != null) play(ev, startAt + ev.s);
    k++;
  }
  return k;
}
