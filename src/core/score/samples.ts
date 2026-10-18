// size-exception: datos de ejemplos (technical-decisions 3.2).
import type { MeterId, Note } from '../types';

export interface Sample {
  title: string;
  composer: string;
  key: number;
  meter: MeterId;
  tempo: number;
  notes: Note[];
  /** false = transcripción aún no verificada al oído; solo se muestra en desarrollo. */
  verified: boolean;
}

/** Formato `MIDI:duración` (r = silencio), igual que `seq()` de legacy. */
export function seq(text: string): Note[] {
  return text
    .trim()
    .split(/\s+/)
    .map((t) => {
      const [p, d] = t.split(':');
      return { p: p === 'r' ? null : Number(p), d: Number(d) };
    });
}

export const SAMPLES: readonly Sample[] = [
  {
    title: 'Himno de la alegría',
    composer: 'L. van Beethoven',
    key: 0,
    meter: '4/4',
    tempo: 100,
    verified: true,
    notes: seq(
      '64:4 64:4 65:4 67:4 67:4 65:4 64:4 62:4 60:4 60:4 62:4 64:4 64:6 62:2 62:8 64:4 64:4 65:4 67:4 67:4 65:4 64:4 62:4 60:4 60:4 62:4 64:4 62:6 60:2 60:8 62:4 62:4 64:4 60:4 62:4 64:2 65:2 64:4 60:4 62:4 64:2 65:2 64:4 62:4 60:4 62:4 55:8 64:4 64:4 65:4 67:4 67:4 65:4 64:4 62:4 60:4 60:4 62:4 64:4 62:6 60:2 60:8',
    ),
  },
  {
    title: 'Estrellita',
    composer: 'Tradicional',
    key: 0,
    meter: '4/4',
    tempo: 96,
    verified: true,
    notes: seq(
      '60:4 60:4 67:4 67:4 69:4 69:4 67:8 65:4 65:4 64:4 64:4 62:4 62:4 60:8 67:4 67:4 65:4 65:4 64:4 64:4 62:8 67:4 67:4 65:4 65:4 64:4 64:4 62:8 60:4 60:4 67:4 67:4 69:4 69:4 67:8 65:4 65:4 64:4 64:4 62:4 62:4 60:8',
    ),
  },
  {
    title: 'Escala de Sol mayor',
    composer: 'Ejercicio',
    key: 1,
    meter: '4/4',
    tempo: 80,
    verified: true,
    notes: seq('55:2 57:2 59:2 60:2 62:2 64:2 66:2 67:2 67:2 66:2 64:2 62:2 60:2 59:2 57:2 55:2 55:16'),
  },
  {
    // Transcripción propia de la melodía tradicional (dominio público); verificar al oído (plan, semana 7).
    title: 'La cucaracha',
    composer: 'Tradicional mexicana',
    key: 1,
    meter: '4/4',
    tempo: 120,
    verified: false,
    notes: seq(
      '62:2 62:2 62:2 67:6 71:4 62:2 62:2 62:2 67:6 71:4 67:2 67:2 66:2 66:2 64:2 64:2 62:4 62:2 62:2 62:2 66:6 69:4 62:2 62:2 62:2 66:6 69:4 69:2 69:2 67:2 67:2 66:2 66:2 67:4 67:16',
    ),
  },
];
