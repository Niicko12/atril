import { readFileSync } from 'node:fs';
import { CASES, SR, rng } from '../../../tests/fixtures/audio/synth.mjs';
import { detectNotes, yinFrames } from './yin';
import { segmentNotes } from './segment';
import { detectMelodyMix } from './melody-mix';
import { guessKey, guessTempo } from './tempo-key';
import { quantize } from './quantize';
import { wsola } from './wsola';
import { melody } from '../../../tests/fixtures/audio/synth.mjs';
import type { RawNote } from './types';

interface GoldenCase {
  raw: RawNote[];
  bpm: number;
  key: number;
  quantized: { p: number | null; d: number }[];
  quantized90: { p: number | null; d: number }[];
}
const golden = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/golden/analysis.json', import.meta.url), 'utf8'),
) as {
  cases: Record<string, GoldenCase>;
  segment: { q: (number | null)[]; result: RawNote[] }[];
  wsola: { length: number; head: number[] };
};
const close = (a: RawNote[], b: RawNote[]) => {
  expect(a.map((n) => n.m)).toEqual(b.map((n) => n.m));
  a.forEach((n, i) => {
    expect(n.t0).toBeCloseTo(b[i]!.t0, 5);
    expect(n.t1).toBeCloseTo(b[i]!.t1, 5);
  });
};

describe('YIN con FFT = YIN de legacy (T-YIN-04, ear-spec 8.2)', () => {
  it.each(['escala', 'himnoDesafinado'] as const)('%s: mismas notas y tiempos', (name) => {
    close(detectNotes(CASES[name].make(), SR), golden.cases[name]!.raw);
  });
  it('escala: las 8 notas esperadas (verdad conocida)', () => {
    expect(detectNotes(CASES.escala.make(), SR).map((n) => n.m)).toEqual(CASES.escala.expected);
  });
});

describe('YIN (T-YIN-01..03)', () => {
  const sine = (f: number, sec = 0.5) =>
    Float32Array.from({ length: SR * sec }, (_, i) => 0.5 * Math.sin((2 * Math.PI * f * i) / SR));
  it.each([440, 65.5, 1000])('seno de %f Hz', (f) => {
    const { frames } = yinFrames(sine(f), SR);
    const f0s = frames.map((x) => x.f0).filter((v): v is number => v != null);
    expect(f0s.length).toBeGreaterThan(frames.length * 0.8);
    expect(Math.abs((f0s[Math.floor(f0s.length / 2)] as number) - f) / f).toBeLessThan(0.01);
  });
  it('ruido: casi sin f0', () => {
    const r = rng(3);
    const { frames } = yinFrames(
      Float32Array.from({ length: SR }, () => r() * 2 - 1),
      SR,
    );
    expect(frames.filter((x) => x.f0 != null).length).toBeLessThan(frames.length * 0.05);
  });
});

describe('segmentNotes = legacy (T-SEG-01/02)', () => {
  it.each(golden.segment.map((g, i) => [i, g] as const))('secuencia %i', (_, g) => {
    close(
      segmentNotes(
        g.q,
        g.q.map((__, i) => i * 0.02),
        0.02,
        3,
      ),
      g.result,
    );
  });
});

describe('mezcla, tempo, tonalidad, cuantización y WSOLA = legacy', () => {
  it('melodía en mezcla: mismas notas y tiempos (T-MIX-01)', () => {
    const raw = detectMelodyMix(CASES.mezcla.make(), SR);
    close(raw, golden.cases.mezcla!.raw);
    expect(raw.map((n) => n.m)).toEqual(CASES.mezcla.expected);
  });
  it.each(['escala', 'himnoDesafinado', 'mezcla'] as const)('%s: tempo, tonalidad y cuantización', (name) => {
    const g = golden.cases[name]!;
    expect(guessTempo(g.raw)).toBe(g.bpm);
    expect(guessKey(g.raw)).toBe(g.key);
    expect(quantize(g.raw, g.bpm).notes).toEqual(g.quantized);
    expect(quantize(g.raw, 90).notes).toEqual(g.quantized90);
  });
  it('WSOLA a 70 %: misma longitud y muestras (T-WSO-01)', () => {
    const y = wsola(
      melody(
        [
          [60, 0.5],
          [67, 0.5],
        ],
        { tail: 0 },
      ),
      SR,
      0.7,
    );
    expect(y.length).toBe(golden.wsola.length);
    golden.wsola.head.forEach((v, i) => expect(y[20000 + i]).toBeCloseTo(v, 5));
  });
});

describe('tempo, tonalidad y cuantización (T-TMP, T-KEY, T-QNT)', () => {
  const clicks = (bpm: number, n = 16) =>
    Array.from({ length: n }, (_, i) => ({ m: 60, t0: (i * 60) / bpm, t1: (i * 60) / bpm + 0.1 }));
  // 150 bpm exactos caen en el límite negra/corchea (0,4 s) y legacy da 75: limitación conocida (ear-spec 14).
  it.each([60, 90, 120, 148])('clics a %i bpm', (bpm) =>
    expect(Math.abs(guessTempo(clicks(bpm)) - bpm)).toBeLessThanOrEqual(1),
  );
  it('180 bpm se pliega a 90', () => expect(guessTempo(clicks(180))).toBe(90));
  it('escala de La menor armónica → armadura de Do', () => {
    const am = [57, 59, 60, 62, 64, 65, 68, 69, 57, 64, 57].map((m, i) => ({ m, t0: i, t1: i + 1 }));
    expect(guessKey(am)).toBe(0);
  });
  it('escala de Re mayor → 2 sostenidos', () => {
    const d = [62, 64, 66, 67, 69, 71, 73, 74, 62, 69].map((m, i) => ({ m, t0: i, t1: i + 1 }));
    expect(guessKey(d)).toBe(2);
  });
  it('hueco de 1 semicorchea absorbido y línea de tiempo por nota (T-QNT-02/03)', () => {
    const u = 60 / 100 / 4;
    const { notes, timeline } = quantize(
      [
        { m: 60, t0: 0, t1: 4 * u },
        { m: 62, t0: 5 * u, t1: 9 * u },
        { m: 64, t0: 12 * u, t1: 16 * u },
      ],
      100,
    );
    expect(notes).toEqual([
      { p: 60, d: 5 },
      { p: 62, d: 4 },
      { p: null, d: 3 },
      { p: 64, d: 4 },
    ]);
    expect(timeline.map((t) => t.index)).toEqual([0, 1, 3]);
  });
});
