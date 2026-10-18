// Semana 2: API mínima. La implementación (sintetizador, iOS, programador) llega en la semana 3 (playback-spec).
import type { Midi, Timbre } from '@/core';

export interface PlaybackEngine {
  unlock(): void;
  preview(midi: Midi, timbre: Timbre): void;
  stopAll(): void;
}

export const playbackEngine: PlaybackEngine = {
  unlock() {},
  preview() {},
  stopAll() {},
};
