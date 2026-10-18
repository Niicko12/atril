import { INSTRUMENTS, clefFor, displayName, getInstrument, isTransposing } from '.';
import { buildAbc } from '../notation';

describe('catálogo (T-INS-*)', () => {
  it('19 instrumentos con ids únicos, rango válido y cuerdas dentro del rango', () => {
    expect(INSTRUMENTS).toHaveLength(19);
    expect(new Set(INSTRUMENTS.map((i) => i.id)).size).toBe(19);
    for (const i of INSTRUMENTS) {
      expect(i.low, i.id).toBeLessThan(i.high);
      for (const s of i.strings ?? []) expect(s >= i.low && s <= i.high, `${i.id} ${s}`).toBe(true);
    }
  });
  it('id desconocido → piano', () => expect(getInstrument('xyz').id).toBe('piano'));
  it('displayName', () => expect(displayName(getInstrument('saxalto'))).toBe('Saxofón alto en Mib'));
  it('flauta dulce: Do5 real se escribe Do4, misma armadura (T-INS-04)', () => {
    const fd = getInstrument('flautadulce');
    expect(isTransposing(fd)).toBe(true);
    const r = buildAbc({ title: 't', composer: '', key: 1, meter: '4/4', tempo: 100, notes: [{ p: 72, d: 4 }] }, fd, 'written');
    expect(r.fifths).toBe(1);
    expect(r.abc.split('\n').pop()).toBe('C4|]');
    expect(r.abc).toContain('T:Flauta dulce soprano · suena una octava arriba de como se escribe');
  });
});

describe('clefFor (T-CLF-01)', () => {
  const piano = getInstrument('piano');
  it('auto por promedio', () => {
    expect(clefFor(piano, [{ p: 56, d: 4 }, { p: 57, d: 4 }], 0)).toBe('bass'); // 56,5 < 57
    expect(clefFor(piano, [], 0)).toBe('treble');
  });
  it('fijas', () => {
    expect(clefFor(getInstrument('viola'), [], 0)).toBe('alto');
    expect(clefFor(getInstrument('tuba'), [{ p: 80, d: 4 }], 0)).toBe('bass');
  });
});
