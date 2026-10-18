import type { Instrument, Score } from '../types';

export type MidiScore = Pick<Score, 'title' | 'key' | 'meter' | 'tempo' | 'notes'>;

const PPQ = 480;
const TICKS_PER_UNIT = PPQ / 4;

function vlq(n: number): number[] {
  const bytes = [n & 0x7f];
  let v = n >> 7;
  while (v) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function metaEvents(score: MidiScore, instrument: Instrument): number[] {
  const mpq = Math.round(60000000 / (score.tempo || 100));
  const [nn, dd] = score.meter.split('/').map(Number) as [number, number];
  const title = Array.from(new TextEncoder().encode(score.title || 'Atril'));
  return [
    0,
    0xff,
    0x03,
    ...vlq(title.length),
    ...title,
    0,
    0xff,
    0x51,
    3,
    (mpq >> 16) & 255,
    (mpq >> 8) & 255,
    mpq & 255,
    0,
    0xff,
    0x58,
    4,
    nn,
    Math.log2(dd),
    24,
    8,
    0,
    0xff,
    0x59,
    2,
    (score.key + 256) & 255,
    0,
    0,
    0xc0,
    instrument.gmProgram,
  ];
}

/** SMF formato 0, una pista, sonido real (formats-spec 5; bytes idénticos a legacy). */
export function toMidi(score: MidiScore, instrument: Instrument): Uint8Array {
  const track = metaEvents(score, instrument);
  let wait = 0;
  for (const n of score.notes) {
    const ticks = Math.round(n.d * TICKS_PER_UNIT);
    if (n.p == null) {
      wait += ticks;
      continue;
    }
    track.push(...vlq(wait), 0x90, n.p, 90, ...vlq(ticks), 0x80, n.p, 0);
    wait = 0;
  }
  track.push(...vlq(wait), 0xff, 0x2f, 0);
  const len = track.length;
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 255, PPQ & 255];
  return new Uint8Array([
    ...header,
    0x4d,
    0x54,
    0x72,
    0x6b,
    (len >>> 24) & 255,
    (len >> 16) & 255,
    (len >> 8) & 255,
    len & 255,
    ...track,
  ]);
}
