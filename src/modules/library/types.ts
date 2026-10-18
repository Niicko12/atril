import type { Score } from '@/core';

/** Registro tal como se guarda en IndexedDB (technical-decisions 8.9). */
export interface ScoreRecord extends Omit<Score, 'savedAt'> {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  schemaVersion: 1;
}

export interface BackupReport {
  added: number;
  updated: number;
  unchanged: number;
  invalid: number;
}

export type SaveState =
  { kind: 'unsaved' } | { kind: 'saving' } | { kind: 'saved'; at: string } | { kind: 'error'; message: string };
