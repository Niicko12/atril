import { measureCount, meterOf, splitDuration, toMeasures } from '.';

describe('splitDuration (T-MEA-01)', () => {
  it.each([
    [16, [16]],
    [10, [8, 2]],
    [7, [6, 1]],
    [5, [4, 1]],
    [24, [16, 8]],
  ])('%i', (u, parts) => expect(splitDuration(u)).toEqual(parts));
});

describe('toMeasures', () => {
  it('ejemplo 9.4: Do♯ ligado sobre la barra (T-MEA-02)', () => {
    const m = toMeasures(
      [
        { p: 60, d: 12 },
        { p: 61, d: 8 },
      ],
      meterOf('4/4'),
    );
    expect(m).toEqual([
      [
        { idx: 0, p: 60, d: 12, first: true, last: true, pos: 0 },
        { idx: 1, p: 61, d: 4, first: true, last: false, pos: 12 },
      ],
      [{ idx: 1, p: 61, d: 4, first: false, last: true, pos: 0 }],
    ]);
  });
  it('propiedades: ningún compás excede la barra y se conserva la duración total (T-MEA-04/05)', () => {
    const notes = Array.from({ length: 200 }, (_, i) => ({ p: i % 5 ? 60 + (i % 12) : null, d: 1 + ((i * 7) % 23) }));
    for (const id of ['4/4', '3/4', '2/4', '6/8', '3/8', '12/8']) {
      const meter = meterOf(id);
      const ms = toMeasures(notes, meter);
      for (const m of ms) expect(m.reduce((a, p) => a + p.d, 0)).toBeLessThanOrEqual(meter.bar);
      expect(ms.flat().reduce((a, p) => a + p.d, 0)).toBe(notes.reduce((a, n) => a + n.d, 0));
    }
  });
  it('measureCount', () => expect(measureCount([{ p: 60, d: 17 }], meterOf('4/4'))).toBe(2));
});
