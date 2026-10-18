// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { strFromU8, unzipSync, zipSync, strToU8 } from 'fflate';
import { emptyScore, fromSample, SAMPLES, type Sample, type Score } from '@/core';
import { resetDbForTests } from '@/infra/idb';
import { useScoreStore } from '@/modules/editor';
import { useSaveStore } from '../store/save.store';
import { BackupError, backupFileName, exportBackup, importBackup } from './backup.service';
import { AUTOSAVE_DELAY_MS, bootLibrary, flushSave, prepareReplace, startAutosave } from './autosave.service';
import { shouldRemindBackup, shouldShowInstallHint } from './persistence';
import { prefs } from './prefs.service';
import { scoreRepository as repo } from './score-repository';

const score = (title = 'T', notes = [{ p: 60, d: 4 }]): Score => ({ ...emptyScore('piano'), title, notes });
const blobBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  prefs.resetForTests();
  useSaveStore.setState({ state: { kind: 'unsaved' }, memoryOnly: false });
});

describe('repositorio (T-REP-*)', () => {
  it('save + get; createdAt fijo y updatedAt cambia (T-REP-01/02)', async () => {
    const s = score();
    await repo.save(s, '2026-01-01T00:00:00.000Z');
    await repo.save({ ...s, title: 'Otra' }, '2026-02-01T00:00:00.000Z');
    const rec = await repo.getRecord(s.id);
    expect([rec?.createdAt, rec?.updatedAt, rec?.title]).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      'Otra',
    ]);
    expect((await repo.get(s.id))?.savedAt).toBe('2026-02-01T00:00:00.000Z');
  });
  it('lista por fecha descendente, sin papelera; papelera y restaurar (T-REP-03/04)', async () => {
    const a = score('A');
    const b = score('B');
    await repo.save(a, '2026-01-01T00:00:00.000Z');
    await repo.save(b, '2026-01-02T00:00:00.000Z');
    expect((await repo.list()).items.map((x) => x.title)).toEqual(['B', 'A']);
    await repo.softDelete(a.id);
    expect((await repo.list()).items.map((x) => x.title)).toEqual(['B']);
    expect((await repo.listTrash()).map((x) => x.title)).toEqual(['A']);
    await repo.restore(a.id);
    expect((await repo.list()).items).toHaveLength(2);
  });
  it('editar una partitura de la papelera la restaura', async () => {
    const a = score('A');
    await repo.save(a);
    await repo.softDelete(a.id);
    expect((await repo.save(a)).restoredFromTrash).toBe(true);
    expect(await repo.listTrash()).toHaveLength(0);
  });
  it('duplicar, purgar y purgar vencidas (T-REP-05..07)', async () => {
    const a = score('x'.repeat(120));
    await repo.save(a);
    const id = await repo.duplicate(a.id);
    expect((await repo.get(id))?.title).toMatch(/\(copia\)$/);
    expect((await repo.get(id))?.title.length).toBeLessThanOrEqual(120);
    await repo.softDelete(a.id, '2026-01-01T00:00:00.000Z');
    expect(await repo.purgeExpired(30, Date.parse('2026-03-01T00:00:00.000Z'))).toBe(1);
    expect(await repo.get(a.id)).toBeNull();
  });
  it('un registro dañado se omite y se cuenta (T-REP-08)', async () => {
    await repo.save(score('ok'));
    await repo.putMany([{ ...(await repo.records(true))[0]!, id: 'malo', tempo: 999 }]);
    const { items, unreadable } = await repo.list();
    expect([items.length, unreadable]).toEqual([1, 1]);
    expect(await repo.get('malo')).toBeNull();
  });
});

describe('respaldo (T-BAK-*)', () => {
  it('ida y vuelta en una base limpia (T-BAK-01)', async () => {
    await repo.save(score('A'));
    await repo.save(score('B'));
    const { blob, count } = await exportBackup(false);
    expect(count).toBe(2);
    const files = unzipSync(await blobBytes(blob));
    expect(Object.keys(files).sort()).toEqual(['LEEME.txt', 'atril-backup.json']);
    expect(strFromU8(files['LEEME.txt']!)).toContain('\r\n');
    globalThis.indexedDB = new IDBFactory();
    resetDbForTests();
    expect(await importBackup(await blobBytes(blob))).toEqual({ added: 2, updated: 0, unchanged: 0, invalid: 0 });
    expect((await repo.list()).items.map((x) => x.title).sort()).toEqual(['A', 'B']);
  });
  it('fusión: nueva / más reciente / más vieja / igual (T-BAK-02); restaurar dos veces (B12)', async () => {
    const old = score('vieja');
    await repo.save(old, '2026-05-01T00:00:00.000Z');
    const recs = [
      { ...(await repo.getRecord(old.id))!, title: 'más nueva', updatedAt: '2026-06-01T00:00:00.000Z' },
      { ...(await repo.getRecord(old.id))!, id: crypto.randomUUID(), title: 'otra' },
    ];
    const json = JSON.stringify({ format: 'atril-backup', version: 1, scores: recs });
    const bytes = strToU8(json);
    expect(await importBackup(bytes)).toEqual({ added: 1, updated: 1, unchanged: 0, invalid: 0 });
    expect(await importBackup(bytes)).toEqual({ added: 0, updated: 0, unchanged: 2, invalid: 0 });
  });
  it('partitura inválida se omite (T-BAK-03); formato ajeno, versión futura, ZIP sin copia (T-BAK-04, B15/B16)', async () => {
    const bad = JSON.stringify({
      format: 'atril-backup',
      version: 1,
      scores: [{ id: 'x', notes: [{ p: 999, d: 4 }] }],
    });
    expect((await importBackup(strToU8(bad))).invalid).toBe(1);
    await expect(importBackup(strToU8('{"format":"otro","scores":[]}'))).rejects.toMatchObject({ kind: 'invalid' });
    await expect(importBackup(strToU8('{"format":"atril-backup","version":2,"scores":[]}'))).rejects.toMatchObject({
      kind: 'future',
    });
    await expect(importBackup(zipSync({ 'otra.txt': strToU8('x') }))).rejects.toBeInstanceOf(BackupError);
    await expect(importBackup(strToU8('no es json'))).rejects.toMatchObject({ kind: 'invalid' });
  });
  it('ZIP bomb: rechazado por tamaño sin descomprimir (T-BAK-06)', async () => {
    const big = zipSync({ 'atril-backup.json': new Uint8Array(21 * 1024 * 1024) }, { level: 9 });
    await expect(importBackup(big)).rejects.toMatchObject({ kind: 'too_large' });
  });
  it('nombre del archivo con la fecha local (T-BAK-08)', () => {
    expect(backupFileName(new Date(2026, 9, 8))).toBe('atril-respaldo-2026-10-08.zip');
  });
});

describe('guardado automático (T-AUT-*)', () => {
  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    useScoreStore.getState().replaceScore(fromSample(SAMPLES[0] as Sample, 'piano'));
    stop = startAutosave();
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
  });
  it('varios cambios seguidos → un guardado a los 800 ms; ejemplo sin cambios no se guarda (T-AUT-01/02)', async () => {
    await flushSave();
    expect((await repo.list()).items).toHaveLength(0);
    const s = useScoreStore.getState();
    s.addNote(60);
    s.addNote(62);
    s.addNote(64);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    await flushSave();
    const { items } = await repo.list();
    expect([items.length, items[0]?.noteCount]).toEqual([1, 65]);
    expect(useSaveStore.getState().state.kind).toBe('saved');
    expect(await prefs.get('lastOpenId')).toBe(useScoreStore.getState().score.id);
  });
  it('prepareReplace guarda lo pendiente y bootLibrary abre la última partitura (B4)', async () => {
    useScoreStore.getState().addNote(70);
    expect(await prepareReplace()).toBe(true);
    const id = useScoreStore.getState().score.id;
    useScoreStore.getState().replaceScore(emptyScore('piano'));
    await bootLibrary();
    expect(useScoreStore.getState().score.id).toBe(id);
  });
});

describe('durabilidad (T-DUR-02/03)', () => {
  const now = Date.parse('2026-10-18T00:00:00Z');
  it('sugerencia de pantalla de inicio solo en iOS no instalada, con partituras', () => {
    const base = { platform: { ios: true, standalone: false }, hasScores: true, shownAt: null, dismissed: false };
    expect(shouldShowInstallHint(base, now)).toBe(true);
    expect(shouldShowInstallHint({ ...base, platform: { ios: true, standalone: true } }, now)).toBe(false);
    expect(shouldShowInstallHint({ ...base, platform: { ios: false, standalone: false } }, now)).toBe(false);
    expect(shouldShowInstallHint({ ...base, shownAt: '2026-10-10T00:00:00Z' }, now)).toBe(false);
    expect(shouldShowInstallHint({ ...base, dismissed: true }, now)).toBe(false);
  });
  it('recordatorio de copia: nunca hecha, o > 14 días con cambios', () => {
    expect(shouldRemindBackup(null, '2026-10-01T00:00:00Z', now)).toBe(true);
    expect(shouldRemindBackup('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', now)).toBe(true);
    expect(shouldRemindBackup('2026-09-01T00:00:00Z', '2026-08-01T00:00:00Z', now)).toBe(false);
    expect(shouldRemindBackup('2026-10-10T00:00:00Z', '2026-10-15T00:00:00Z', now)).toBe(false);
    expect(shouldRemindBackup(null, null, now)).toBe(false);
  });
});
