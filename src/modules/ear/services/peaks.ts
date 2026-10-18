/** Picos normalizados por píxel (muestreo cada 8; ear-spec 5.1). */
export function computePeaks(mono: Float32Array, width: number): Float32Array {
  const peaks = new Float32Array(width);
  const step = mono.length / width;
  let max = 0;
  for (let x = 0; x < width; x++) {
    let m = 0;
    const end = Math.min(mono.length, Math.floor((x + 1) * step));
    for (let i = Math.floor(x * step); i < end; i += 8) m = Math.max(m, Math.abs(mono[i] as number));
    peaks[x] = m;
    max = Math.max(max, m);
  }
  if (max) for (let x = 0; x < width; x++) peaks[x] = (peaks[x] as number) / max;
  return peaks;
}

export const formatTime = (s: number): string => {
  const t = Math.max(0, s);
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};
