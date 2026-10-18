import type { Score, ScoreSummary } from '@/core';
import { requestToPromise, tx } from '@/infra/idb';
import type { ScoreRecord } from '../types';
import { isValidRecord, recordToScore, recordToSummary, scoreToRecord } from './score-mapper';

const DAY_MS = 86400000;
const nowIso = (): string => new Date().toISOString();

async function allRecords(): Promise<{ valid: ScoreRecord[]; invalid: number }> {
  const all = await tx('scores', 'readonly', (t) => requestToPromise(t.objectStore('scores').getAll()));
  const valid = (all as unknown[]).filter(isValidRecord);
  return { valid, invalid: all.length - valid.length };
}

const byDateDesc = (key: 'updatedAt' | 'deletedAt') => (a: ScoreRecord, b: ScoreRecord) =>
  String(b[key]).localeCompare(String(a[key]));

async function patchRecord(id: string, patch: Partial<ScoreRecord>): Promise<void> {
  await tx('scores', 'readwrite', async (t) => {
    const st = t.objectStore('scores');
    const rec = (await requestToPromise(st.get(id))) as ScoreRecord | undefined;
    if (rec) st.put({ ...rec, ...patch });
  });
}

/** Repositorio de partituras sobre IndexedDB (library-spec 5). */
export const scoreRepository = {
  async list(): Promise<{ items: ScoreSummary[]; unreadable: number }> {
    const { valid, invalid } = await allRecords();
    return {
      items: valid
        .filter((r) => r.deletedAt === null)
        .sort(byDateDesc('updatedAt'))
        .map(recordToSummary),
      unreadable: invalid,
    };
  },
  async listTrash(): Promise<ScoreSummary[]> {
    const { valid } = await allRecords();
    return valid
      .filter((r) => r.deletedAt !== null)
      .sort(byDateDesc('deletedAt'))
      .map(recordToSummary);
  },
  async records(includeTrash: boolean): Promise<ScoreRecord[]> {
    const { valid } = await allRecords();
    return includeTrash ? valid : valid.filter((r) => r.deletedAt === null);
  },
  async get(id: string): Promise<Score | null> {
    const rec = await tx('scores', 'readonly', (t) => requestToPromise(t.objectStore('scores').get(id)));
    return isValidRecord(rec) ? recordToScore(rec) : null;
  },
  /** Inserta o actualiza; editar una partitura de la papelera la restaura (library-spec 8.3). */
  async save(score: Score, now = nowIso()): Promise<{ updatedAt: string; restoredFromTrash: boolean }> {
    return tx('scores', 'readwrite', async (t) => {
      const st = t.objectStore('scores');
      const prev = (await requestToPromise(st.get(score.id))) as ScoreRecord | undefined;
      const rec = { ...scoreToRecord(score, now, prev), deletedAt: null };
      st.put(rec);
      return { updatedAt: now, restoredFromTrash: !!prev?.deletedAt };
    });
  },
  async duplicate(id: string, now = nowIso()): Promise<string> {
    const score = await this.get(id);
    if (!score) throw new Error('No existe');
    const copy = { ...score, id: crypto.randomUUID(), title: `${score.title.slice(0, 120 - 9)} (copia)` };
    await tx('scores', 'readwrite', (t) => void t.objectStore('scores').put(scoreToRecord(copy, now)));
    return copy.id;
  },
  softDelete: (id: string, now = nowIso()) => patchRecord(id, { deletedAt: now }),
  restore: (id: string) => patchRecord(id, { deletedAt: null }),
  async purge(id: string): Promise<void> {
    await tx(['scores', 'audio'], 'readwrite', async (t) => {
      t.objectStore('scores').delete(id);
      const audio = t.objectStore('audio');
      const keys = await requestToPromise(audio.index('by_score').getAllKeys(id));
      keys.forEach((k) => audio.delete(k));
    });
  },
  async purgeExpired(days = 30, now = Date.now()): Promise<number> {
    const trash = await this.listTrash();
    const expired = trash.filter((s) => s.deletedAt && now - Date.parse(s.deletedAt) > days * DAY_MS);
    for (const s of expired) await this.purge(s.id);
    return expired.length;
  },
  /** Escribe registros ya validados (restaurar copia). */
  async putMany(records: ScoreRecord[]): Promise<void> {
    await tx('scores', 'readwrite', (t) => records.forEach((r) => t.objectStore('scores').put(r)));
  },
  async getRecord(id: string): Promise<ScoreRecord | undefined> {
    return tx('scores', 'readonly', (t) => requestToPromise(t.objectStore('scores').get(id))) as Promise<
      ScoreRecord | undefined
    >;
  },
};

export type ScoreRepository = typeof scoreRepository;
