import type { Cursor, Note, ScoreMeta } from '@/core';

export type { Cursor } from '@/core';
export type EditorMode = 'piano' | 'fret' | 'names';
export type BaseDuration = Cursor['base'];

export interface Snapshot {
  notes: Note[];
  meta: ScoreMeta;
}

export interface ShiftReport {
  /** Notas que quedaron en el límite del rango por el recorte. */
  clipped: number;
}

/** Alteración pendiente para la próxima nota en Do-Re-Mi (null = la de la armadura). */
export type PendingAccidental = -1 | 0 | 1 | null;
