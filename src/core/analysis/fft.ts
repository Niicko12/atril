/** FFT radix-2 in situ (portada de legacy). `re.length` debe ser potencia de 2. */
export function fft(re: Float32Array | Float64Array, im: Float32Array | Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] as number, re[i] as number];
      [im[i], im[j]] = [im[j] as number, im[i] as number];
    }
  }
  for (let len = 2; len <= n; len <<= 1) butterflies(re, im, len);
}

function butterflies(re: Float32Array | Float64Array, im: Float32Array | Float64Array, len: number): void {
  const ang = (-2 * Math.PI) / len;
  const wr = Math.cos(ang);
  const wi = Math.sin(ang);
  const half = len >> 1;
  for (let i = 0; i < re.length; i += len) {
    let cr = 1;
    let ci = 0;
    for (let j = 0; j < half; j++) {
      const a = i + j;
      const b = a + half;
      const tr = (re[b] as number) * cr - (im[b] as number) * ci;
      const ti = (re[b] as number) * ci + (im[b] as number) * cr;
      re[b] = (re[a] as number) - tr;
      im[b] = (im[a] as number) - ti;
      re[a] = (re[a] as number) + tr;
      im[a] = (im[a] as number) + ti;
      const ncr = cr * wr - ci * wi;
      ci = cr * wi + ci * wr;
      cr = ncr;
    }
  }
}

export const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(2, n)));
