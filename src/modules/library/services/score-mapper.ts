import type { Score, ScoreSummary } from '@/core';
import { validateScore } from '@/core';
import type { ScoreRecord } from '../types';

/** Partitura → registro (library-spec 3.1). */
export function scoreToRecord(s: Score, now: string, prev?: ScoreRecord): ScoreRecord {
  const { savedAt: _saved, ...rest } = s;
  void _saved;
  return {
    ...rest,
    title: s.title || 'Sin título',
    notes: s.notes.map((n) => ({ ...n })),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    deletedAt: prev?.deletedAt ?? null,
    schemaVersion: 1,
  };
}

/** Registro → partitura; lanza si no es válida. */
export function recordToScore(r: ScoreRecord): Score {
  const { createdAt: _c, updatedAt, deletedAt: _d, schemaVersion: _v, ...rest } = r;
  void [_c, _d, _v];
  const score: Score = { ...rest, savedAt: updatedAt };
  validateScore(score);
  return score;
}

export function recordToSummary(r: ScoreRecord): ScoreSummary {
  return {
    id: r.id,
    title: r.title,
    composer: r.composer,
    instrumentId: r.instrumentId,
    noteCount: r.notes.length,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function isValidRecord(r: unknown): r is ScoreRecord {
  try {
    recordToScore(r as ScoreRecord);
    return typeof (r as ScoreRecord).updatedAt === 'string';
  } catch {
    return false;
  }
}
