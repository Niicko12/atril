import { S } from '../strings';

const ROOT = 'music21/corpus/';
const API = 'https://api.github.com/repos/cuthbertLab/music21/git/trees/master?recursive=1';
const RAW = 'https://raw.githubusercontent.com/cuthbertLab/music21/master/';
const COMPOSERS: Readonly<Record<string, string>> = {
  bach: 'Johann Sebastian Bach',
  beethoven: 'Ludwig van Beethoven',
  mozart: 'Wolfgang Amadeus Mozart',
  chopin: 'Frédéric Chopin',
  schubert: 'Franz Schubert',
  schumann: 'Robert Schumann',
  haydn: 'Joseph Haydn',
  handel: 'Georg Friedrich Händel',
  corelli: 'Arcangelo Corelli',
  vivaldi: 'Antonio Vivaldi',
  monteverdi: 'Claudio Monteverdi',
  palestrina: 'Giovanni Pierluigi da Palestrina',
};
export type SearchMode = 'all' | 'artist';

export interface OnlineScore {
  path: string;
  title: string;
  composer: string;
}
let cached: OnlineScore[] | undefined;
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function responseReader(response: Response) {
  if (!response.ok)
    throw new Error(response.status === 403 || response.status === 429 ? S.onlineRateLimit : S.onlineFailed);
  if (!response.body) throw new Error(S.onlineFailed);
  return response.body.getReader();
}

function isFileEntry(value: unknown): value is { path: string; type: string } {
  return Boolean(value && typeof value === 'object' && 'path' in value && 'type' in value);
}

/** Lee de forma acotada incluso si el servidor no declara Content-Length. */
export async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const reader = responseReader(response);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (Number(response.headers.get('content-length')) > limit) throw new Error(S.onlineTooBig);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error(S.onlineTooBig);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function entry(value: unknown): OnlineScore | null {
  if (!isFileEntry(value)) return null;
  if (value.type !== 'blob' || typeof value.path !== 'string' || !value.path.startsWith(ROOT)) return null;
  const parts = value.path.slice(ROOT.length).split('/');
  const composer = COMPOSERS[parts[0] ?? ''];
  if (!composer || !/\.(mxl|musicxml|xml)$/i.test(value.path) || parts.includes('..')) return null;
  const title = parts
    .slice(1)
    .join(' · ')
    .replace(/\.(mxl|musicxml|xml)$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/bwv/gi, 'BWV ')
    .replace(/opus/gi, 'Opus ');
  return { path: value.path, title, composer };
}

export function parseOnlineIndex(data: unknown): OnlineScore[] {
  if (!data || typeof data !== 'object' || !('tree' in data) || !Array.isArray(data.tree))
    throw new Error(S.onlineFailed);
  if ('truncated' in data && data.truncated) throw new Error(S.onlineFailed);
  return data.tree
    .map(entry)
    .filter((item): item is OnlineScore => item !== null)
    .sort((a, b) => `${a.composer} ${a.title}`.localeCompare(`${b.composer} ${b.title}`, 'es', { numeric: true }));
}

export async function loadOnlineIndex(signal: AbortSignal): Promise<OnlineScore[]> {
  if (cached) return cached;
  const response = await fetch(API, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  const bytes = await readLimited(response, 10 * 1024 * 1024);
  signal.throwIfAborted();
  const scores = parseOnlineIndex(JSON.parse(new TextDecoder().decode(bytes)));
  if (!scores.length) throw new Error(S.onlineFailed);
  cached = scores;
  return scores;
}

export function searchOnline(scores: OnlineScore[], query: string, mode: SearchMode = 'all'): OnlineScore[] {
  const words = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return scores.filter((score) =>
    words.every((word) =>
      normalizeSearch(mode === 'artist' ? score.composer : `${score.title} ${score.composer}`).includes(word),
    ),
  );
}

export async function downloadOnline(score: OnlineScore, signal: AbortSignal): Promise<Uint8Array> {
  const valid = entry({ path: score.path, type: 'blob' });
  if (!valid) throw new Error(S.onlineFailed);
  const url = RAW + valid.path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  const bytes = await readLimited(response, 5 * 1024 * 1024);
  signal.throwIfAborted();
  return bytes;
}
