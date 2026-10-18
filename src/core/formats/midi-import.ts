import type { ImportResult, ImportWarning } from '../types';
import { ImportError } from '../types';
import { normalizeFifths } from '../theory';
import { METERS } from '../rhythm';
import { finalize, guessInstrument, pickMeter } from './import-common';
import { toMonophonic, type VoiceEvent } from './mono';
import { readMidi, type MidiFile, type RawMidiNote } from './midi-reader';

const DRUMS = 9;

/** Grupo (pista, canal) con más notas, sin percusión (legacy). */
function pickGroup(f: MidiFile): RawMidiNote[] {
  const groups = new Map<string, RawMidiNote[]>();
  for (const n of f.notes)
    if (n.channel !== DRUMS)
      groups.set(`${n.track}:${n.channel}`, [...(groups.get(`${n.track}:${n.channel}`) ?? []), n]);
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (!best) throw new ImportError('no_notes', 'El MIDI no tiene notas.');
  return best;
}

/** Cuantiza a semicorcheas; avisa si > 5 % de las notas caen lejos de la rejilla (formats-spec 13.4). */
function quantizeNotes(notes: RawMidiNote[], division: number): { events: VoiceEvent[]; tuplets: boolean } {
  const q = division / 4;
  let off = 0;
  const events = notes.map((n) => {
    const s = Math.round(n.start / q);
    if (Math.abs(n.start / q - s) > 0.2) off++;
    return { start: s, dur: Math.max(s + 1, Math.round(n.end / q)) - s, midi: n.pitch };
  });
  return { events, tuplets: off > notes.length * 0.05 };
}

function changes(list: readonly unknown[]): boolean {
  return new Set(list.map((x) => JSON.stringify(x))).size > 1;
}

function warningsOf(f: MidiFile, tuplets: boolean, reduced: boolean, exactMeter: boolean): ImportWarning[] {
  const w: ImportWarning[] = [];
  if (changes(f.tempos)) w.push({ code: 'tempo_changes' });
  if (changes(f.meters)) w.push({ code: 'meter_changes' });
  if (tuplets) w.push({ code: 'tuplets_rounded' });
  if (reduced) w.push({ code: 'polyphony_reduced' });
  if (!exactMeter) w.push({ code: 'unsupported_meter', detail: f.meters[0]?.join('/') ?? '' });
  return w;
}

/** SMF → melodía principal (formats-spec 13). */
export function parseMidi(buf: ArrayBuffer): ImportResult {
  let f: MidiFile;
  try {
    f = readMidi(buf);
  } catch (e) {
    throw new ImportError('parse_failed', (e as Error).message);
  }
  const group = pickGroup(f);
  const { events, tuplets } = quantizeNotes(group, f.division);
  const ts = f.meters[0];
  const { meter, exact } = ts ? pickMeter(ts[0], ts[1]) : { meter: '4/4' as const, exact: true };
  const bar = METERS[meter].bar;
  const first = Math.min(...events.map((e) => e.start));
  const { notes, reduced } = toMonophonic(events, first - (first % bar));
  const tempo = f.tempos[0];
  return finalize({
    title: f.trackNames[0] ?? '',
    composer: '',
    key: f.key !== null ? normalizeFifths(f.key) : 0,
    meter,
    tempo: tempo ? Math.round(60000000 / tempo) : 100,
    notes,
    instrumentId: guessInstrument(f.trackNames[group[0]?.track ?? 0] ?? ''),
    warnings: warningsOf(f, tuplets, reduced, exact),
  });
}
