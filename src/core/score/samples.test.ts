import { SAMPLES, seq } from '.';
import { MAX_NOTES, MIDI_MAX, MIDI_MIN, TEMPO_MAX, TEMPO_MIN } from '../types';
import { meterOf, totalUnits } from '../rhythm';

describe('ejemplos (technical-decisions 3.2)', () => {
  it('seq lee notas y silencios', () => {
    expect(seq('60:4 r:2 72:1')).toEqual([
      { p: 60, d: 4 },
      { p: null, d: 2 },
      { p: 72, d: 1 },
    ]);
  });
  it.each(SAMPLES.map((s) => [s.title, s] as const))('%s es válido y llena compases completos', (_, s) => {
    expect(s.notes.length).toBeGreaterThan(0);
    expect(s.notes.length).toBeLessThanOrEqual(MAX_NOTES);
    expect(s.tempo >= TEMPO_MIN && s.tempo <= TEMPO_MAX).toBe(true);
    for (const n of s.notes) if (n.p != null) expect(n.p >= MIDI_MIN && n.p <= MIDI_MAX).toBe(true);
    expect(totalUnits(s.notes) % meterOf(s.meter).bar).toBe(0);
  });
  it('La cucaracha queda sin verificar hasta revisarla al oído (semana 7)', () => {
    expect(SAMPLES.find((s) => s.title === 'La cucaracha')?.verified).toBe(false);
  });
});
