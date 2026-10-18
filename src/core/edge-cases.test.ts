// Casos límite de las specs que no cubren los dorados.
import { decimate } from './analysis/downmix';
import { detectMelodyMix } from './analysis/melody-mix';
import { quantize } from './analysis/quantize';
import { segmentNotes } from './analysis/segment';
import { guessKey, guessTempo } from './analysis/tempo-key';
import { wsola } from './analysis/wsola';
import { finalize, pickMeter } from './formats/import-common';
import { toMonophonic } from './formats/mono';
import { parseMidi } from './formats/midi-import';
import { measureCount, meterOf, splitDuration } from './rhythm';

describe('análisis: bordes', () => {
  it('decimate con factor 1 devuelve la misma señal', () => {
    const x = new Float32Array([1, 2, 3]);
    expect(decimate(x, 1)).toBe(x);
  });
  it('mezcla con audio demasiado corto → sin notas', () =>
    expect(detectMelodyMix(new Float32Array(1000), 44100)).toEqual([]));
  it('quantize: vacío, origen dado y nota de duración cero', () => {
    expect(quantize([], 120)).toEqual({ notes: [], timeline: [] });
    const r = quantize([{ m: 60, t0: 1, t1: 1 }], 120, 0);
    expect(r.notes).toEqual([
      { p: null, d: 8 },
      { p: 60, d: 1 },
    ]);
  });
  it('quantize recorta a 3 000 notas', () => {
    const raw = Array.from({ length: 3100 }, (_, i) => ({ m: 60, t0: i * 0.125, t1: i * 0.125 + 0.1 }));
    expect(quantize(raw, 120).notes.length).toBeLessThanOrEqual(3000);
  });
  it('segmentNotes: segmento corto entre dos iguales se une; segmento corto inicial se absorbe en el siguiente', () => {
    const q = [62, 62, 62, 62, 62, 62, 64, 62, 62, 62, 62, 62, 62];
    expect(
      segmentNotes(
        q,
        q.map((_, i) => i),
        1,
        3,
      ).map((n) => n.m),
    ).toEqual([62]);
    const q2 = [null, 70, 70, 70, 70, 70, 70];
    expect(
      segmentNotes(
        q2,
        q2.map((_, i) => i),
        1,
        3,
      ).map((n) => n.m),
    ).toEqual([70]);
  });
  it('guessTempo sin intervalos útiles → 90; muy lento se duplica hasta ≥ 60', () => {
    expect(guessTempo([{ m: 60, t0: 0, t1: 1 }])).toBe(90);
    expect(guessTempo([0, 2, 4, 6].map((t) => ({ m: 60, t0: t, t1: t + 1 })))).toBeGreaterThanOrEqual(60);
  });
  it('guessKey sin notas no rompe', () => expect(guessKey([])).toBe(0));
  it('wsola con señal más corta que una ventana → copia', () =>
    expect(wsola(new Float32Array(100), 44100, 0.5)).toHaveLength(100));
});

describe('importación: bordes', () => {
  it('pickMeter aproxima 5/4 → 4/4 y 9/8 → 6/8', () => {
    expect(pickMeter(5, 4)).toEqual({ meter: '4/4', exact: false });
    expect(pickMeter(9, 8)).toEqual({ meter: '6/8', exact: false });
  });
  it('finalize recorta notas, limita el tempo y parte notas de más de 48', () => {
    const r = finalize({
      title: '',
      composer: '',
      key: 0,
      meter: '4/4',
      tempo: 500,
      notes: [{ p: 60, d: 100 }, ...Array(3001).fill({ p: 60, d: 1 })],
      instrumentId: null,
      warnings: [],
    });
    expect(r.tempo).toBe(240);
    expect(r.notes.slice(0, 3).map((n) => n.d)).toEqual([48, 48, 4]);
    expect(r.notes).toHaveLength(3000);
    expect(r.warnings.map((w) => w.code)).toEqual(['truncated']);
  });
  it('mono: una nota solapada se corta en el inicio de la siguiente', () => {
    const { notes } = toMonophonic([
      { start: 0, dur: 8, midi: 60 },
      { start: 4, dur: 4, midi: 62 },
    ]);
    expect(notes).toEqual([
      { p: 60, d: 4 },
      { p: 62, d: 4 },
    ]);
  });
  it('MIDI: compás no soportado, cambio de compás y acorde generan avisos', () => {
    const hdr = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0];
    const t = [
      0, 0xff, 0x58, 4, 5, 2, 24, 8, 0, 0x90, 60, 90, 0, 0x90, 64, 90, 0x83, 0x60, 0x80, 60, 0, 0, 0x80, 64, 0, 0, 0xff,
      0x58, 4, 3, 2, 24, 8, 0, 0xff, 0x2f, 0,
    ];
    const bytes = new Uint8Array([...hdr, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, t.length, ...t]);
    expect(
      parseMidi(bytes.buffer)
        .warnings.map((w) => w.code)
        .sort(),
    ).toEqual(['meter_changes', 'polyphony_reduced', 'unsupported_meter']);
  });
});

describe('ritmo: bordes', () => {
  it('splitDuration(0) vacío y measureCount de partitura vacía', () => {
    expect(splitDuration(0)).toEqual([]);
    expect(measureCount([], meterOf('4/4'))).toBe(0);
  });
});

describe('ramas restantes', () => {
  it('segmentNotes: corto al final se une al anterior; un solo segmento corto se conserva', () => {
    const q = [...Array(10).fill(60), 62, 62];
    expect(
      segmentNotes(
        q,
        q.map((_, i) => i),
        1,
        3,
      ).map((n) => n.m),
    ).toEqual([60]);
    expect(segmentNotes([60, 60], [0, 1], 1, 3).map((n) => n.m)).toEqual([60]);
  });
  it('wsola a 96 kHz usa ventana de 4096', () => {
    const y = wsola(new Float32Array(96000), 96000, 1);
    expect(y.length % 2048).toBe(0);
  });
  it('mono: grupo de solo silencios toma el más largo; ligadura sin coincidencia no une', () => {
    const { notes } = toMonophonic([
      { start: 0, dur: 2, midi: null },
      { start: 0, dur: 4, midi: null },
      { start: 4, dur: 4, midi: 60, tieStop: true },
    ]);
    expect(notes).toEqual([
      { p: null, d: 4 },
      { p: 60, d: 4 },
    ]);
  });
});

describe('segmentNotes: corto entre dos iguales', () => {
  it('tres tramas distintas entre dos tramos iguales (MIN 5) se unen a ellos', () => {
    const q = [...Array(8).fill(62), 64, 64, 64, ...Array(8).fill(62)];
    expect(
      segmentNotes(
        q,
        q.map((_, i) => i),
        1,
        5,
      ).map((n) => n.m),
    ).toEqual([62]);
  });
});
