import { emptyScore, getInstrument, MAX_NOTES, parseMidi, toMidi, validateScore, type Note } from '@/core';
import { deleteNote, dragNote, insertNote, pitchRange, sameNotes, timeline } from './draft';

const notes: Note[] = [
  { p: 60, d: 4, c: 'Am' },
  { p: null, d: 4 },
  { p: 67, d: 8 },
];
describe('borrador visual monofónico', () => {
  it('mantiene tiempos consecutivos con silencios y duraciones de varias unidades', () => {
    expect(timeline(notes).map(({ start, end }) => [start, end])).toEqual([
      [0, 4],
      [4, 8],
      [8, 16],
    ]);
  });
  it('reordena y cambia altura conservando cifrado y notas originales', () => {
    const before = structuredClone(notes);
    const next = dragNote(notes, 0, { units: 10, steps: -2, resize: false });
    expect(next.selection).toBe(2);
    expect(next.notes).toEqual([
      { p: null, d: 4 },
      { p: 67, d: 8 },
      { p: 62, d: 4, c: 'Am' },
    ]);
    expect(notes).toEqual(before);
  });
  it('un movimiento corto no reordena y los silencios no adquieren tono al arrastrar', () => {
    expect(dragNote(notes, 0, { units: 1, steps: 0, resize: false }).selection).toBe(0);
    expect(dragNote(notes, 1, { units: 0, steps: -20, resize: false }).notes[1]?.p).toBeNull();
  });
  it('redimensiona en semicorcheas sin perder cifrado y respeta los límites', () => {
    const next = dragNote(notes, 0, { units: 4, steps: 99, resize: true });
    expect(next.notes[0]).toEqual({ p: 60, d: 8, c: 'Am' });
    expect(timeline(next.notes)[1]?.start).toBe(8);
    expect(dragNote(notes, 0, { units: -99, steps: 0, resize: true }).notes[0]?.d).toBe(1);
    expect(dragNote(notes, 0, { units: 99, steps: 0, resize: true }).notes[0]?.d).toBe(48);
  });
  it('permite los extremos MIDI importados sin recortarlos al rango instrumental', () => {
    const extreme = [
      { p: 0, d: 4 },
      { p: 127, d: 4 },
    ];
    expect(pitchRange(extreme)).toEqual({ low: 0, high: 127 });
    expect(dragNote(extreme, 0, { units: 0, steps: 20, resize: false }).notes[0]?.p).toBe(0);
    expect(dragNote(extreme, 1, { units: 0, steps: -20, resize: false }).notes[1]?.p).toBe(127);
  });
  it('empieza vacío, borra la última y no supera el límite de eventos', () => {
    const first = insertNote([], 0, 60);
    expect(first).toEqual({ notes: [{ p: 60, d: 4 }], selection: 0 });
    expect(deleteNote(first.notes, 0)).toEqual({ notes: [], selection: -1 });
    const full = Array.from({ length: MAX_NOTES }, () => ({ p: 60, d: 4 }));
    expect(insertNote(full, -1, null).notes).toHaveLength(MAX_NOTES);
  });
  it('detecta cambios de cifrado y el borrador aplicado sigue exportándose como MIDI', () => {
    expect(sameNotes(notes, structuredClone(notes))).toBe(true);
    expect(
      sameNotes(
        notes,
        notes.map((n) => ({ ...n, c: 'G' })),
      ),
    ).toBe(false);
    const result = dragNote(notes, 0, { units: 0, steps: -5, resize: false });
    const score = { ...emptyScore('piano'), notes: result.notes };
    expect(() => validateScore(score)).not.toThrow();
    expect(
      parseMidi(toMidi(score, getInstrument('piano')).buffer as ArrayBuffer).notes.map(({ p, d }) => ({ p, d })),
    ).toEqual([
      { p: 65, d: 4 },
      { p: null, d: 4 },
      { p: 67, d: 8 },
    ]);
  });
});
