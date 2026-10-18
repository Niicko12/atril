import type { Midi, Units16, Fifths } from './units';
import type { InstrumentId } from './instrument';

export type MeterId = '4/4' | '3/4' | '2/4' | '6/8' | '3/8' | '12/8';

/** Una nota o silencio. Compatible con el formato de legacy (ADR-001). */
export interface Note {
  /** Tono en sonido real; null = silencio. */
  p: Midi | null;
  /** Duración en semicorcheas. */
  d: Units16;
  /** Cifrado de acorde que se muestra encima (p. ej. "Lam7"). Opcional. */
  c?: string;
}

export interface ScoreMeta {
  title: string;
  composer: string;
  instrumentId: InstrumentId;
  /** Tonalidad en sonido real. */
  key: Fifths;
  meter: MeterId;
  tempo: number;
  showNames: boolean;
  showTab: boolean;
}

export type ScoreSource = 'manual' | 'sample' | 'musicxml' | 'midi' | 'abc' | 'ear_solo' | 'ear_mix' | 'ear_parts';

/** Partitura en edición (lo que maneja el store). */
export interface Score extends ScoreMeta {
  /** ID estable (UUID); es también la clave en IndexedDB. */
  id: string;
  notes: Note[];
  source: ScoreSource;
  /** null hasta el primer guardado automático (p. ej. un ejemplo sin editar). */
  savedAt: string | null;
}

/** Fila resumida para "Mis partituras". */
export interface ScoreSummary {
  id: string;
  title: string;
  composer: string;
  instrumentId: InstrumentId;
  noteCount: number;
  updatedAt: string;
  deletedAt: string | null;
}

export type View = 'written' | 'concert';
