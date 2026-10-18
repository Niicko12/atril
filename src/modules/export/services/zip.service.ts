import { strToU8, zipSync } from 'fflate';
import type { Instrument, Score } from '@/core';
import { buildAbc, toMidi, toMusicXML } from '@/core';
import { S } from '../strings';
import { baseName } from './file-names';

/** ZIP "para MuseScore": MusicXML + MIDI + ABC + LEEME (formats-spec 7). */
export function museScoreZip(score: Score, instrument: Instrument): Blob {
  const base = baseName(score.title, instrument);
  const zip = zipSync(
    {
      [`${base}.musicxml`]: strToU8(toMusicXML(score, instrument)),
      [`${base}.mid`]: toMidi(score, instrument),
      [`${base}.abc`]: strToU8(buildAbc(score, instrument, 'written').abc),
      'LEEME.txt': strToU8(S.readme(base)),
    },
    { level: 6 },
  );
  return new Blob([zip], { type: 'application/zip' });
}
