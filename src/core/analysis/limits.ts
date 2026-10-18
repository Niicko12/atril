/** Límites de "De oído": código y textos usan los mismos valores (ear-spec 22, deuda 6). */
export const EAR_LIMITS = {
  fileMaxBytes: 50 * 1024 * 1024,
  durationMaxSec: 900,
  soloMaxSec: 300,
  mixMaxSec: 180,
  partsMaxSec: 90,
  stretchSegmentSec: 90,
  loopMinSec: 0.3,
} as const;
