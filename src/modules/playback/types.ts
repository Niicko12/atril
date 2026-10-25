import type { PracticeOptions } from '@/modules/practice';
import type { InstrumentId, Midi, Note, Timbre } from '@/core';

export interface PlayOptions {
  practice?: PracticeOptions;
  instrumentId?: InstrumentId;
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
  preview(midi: Midi, timbre: Timbre, instrumentId?: InstrumentId): void;
  play(opts: PlayOptions): void;
  stopAll(): void;
  readonly isPlaying: boolean;
  subscribe(fn: (playing: boolean) => void): () => void;
}
