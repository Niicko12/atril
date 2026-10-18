import type { Score, ScoreMeta, View } from '@/core';
import type { Cursor, PendingAccidental, Snapshot } from '../types';

export interface HistoryGroup {
  field: 'title' | 'composer';
  until: number;
}

/** Estado del editor (editor-spec 3.2). */
export interface ScoreState {
  score: Score;
  selection: number;
  lastIndex: number;
  cursor: Cursor;
  view: View;
  pendingAccidental: PendingAccidental;
  keyboardOctave: number;
  past: Snapshot[];
  future: Snapshot[];
  group: HistoryGroup | null;
  dirty: boolean;
  revision: number;
  loadedRevision: number;
}

export function metaOf(s: Score): ScoreMeta {
  const { title, composer, instrumentId, key, meter, tempo, showNames, showTab } = s;
  return { title, composer, instrumentId, key, meter, tempo, showNames, showTab };
}

export function initialState(score: Score): ScoreState {
  return {
    score,
    selection: -1,
    lastIndex: -1,
    cursor: { base: 4, dot: false },
    view: 'written',
    pendingAccidental: null,
    keyboardOctave: 4,
    past: [],
    future: [],
    group: null,
    dirty: false,
    revision: 0,
    loadedRevision: 0,
  };
}
