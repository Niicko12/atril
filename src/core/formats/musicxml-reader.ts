import type { VoiceEvent } from './mono';

/** Para inyectar DOMParser (navegador) o @xmldom/xmldom (Node). */
export interface DomParserLike {
  parseFromString(text: string, type: 'application/xml'): Document;
}

const NAT: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const child = (el: Element, name: string): Element | undefined => el.getElementsByTagName(name)[0];
export const text = (el: Element | undefined, name: string): string =>
  el ? (child(el, name)?.textContent ?? '').trim() : '';

export interface PartState {
  divisions: number;
  chromatic: number;
  fifths: number | null;
  meter: [number, number] | null;
  tempo: number | null;
  meterChanges: boolean;
  tempoChanges: boolean;
  voice: string | null;
  /** Posición absoluta en negras del inicio del compás. */
  measureStartQ: number;
  events: VoiceEvent[];
  measureLengthsQ: number[];
  repeats: boolean;
}

export const newPartState = (): PartState => ({
  divisions: 1,
  chromatic: 0,
  fifths: null,
  meter: null,
  tempo: null,
  meterChanges: false,
  tempoChanges: false,
  voice: null,
  measureStartQ: 0,
  events: [],
  measureLengthsQ: [],
  repeats: false,
});

function readTime(el: Element, st: PartState): void {
  const beats = Number(text(el, 'beats'));
  if (!beats) return;
  const m: [number, number] = [beats, Number(text(el, 'beat-type'))];
  if (st.meter && (st.meter[0] !== m[0] || st.meter[1] !== m[1])) st.meterChanges = true;
  st.meter ??= m;
}

function readAttributes(el: Element, st: PartState): void {
  const div = Number(text(el, 'divisions'));
  if (div > 0) st.divisions = div;
  const fifths = text(el, 'fifths');
  if (st.fifths === null && fifths !== '') st.fifths = Number(fifths);
  readTime(el, st);
  const tp = child(el, 'transpose');
  if (tp) st.chromatic = Number(text(tp, 'chromatic') || 0) + 12 * Number(text(tp, 'octave-change') || 0);
}

function readTempo(el: Element, st: PartState): void {
  const sound = el.nodeName === 'sound' ? el : child(el, 'sound');
  const bpm = Number(
    sound?.getAttribute('tempo') ?? (text(el, 'beat-unit') === 'quarter' ? text(el, 'per-minute') : ''),
  );
  if (!bpm) return;
  if (st.tempo !== null && Math.round(bpm) !== st.tempo) st.tempoChanges = true;
  st.tempo ??= Math.round(bpm);
}

function pitchOf(note: Element, chromatic: number): number | null {
  const p = child(note, 'pitch');
  if (!p || child(note, 'rest')) return null;
  return (
    (Number(text(p, 'octave')) + 1) * 12 +
    (NAT[text(p, 'step')] ?? 0) +
    Math.round(Number(text(p, 'alter') || 0)) +
    chromatic
  );
}

interface MeasureCursor {
  pos: number;
  max: number;
  lastStart: number;
}

const toUnits = (q: number): number => Math.round(q * 4);

function pushEvent(st: PartState, startDiv: number, durDiv: number, extra: Omit<VoiceEvent, 'start' | 'dur'>): void {
  const s = toUnits(st.measureStartQ + startDiv / st.divisions);
  const e = toUnits(st.measureStartQ + (startDiv + durDiv) / st.divisions);
  if (e > s) st.events.push({ start: s, dur: e - s, ...extra });
}

const tiesOf = (el: Element) => {
  const types = Array.from(el.getElementsByTagName('tie')).map((t) => t.getAttribute('type'));
  return { tieStart: types.includes('start'), tieStop: types.includes('stop') };
};

function readNote(el: Element, st: PartState, c: MeasureCursor): void {
  if (child(el, 'grace') || child(el, 'cue')) return;
  const dur = Number(text(el, 'duration')) || 0;
  const chord = !!child(el, 'chord');
  const voice = text(el, 'voice') || '1';
  st.voice ??= voice;
  const start = chord ? c.lastStart : c.pos;
  if (!chord) {
    c.lastStart = c.pos;
    c.pos += dur;
  }
  if (voice === st.voice && dur > 0) pushEvent(st, start, dur, { midi: pitchOf(el, st.chromatic), ...tiesOf(el) });
}

const dur = (el: Element): number => Number(text(el, 'duration')) || 0;

type Reader = (el: Element, st: PartState, c: MeasureCursor) => void;
const READERS: Readonly<Record<string, Reader>> = {
  attributes: (el, st) => readAttributes(el, st),
  direction: (el, st) => readTempo(el, st),
  sound: (el, st) => readTempo(el, st),
  backup: (el, _st, c) => void (c.pos -= dur(el)),
  forward: (el, st, c) => {
    const v = text(el, 'voice');
    if (!v || v === st.voice) pushEvent(st, c.pos, dur(el), { midi: null });
    c.pos += dur(el);
  },
  note: readNote,
  barline: (el, st) => void ((child(el, 'repeat') || child(el, 'ending')) && (st.repeats = true)),
};

/** Lee un compás con cursor de tiempo (formats-spec 12.3). */
export function readMeasure(measure: Element, st: PartState): void {
  const c: MeasureCursor = { pos: 0, max: 0, lastStart: 0 };
  for (const node of Array.from(measure.childNodes)) {
    if (node.nodeType !== 1) continue;
    READERS[node.nodeName]?.(node as Element, st, c);
    c.max = Math.max(c.max, c.pos);
  }
  const lengthQ = c.max / st.divisions;
  st.measureLengthsQ.push(lengthQ);
  st.measureStartQ += lengthQ;
}
