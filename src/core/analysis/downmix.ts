/** Diezmado por promedio de `factor` muestras (legacy). */
export function decimate(x: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return x;
  const n = Math.floor(x.length / factor);
  const y = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += x[j * factor + k] as number;
    y[j] = s / factor;
  }
  return y;
}
