import { readFileSync } from 'node:fs';
import { parseMidi } from './midi-import';
import { toMidi } from './midi-export';
import { getInstrument } from '../instruments';
import type { Note } from '../types';

interface Golden {
  midi: Record<string, string>;
  midiImport: Record<
    string,
    { notes?: Note[]; key?: number; meter?: string; tempo?: number; title?: string; error?: string }
  >;
}
const golden = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/golden/core.json', import.meta.url), 'utf8'),
) as Golden;
const buf = (bytes: number[] | Uint8Array) => new Uint8Array(bytes).buffer;
const mergeRests = (list: Note[]) =>
  list.reduce<Note[]>((out, x) => {
    const prev = out[out.length - 1];
    if (prev && prev.p == null && x.p == null) prev.d += x.d;
    else out.push({ ...x });
    return out;
  }, []);

/** SMF formato 0 a mano: cabecera + una pista con los bytes dados. */
const smf = (track: number[], division = 480) => {
  const hdr = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, division >> 8, division & 255];
  const len = track.length;
  return buf([
    ...hdr,
    0x4d,
    0x54,
    0x72,
    0x6b,
    (len >>> 24) & 255,
    (len >> 16) & 255,
    (len >> 8) & 255,
    len & 255,
    ...track,
  ]);
};

describe('dorados contra el importador MIDI de legacy (G-FMT-03)', () => {
  it('216 exportaciones de legacy: mismas notas, tonalidad, compás, tempo y título', () => {
    for (const [k, g] of Object.entries(golden.midiImport)) {
      const bytes = Buffer.from(golden.midi[k]!, 'hex');
      if (g.error) {
        expect(() => parseMidi(buf(bytes)), k).toThrow();
        continue;
      }
      const r = parseMidi(buf(bytes));
      expect({ notes: r.notes, key: r.key, meter: r.meter, tempo: r.tempo, title: r.title }, k).toEqual({
        ...g,
        notes: mergeRests(g.notes ?? []),
      });
    }
  });
  it('ida y vuelta toMidi → parseMidi (T-MID-05)', () => {
    const s = {
      title: 'T',
      key: 2,
      meter: '3/4' as const,
      tempo: 84,
      notes: [
        { p: 62, d: 4 },
        { p: null, d: 2 },
        { p: 66, d: 6 },
      ],
    };
    const r = parseMidi(toMidi(s, getInstrument('violin')).slice().buffer);
    expect([r.notes, r.key, r.meter, r.tempo]).toEqual([s.notes, 2, '3/4', 84]);
  });
});

describe('casos de formats-spec 19 (T-MID-06/07/08)', () => {
  const on = (d: number, p: number) => [d, 0x90, p, 90];
  it('X16 running status después de un meta: notas correctas (legacy fallaba)', () => {
    // Do4 (0x90), apagado en running status (vel 0), meta de texto, y Re4 SIN byte de estado: debe seguir 0x90.
    const track = [
      0, 0x90, 60, 90, 0x83, 0x60, 60, 0, 0, 0xff, 0x01, 0x01, 0x41, 0, 62, 90, 0x83, 0x60, 62, 0, 0, 0xff, 0x2f, 0,
    ];
    expect(parseMidi(smf(track)).notes).toEqual([
      { p: 60, d: 4 },
      { p: 62, d: 4 },
    ]);
  });
  it('X17 solo percusión → sin notas; X18 cambios de tempo → aviso', () => {
    expect(() => parseMidi(smf([0, 0x99, 36, 90, 0x60, 0x89, 36, 0, 0, 0xff, 0x2f, 0]))).toThrow('no tiene notas');
    const tempos = [
      0,
      0xff,
      0x51,
      3,
      0x07,
      0xa1,
      0x20,
      ...on(0, 60),
      0x83,
      0x60,
      0x80,
      60,
      0,
      0,
      0xff,
      0x51,
      3,
      0x09,
      0x27,
      0xc0,
      0,
      0xff,
      0x2f,
      0,
    ];
    const r = parseMidi(smf(tempos));
    expect([r.tempo, r.warnings.map((w) => w.code)]).toEqual([120, ['tempo_changes']]);
  });
  it('X19 tresillos → aviso; X21 empieza en el tiempo 3 → silencio desde el inicio del compás', () => {
    const trip = [
      ...on(0, 60),
      0x81,
      0x20,
      0x80,
      60,
      0,
      0,
      0x90,
      62,
      90,
      0x81,
      0x20,
      0x80,
      62,
      0,
      0,
      0x90,
      64,
      90,
      0x81,
      0x20,
      0x80,
      64,
      0,
      0,
      0xff,
      0x2f,
      0,
    ];
    expect(parseMidi(smf(trip)).warnings.map((w) => w.code)).toContain('tuplets_rounded');
    const late = [0x87, 0x40, 0x90, 67, 90, 0x83, 0x60, 0x80, 67, 0, 0, 0xff, 0x2f, 0];
    expect(parseMidi(smf(late)).notes).toEqual([
      { p: null, d: 8 },
      { p: 67, d: 4 },
    ]);
  });
  it('archivo que no es MIDI, SMPTE y truncado', () => {
    expect(() => parseMidi(buf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]))).toThrow('No es un archivo MIDI');
    const smpte = new Uint8Array(smf([0, 0xff, 0x2f, 0]));
    smpte[12] = 0xe7;
    expect(() => parseMidi(smpte.buffer)).toThrow('no compatible');
    expect(() => parseMidi(smf([0, 0x90, 60]).slice(0, 25))).toThrow();
  });
});
