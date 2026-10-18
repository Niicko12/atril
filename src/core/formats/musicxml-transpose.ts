/** Semitonos → pasos de escala (intervalos más comunes). formats-spec 4.3. */
const DIATONIC = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6] as const;

export interface TransposeElement {
  diatonic: number;
  chromatic: number;
  octaveChange: number;
}

/** `<transpose>`: lo que hay que sumar a lo escrito para obtener lo que suena (F-X1, admite negativos). */
export function transposeFor(instrumentTranspose: number): TransposeElement | null {
  if (instrumentTranspose === 0) return null;
  const total = -instrumentTranspose;
  const octaveChange = Math.trunc(total / 12);
  const rest = total - 12 * octaveChange;
  const diatonic = Math.sign(rest) * (DIATONIC[Math.abs(rest)] as number);
  return { diatonic, chromatic: rest, octaveChange };
}

export function transposeXml(t: TransposeElement): string {
  const fmt = (n: number) => String(n === 0 ? 0 : n);
  return (
    `<transpose><diatonic>${fmt(t.diatonic)}</diatonic><chromatic>${fmt(t.chromatic)}</chromatic>` +
    (t.octaveChange ? `<octave-change>${t.octaveChange}</octave-change>` : '') +
    '</transpose>'
  );
}
