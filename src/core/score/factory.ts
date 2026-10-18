import type { InstrumentId, Score } from '../types';
import type { Sample } from './samples';

const newId = (): string => globalThis.crypto.randomUUID();

/** Partitura desde un ejemplo, con el instrumento actual (legacy `fresh`). */
export function fromSample(sample: Sample, instrumentId: InstrumentId): Score {
  return {
    id: newId(),
    title: sample.title,
    composer: sample.composer,
    instrumentId,
    key: sample.key,
    meter: sample.meter,
    tempo: sample.tempo,
    showNames: false,
    showTab: false,
    notes: sample.notes.map((n) => ({ ...n })),
    source: 'sample',
    savedAt: null,
  };
}

/** "Nueva" (editor-spec 11.1). */
export function emptyScore(instrumentId: InstrumentId): Score {
  return {
    id: newId(),
    title: 'Mi canción',
    composer: '',
    instrumentId,
    key: 0,
    meter: '4/4',
    tempo: 96,
    showNames: false,
    showTab: false,
    notes: [],
    source: 'manual',
    savedAt: null,
  };
}
