/** Datos de una nota a sintetizar. */
export interface Voice {
  c: AudioContext;
  out: GainNode;
  midi: number;
  t0: number;
  dur: number;
  rand: () => number;
}
