import type { ScoreState } from './state';
import { metaOf } from './state';

export const HISTORY_LIMIT = 200;
export const GROUP_WINDOW_MS = 1000;

type HistoryPatch = Pick<ScoreState, 'past' | 'future' | 'group'>;

/** Guarda el estado actual antes de un cambio (editor-spec 6.2). Las ráfagas de título/compositor se agrupan. */
export function pushSnapshot(s: ScoreState, now: number, groupField?: 'title' | 'composer'): HistoryPatch {
  if (groupField && s.group?.field === groupField && now < s.group.until) {
    return { past: s.past, future: s.future, group: { field: groupField, until: now + GROUP_WINDOW_MS } };
  }
  const past = [...s.past, { notes: s.score.notes, meta: metaOf(s.score) }].slice(-HISTORY_LIMIT);
  return { past, future: [], group: groupField ? { field: groupField, until: now + GROUP_WINDOW_MS } : null };
}

function restore(s: ScoreState, from: 'past' | 'future'): Partial<ScoreState> | null {
  const stack = s[from];
  const snap = stack[stack.length - 1];
  if (!snap) return null;
  const current = { notes: s.score.notes, meta: metaOf(s.score) };
  const score = { ...s.score, ...snap.meta, notes: snap.notes };
  const other = from === 'past' ? 'future' : 'past';
  return {
    score,
    [from]: stack.slice(0, -1),
    [other]: [...s[other], current],
    group: null,
    selection: s.selection < snap.notes.length ? s.selection : -1,
    dirty: true,
    revision: s.revision + 1,
  };
}

export const undoPatch = (s: ScoreState) => restore(s, 'past');
export const redoPatch = (s: ScoreState) => restore(s, 'future');
