import { create } from 'zustand';
import type { Midi, Note, Sample, Score, ScoreMeta, View } from '@/core';
import { SAMPLES, fromSample } from '@/core';
import { playbackEngine } from '@/modules/playback';
import { toast } from '@/shared/toast';
import { S } from '../strings';
import type { BaseDuration, PendingAccidental, ShiftReport } from '../types';
import { redoPatch, undoPatch } from './history';
import * as R from './reducers';
import { initialState, type ScoreState } from './state';

export interface ScoreActions {
  addNote(midi: Midi | null): void;
  deleteNote(): void;
  setDuration(base: BaseDuration): void;
  toggleDot(): void;
  select(index: number): void;
  moveSelection(dir: -1 | 1): void;
  clearSelection(): void;
  octaveLast(dir: 1 | -1): void;
  shiftAll(semitones: number): ShiftReport;
  setMeta(patch: Partial<ScoreMeta>): void;
  setView(view: View): void;
  setPendingAccidental(acc: PendingAccidental): void;
  setKeyboardOctave(dir: 1 | -1): number;
  undo(): void;
  redo(): void;
  replaceScore(next: Score, opts?: { keepHistory?: boolean }): void;
  replaceNotesKeepingMeta(notes: Note[]): void;
  markSaved(savedAt: string): void;
}

export type ScoreStore = ScoreState & ScoreActions;

const firstScore = (): Score => fromSample(SAMPLES[0] as Sample, 'piano');

export const useScoreStore = create<ScoreStore>()((set, get) => {
  /** Aplica el resultado de una acción pura y ejecuta sus efectos. */
  const apply = (o: R.Outcome): R.Outcome => {
    if (o.stop) playbackEngine.stopAll();
    if (o.patch) set(o.patch);
    if (o.toast) toast(o.toast);
    return o;
  };
  const history = (patch: Partial<ScoreState> | null, empty: string) => {
    playbackEngine.stopAll();
    if (patch) set(patch);
    else toast(empty);
  };
  return {
    ...initialState(firstScore()),
    addNote: (midi) => void apply(R.addNote(get(), midi, Date.now())),
    deleteNote: () => void apply(R.deleteNote(get(), Date.now())),
    setDuration: (base) => void apply(R.setDuration(get(), base, Date.now())),
    toggleDot: () => void apply(R.toggleDot(get(), Date.now())),
    select: (index) => void apply(R.select(get(), index)),
    moveSelection: (dir) => void apply(R.moveSelection(get(), dir)),
    clearSelection: () => set({ selection: -1 }),
    octaveLast: (dir) => void apply(R.octaveLast(get(), dir, Date.now())),
    shiftAll: (semitones) => apply(R.shiftAll(get(), semitones, Date.now())).report ?? { clipped: 0 },
    setMeta: (patch) => void apply(R.setMeta(get(), patch, Date.now())),
    setView: (view) => void apply(R.setView(get(), view)),
    setPendingAccidental: (acc) => set((s) => ({ pendingAccidental: s.pendingAccidental === acc ? null : acc })),
    setKeyboardOctave: (dir) => {
      const keyboardOctave = Math.min(6, Math.max(2, get().keyboardOctave + dir));
      set({ keyboardOctave });
      return keyboardOctave;
    },
    undo: () => history(undoPatch(get()), S.nothingToUndo),
    redo: () => history(redoPatch(get()), S.nothingToRedo),
    replaceScore: (next, opts) => void apply(R.replaceScore(get(), next, opts?.keepHistory)),
    replaceNotesKeepingMeta: (notes) => void apply(R.replaceNotesKeepingMeta(get(), notes, Date.now())),
    markSaved: (savedAt) => set((s) => ({ score: { ...s.score, savedAt }, dirty: false })),
  };
});
