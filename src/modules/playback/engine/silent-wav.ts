let cached: string | null = null;

/** WAV de 800 muestras de silencio a 8 kHz y 8 bits, en data URI (playback-spec 5.4). */
export function silentWav(): string {
  if (cached) return cached;
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => (b[o + i] = ch.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  b.fill(128, 44);
  let s = '';
  b.forEach((x) => (s += String.fromCharCode(x)));
  return (cached = `data:audio/wav;base64,${btoa(s)}`);
}
