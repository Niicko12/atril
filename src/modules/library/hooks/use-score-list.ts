import { useEffect, useState } from 'react';
import type { ScoreSummary } from '@/core';
import { useLibraryVersion } from '../services/autosave.service';
import { scoreRepository } from '../services/score-repository';

export interface ScoreList {
  items: ScoreSummary[];
  trash: ScoreSummary[];
  unreadable: number;
  loading: boolean;
  refresh(): void;
}

/** Lista y papelera; se recarga con cada guardado (useLibraryVersion). */
export function useScoreList(): ScoreList {
  const version = useLibraryVersion((s) => s.v);
  const bump = useLibraryVersion((s) => s.bump);
  const [state, setState] = useState<Omit<ScoreList, 'refresh'>>({
    items: [],
    trash: [],
    unreadable: 0,
    loading: true,
  });
  useEffect(() => {
    let alive = true;
    void (async () => {
      await scoreRepository.purgeExpired(30);
      const [{ items, unreadable }, trash] = await Promise.all([scoreRepository.list(), scoreRepository.listTrash()]);
      if (alive) setState({ items, trash, unreadable, loading: false });
    })().catch(() => alive && setState((s) => ({ ...s, loading: false })));
    return () => {
      alive = false;
    };
  }, [version]);
  return { ...state, refresh: bump };
}
