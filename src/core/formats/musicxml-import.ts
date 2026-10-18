import type { ImportResult, ImportWarning } from '../types';
import { ImportError } from '../types';
import { normalizeFifths } from '../theory';
import { METERS } from '../rhythm';
import { finalize, guessInstrument, hasPitches, pickMeter } from './import-common';
import { toMonophonic } from './mono';
import { newPartState, readMeasure, text, type DomParserLike, type PartState } from './musicxml-reader';

const MAX_MEASURES = 2000;

function parseRoot(xml: string, dom: DomParserLike): Element {
  if (/<!ENTITY/i.test(xml)) throw new ImportError('parse_failed', 'El archivo tiene un formato no permitido.');
  const doc = dom.parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (!root || doc.getElementsByTagName('parsererror').length)
    throw new ImportError('parse_failed', 'No se pudo leer el archivo MusicXML.');
  if (root.nodeName === 'score-timewise') {
    throw new ImportError(
      'parse_failed',
      'Solo se pueden abrir partituras MusicXML «partwise». Ábrela en MuseScore y expórtala de nuevo.',
    );
  }
  if (root.nodeName !== 'score-partwise') throw new ImportError('parse_failed', 'No es un archivo MusicXML.');
  return root;
}

function metadata(root: Element): { title: string; composer: string } {
  const credit = Array.from(root.getElementsByTagName('credit-words'))[0]?.textContent?.trim() ?? '';
  const title = text(root, 'work-title') || text(root, 'movement-title') || credit;
  const creators = Array.from(root.getElementsByTagName('creator'));
  const composer =
    creators.find((c) => (c.getAttribute('type') ?? 'composer') === 'composer')?.textContent?.trim() ?? '';
  return { title, composer };
}

function partName(root: Element, part: Element): string {
  const id = part.getAttribute('id');
  const sp = Array.from(root.getElementsByTagName('score-part')).find((p) => p.getAttribute('id') === id);
  return sp ? text(sp, 'part-name') : '';
}

/** Anacrusa: primer compás más corto que la barra o implicit="yes" → silencio inicial (formats-spec 12.5). */
function pickupPad(st: PartState, firstMeasure: Element, barUnits: number): number {
  const firstUnits = Math.round((st.measureLengthsQ[0] ?? 0) * 4);
  const implicit = firstMeasure.getAttribute('implicit') === 'yes';
  return (implicit || firstUnits < barUnits) && firstUnits > 0 && firstUnits < barUnits ? barUnits - firstUnits : 0;
}

function warningsOf(st: PartState, reduced: boolean, pad: number, exactMeter: boolean): ImportWarning[] {
  const w: ImportWarning[] = [];
  if (reduced) w.push({ code: 'polyphony_reduced' });
  if (st.tempoChanges) w.push({ code: 'tempo_changes', detail: String(st.tempo) });
  if (st.meterChanges) w.push({ code: 'meter_changes' });
  if (!exactMeter) w.push({ code: 'unsupported_meter', detail: st.meter?.join('/') ?? '' });
  if (pad) w.push({ code: 'pickup_padded' });
  if (st.repeats) w.push({ code: 'repeats_ignored' });
  return w;
}

/** MusicXML partwise → melodía principal en sonido real (formats-spec 12). */
export function parseMusicXML(xml: string, dom: DomParserLike): ImportResult {
  const root = parseRoot(xml, dom);
  const parts = Array.from(root.getElementsByTagName('part'));
  const part = parts[0];
  if (!part) throw new ImportError('parse_failed', 'El archivo no tiene partes.');
  const st = newPartState();
  const measures = Array.from(part.getElementsByTagName('measure')).slice(0, MAX_MEASURES);
  measures.forEach((m) => readMeasure(m, st));
  const { meter, exact } = st.meter ? pickMeter(st.meter[0], st.meter[1]) : { meter: '4/4' as const, exact: true };
  const pad = measures[0] ? pickupPad(st, measures[0], METERS[meter].bar) : 0;
  const { notes, reduced } = toMonophonic(st.events.map((e) => ({ ...e, start: e.start + pad })));
  if (!hasPitches(notes)) throw new ImportError('no_notes', 'No se encontraron notas en la primera parte.');
  const name = partName(root, part);
  const warnings = warningsOf(st, reduced, pad, exact);
  if (parts.length > 1)
    warnings.push({ code: 'parts_more', detail: `${name || 'la primera parte'} (1 de ${parts.length})` });
  return finalize({
    ...metadata(root),
    key: normalizeFifths((st.fifths ?? 0) + 7 * st.chromatic),
    meter,
    tempo: st.tempo ?? 100,
    notes,
    instrumentId: guessInstrument(name),
    warnings,
  });
}
