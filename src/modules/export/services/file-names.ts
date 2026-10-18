import type { Instrument } from '@/core';
import { displayName } from '@/core';

/** "Cielito lindo - Saxofón alto en Mib" (formats-spec 7.2). */
export function baseName(title: string, instrument: Instrument): string {
  const clean =
    title
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim()
      .slice(0, 80) || 'partitura';
  return `${clean} - ${displayName(instrument)}`;
}

export const fileName = (title: string, instrument: Instrument, ext: string): string =>
  `${baseName(title, instrument)}.${ext}`;
