import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AudioPlayer, type PlayerState } from '../services/audio-player';
import { useEarSession } from '../store/ear-session.store';
import type { DecodedAudio } from '../types';

const IDLE: PlayerState = { pos: 0, playing: false, a: null, b: null, speed: 1, preparing: false };

/** Reproductor ligado al audio cargado; se libera al cambiar de audio o cerrar. */
export function useAudioPlayer(audio: DecodedAudio | null): { player: AudioPlayer | null; state: PlayerState } {
  const player = useMemo(() => (audio ? new AudioPlayer(audio) : null), [audio]);
  useEffect(() => {
    player?.attach();
    return () => {
      if (player) {
        player.dispose();
        useEarSession.getState().set(null);
      }
    };
  }, [player]);
  const state = useSyncExternalStore(
    (fn) => player?.subscribe(fn) ?? (() => {}),
    () => player?.state ?? IDLE,
    () => IDLE,
  );
  return { player, state };
}
