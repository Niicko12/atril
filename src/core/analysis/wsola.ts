/** Cambia la velocidad sin cambiar el tono (legacy `wsola`, ear-spec 7.1). */
export function wsola(x: Float32Array, sr: number, speed: number): Float32Array {
  const N = sr > 60000 ? 4096 : 2048;
  const Hs = N / 2;
  const tol = Math.round(Hs / 2);
  const Ha = Hs * speed;
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const frames = Math.floor((x.length - N - 2 * tol) / Ha);
  if (frames < 1) return x.slice();
  const y = new Float32Array(frames * Hs + N);
  let prev = 0;
  for (let k = 0; k < frames; k++) {
    const ideal = Math.round(k * Ha) + tol;
    const best = k > 0 ? bestOffset(x, prev + Hs, ideal, { N, Hs, tol }) : ideal;
    const o = k * Hs;
    for (let i = 0; i < N; i++) y[o + i] = (y[o + i] as number) + (x[best + i] as number) * (win[i] as number);
    prev = best;
  }
  return y;
}

/** Desplazamiento (paso 4) con mayor correlación con la continuación natural (muestreo cada 8). */
function bestOffset(x: Float32Array, nat: number, ideal: number, p: { N: number; Hs: number; tol: number }): number {
  let best = ideal,
    bc = -Infinity;
  for (let dd = -p.tol; dd <= p.tol; dd += 4) {
    const q = ideal + dd;
    if (q < 0 || q + p.N > x.length) continue;
    let cc = 0;
    for (let i = 0; i < p.Hs; i += 8) cc += (x[nat + i] as number) * (x[q + i] as number);
    if (cc > bc) [bc, best] = [cc, q];
  }
  return best;
}
