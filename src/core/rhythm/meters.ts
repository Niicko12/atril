import type { Meter, MeterId } from '../types';

export const METERS: Readonly<Record<MeterId, Meter>> = {
  '4/4': { bar: 16, beat: 4 },
  '3/4': { bar: 12, beat: 4 },
  '2/4': { bar: 8, beat: 4 },
  '6/8': { bar: 12, beat: 6 },
  '3/8': { bar: 6, beat: 6 },
  '12/8': { bar: 24, beat: 6 },
};

export const METER_IDS = Object.keys(METERS) as MeterId[];

/** Id desconocido → 4/4. */
export function meterOf(id: string): Meter {
  return METERS[id as MeterId] ?? METERS['4/4'];
}
