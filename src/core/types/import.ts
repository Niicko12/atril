import type { MeterId, Note } from './score';
import type { InstrumentId } from './instrument';

export type ImportWarningCode =
  | 'truncated'
  | 'polyphony_reduced'
  | 'tempo_changes'
  | 'meter_changes'
  | 'unsupported_meter'
  | 'tuplets_rounded'
  | 'pickup_padded'
  | 'repeats_ignored'
  | 'parts_more';

export interface ImportWarning {
  code: ImportWarningCode;
  detail?: string;
}

/** Resultado común de los importadores (technical-decisions 8.5, formats-spec 3). Alturas en sonido real. */
export interface ImportResult {
  title: string;
  composer: string;
  key: number;
  meter: MeterId;
  tempo: number;
  notes: Note[];
  instrumentId: InstrumentId | null;
  warnings: ImportWarning[];
}

/** Error de importación con mensaje en español apto para el usuario. */
export class ImportError extends Error {
  constructor(
    public readonly code: 'unsupported_format' | 'parse_failed' | 'no_notes' | 'file_too_large',
    message: string,
  ) {
    super(message);
  }
}
