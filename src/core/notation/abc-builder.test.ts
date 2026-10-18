import { buildAbc } from '.';
import { getInstrument } from '../instruments';
import type { MeterId, Note } from '../types';

const piano = getInstrument('piano');
const base = { title: 'T', composer: '', key: 0, meter: '4/4' as MeterId, tempo: 100 };
const body = (notes: Note[], over: Partial<typeof base> = {}) =>
  buildAbc({ ...base, ...over, notes }, piano, 'written')
    .abc.split('\n')
    .pop();

describe('buildAbc (notation-core 10)', () => {
  it('partitura vacía (T-ABC-01)', () => expect(body([])).toBe('x16|]'));
  it('D1: la continuación ligada lleva la alteración (T-ABC-02)', () => {
    expect(
      body([
        { p: 60, d: 12 },
        { p: 61, d: 8 },
      ]),
    ).toBe('C12 ^C4-| ^C4|]');
  });
  it('D1: en Fa mayor el La♭ ligado conserva el bemol', () => {
    expect(
      body(
        [
          { p: 68, d: 8 },
          { p: 68, d: 16 },
        ],
        { key: -1 },
      ),
    ).toBe('_A8 A8-| _A8|]');
  });
  it('alteraciones dentro del compás (C6, C7, C8, T-ABC-03)', () => {
    expect(
      body([
        { p: 66, d: 4 },
        { p: 66, d: 4 },
        { p: 65, d: 4 },
        { p: 78, d: 4 },
      ]),
    ).toBe('^F4 F4 =F4 ^f4|]');
  });
  it('D2: % eliminado del título; saltos de línea a espacio; título vacío (T-ABC-04)', () => {
    expect(buildAbc({ ...base, title: 'A%B', notes: [] }, piano, 'written').abc).toContain('T:AB\n');
    expect(buildAbc({ ...base, title: 'Canción\n2', notes: [] }, piano, 'written').abc).toContain('T:Canción 2\n');
    expect(buildAbc({ ...base, title: '', notes: [] }, piano, 'written').abc).toContain('T:Sin título\n');
  });
  it('cifrado sin comillas, antes del nombre (C15, C17, T-ABC-05)', () => {
    const r = buildAbc(
      {
        ...base,
        notes: [
          { p: 60, d: 4, c: 'Do"m' },
          { p: null, d: 4 },
        ],
      },
      piano,
      'written',
      { names: true },
    );
    expect(r.abc.split('\n').pop()).toBe('"^Dom""_Do"C4 z4|]');
  });
  it('determinista y con todas las notas en el charMap (N5, N6, T-ABC-07/08)', () => {
    const notes = [
      { p: 60, d: 20 },
      { p: null, d: 3 },
      { p: 72, d: 1 },
    ];
    const a = buildAbc({ ...base, notes }, piano, 'written');
    const b = buildAbc({ ...base, notes }, piano, 'written');
    expect(a.abc).toBe(b.abc);
    expect(new Set(a.charMap.values())).toEqual(new Set([0, 1, 2]));
  });
  it('6/8 agrupa cada 6 semicorcheas (T-ABC-09)', () => {
    expect(
      body(
        [
          { p: 60, d: 2 },
          { p: 62, d: 2 },
          { p: 64, d: 2 },
          { p: 65, d: 2 },
          { p: 67, d: 2 },
          { p: 69, d: 2 },
        ],
        { meter: '6/8' },
      ),
    ).toBe('C2D2E2 F2G2A2|]');
  });
  it('nombre de la parte (T-ABC-10)', () => {
    const sax = getInstrument('saxalto');
    expect(buildAbc({ ...base, notes: [] }, sax, 'concert').abc).toContain('T:Saxofón alto en Mi♭ · sonido real');
    expect(buildAbc({ ...base, notes: [] }, getInstrument('guitarra'), 'written').abc).toContain(
      'T:Guitarra · escrita una octava arriba de como suena',
    );
  });
});
