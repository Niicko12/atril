import type { Letter } from '../types';
import { NATURAL, spell } from '../theory';
import { xmlEscape } from './xml-escape';

const ROOTS: Readonly<Record<string, Letter>> = { Do: 'C', Re: 'D', Mi: 'E', Fa: 'F', Sol: 'G', La: 'A', Si: 'B' };
const KINDS: Readonly<Record<string, string>> = {
  '': 'major',
  m: 'minor',
  '7': 'dominant',
  m7: 'minor-seventh',
  dim: 'diminished',
};
const PATTERN = /^(Do|Re|Mi|Fa|Sol|La|Si)([♯#♭b]?)(.*)$/;

export interface ParsedChord {
  /** Clase de altura de la raíz en sonido real (0-11). */
  rootPc: number;
  suffix: string;
}

/** "Fa♯m7" → { rootPc: 6, suffix: 'm7' }; null si la raíz no se reconoce. */
export function parseChord(name: string): ParsedChord | null {
  const m = PATTERN.exec(name.trim());
  if (!m) return null;
  const letter = ROOTS[m[1] as string] as Letter;
  const alter = m[2] === '♯' || m[2] === '#' ? 1 : m[2] === '♭' || m[2] === 'b' ? -1 : 0;
  return { rootPc: (((NATURAL[letter] + alter) % 12) + 12) % 12, suffix: m[3] ?? '' };
}

/** `<harmony>` con la raíz transportada a lo escrito; `<words>` si no se reconoce (formats-spec 4.5). */
export function harmonyXml(name: string, transpose: number, writtenFifths: number): string {
  const chord = parseChord(name);
  if (!chord) {
    return `<direction placement="above"><direction-type><words>${xmlEscape(name)}</words></direction-type></direction>`;
  }
  const sp = spell(60 + chord.rootPc + transpose, writtenFifths);
  const kind = KINDS[chord.suffix] ?? 'other';
  return (
    `<harmony print-frame="no"><root><root-step>${sp.letter}</root-step>` +
    (sp.alter ? `<root-alter>${sp.alter}</root-alter>` : '') +
    `</root><kind text="${xmlEscape(chord.suffix)}">${kind}</kind></harmony>`
  );
}
