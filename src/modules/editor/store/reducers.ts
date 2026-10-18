import type { Midi, Note, Score, ScoreMeta, View } from '@/core';
import {
  MAX_NOTES,
  cursorUnits,
  getInstrument,
  insertOrReplace,
  isTransposing,
  octaveAt,
  removeAt,
  setDurationAt,
  shiftKey,
  shiftNotes,
  validateScore,
} from '@/core';
import type { BaseDuration, ShiftReport } from '../types';
import { pushSnapshot } from './history';
import type { ScoreState } from './state';
import { S } from '../strings';

/** Resultado de una acción: el cambio de estado y los efectos que debe ejecutar el store. */
export interface Outcome {
  patch: Partial<ScoreState> | null;
  stop?: boolean;
  toast?: string;
  report?: ShiftReport;
}

const changed = (s: ScoreState, score: Score, now: number, extra: Partial<ScoreState> = {}): Partial<ScoreState> => ({
  ...pushSnapshot(s, now),
  score,
  dirty: true,
  revision: s.revision + 1,
  ...extra,
});

export function addNote(s: ScoreState, midi: Midi | null, now: number): Outcome {
  if (s.selection < 0 && s.score.notes.length >= MAX_NOTES) return { patch: null, toast: S.maxNotes };
  const r = insertOrReplace(s.score.notes, s.selection, midi, cursorUnits(s.cursor));
  const patch = changed(s, { ...s.score, notes: r.notes }, now, {
    selection: r.selection,
    lastIndex: r.lastIndex,
    pendingAccidental: null,
  });
  return { patch, stop: true };
}

export function deleteNote(s: ScoreState, now: number): Outcome {
  if (!s.score.notes.length) return { patch: null };
  const r = removeAt(s.score.notes, s.selection);
  const selection = s.selection >= 0 ? r.selection : -1;
  return { patch: changed(s, { ...s.score, notes: r.notes }, now, { selection, lastIndex: -1 }), stop: true };
}

function withCursor(s: ScoreState, cursor: ScoreState['cursor'], now: number): Outcome {
  if (s.selection < 0) return { patch: { cursor } };
  const notes = setDurationAt(s.score.notes, s.selection, cursorUnits(cursor));
  return { patch: changed(s, { ...s.score, notes }, now, { cursor }) };
}

export const setDuration = (s: ScoreState, base: BaseDuration, now: number): Outcome =>
  withCursor(s, { base, dot: base === 1 ? false : s.cursor.dot }, now);

export const toggleDot = (s: ScoreState, now: number): Outcome =>
  s.cursor.base === 1 ? { patch: null } : withCursor(s, { ...s.cursor, dot: !s.cursor.dot }, now);

export function select(s: ScoreState, index: number): Outcome {
  const valid = index >= 0 && index < s.score.notes.length && index !== s.selection;
  return { patch: { selection: valid ? index : -1 } };
}

export function moveSelection(s: ScoreState, dir: -1 | 1): Outcome {
  const len = s.score.notes.length;
  if (s.selection < 0) return { patch: { selection: dir === -1 ? len - 1 : -1 } };
  const next = dir === -1 ? Math.max(0, s.selection - 1) : s.selection + 1 < len ? s.selection + 1 : -1;
  return { patch: { selection: next } };
}

export function octaveLast(s: ScoreState, dir: 1 | -1, now: number): Outcome {
  const len = s.score.notes.length;
  const i = s.selection >= 0 ? s.selection : s.lastIndex >= 0 && s.lastIndex < len ? s.lastIndex : len - 1;
  if (s.score.notes[i]?.p == null) return { patch: null };
  const r = octaveAt(s.score.notes, i, dir);
  if (!r.changed) return { patch: null, toast: S.atRangeLimit };
  return { patch: changed(s, { ...s.score, notes: r.notes }, now, { lastIndex: i }) };
}

export function shiftAll(s: ScoreState, semitones: number, now: number): Outcome {
  if (!s.score.notes.some((n) => n.p != null)) return { patch: null, report: { clipped: 0 } };
  const r = shiftNotes(s.score.notes, semitones);
  const score = { ...s.score, notes: r.notes, key: shiftKey(s.score.key, semitones) };
  return { patch: changed(s, score, now), stop: true, report: { clipped: r.clipped } };
}

export function setMeta(s: ScoreState, patch: Partial<ScoreMeta>, now: number): Outcome {
  const field = 'title' in patch ? 'title' : 'composer' in patch ? 'composer' : undefined;
  const score = { ...s.score, ...patch };
  const view: View = isTransposing(getInstrument(score.instrumentId)) ? s.view : 'written';
  const stop = 'instrumentId' in patch || 'tempo' in patch;
  return { patch: { ...pushSnapshot(s, now, field), score, view, dirty: true, revision: s.revision + 1 }, stop };
}

export function setView(s: ScoreState, view: View): Outcome {
  return { patch: { view: isTransposing(getInstrument(s.score.instrumentId)) ? view : 'written' } };
}

export function replaceScore(s: ScoreState, next: Score, keepHistory = false): Outcome {
  validateScore(next);
  const revision = s.revision + 1;
  const history = keepHistory ? {} : { past: [], future: [], group: null };
  const patch = {
    ...history,
    score: next,
    selection: -1,
    lastIndex: -1,
    view: 'written' as View,
    pendingAccidental: null,
    dirty: false,
    revision,
    loadedRevision: revision,
  };
  return { patch, stop: true };
}

export function replaceNotesKeepingMeta(s: ScoreState, notes: Note[], now: number): Outcome {
  return { patch: changed(s, { ...s.score, notes }, now, { selection: -1 }), stop: true };
}
