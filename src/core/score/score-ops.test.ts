import {
  cursorUnits,
  insertOrReplace,
  nearestMidiForLetter,
  octaveAt,
  outOfRangeIndices,
  referencePitch,
  removeAt,
  setDurationAt,
  shiftKey,
  shiftNotes,
} from './score-ops';
import type { Note } from '../types';

const N = (p: number | null, d = 4, c?: string): Note => (c ? { p, d, c } : { p, d });

describe('insertOrReplace (T-OPS-01..04)', () => {
  it('agrega al final sin selección', () =>
    expect(insertOrReplace([], -1, 60, 4)).toEqual({ notes: [N(60)], selection: -1, lastIndex: 0 }));
  it('reemplaza en medio: cambia p, no d, avanza', () => {
    const r = insertOrReplace([N(60, 2), N(62, 8), N(64)], 1, 67, 4);
    expect(r.notes[1]).toEqual(N(67, 8));
    expect([r.selection, r.lastIndex]).toEqual([2, 1]);
  });
  it('reemplazar la última deja sin selección', () =>
    expect(insertOrReplace([N(60), N(62)], 1, 64, 4).selection).toBe(-1));
  it('conserva el cifrado', () => expect(insertOrReplace([N(60, 4, 'Do')], 0, 62, 4).notes[0]).toEqual(N(62, 4, 'Do')));
  it('silencio con selección', () => expect(insertOrReplace([N(60)], 0, null, 4).notes[0]?.p).toBeNull());
});

describe('removeAt (T-OPS-05..07, E1..E3)', () => {
  it('sin selección quita la última', () =>
    expect(removeAt([N(60), N(62)], -1)).toEqual({ notes: [N(60)], selection: -1 }));
  it('última seleccionada → selección pasa a la anterior', () =>
    expect(removeAt([N(60), N(62), N(64)], 2).selection).toBe(1));
  it('en medio → misma posición', () =>
    expect(removeAt([N(60), N(62), N(64)], 1)).toEqual({ notes: [N(60), N(64)], selection: 1 }));
  it('única nota → vacía y sin selección', () => expect(removeAt([N(60)], 0)).toEqual({ notes: [], selection: -1 }));
  it('vacía → sin efecto', () => expect(removeAt([], -1)).toEqual({ notes: [], selection: -1 }));
});

describe('mover todo y tonalidad (T-OPS-08..13, E8)', () => {
  it('sin recorte', () => expect(shiftNotes([N(60), N(null)], 1)).toEqual({ notes: [N(61), N(null)], clipped: 0 }));
  it('recorta Do8 y lo cuenta', () =>
    expect(shiftNotes([N(108), N(100)], 12)).toEqual({ notes: [N(108), N(108)], clipped: 2 }));
  it('silencios intactos', () => expect(shiftNotes([N(null, 4)], 5).notes[0]).toEqual(N(null, 4)));
  it.each([
    [0, 1, -5],
    [0, -1, 5],
    [3, 12, 3],
    [3, -12, 3],
  ])('shiftKey(%i, %i) = %i', (k, s, out) => expect(shiftKey(k, s)).toBe(out));
});

describe('octaveAt (T-OPS-14, E7)', () => {
  it('sube una octava', () => expect(octaveAt([N(60)], 0, 1)).toEqual({ notes: [N(72)], changed: true }));
  it('si la octava no cabe no cambia (Sol♯7 no pasa a Do8)', () =>
    expect(octaveAt([N(104)], 0, 1)).toEqual({ notes: [N(104)], changed: false }));
  it('baja una octava desde Do8', () => expect(octaveAt([N(108)], 0, -1).notes[0]?.p).toBe(96));
  it('silencio no cambia', () => expect(octaveAt([N(null)], 0, 1).changed).toBe(false));
});

describe('Do-Re-Mi (T-OPS-15/16, E10..E12)', () => {
  it('Re cerca de Do4', () => expect(nearestMidiForLetter('D', 0, 60)).toBe(62));
  it('Si cerca de Do4 → Si3', () => expect(nearestMidiForLetter('B', 0, 60)).toBe(59));
  it('empate → la más grave', () => expect(nearestMidiForLetter('C', 0, 66)).toBe(60));
  it('referencia: seleccionada con tono, si no la última con tono, si no Do4', () => {
    expect(referencePitch([N(50), N(70)], 0)).toBe(50);
    expect(referencePitch([N(50), N(null)], 1)).toBe(50);
    expect(referencePitch([], -1)).toBe(60);
  });
});

describe('varios (T-OPS-17..20)', () => {
  it('cursorUnits', () => {
    expect([16, 8, 4, 2, 1].map((base) => cursorUnits({ base: base as 4, dot: true }))).toEqual([24, 12, 6, 3, 1]);
    expect(cursorUnits({ base: 4, dot: false })).toBe(4);
  });
  it('inmutabilidad: las notas no tocadas conservan la referencia', () => {
    const notes = [N(60), N(62)];
    const r = setDurationAt(notes, 1, 8);
    expect(r[0]).toBe(notes[0]);
    expect(notes[1]?.d).toBe(4);
  });
  it('fuera de rango ignora silencios', () =>
    expect(outOfRangeIndices([N(30), N(null), N(60), N(99)], 55, 96)).toEqual([0, 3]));
});
