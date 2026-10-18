import { validateScore } from './validate';
import { emptyScore, fromSample } from './factory';
import { SAMPLES } from './samples';

describe('validateScore', () => {
  const ok = () => fromSample(SAMPLES[0]!, 'piano');
  it('acepta partituras válidas', () => {
    expect(() => validateScore(ok())).not.toThrow();
    expect(() => validateScore(emptyScore('saxalto'))).not.toThrow();
  });
  it.each([
    ['title', { title: 'x'.repeat(121) }],
    ['instrumentId', { instrumentId: 'banjo' }],
    ['key', { key: 7 }],
    ['meter', { meter: '5/4' }],
    ['tempo', { tempo: 241 }],
    ['notes', { notes: Array(3001).fill({ p: 60, d: 1 }) }],
    ['nota 0: d', { notes: [{ p: 60, d: 0 }] }],
    ['nota 0: p', { notes: [{ p: 128, d: 4 }] }],
    ['nota 0: c', { notes: [{ p: 60, d: 4, c: 'x'.repeat(13) }] }],
  ])('rechaza %s', (msg, patch) => expect(() => validateScore({ ...ok(), ...patch })).toThrow(msg));
  it('rechaza no-objetos', () => expect(() => validateScore(null)).toThrow());
  it('fromSample copia las notas (no comparte referencias)', () => {
    const s = fromSample(SAMPLES[0]!, 'clarinete');
    expect(s.notes[0]).not.toBe(SAMPLES[0]!.notes[0]);
    expect([s.instrumentId, s.source, s.savedAt]).toEqual(['clarinete', 'sample', null]);
  });
});
