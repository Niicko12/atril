// Tests dorados: el núcleo portado debe dar exactamente lo mismo que legacy (technical-decisions 16.2).
import { readFileSync } from 'node:fs';
import { INSTRUMENTS, getInstrument } from './instruments';
import { buildAbc } from './notation';
import { normalizeFifths, spell } from './theory';
import { meterOf, toMeasures } from './rhythm';
import type { MeterId, Note, View } from './types';

interface Golden {
  scores: Record<string, { title: string; composer: string; key: number; meter: MeterId; tempo: number; notes: Note[] }>;
  instruments: { id: string; n: string; t: number; clef: string; lo: number; hi: number; tb: string; gm: number; tab: string | null; str: number[] | null; note: string | null }[];
  abc: Record<string, { abc: string; charMap: [number, number][]; f: number; t: number }>;
  spell: Record<string, string>;
  measures: Record<string, unknown[]>;
  normF: Record<string, number>;
}

const golden = JSON.parse(
  readFileSync(new URL('../../tests/fixtures/golden/core.json', import.meta.url), 'utf8'),
) as Golden;

/** Diferencias intencionales (tests/fixtures/golden/EXCEPTIONS.md). Se cubren con tests propios. */
const EXCEPTIONS = new Set<string>([]);

describe('dorados contra legacy', () => {
  it('catálogo: los 18 instrumentos de legacy son idénticos', () => {
    for (const g of golden.instruments) {
      const i = getInstrument(g.id);
      expect(i.id).toBe(g.id);
      expect([i.name, i.transpose, i.clef, i.low, i.high, i.timbre, i.gmProgram]).toEqual([g.n, g.t, g.clef, g.lo, g.hi, g.tb, g.gm]);
      expect(i.tab ?? null).toBe(g.tab);
      expect(i.strings ? [...i.strings] : null).toEqual(g.str);
      expect(i.note ?? null).toBe(g.note);
    }
    expect(INSTRUMENTS).toHaveLength(golden.instruments.length + 1); // + flauta dulce (aprobada 2026-10-18)
  });

  it('spell: 128 alturas × 15 armaduras', () => {
    for (const [k, v] of Object.entries(golden.spell)) {
      const [m, f] = k.split('|').map(Number) as [number, number];
      const s = spell(m, f);
      expect(`${s.letter}|${s.alter}|${s.octave}`, k).toBe(v);
    }
  });

  it('normalizeFifths', () => {
    for (const [f, v] of Object.entries(golden.normF)) expect(normalizeFifths(Number(f)), f).toBe(v);
  });

  it('toMeasures en los 6 compases', () => {
    for (const [k, v] of Object.entries(golden.measures)) {
      const [name, meter] = k.split('|') as [string, MeterId];
      const score = golden.scores[name]!;
      expect(toMeasures(score.notes, meterOf(meter)), k).toEqual(v);
    }
  });

  it('buildAbc: texto y mapa de caracteres (casos × instrumentos × vistas × nombres)', () => {
    let compared = 0;
    for (const [k, v] of Object.entries(golden.abc)) {
      if (EXCEPTIONS.has(k)) continue;
      const [name, id, view, names] = k.split('|') as [string, string, View, string];
      const r = buildAbc(golden.scores[name]!, getInstrument(id), view, { names: names === 'true' });
      expect(r.abc, k).toBe(v.abc);
      expect([...r.charMap], k).toEqual(v.charMap);
      expect([r.fifths, r.transpose], k).toEqual([v.f, v.t]);
      compared++;
    }
    expect(compared).toBeGreaterThan(800);
  });
});
