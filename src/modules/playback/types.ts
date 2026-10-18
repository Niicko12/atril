import type { Midi, Note, Timbre } from '@/core';

export interface PlayOptions {
  notes: readonly Note[];
  fromIndex: number;
  tempo: number;
  timbre: Timbre;
  onPosition?(index: number): void;
  onEnd?(): void;
}

export interface PlaybackEngine {
  getContext(): AudioContext;
  unlock(): void;
  preview(midi: Midi, timbre: Timbre): void;
  play(opts: PlayOptions): void;
  stopAll(): void;
  readonly isPlaying: boolean;
  subscribe(fn: (playing: boolean) => void): () => void;
}
