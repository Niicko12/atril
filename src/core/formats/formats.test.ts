import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { parseChord, toMidi, toMusicXML, transposeFor } from '.';
import { getInstrument } from '../instruments';
import { meterOf, splitDuration, toMeasures } from '../rhythm';
import { noteXml } from './musicxml-measure';
import type { MeterId, Note } from '../types';

interface Golden {
  scores: Record<
    string,
    { title: string; composer: string; key: number; meter: MeterId; tempo: number; notes: Note[] }
  >;
  musicxml: Record<string, string>;
  midi: Record<string, string>;
}
const golden = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/golden/core.json', import.meta.url), 'utf8'),
) as Golden;

/** Legacy + el silencio de relleno del último compás (D2), calculado de forma exacta. */
function expectedXml(legacy: string, notes: Note[], meter: MeterId): string {
  if (!notes.length) return legacy;
  const ms = toMeasures(notes, meterOf(meter));
  let pos = ms[ms.length - 1]!.reduce((a, p) => a + p.d, 0);
  const pad = splitDuration(meterOf(meter).bar - pos)
    .map((d) => {
      const x = noteXml({ idx: -1, p: null, d, first: true, last: true, pos }, 0, 0);
      pos += d;
      return x;
    })
    .join('');
  return legacy.replace('<barline location="right">', `${pad}<barline location="right">`);
}

const base = { title: 'T', composer: '', key: 0, meter: '4/4' as MeterId, tempo: 100 };

describe('dorados MusicXML y MIDI contra legacy', () => {
  it('MusicXML: 12 casos × 18 instrumentos (con relleno del último compás)', () => {
    let n = 0;
    for (const [k, legacy] of Object.entries(golden.musicxml)) {
      const [name, id] = k.split('|') as [string, string];
      if (name === 'con-acordes') continue; // D1: <harmony>, cubierto abajo
      const s = golden.scores[name]!;
      expect(toMusicXML(s, getInstrument(id)), k).toBe(expectedXml(legacy, s.notes, s.meter));
      n++;
    }
    expect(n).toBe(198);
  });
  it('MIDI: bytes idénticos en los 216 casos', () => {
    for (const [k, hex] of Object.entries(golden.midi)) {
      const [name, id] = k.split('|') as [string, string];
      expect(Buffer.from(toMidi(golden.scores[name]!, getInstrument(id))).toString('hex'), k).toBe(hex);
    }
  });
});

describe('<transpose> (formats-spec 4.3, T-MXE-01)', () => {
  it.each([
    ['clarinete', { diatonic: -1, chromatic: -2, octaveChange: 0 }],
    ['saxalto', { diatonic: -5, chromatic: -9, octaveChange: 0 }],
    ['saxtenor', { diatonic: -1, chromatic: -2, octaveChange: -1 }],
    ['corno', { diatonic: -4, chromatic: -7, octaveChange: 0 }],
    ['guitarra', { diatonic: 0, chromatic: 0, octaveChange: -1 }],
    ['flautadulce', { diatonic: 0, chromatic: 0, octaveChange: 1 }],
  ])('%s', (id, expected) => {
    const t = transposeFor(getInstrument(id).transpose)!;
    expect({ diatonic: t.diatonic + 0, chromatic: t.chromatic + 0, octaveChange: t.octaveChange + 0 }).toEqual(
      expected,
    );
  });
  it('piano no lleva <transpose>; flauta dulce lleva octave-change +1 (D3)', () => {
    expect(toMusicXML({ ...base, notes: [] }, getInstrument('piano'))).not.toContain('<transpose>');
    expect(toMusicXML({ ...base, notes: [] }, getInstrument('flautadulce'))).toContain(
      '<octave-change>1</octave-change>',
    );
  });
});

describe('cifrados → <harmony> (formats-spec 4.5, T-HAR-01, T-MXE-06)', () => {
  it.each([
    ['Do', 0, ''],
    ['Rem', 2, 'm'],
    ['Fa♯7', 6, '7'],
    ['Si♭m7', 10, 'm7'],
    ['Soldim', 7, 'dim'],
    ['Lab', 8, ''],
  ])('%s', (name, pc, suffix) => {
    expect(parseChord(name)).toEqual({ rootPc: pc, suffix });
  });
  it('raíz transportada para clarinete y kind correcto', () => {
    const x = toMusicXML({ ...base, notes: [{ p: 60, d: 16, c: 'Lam' }] }, getInstrument('clarinete'));
    expect(x).toContain(
      '<harmony print-frame="no"><root><root-step>B</root-step></root><kind text="m">minor</kind></harmony><note>',
    );
  });
  it('raíz no reconocible → <words> escapado (X32)', () => {
    expect(toMusicXML({ ...base, notes: [{ p: 60, d: 16, c: 'N.C.<' }] }, getInstrument('piano'))).toContain(
      '<words>N.C.&lt;</words>',
    );
  });
});

describe('estructura MusicXML', () => {
  const parse = (x: string) => new DOMParser().parseFromString(x, 'application/xml');
  const durations = (x: string) => {
    const doc = parse(x);
    return Array.from(doc.getElementsByTagName('measure')).map((m) =>
      Array.from(m.getElementsByTagName('duration')).reduce((a, d) => a + Number(d.textContent), 0),
    );
  };
  it('partitura vacía: compás con silencio de compás completo (T-MXE-04)', () => {
    expect(toMusicXML({ ...base, notes: [] }, getInstrument('piano'))).toContain(
      '<rest measure="yes"/><duration>16</duration>',
    );
  });
  it('todos los compases suman la barra, incluido el último (X30, T-MXE-05)', () => {
    const x = toMusicXML(
      {
        ...base,
        meter: '3/4',
        notes: [
          { p: 60, d: 7 },
          { p: 62, d: 9 },
          { p: 64, d: 3 },
        ],
      },
      getInstrument('piano'),
    );
    expect(durations(x).every((d) => d === 12)).toBe(true);
  });
  it('XML bien formado y escapado (T-MXE-07)', () => {
    const x = toMusicXML(
      { ...base, title: 'A & B <"x">', composer: 'Él & yo', notes: [{ p: 60, d: 4 }] },
      getInstrument('piano'),
    );
    expect(parse(x).getElementsByTagName('work-title')[0]?.textContent).toBe('A & B <"x">');
  });
});

describe('MIDI (T-MID-01..04)', () => {
  it('cabecera, 6/8, armadura −3 y título UTF-8', () => {
    const bytes = toMidi(
      { ...base, title: 'Canción', key: -3, meter: '6/8', notes: [{ p: 60, d: 4 }] },
      getInstrument('piano'),
    );
    const hex = Buffer.from(bytes).toString('hex');
    expect(hex.startsWith('4d546864000000060000000101e0')).toBe(true);
    expect(hex).toContain('ff580406031808');
    expect(hex).toContain('ff5902fd00');
    expect(hex).toContain(Buffer.from('Canción').toString('hex'));
  });
  it('partitura vacía es válida (solo metas y fin de pista)', () => {
    expect(
      Buffer.from(toMidi({ ...base, notes: [] }, getInstrument('piano')))
        .toString('hex')
        .endsWith('00ff2f00'),
    ).toBe(true);
  });
});

describe('casos límite de formato', () => {
  it('cifrado con # y b, y sufijo desconocido → kind other', () => {
    expect(parseChord('Do#')?.rootPc).toBe(1);
    expect(parseChord('Mib')?.rootPc).toBe(3);
    const x = toMusicXML({ ...base, notes: [{ p: 60, d: 16, c: 'Dosus4' }] }, getInstrument('piano'));
    expect(x).toContain('<kind text="sus4">other</kind>');
    expect(toMusicXML({ ...base, notes: [{ p: 60, d: 16, c: 'Fa♯' }] }, getInstrument('piano'))).toContain(
      '<root-alter>1</root-alter>',
    );
  });
  it('MIDI con tempo 0 usa 100 (600 000 µs por negra)', () => {
    const hex = Buffer.from(toMidi({ ...base, tempo: 0, notes: [] }, getInstrument('piano'))).toString('hex');
    expect(hex).toContain('ff510309' + '27c0');
  });
});
