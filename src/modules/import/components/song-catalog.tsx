import { useEffect, useMemo, useState } from 'react';
import { fromSample, SAMPLES, type ScoreSummary } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { prepareReplace, scoreRepository } from '@/modules/library';
import { buttonStyles as b } from '@/shared/components/overlay';
import { toast } from '@/shared/toast';
import { libraryStrings } from '@/modules/library';
import { S } from '../strings';
import { OnlineCatalog } from './online-catalog';
import type { SearchMode } from '../services/online-catalog.service';
import styles from './import.module.css';

const SONGS = SAMPLES.filter((song) => song.verified && !song.tags?.includes('ejercicio'));
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Catálogo guardado en Atril: buscar y abrir una canción directamente en el editor. */
export function SongCatalog({ onLoaded }: { onLoaded(): void }) {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const [loading, setLoading] = useState('');
  const [savedScores, setSavedScores] = useState<ScoreSummary[]>([]);
  useEffect(() => {
    let alive = true;
    void scoreRepository
      .list()
      .then(({ items }) => {
        if (alive) setSavedScores(items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const results = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return SONGS;
    return SONGS.filter((song) =>
      normalize(
        searchMode === 'artist'
          ? song.composer
          : [song.title, song.composer, ...(song.aliases ?? []), ...(song.tags ?? [])].join(' '),
      ).includes(term),
    );
  }, [query, searchMode]);
  const savedResults = useMemo(() => {
    const term = normalize(query.trim());
    return savedScores.filter((score) =>
      normalize(searchMode === 'artist' ? score.composer : `${score.title} ${score.composer}`).includes(term),
    );
  }, [query, savedScores, searchMode]);

  const open = async (title: string) => {
    const song = SONGS.find((item) => item.title === title);
    if (!song || loading) return;
    setLoading(title);
    try {
      if (!(await prepareReplace())) return;
      const score = fromSample(song, useScoreStore.getState().score.instrumentId);
      useScoreStore.getState().replaceScore(score);
      toast(S.songLoaded(song.title, score.notes.length));
      onLoaded();
      scrollTo({ top: 0 });
    } catch {
      toast(libraryStrings.libraryActionFailed);
    } finally {
      setLoading('');
    }
  };

  const openSaved = async (scoreId: string) => {
    if (loading) return;
    setLoading(scoreId);
    try {
      if (!(await prepareReplace())) return;
      const score = await scoreRepository.get(scoreId);
      if (!score) throw new Error('No existe');
      useScoreStore.getState().replaceScore(score);
      toast(S.songLoaded(score.title, score.notes.length));
      onLoaded();
      scrollTo({ top: 0 });
    } catch {
      toast(libraryStrings.libraryActionFailed);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className={styles.block}>
      <h3>{S.catalogTitle}</h3>
      <p className={styles.muted}>{S.catalogHelp}</p>
      <label className={styles.label}>
        {S.searchBy}
        <select
          className={styles.input}
          value={searchMode}
          onChange={(event) => setSearchMode(event.target.value as SearchMode)}
        >
          <option value="all">{S.searchAll}</option>
          <option value="artist">{S.searchArtist}</option>
        </select>
      </label>
      <input
        className={styles.input}
        type="search"
        placeholder={searchMode === 'artist' ? S.artistName : S.songName}
        aria-label={searchMode === 'artist' ? S.artistName : S.songName}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <OnlineCatalog
        query={query}
        searchMode={searchMode}
        blocked={Boolean(loading) && loading !== 'online'}
        onBusy={setLoading}
        onLoaded={onLoaded}
      />
      <span className={styles.label} aria-live="polite">
        {S.catalogCount(results.length + savedResults.length)}
      </span>
      {results.length > 0 && (
        <ul className={styles.catalog}>
          {results.map((song) => (
            <li key={song.title} className={styles.catalogRow}>
              <div className={styles.info}>
                <b>{song.title}</b>
                <span>
                  {song.composer} · {song.notes.length} notas
                </span>
              </div>
              <button type="button" className={b.btn} onClick={() => void open(song.title)} disabled={Boolean(loading)}>
                {loading === song.title ? S.loadingSong : S.editSong}
              </button>
            </li>
          ))}
        </ul>
      )}
      {savedResults.length > 0 && (
        <>
          <span className={styles.label}>{S.personalSongs}</span>
          <ul className={styles.catalog}>
            {savedResults.map((score) => (
              <li key={score.id} className={styles.catalogRow}>
                <div className={styles.info}>
                  <b>{score.title}</b>
                  <span>
                    {score.composer || S.personalScore} · {score.noteCount} notas
                  </span>
                </div>
                <button
                  type="button"
                  className={b.btn}
                  onClick={() => void openSaved(score.id)}
                  disabled={Boolean(loading)}
                >
                  {loading === score.id ? S.loadingSong : S.editSong}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {!results.length && !savedResults.length && (
        <p className={styles.muted} role="status">
          {S.noSongs}
        </p>
      )}
    </div>
  );
}
