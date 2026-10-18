export type EarMode = 'solo' | 'mix';

export interface DecodedAudio {
  name: string;
  buffer: AudioBuffer;
  mono: Float32Array;
  sampleRate: number;
  duration: number;
}

export interface Region {
  a: number;
  b: number;
  loop: boolean;
}
