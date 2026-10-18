import {
  abcPitch,
  keyAccidentals,
  keyName,
  keyOptionLabel,
  midiName,
  noteName,
  normalizeFifths,
  spell,
  writtenFifths,
} from '.';

describe('armaduras (notation-core 4)', () => {
  it('keyAccidentals', () => {
    expect(keyAccidentals(2)).toMatchObject({ F: 1, C: 1, G: 0 });
    expect(keyAccidentals(-3)).toMatchObject({ B: -1, E: -1, A: -1, D: 0 });
  });
  it('normalizeFifths (T-KEY-03)', () => {
    expect([-6, 6, 7, -7, 13].map(normalizeFifths)).toEqual([6, 6, -5, 5, 1]);
  });
  it('writtenFifths: tabla 4.4 (T-KEY-04)', () => {
    expect(writtenFifths(0, 2)).toBe(2);
    expect(writtenFifths(-3, 2)).toBe(-1);
    expect(writtenFifths(0, 9)).toBe(3);
    expect(writtenFifths(-1, 7)).toBe(0);
    expect(writtenFifths(2, 14)).toBe(4);
    expect(writtenFifths(1, 12)).toBe(1);
    expect(writtenFifths(-6, 2)).toBe(-4);
    expect(writtenFifths(3, -12)).toBe(3); // flauta dulce
  });
  it('nombres (T-KEY-05)', () => {
    expect(keyName(-3)).toBe('Mi♭ mayor');
    expect(keyOptionLabel(-3)).toBe('Mi♭ mayor / Do menor');
  });
});

describe('spell (notation-core 5.3, T-SPL-01/03)', () => {
  const s = (m: number, f: number) => {
    const x = spell(m, f);
    return noteName(x) + x.octave;
  };
  it.each([
    [61, 0, 'Do♯4'],
    [70, -1, 'Si♭4'],
    [65, 6, 'Mi♯4'],
    [71, -6, 'Do♭5'],
    [66, -1, 'Sol♭4'],
    [60, 7, 'Si♯3'],
  ])('%i en %i → %s', (m, f, expected) => expect(s(m, f)).toBe(expected));
});

describe('abcPitch y nombres (T-SPL-04, T-NAM-*)', () => {
  it('octavas', () => {
    expect([2, 3, 4, 5, 6, 7].map((o) => abcPitch('C', o))).toEqual(['C,,', 'C,', 'C', 'c', "c'", "c''"]);
  });
  it('midiName usa ♯/♭ Unicode', () => {
    expect(midiName(61)).toBe('Do♯4');
    expect(midiName(70, -1)).toBe('Si♭4');
  });
});

describe('valores fuera de tabla', () => {
  it('abcKey y keyName con armadura inválida usan Do', async () => {
    const { abcKey } = await import('.');
    expect(abcKey(99)).toBe('C');
    expect(keyName(99)).toBe('Do mayor');
  });
});
