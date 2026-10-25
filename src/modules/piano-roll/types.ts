import type { Note } from '@/core';
export interface TimedNote {
  index: number;
  start: number;
  end: number;
  note: Note;
}
export interface DraftChange {
  notes: Note[];
  selection: number;
}
export interface Gesture {
  index: number;
  x: number;
  y: number;
  pointerId: number;
  resize: boolean;
  notes: readonly Note[];
  scrollX: number;
  scrollY: number;
}
