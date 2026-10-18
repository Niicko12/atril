import type { Instrument } from '@/core';
import { cursorUnits, getInstrument, isTransposing } from '@/core';
import type { ScoreStore } from './score.store';

export const selectNotes = (s: ScoreStore) => s.score.notes;
export const selectSelection = (s: ScoreStore) => s.selection;
export const selectCursor = (s: ScoreStore) => s.cursor;
export const selectCursorUnits = (s: ScoreStore) => cursorUnits(s.cursor);
export const selectInstrument = (s: ScoreStore): Instrument => getInstrument(s.score.instrumentId);
export const selectEffectiveView = (s: ScoreStore) =>
  isTransposing(getInstrument(s.score.instrumentId)) ? s.view : 'written';
export const selectCanUndo = (s: ScoreStore) => s.past.length > 0;
export const selectCanRedo = (s: ScoreStore) => s.future.length > 0;
export const selectHasNotes = (s: ScoreStore) => s.score.notes.length > 0;
