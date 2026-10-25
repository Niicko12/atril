import { useCallback, useSyncExternalStore } from 'react';
import type { InstrumentId, Note, Timbre } from '@/core';
import { playbackEngine } from '../engine';

export interface PlayArgs {
  instrumentId?: InstrumentId;
  notes: readonly Note[];
  fromIndex: number;
  tempo: number;
  timbre: Timbre;
}

/** Estado de reproducción para la UI y alternar ▶/■. */
export function usePlayback() {
  const playing = useSyncExternalStore(
    playbackEngine.subscribe,
    () => playbackEngine.isPlaying,
    () => false,
  );
  const toggle = useCallback((args: PlayArgs) => {
    if (playbackEngine.isPlaying) playbackEngine.stopAll();
    else playbackEngine.play(args);
  }, []);
  return { playing, toggle };
}
