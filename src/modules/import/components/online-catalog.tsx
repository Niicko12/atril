import { useCallback, useEffect, useRef, useState } from 'react';
import { buttonStyles as b } from '@/shared/components/overlay';
import {
  downloadOnline,
  loadOnlineIndex,
  searchOnline,
  type OnlineScore,
  type SearchMode,
} from '../services/online-catalog.service';
import { openImported, parseFile } from '../services/import.service';
import { S } from '../strings';
import styles from './import.module.css';

type Props = {
  searchMode?: SearchMode;
  query: string;
  blocked: boolean;
  onBusy(value: string): void;
  onLoaded(): void;
};

function onlineError(reason: unknown): string {
  const known: readonly string[] = [S.onlineRateLimit, S.onlineTooBig, S.onlineFailed];
  return reason instanceof Error && known.includes(reason.message) ? reason.message : S.onlineFailed;
}

async function importOnline(score: OnlineScore, signal: AbortSignal): Promise<boolean> {
  const bytes = await downloadOnline(score, signal);
  signal.throwIfAborted();
  const { result, source } = parseFile(score.path, bytes);
  if (/\.(mxl|xml|musicxml)$/i.test(result.title)) result.title = score.title;
  return openImported(result, source, score.title, signal);
}

/** El índice se consulta solo por elección del usuario; la búsqueda posterior es local. */
export function OnlineCatalog({ query, searchMode = 'all', blocked, onBusy, onLoaded }: Props) {
  const [scores, setScores] = useState<OnlineScore[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const task = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      const pending = task.current;
      task.current = null;
      pending?.abort();
    },
    [],
  );
  const results = scores ? searchOnline(scores, query, searchMode) : [];
  const visible = results.slice(0, 50);

  const run = useCallback(
    async (score?: OnlineScore) => {
      if (task.current || blocked) return;
      const controller = new AbortController();
      task.current = controller;
      const timeout = setTimeout(() => controller.abort(new Error(S.onlineFailed)), 30000);
      setBusy(score?.path ?? 'index');
      onBusy('online');
      setError('');
      try {
        if (!score) {
          const index = await loadOnlineIndex(controller.signal);
          controller.signal.throwIfAborted();
          setScores(index);
        } else {
          if (await importOnline(score, controller.signal)) onLoaded();
        }
      } catch (reason) {
        if (task.current === controller) {
          setError(onlineError(reason));
        }
      } finally {
        clearTimeout(timeout);
        if (task.current === controller) {
          task.current = null;
          setBusy('');
          onBusy('');
        }
      }
    },
    [blocked, onBusy, onLoaded],
  );
  useEffect(() => {
    if (scores || query.trim().length < 2) return;
    const timer = setTimeout(() => void run(), 350);
    return () => clearTimeout(timer);
  }, [query, scores, run]);

  const cancel = () => {
    task.current?.abort();
    task.current = null;
    setBusy('');
    onBusy('');
  };

  return (
    <div className={styles.block}>
      <p className={styles.muted}>{S.onlineHelp}</p>
      {!scores && (
        <button type="button" className={b.btn} disabled={Boolean(busy) || blocked} onClick={() => void run()}>
          {S.onlineSearch}
        </button>
      )}
      {busy && (
        <>
          <p role="status" className={styles.muted}>
            {busy === 'index' ? S.onlineLoading : S.loadingSong}
          </p>
          <button type="button" className={b.btn} onClick={cancel}>
            {S.onlineCancel}
          </button>
        </>
      )}
      {error && (
        <>
          <p role="alert" className={styles.err}>
            {error}
          </p>
        </>
      )}
      {scores && (
        <>
          <span className={styles.label} aria-live="polite">
            {S.onlineCount(results.length, visible.length)}
          </span>
          {!results.length && (
            <p role="status" className={styles.muted}>
              {S.onlineNone}
            </p>
          )}
          <ul className={styles.catalog}>
            {visible.map((score) => (
              <li key={score.path} className={styles.catalogRow}>
                <div className={styles.info}>
                  <b>{score.title}</b>
                  <span>{score.composer} · music21</span>
                </div>
                <button
                  type="button"
                  className={b.btn}
                  disabled={Boolean(busy) || blocked}
                  onClick={() => void run(score)}
                >
                  {S.onlineOpen}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={styles.muted}>
        {S.onlinePrivacy}{' '}
        <a
          href="https://github.com/cuthbertLab/music21/blob/master/music21/corpus/license.txt"
          target="_blank"
          rel="noopener noreferrer"
        >
          {S.onlineLicense}
        </a>
      </p>
    </div>
  );
}
