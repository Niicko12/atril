/** Nota detectada antes de cuantizar (technical-decisions 8.6). */
export interface RawNote {
  m: number;
  t0: number;
  t1: number;
}

export type Progress = (value: number) => void;

export interface PolyNote extends RawNote {
  amplitude?: number;
}
