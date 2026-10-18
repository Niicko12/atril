import type { MeasurePart } from '../types';
import { spell } from '../theory';

/** Duración en semicorcheas → [type, puntillo]. */
const TYPES: Readonly<Record<number, readonly [string, boolean]>> = {
  16: ['whole', false],
  12: ['half', true],
  8: ['half', false],
  6: ['quarter', true],
  4: ['quarter', false],
  3: ['eighth', true],
  2: ['eighth', false],
  1: ['16th', false],
};

export type XmlPart = MeasurePart & { whole?: boolean };

function pitchXml(p: number, transpose: number, fifths: number): string {
  const sp = spell(p + transpose, fifths);
  return `<pitch><step>${sp.letter}</step>${sp.alter ? `<alter>${sp.alter}</alter>` : ''}<octave>${sp.octave}</octave></pitch>`;
}

function tiesXml(part: XmlPart): { ties: string; notations: string } {
  if (part.p == null) return { ties: '', notations: '' };
  const stop = !part.first;
  const start = !part.last;
  if (!stop && !start) return { ties: '', notations: '' };
  return {
    ties: (stop ? '<tie type="stop"/>' : '') + (start ? '<tie type="start"/>' : ''),
    notations: `<notations>${stop ? '<tied type="stop"/>' : ''}${start ? '<tied type="start"/>' : ''}</notations>`,
  };
}

function typeXml(part: XmlPart): string {
  if (part.whole) return '';
  const [type, dot] = TYPES[part.d] ?? ['quarter', false];
  return `<type>${type}</type>${dot ? '<dot/>' : ''}`;
}

/** `<note>` de un fragmento, con el orden de elementos del XSD (legacy, sin cambios). */
export function noteXml(part: XmlPart, transpose: number, fifths: number): string {
  const rest = part.whole ? '<rest measure="yes"/>' : '<rest/>';
  const body = part.p == null ? rest : pitchXml(part.p, transpose, fifths);
  const { ties, notations } = tiesXml(part);
  return `<note>${body}<duration>${part.d}</duration>${ties}<voice>1</voice>${typeXml(part)}${notations}</note>`;
}
