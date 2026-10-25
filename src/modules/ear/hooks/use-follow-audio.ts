import { useEffect } from 'react';
import { timelineIndex } from '@/core/analysis';
import { useScoreStore } from '@/modules/editor';
import { usePlaybackPositionStore } from '@/modules/playback';
import { useEarSession } from '../store/ear-session.store';
import type { AudioPlayer } from '../services/audio-player';

/** Sigue el tiempo original (ya corregido por velocidad/A-B), sin renderizar el editor por frame. */
export function useFollowAudio(player: AudioPlayer | null): boolean {
  const session = useEarSession((s) => s.session);
  const revision = useScoreStore((s) => s.revision);
  const scoreId = useScoreStore((s) => s.score.id);
  useEffect(() => {
    if (!player || !session) return;
    let ownsHighlight = false;
    const clear = () => {
      if (ownsHighlight) usePlaybackPositionStore.getState().set(-1);
      ownsHighlight = false;
    };
    const update = () => {
      const current = useScoreStore.getState();
      if (
        !player.state.playing ||
        session.revisionAtImport !== current.revision ||
        session.scoreId !== current.score.id
      )
        return clear();
      ownsHighlight = true;
      usePlaybackPositionStore.getState().set(timelineIndex(session.timeline, player.state.pos));
    };
    const off = player.subscribe(update);
    update();
    return () => {
      off();
      clear();
    };
  }, [player, session, revision, scoreId]);
  useEffect(() => {
    if (session?.scoreId && session.scoreId !== scoreId) useEarSession.getState().set(null);
  }, [scoreId, session]);
  return !!session && session.scoreId === scoreId && session.revisionAtImport !== revision;
}
