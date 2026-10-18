import type { Clef, Instrument, Measure, Meter, Score } from '../types';
import { normalizeFifths } from '../theory';
import { meterOf, splitDuration, toMeasures } from '../rhythm';
import { clefFor } from '../instruments';
import { harmonyXml } from './harmony';
import { noteXml, type XmlPart } from './musicxml-measure';
import { transposeFor, transposeXml } from './musicxml-transpose';
import { xmlEscape } from './xml-escape';

export type XmlScore = Pick<Score, 'title' | 'composer' | 'key' | 'meter' | 'tempo' | 'notes'>;

const CLEFS: Readonly<Record<Clef, readonly [string, number]>> = { treble: ['G', 2], bass: ['F', 4], alto: ['C', 3] };

function headerXml(score: XmlScore, instrument: Instrument): string {
  const name = xmlEscape(instrument.name);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    `<score-partwise version="3.1"><work><work-title>${xmlEscape(score.title || 'Sin título')}</work-title></work>` +
    `<identification>${score.composer ? `<creator type="composer">${xmlEscape(score.composer)}</creator>` : ''}` +
    '<encoding><software>Atril</software></encoding></identification>' +
    `<part-list><score-part id="P1"><part-name>${name}</part-name><score-instrument id="P1-I1"><instrument-name>${name}</instrument-name></score-instrument>` +
    `<midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>${instrument.gmProgram + 1}</midi-program></midi-instrument></score-part></part-list><part id="P1">`
  );
}

function attributesXml(score: XmlScore, instrument: Instrument, fifths: number, clef: Clef): string {
  const [beats, beatType] = score.meter.split('/');
  const [sign, line] = CLEFS[clef];
  const t = transposeFor(instrument.transpose);
  return (
    `<attributes><divisions>4</divisions><key><fifths>${fifths}</fifths></key>` +
    `<time${score.meter === '4/4' ? ' symbol="common"' : ''}><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
    `<clef><sign>${sign}</sign><line>${line}</line></clef>${t ? transposeXml(t) : ''}</attributes>` +
    `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome></direction-type><sound tempo="${score.tempo}"/></direction>`
  );
}

/** Completa el último compás con silencios (formats-spec 4.6, D2). */
function padLast(measures: Measure[], meter: Meter): XmlPart[][] {
  const last = measures[measures.length - 1];
  if (!last) return [[{ idx: -1, p: null, d: meter.bar, first: true, last: true, pos: 0, whole: true }]];
  let pos = last.reduce((a, p) => a + p.d, 0);
  const pad = splitDuration(meter.bar - pos).map((d) => {
    const part: XmlPart = { idx: -1, p: null, d, first: true, last: true, pos };
    pos += d;
    return part;
  });
  return [...measures.slice(0, -1), [...last, ...pad]];
}

/** MusicXML 3.1 partwise con alturas escritas + `<transpose>` (formats-spec 4). */
export function toMusicXML(score: XmlScore, instrument: Instrument): string {
  const t = instrument.transpose;
  const fifths = normalizeFifths(score.key + 7 * t);
  const meter = meterOf(score.meter);
  const clef = clefFor(instrument, score.notes, t);
  const measures = padLast(toMeasures(score.notes, meter), meter);
  let x = headerXml(score, instrument);
  measures.forEach((m, mi) => {
    x += `<measure number="${mi + 1}">`;
    if (mi === 0) x += attributesXml(score, instrument, fifths, clef);
    for (const part of m) {
      const chord = part.first && part.idx >= 0 ? score.notes[part.idx]?.c : undefined;
      if (chord) x += harmonyXml(chord, t, fifths);
      x += noteXml(part, t, fifths);
    }
    if (mi === measures.length - 1) x += '<barline location="right"><bar-style>light-heavy</bar-style></barline>';
    x += '</measure>';
  });
  return x + '</part></score-partwise>\n';
}
