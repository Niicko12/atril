import type { Note } from '../types';

/** Evento de una voz en semicorcheas absolutas, antes de reducir a monofonía. */
export interface VoiceEvent {
  start: number;
  dur: number;
  midi: number | null;
  tieStart?: boolean;
  tieStop?: boolean;
}

/** Por inicio, la nota más aguda (silencio solo si todo el grupo es silencio). */
function topOfGroups(events: readonly VoiceEvent[]): { events: VoiceEvent[]; reduced: boolean } {
  const groups = new Map<number, VoiceEvent[]>();
  for (const e of events) groups.set(e.start, [...(groups.get(e.start) ?? []), e]);
  let reduced = false;
  const out = [...groups.values()].map((g) => {
    const pitched = g.filter((e) => e.midi != null);
    if (pitched.length > 1) reduced = true;
    if (!pitched.length) return g.reduce((a, b) => (b.dur > a.dur ? b : a));
    return pitched.reduce((a, b) => ((b.midi as number) > (a.midi as number) ? b : a));
  });
  return { events: out.sort((a, b) => a.start - b.start), reduced };
}

interface Cursor {
  notes: Note[];
  pos: number;
  last: { note: Note; start: number } | null;
}

/** Agrega un evento a la salida: corta solapamientos, rellena huecos y une ligaduras. */
function step(c: Cursor, e: VoiceEvent): void {
  if (c.last && e.start < c.pos) {
    c.last.note.d = Math.max(1, e.start - c.last.start);
    c.pos = c.last.start + c.last.note.d;
  }
  if (e.start > c.pos) c.notes.push({ p: null, d: e.start - c.pos });
  const tied = !!c.last && !!e.tieStop && c.last.note.p === e.midi && c.last.start + c.last.note.d === e.start;
  if (tied && c.last) c.last.note.d += e.dur;
  else if (e.dur >= 1) c.notes.push((c.last = { note: { p: e.midi, d: e.dur }, start: e.start }).note);
  c.pos = Math.max(c.pos, e.start) + e.dur;
}

/**
 * Reduce a una voz (formats-spec 12.4): nota más aguda por inicio, huecos → silencios, solapamientos → la anterior
 * se corta, ligaduras de la misma altura se suman. `origin` = semicorchea donde empieza la salida.
 */
export function toMonophonic(events: readonly VoiceEvent[], origin = 0): { notes: Note[]; reduced: boolean } {
  const { events: evs, reduced } = topOfGroups(events);
  const c: Cursor = { notes: [], pos: origin, last: null };
  for (const e of evs) step(c, e);
  return { notes: mergeRests(c.notes), reduced };
}

/** Une silencios consecutivos. */
function mergeRests(notes: Note[]): Note[] {
  const out: Note[] = [];
  for (const n of notes) {
    const prev = out[out.length - 1];
    if (prev && prev.p == null && n.p == null) prev.d += n.d;
    else out.push(n);
  }
  return out;
}

/** Notas largas (> 48 semicorcheas) se parten en notas de 48 ligadas implícitamente (el modelo no tiene ligaduras). */
export function splitLong(notes: readonly Note[], max = 48): Note[] {
  return notes.flatMap((n) => {
    const out: Note[] = [];
    for (let d = n.d; d > 0; d -= max) out.push({ ...n, d: Math.min(max, d) });
    return out;
  });
}
