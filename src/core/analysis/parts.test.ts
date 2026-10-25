import { analyzeParts, attachChords, chordsFor, skyline, splitParts, timelineIndex, type PolyNote } from './index';
const note = (m: number, t0 = 0, t1 = 1): PolyNote => ({ m, t0, t1, amplitude: 0.8 });
const mixture = () => [0, 1, 2, 3].flatMap((i) => [note(60 + i * 2, i, i + 0.9), note(36 + i, i, i + 0.9)]);

describe('skyline y partes', () => {
  it('ordena simultáneas, preserva originales y elige el extremo', () => {
    const events = [note(60), note(72), note(48)];
    expect(skyline(events, true).map((n) => n.m)).toEqual([72]);
    expect(skyline(events, false).map((n) => n.m)).toEqual([48]);
    expect(events[0]?.t1).toBe(1);
  });
  it('corta al llegar una nota mejor, reemplaza casi simultáneas y continúa notas largas', () => {
    expect(skyline([note(60, 0, 1), note(72, 0.5, 1.5)], true)[0]?.t1).toBe(0.5);
    expect(skyline([note(60, 0, 1), note(72, 0.03, 1.5)], true)).toEqual([note(72, 0.03, 1.5)]);
    expect(skyline([note(72, 0, 1), note(60, 0.2, 2)], true)[1]?.t0).toBe(1);
    expect(skyline([note(72, 0, 1), note(60, 0.02, 2)], true)).toHaveLength(1);
    expect(skyline([note(60, 0, 0.02)], true)).toEqual([]);
  });
  it('MIDI 53 y 54 participan sin huecos; no ofrece bajo si no es distinto', () => {
    expect(splitParts([note(53, 0, 0.5), note(54, 0.5, 1)]).melody.map((n) => n.m)).toEqual([53, 54]);
    expect(splitParts([note(60), note(57)]).bass).toEqual([]);
    expect(splitParts([])).toEqual({ melody: [], bass: [] });
  });
  it('separa todas las notas de una mezcla sintética con un origen compartido', () => {
    const result = analyzeParts(mixture());
    expect(result?.parts.map((p) => p.id)).toEqual(['mel', 'bass']);
    expect(result?.parts[0]?.raw.map((n) => n.m)).toEqual([60, 62, 64, 66]);
    expect(result?.parts[1]?.raw.map((n) => n.m)).toEqual([36, 37, 38, 39]);
    expect(result?.origin).toBe(0);
    expect(result?.parts[1]?.instrumentId).toBe('bajo');
  });
  it('descarta entradas inválidas y no ofrece menos de tres notas por parte', () => {
    expect(analyzeParts([note(60)])).toBeNull();
    expect(analyzeParts([note(NaN), note(110), note(60, 1, 0), note(40)])).toBeNull();
    expect(analyzeParts([note(60), note(64), note(67), note(72)])?.parts).toEqual([]);
    expect(analyzeParts([0, 1, 2, 3].map((i) => note(60 + i, i, i + 0.8)))?.parts).toHaveLength(1);
  });
});
describe('cifrado', () => {
  it('reconoce Do mayor, La menor y elimina repeticiones consecutivas', () => {
    expect(
      chordsFor(
        [60, 64, 67].map((m) => note(m, 0, 2)),
        120,
        0,
        0,
      ),
    ).toEqual([{ u: 0, name: 'Do' }]);
    expect(
      chordsFor(
        [57, 60, 64].map((m) => note(m)),
        120,
        0,
        0,
      )[0]?.name,
    ).toBe('Lam');
  });
  it('reconoce séptimas y disminuidos; usa bemoles en tonalidad negativa', () => {
    expect(
      chordsFor(
        [48, 60, 64, 67, 70].map((m) => note(m)),
        120,
        0,
        0,
      )[0]?.name,
    ).toBe('Do7');
    expect(
      chordsFor(
        [48, 60, 63, 67, 70].map((m) => note(m)),
        120,
        0,
        0,
      )[0]?.name,
    ).toBe('Dom7');
    expect(
      chordsFor(
        [60, 63, 66].map((m) => note(m)),
        120,
        0,
        0,
      )[0]?.name,
    ).toBe('Dodim');
    expect(
      chordsFor(
        [61, 65, 68].map((m) => note(m)),
        120,
        0,
        -1,
      )[0]?.name,
    ).toBe('Re♭');
    expect(
      chordsFor(
        [61, 65, 68].map((m) => note(m)),
        120,
        0,
        1,
      )[0]?.name,
    ).toBe('Do♯');
  });
  it('silencio, peso nulo, eventos sin amplitud y tempos inválidos', () => {
    expect(chordsFor([], 120, 0, 0)).toEqual([]);
    expect(chordsFor([note(60)], 0, 0, 0)).toEqual([]);
    expect(chordsFor([note(60)], NaN, 0, 0)).toEqual([]);
    expect(chordsFor([{ ...note(60), amplitude: 0 }], 120, 0, 0)).toEqual([]);
    expect(chordsFor([{ m: 60, t0: 2, t1: 3 }], 120, 0, 0)).toEqual([{ u: 16, name: 'Do' }]);
  });
  it('asocia al inicio cercano sin mutar ni sobrescribir cifrados existentes', () => {
    const notes = [
      { p: 60, d: 4 },
      { p: 62, d: 4, c: 'Sol' },
      { p: 64, d: 4 },
    ];
    const out = attachChords(notes, [
      { u: 0, name: 'Do' },
      { u: 8, name: 'Fa' },
      { u: 40, name: 'Lam' },
    ]);
    expect(out.map((n) => n.c)).toEqual(['Do', 'Sol', 'Fa']);
    expect(notes[0]).not.toHaveProperty('c');
    expect(attachChords([], [{ u: 0, name: 'Do' }])).toEqual([]);
  });
});
it('seguimiento: límites semiabiertos, silencios y fin', () => {
  const timeline = [
    { index: 0, t0: 1, t1: 2 },
    { index: 2, t0: 3, t1: 4 },
  ];
  expect([0, 1, 1.23, 2, 2.9, 3, 4].map((t) => timelineIndex(timeline, t))).toEqual([-1, 0, 0, -1, -1, 2, -1]);
  expect(timelineIndex([], 1)).toBe(-1);
  expect(timelineIndex(timeline, NaN)).toBe(-1);
});
