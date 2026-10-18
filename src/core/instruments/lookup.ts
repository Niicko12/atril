import type { Instrument } from '../types';
import { INSTRUMENTS } from './catalog';

/** Id desconocido → piano (nunca devuelve undefined). */
export function getInstrument(id: string): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? (INSTRUMENTS[0] as Instrument);
}

export function isTransposing(instrument: Instrument): boolean {
  return instrument.transpose !== 0;
}

/** Nombre apto para archivos: ♭ → b, ♯ → #. */
export function displayName(instrument: Instrument): string {
  return instrument.name.replace(/[♭♯]/g, (m) => (m === '♭' ? 'b' : '#'));
}
