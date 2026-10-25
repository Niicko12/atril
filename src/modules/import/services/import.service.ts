import abcjs from 'abcjs';
import { unzipSync, strFromU8 } from 'fflate';
import type { AbcTuneLike, ImportResult, InstrumentId, Score, ScoreSource } from '@/core';
import { ImportError, decodeText, parseAbcTune, parseMidi, parseMusicXML } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { prepareReplace } from '@/modules/library';
import { toast } from '@/shared/toast';
import { useImportWarnings } from '../store/warnings.store';
import { S } from '../strings';

const MB = 1024 * 1024;
export const LIMITS = { text: 5 * MB, mxl: 5 * MB, mxlUnzipped: 20 * MB, midi: 2 * MB, abcPaste: 200 * 1024 } as const;

type Format = 'midi' | 'mxl' | 'musicxml' | 'abc';

const startsWith = (bytes: Uint8Array, sig: readonly number[]): boolean => sig.every((b, i) => bytes[i] === b);
const BY_EXT: Readonly<Record<string, Format>> = {
  mid: 'midi',
  midi: 'midi',
  mxl: 'mxl',
  musicxml: 'musicxml',
  xml: 'musicxml',
};

function byContent(bytes: Uint8Array): Format | null {
  if (startsWith(bytes, [0x4d, 0x54, 0x68, 0x64])) return 'midi';
  if (startsWith(bytes, [0x50, 0x4b])) return 'mxl';
  if (decodeText(bytes.subarray(0, 512)).trimStart().startsWith('<')) return 'musicxml';
  return /^(X|K):/m.test(decodeText(bytes.subarray(0, 4096))) ? 'abc' : null;
}

/** Por extensión y, si no, por contenido (formats-spec 11.1-11.2). .abc/.txt con XML adentro → MusicXML. */
export function detectFormat(name: string, bytes: Uint8Array): Format | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const known = BY_EXT[ext];
  if (known) return known;
  const content = byContent(bytes);
  if (content) return content;
  return ext === 'abc' || ext === 'txt' ? 'abc' : null;
}

/** .mxl: container.xml → rootfile; si no, el primer .xml fuera de META-INF (formats-spec 11.4). */
export function unzipMxl(bytes: Uint8Array): string {
  let total = 0;
  const files = unzipSync(bytes, {
    filter: (f) => {
      total += f.originalSize;
      if (total > LIMITS.mxlUnzipped) throw new ImportError('file_too_large', S.zipTooBig);
      return true;
    },
  });
  const container = files['META-INF/container.xml'];
  const root = container ? /full-path="([^"]+)"/.exec(strFromU8(container))?.[1] : undefined;
  const path =
    root && files[root]
      ? root
      : Object.keys(files).find((p) => /\.(musicxml|xml)$/i.test(p) && !p.startsWith('META-INF'));
  if (!path || !files[path]) throw new ImportError('parse_failed', S.mxlEmpty);
  return decodeText(files[path]);
}

export function parseAbcText(text: string): { result: ImportResult; tunes: number } {
  const tunes = abcjs.parseOnly(/^X:/m.test(text) ? text : `X:1\n${text}`);
  if (!tunes.length) throw new ImportError('parse_failed', S.noTune);
  const result = parseAbcTune(tunes[0] as unknown as AbcTuneLike);
  if (tunes.length > 1) result.warnings.push({ code: 'parts_more', detail: S.moreTunes(tunes.length) });
  return { result, tunes: tunes.length };
}

const LIMIT_OF: Record<Format, number> = {
  midi: LIMITS.midi,
  mxl: LIMITS.mxl,
  musicxml: LIMITS.text,
  abc: LIMITS.text,
};
const SOURCE_OF: Record<Format, ScoreSource> = { midi: 'midi', mxl: 'musicxml', musicxml: 'musicxml', abc: 'abc' };

export function parseFile(name: string, bytes: Uint8Array): { result: ImportResult; source: ScoreSource } {
  const format = detectFormat(name, bytes);
  if (!format) throw new ImportError('unsupported_format', S.unsupported);
  if (bytes.length > LIMIT_OF[format]) throw new ImportError('file_too_large', S.tooBig(LIMIT_OF[format] / MB));
  const dom = new DOMParser();
  const parse: Record<Format, () => ImportResult> = {
    midi: () => parseMidi(bytes.slice().buffer),
    mxl: () => parseMusicXML(unzipMxl(bytes), dom),
    musicxml: () => parseMusicXML(decodeText(bytes), dom),
    abc: () => parseAbcText(decodeText(bytes)).result,
  };
  return { result: parse[format](), source: SOURCE_OF[format] };
}

/** Resultado → partitura y al editor (formats-spec 15). Devuelve false si no se pudo guardar la anterior. */
export async function openImported(
  result: ImportResult,
  source: ScoreSource,
  fallbackTitle: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!(await prepareReplace())) return false;
  if (signal?.aborted) return false;
  const current = useScoreStore.getState().score;
  const score: Score = {
    id: crypto.randomUUID(),
    title: (result.title || fallbackTitle || 'Sin título').slice(0, 120),
    composer: result.composer.slice(0, 120),
    instrumentId: (result.instrumentId ?? current.instrumentId) as InstrumentId,
    key: result.key,
    meter: result.meter,
    tempo: result.tempo,
    showNames: false,
    showTab: false,
    notes: result.notes,
    source,
    savedAt: null,
  };
  useScoreStore.getState().replaceScore(score);
  useImportWarnings.getState().set(result.warnings);
  toast(S.opened(score.notes.length));
  scrollTo({ top: 0 });
  return true;
}

export const errorMessage = (e: unknown): string => (e instanceof ImportError ? e.message : S.failed);
