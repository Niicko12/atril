import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { BackupReport, ScoreRecord } from '../types';
import { isValidRecord } from './score-mapper';
import { scoreRepository } from './score-repository';

export const BACKUP_FORMAT = 'atril-backup';
export const BACKUP_VERSION = 1;
const MAX_FILE = 300 * 1024 * 1024;
const MAX_JSON = 20 * 1024 * 1024;

export class BackupError extends Error {
  constructor(public readonly kind: 'invalid' | 'future' | 'too_large') {
    super(kind);
  }
}

const LEEME = [
  'Copia de respaldo de Atril.',
  '',
  'Para recuperar tus partituras en otro teléfono o computadora:',
  '1. Abre Atril.',
  '2. Toca «Mis partituras» → «Restaurar copia».',
  '3. Elige este archivo .zip.',
  '',
  'No hace falta descomprimirlo.',
].join('\r\n');

export const backupFileName = (d = new Date()): string =>
  `atril-respaldo-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.zip`;

/** ZIP con atril-backup.json + LEEME.txt (technical-decisions 7.7). */
export async function exportBackup(includeTrash: boolean, now = new Date()): Promise<{ blob: Blob; count: number }> {
  const scores = await scoreRepository.records(includeTrash);
  const json = JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    app: 'Atril',
    scores,
  });
  const zip = zipSync({ 'atril-backup.json': strToU8(json), 'LEEME.txt': strToU8(LEEME) }, { level: 6 });
  return { blob: new Blob([zip], { type: 'application/zip' }), count: scores.length };
}

function readJson(bytes: Uint8Array): string {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) return strFromU8(bytes);
  let total = 0;
  const files = unzipSync(bytes, {
    filter: (f) => {
      total += f.originalSize;
      if (f.originalSize > MAX_JSON || total > MAX_JSON) throw new BackupError('too_large');
      return f.name === 'atril-backup.json';
    },
  });
  const json = files['atril-backup.json'];
  if (!json) throw new BackupError('invalid');
  return strFromU8(json);
}

function parseBackup(text: string): unknown[] {
  let data: { format?: unknown; version?: unknown; scores?: unknown };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new BackupError('invalid');
  }
  if (data.format !== BACKUP_FORMAT || !Array.isArray(data.scores)) throw new BackupError('invalid');
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) throw new BackupError('future');
  return data.scores;
}

/** Fusión por id: gana el updatedAt más reciente; nunca se borra nada local (library-spec 12.2). */
export async function importBackup(bytes: Uint8Array): Promise<BackupReport> {
  if (bytes.length > MAX_FILE) throw new BackupError('too_large');
  const incoming = parseBackup(readJson(bytes));
  const report: BackupReport = { added: 0, updated: 0, unchanged: 0, invalid: 0 };
  const toWrite: ScoreRecord[] = [];
  for (const rec of incoming) {
    if (!isValidRecord(rec)) {
      report.invalid++;
      continue;
    }
    const local = await scoreRepository.getRecord(rec.id);
    if (!local) report.added++;
    else if (rec.updatedAt > local.updatedAt) report.updated++;
    else {
      report.unchanged++;
      continue;
    }
    toWrite.push(rec);
  }
  await scoreRepository.putMany(toWrite);
  return report;
}
