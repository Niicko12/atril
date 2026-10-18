import { readFileSync } from 'node:fs';
import abcjs from 'abcjs';
import { parseAbcTune, type AbcTuneLike } from './abc-import';
import type { Note } from '../types';

interface Golden {
  abc: Record<string, { abc: string }>;
  abcImport: Record<
    string,
    { notes?: Note[]; key?: number; meter?: string; tempo?: number; title?: string; error?: string }
  >;
}
const golden = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/golden/core.json', import.meta.url), 'utf8'),
) as Golden;
const parse = (text: string) => parseAbcTune(abcjs.parseOnly(text)[0] as unknown as AbcTuneLike);
const notes = (r: { notes: Note[] }) => r.notes.map((x) => `${x.p ?? 'r'}:${x.d}`).join(' ');
const codes = (r: { warnings: { code: string }[] }) => r.warnings.map((w) => w.code).sort();

describe('dorados contra el importador ABC de legacy', () => {
  it('216 salidas ABC de legacy: mismas notas, tonalidad, compás, tempo y título', () => {
    for (const [k, g] of Object.entries(golden.abcImport)) {
      const text = golden.abc[k]!.abc;
      if (g.error) {
        expect(() => parse(text), k).toThrow();
        continue;
      }
      const r = parse(text);
      expect({ notes: r.notes, key: r.key, meter: r.meter, tempo: r.tempo, title: r.title }, k).toEqual(g);
    }
  });
});

describe('casos de formats-spec 14 (T-ABC-I-*)', () => {
  it('X25 acorde → nota más aguda + aviso', () => {
    const r = parse('X:1\nM:4/4\nL:1/4\nK:C\n[CEG] z3|');
    expect([notes(r), codes(r)]).toEqual(['67:4 r:12', ['polyphony_reduced']]);
  });
  it('tresillos de corchea: el compás suma 16 y avisa (T-ABC-I-02)', () => {
    const r = parse('X:1\nM:4/4\nL:1/8\nK:C\n(3CDE (3FGA (3Bcd (3efg|');
    expect(r.notes.reduce((a, n) => a + n.d, 0)).toBe(16);
    expect(codes(r)).toContain('tuplets_rounded');
  });
  it('X24 repeticiones: tal como está escrita + aviso', () => {
    expect(codes(parse('X:1\nM:2/4\nL:1/4\nK:C\n|:C D:|'))).toEqual(['repeats_ignored']);
  });
  it('cambio de K: a mitad (T-ABC-I-03), tempo y metadatos', () => {
    const r = parse('X:1\nT:Canción\nC:Anónimo\nM:3/4\nL:1/4\nQ:1/8=180\nK:G\nF G A|[K:F] B c d|');
    expect(notes(r)).toBe('66:4 67:4 69:4 70:4 72:4 74:4');
    expect([r.title, r.composer, r.meter, r.tempo, r.key]).toEqual(['Canción', 'Anónimo', '3/4', 90, 1]);
  });
  it('ligadura y alteración que dura el compás', () => {
    expect(notes(parse('X:1\nM:4/4\nL:1/4\nK:C\n^F2- F2 | F4|'))).toBe('66:16 65:16');
  });
  it('sin notas o árbol vacío → error', () => {
    expect(() => parse('X:1\nK:C\nz4|')).toThrow('No se encontraron notas');
    expect(() => parseAbcTune(undefined)).toThrow('No se pudo leer');
  });
});

describe('compás que no se puede leer', () => {
  it('getMeterFraction que lanza → 4/4', () => {
    const tune = {
      lines: [{ staff: [{ voices: [[{ el_type: 'note', duration: 0.25, pitches: [{ pitch: 0 }] }]] }] }],
      getMeterFraction: () => {
        throw new Error('x');
      },
    };
    expect(parseAbcTune(tune).meter).toBe('4/4');
  });
});

describe('ABC: más bordes', () => {
  it('armadura con bemoles, becuadro y tempo sin unidad', () => {
    const r = parse('X:1\nL:1/4\nQ:100\nK:F\nB =B c|');
    expect([notes(r), r.key, r.tempo]).toEqual(['70:4 71:4 72:4', -1, 100]);
  });
  it('líneas sin pentagrama o sin voces se ignoran', () => {
    const tune = {
      lines: [
        {},
        { staff: [{}] },
        { staff: [{ voices: [[{ el_type: 'note', duration: 0.25, pitches: [{ pitch: 2 }] }]] }] },
      ],
    };
    expect(parseAbcTune(tune).notes).toEqual([{ p: 64, d: 4 }]);
  });
  it('silencio invisible y nota sin alturas se ignoran; silencio corta la ligadura', () => {
    const tune = {
      lines: [
        {
          staff: [
            {
              voices: [
                [
                  { el_type: 'note', duration: 0.25, rest: { type: 'spacer' } },
                  { el_type: 'note', duration: 0.25, pitches: [] },
                  { el_type: 'note', duration: 0.25, pitches: [{ pitch: 0, startTie: {} }] },
                  { el_type: 'note', duration: 0.25, rest: { type: 'rest' } },
                  { el_type: 'note', duration: 0.25, pitches: [{ pitch: 0 }] },
                ],
              ],
            },
          ],
        },
      ],
    };
    expect(parseAbcTune(tune).notes).toEqual([
      { p: 60, d: 4 },
      { p: null, d: 4 },
      { p: 60, d: 4 },
    ]);
  });
});
