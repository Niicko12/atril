import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { parseMusicXML } from './musicxml-import';
import { toMusicXML } from './musicxml-export';
import { decodeText } from './text-decode';
import { guessInstrument } from './import-common';
import { getInstrument, INSTRUMENTS } from '../instruments';
import type { MeterId, Note } from '../types';

const dom = new DOMParser() as unknown as { parseFromString(t: string, m: 'application/xml'): Document };
interface Golden {
  musicxml: Record<string, string>;
  musicxmlImport: Record<string, { notes?: Note[]; key?: number; meter?: string; tempo?: number; error?: string }>;
  scores: Record<
    string,
    { title: string; composer: string; key: number; meter: MeterId; tempo: number; notes: Note[] }
  >;
}
const golden = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/golden/core.json', import.meta.url), 'utf8'),
) as Golden;

/** Partitura MusicXML mínima con los compases dados. */
const xml = (
  measures: string,
  attrs = '<divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>',
  extra = '',
) =>
  `<?xml version="1.0"?><score-partwise version="3.1"><work><work-title>Prueba</work-title></work><part-list><score-part id="P1"><part-name>Flute</part-name></score-part>${extra}</part-list><part id="P1"><measure number="1"><attributes>${attrs}</attributes>${measures}</part></score-partwise>`;
const n = (step: string, oct: number, dur: number, more = '') =>
  `<note><pitch><step>${step}</step><octave>${oct}</octave></pitch><duration>${dur}</duration><voice>1</voice>${more}</note>`;
const notes = (r: { notes: Note[] }) => r.notes.map((x) => `${x.p ?? 'r'}:${x.d}`).join(' ');
/** D4 de formats-spec: la versión nueva une silencios consecutivos; legacy los dejaba separados. */
const mergeRests = (list: Note[]): Note[] =>
  list.reduce<Note[]>((out, x) => {
    const prev = out[out.length - 1];
    if (prev && prev.p == null && x.p == null) prev.d += x.d;
    else out.push({ ...x });
    return out;
  }, []);

describe('dorados contra el importador de legacy (G-FMT-04)', () => {
  it('importa las exportaciones de legacy igual que legacy (198 casos con notas)', () => {
    let compared = 0;
    for (const [k, g] of Object.entries(golden.musicxmlImport)) {
      if (g.error) {
        expect(() => parseMusicXML(golden.musicxml[k]!, dom), k).toThrow();
        continue;
      }
      const r = parseMusicXML(golden.musicxml[k]!, dom);
      expect({ notes: r.notes, key: r.key, meter: r.meter, tempo: r.tempo }, k).toEqual({
        ...g,
        notes: mergeRests(g.notes ?? []),
      });
      compared++;
    }
    expect(compared).toBe(198);
  });
  it('ida y vuelta: exportar e importar conserva notas y tonalidad en los 19 instrumentos (T-MXI-03)', () => {
    const s = golden.scores['mib-seis-octavos']!;
    for (const i of INSTRUMENTS) {
      const r = parseMusicXML(toMusicXML(s, i), dom);
      expect([notes(r), r.key, r.meter, r.tempo], i.id).toEqual([notes(s) + ' r:10', s.key, s.meter, s.tempo]);
    }
  });
});

describe('casos de formats-spec 19 (T-MXI-01)', () => {
  it('X1 dos voces con <backup>: solo la voz 1', () => {
    const m = `${n('C', 5, 16)}<backup><duration>16</duration></backup><note><pitch><step>C</step><octave>3</octave></pitch><duration>16</duration><voice>2</voice></note></measure>`;
    expect(notes(parseMusicXML(xml(m), dom))).toBe('72:16');
  });
  it('X2 <forward> en la voz 1 → silencio', () => {
    expect(
      notes(
        parseMusicXML(
          xml(`${n('C', 4, 4)}<forward><duration>8</duration><voice>1</voice></forward>${n('D', 4, 4)}</measure>`),
          dom,
        ),
      ),
    ).toBe('60:4 r:8 62:4');
  });
  it('X3 anacrusa de una negra → silencio de 12 + aviso', () => {
    const r = parseMusicXML(xml(`${n('G', 4, 4)}</measure><measure number="2">${n('C', 5, 16)}</measure>`), dom);
    expect(notes(r)).toBe('r:12 67:4 72:16');
    expect(r.warnings.map((w) => w.code)).toContain('pickup_padded');
  });
  it('X4 acorde → nota más aguda + aviso; X5 adorno ignorado', () => {
    const m = `<note><grace/><pitch><step>B</step><octave>4</octave></pitch><voice>1</voice></note>${n('C', 4, 16)}${n('E', 4, 16, '<chord/>').replace('<note>', '<note><chord/>')}${n('G', 4, 16).replace('<note>', '<note><chord/>')}</measure>`;
    const r = parseMusicXML(xml(m), dom);
    expect(notes(r)).toBe('67:16');
    expect(r.warnings.map((w) => w.code)).toContain('polyphony_reduced');
  });
  it('X6 ligadura entre compases → una nota', () => {
    const m = `${n('C', 4, 12)}${n('D', 4, 4, '<tie type="start"/>')}</measure><measure number="2">${n('D', 4, 8, '<tie type="stop"/>')}</measure>`;
    expect(notes(parseMusicXML(xml(m), dom))).toBe('60:12 62:12');
  });
  it('X7 divisions cambia a mitad', () => {
    const m = `${n('C', 4, 16)}</measure><measure number="2"><attributes><divisions>8</divisions></attributes>${n('D', 4, 32)}</measure>`;
    expect(notes(parseMusicXML(xml(m), dom))).toBe('60:16 62:16');
  });
  it('X8 clarinete con <transpose> −2: alturas y armadura en sonido real', () => {
    const attrs =
      '<divisions>4</divisions><key><fifths>2</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>';
    const r = parseMusicXML(xml(`${n('D', 5, 16)}</measure>`, attrs), dom);
    expect([notes(r), r.key]).toEqual(['72:16', 0]);
  });
  it('X12 timewise, entidades y XML roto', () => {
    expect(() => parseMusicXML('<score-timewise/>', dom)).toThrow('partwise');
    expect(() => parseMusicXML('<!DOCTYPE x [<!ENTITY a "b">]><score-partwise/>', dom)).toThrow('no permitido');
    expect(() => parseMusicXML('<html/>', dom)).toThrow('No es un archivo MusicXML');
  });
  it('varias partes, repeticiones y cambios de tempo generan avisos; instrumento por nombre', () => {
    const m = `<direction><sound tempo="90"/></direction>${n('C', 4, 8)}<direction><sound tempo="120"/></direction>${n('D', 4, 8)}<barline><repeat direction="backward"/></barline></measure>`;
    const r = parseMusicXML(
      xml(m, undefined, '<score-part id="P2"><part-name>Piano</part-name></score-part>').replace(
        '</part></score-partwise>',
        '</part><part id="P2"><measure number="1"></measure></part></score-partwise>',
      ),
      dom,
    );
    expect(r.warnings.map((w) => w.code).sort()).toEqual(['parts_more', 'repeats_ignored', 'tempo_changes']);
    expect([r.tempo, r.instrumentId, r.title]).toEqual([90, 'flauta', 'Prueba']);
  });
});

describe('utilidades', () => {
  it('decodeText: UTF-8 con BOM, UTF-16LE y Latin-1 declarado (T-TXT-01)', () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x43, 0xc3, 0xa1]))).toBe('Cá');
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x43, 0x00, 0xe1, 0x00]))).toBe('Cá');
    const latin = new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><a>C');
    expect(decodeText(new Uint8Array([...latin, 0xe1]))).toContain('Cá');
  });
  it('guessInstrument (T-MXI-04)', () => {
    expect(['Alto Sax', 'Soprano Recorder', 'Violoncello', 'Electric Bass', 'Banjo'].map(guessInstrument)).toEqual([
      'saxalto',
      'flautadulce',
      'cello',
      'bajo',
      null,
    ]);
    expect(getInstrument('flautadulce').name).toBe('Flauta dulce soprano');
  });
});
