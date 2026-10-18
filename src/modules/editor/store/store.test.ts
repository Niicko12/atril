import { emptyScore, fromSample, SAMPLES, type Sample } from '@/core';
import { playbackEngine } from '@/modules/playback';
import { useToastStore } from '@/shared/toast';
import { HISTORY_LIMIT, pushSnapshot } from './history';
import { useScoreStore } from './score.store';
import { initialState } from './state';

const store = () => useScoreStore.getState();
const notes = () => store().score.notes.map((n) => n.p);
const reset = () => useScoreStore.setState(initialState(emptyScore('piano')));

beforeEach(() => {
  reset();
  useToastStore.getState().clear();
  vi.restoreAllMocks();
});

describe('acciones (T-STO-*)', () => {
  it('addNote detiene el sonido, sube revision y marca dirty (T-STO-01/02)', () => {
    const stop = vi.spyOn(playbackEngine, 'stopAll');
    store().addNote(60);
    expect(stop).toHaveBeenCalled();
    expect([store().revision, store().dirty, notes()]).toEqual([1, true, [60]]);
  });
  it('setDuration sin selección no entra al historial; con semicorchea apaga el puntillo (T-STO-03/04)', () => {
    store().toggleDot();
    store().setDuration(1);
    expect(store().cursor).toEqual({ base: 1, dot: false });
    expect(store().past).toHaveLength(0);
  });
  it('toggleDot con semicorchea no hace nada (T-STO-05)', () => {
    store().setDuration(1);
    store().toggleDot();
    expect(store().cursor.dot).toBe(false);
  });
  it('duración con selección cambia la nota seleccionada', () => {
    store().addNote(60);
    store().select(0);
    store().setDuration(8);
    store().toggleDot();
    expect(store().score.notes[0]?.d).toBe(12);
  });
  it('cambiar a un instrumento no transpositor vuelve a la vista escrita (T-STO-06/07)', () => {
    store().setMeta({ instrumentId: 'clarinete' });
    store().setView('concert');
    expect(store().view).toBe('concert');
    store().setMeta({ instrumentId: 'piano' });
    expect(store().view).toBe('written');
    store().setView('concert');
    expect(store().view).toBe('written');
  });
  it('shiftAll informa recortes y cambia la tonalidad (T-STO-08)', () => {
    store().addNote(108);
    store().addNote(60);
    expect(store().shiftAll(1)).toEqual({ clipped: 1 });
    expect([notes(), store().score.key]).toEqual([[108, 61], -5]);
  });
  it('replaceScore limpia historial y selección; con partitura inválida lanza (T-STO-09/10)', () => {
    store().addNote(60);
    store().select(0);
    store().replaceScore(fromSample(SAMPLES[1] as Sample, 'piano'));
    expect([store().past.length, store().selection, store().dirty]).toEqual([0, -1, false]);
    expect(store().loadedRevision).toBe(store().revision);
    expect(() => store().replaceScore({ ...emptyScore('piano'), tempo: 999 })).toThrow();
  });
  it('markSaved no sube revision (T-STO-11)', () => {
    store().addNote(60);
    const rev = store().revision;
    store().markSaved('2026-10-18T00:00:00Z');
    expect([store().revision, store().dirty, store().score.savedAt]).toEqual([rev, false, '2026-10-18T00:00:00Z']);
  });
  it('límite de 3 000 notas sin selección muestra aviso (T-STO-12, E18)', () => {
    useScoreStore.setState({
      score: { ...emptyScore('piano'), notes: Array.from({ length: 3000 }, () => ({ p: 60, d: 1 })) },
    });
    store().addNote(62);
    expect(store().score.notes).toHaveLength(3000);
    expect(useToastStore.getState().message).toContain('3 000');
  });
  it('octaveLast sin notas con tono no hace nada; en el límite avisa (T-STO-13, E7)', () => {
    store().addNote(null);
    store().octaveLast(1);
    expect(store().past).toHaveLength(1);
    store().addNote(104);
    store().octaveLast(1);
    expect(useToastStore.getState().message).toContain('límite');
  });
  it('moveSelection (T-STO-14)', () => {
    [60, 62, 64].forEach((p) => store().addNote(p));
    store().moveSelection(-1);
    expect(store().selection).toBe(2);
    store().moveSelection(-1);
    store().moveSelection(1);
    store().moveSelection(1);
    expect(store().selection).toBe(-1);
  });
  it('alteración pendiente alterna y la octava del teclado se limita a 2..6 (T-STO-15/16)', () => {
    store().setPendingAccidental(1);
    store().setPendingAccidental(1);
    expect(store().pendingAccidental).toBeNull();
    for (let i = 0; i < 5; i++) store().setKeyboardOctave(1);
    expect(store().keyboardOctave).toBe(6);
  });
});

describe('historial (T-HIS-*)', () => {
  it('deshacer y rehacer; una acción nueva vacía el futuro (T-HIS-01..03)', () => {
    store().addNote(60);
    store().addNote(62);
    store().undo();
    expect(notes()).toEqual([60]);
    store().redo();
    expect(notes()).toEqual([60, 62]);
    store().undo();
    store().addNote(64);
    expect(store().future).toHaveLength(0);
  });
  it('máximo 200 pasos (T-HIS-04)', () => {
    let s = initialState(emptyScore('piano'));
    for (let i = 0; i < 201; i++) s = { ...s, ...pushSnapshot(s, i * 5000) };
    expect(s.past).toHaveLength(HISTORY_LIMIT);
  });
  it('ráfaga de título = 1 paso; otro campo cierra el grupo (T-HIS-05..07)', () => {
    const now = vi.spyOn(Date, 'now');
    'Hola mundo'.split('').forEach((_, i) => {
      now.mockReturnValue(1000 + i * 80);
      store().setMeta({ title: 'Hola mundo'.slice(0, i + 1) });
    });
    expect(store().past).toHaveLength(1);
    now.mockReturnValue(1900);
    store().setMeta({ tempo: 120 });
    expect(store().past).toHaveLength(2);
    store().undo();
    store().undo();
    expect(store().score.title).toBe('Mi canción');
  });
  it('deshacer restaura metadatos (T-HIS-09) y avisa si no hay pasos', () => {
    store().setMeta({ instrumentId: 'saxalto' });
    store().undo();
    expect(store().score.instrumentId).toBe('piano');
    store().undo();
    expect(useToastStore.getState().message).toBe('Nada que deshacer');
  });
  it('deshacer con selección fuera de rango la quita (T-HIS-08)', () => {
    store().addNote(60);
    store().addNote(62);
    store().select(1);
    store().deleteNote();
    store().addNote(64);
    store().select(1);
    store().undo();
    store().undo();
    expect(store().selection).toBe(-1);
  });
});
