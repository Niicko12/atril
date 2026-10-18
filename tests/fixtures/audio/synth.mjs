// Audio sintético determinista para tests de análisis (ear-spec 28.1). Sin dependencias.
export const SR = 44100;

/** PRNG con semilla (mulberry32): mismas muestras en cada ejecución. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const freq = (midi, cents = 0) => 440 * 2 ** ((midi - 69 + cents / 100) / 12);

/** Suma una nota con armónicos, ataque corto y caída suave. */
function addNote(out, { midi, start, dur, amp = 0.3, cents = 0, vibrato = 0, harmonics = [1, 0.5, 0.33, 0.2] }) {
  const s0 = Math.floor(start * SR);
  const n = Math.floor(dur * SR);
  const f = freq(midi, cents);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / SR;
    const fi = f * (1 + vibrato * Math.sin(2 * Math.PI * 5.5 * t));
    phase += (2 * Math.PI * fi) / SR;
    const env = Math.min(1, t / 0.01) * Math.min(1, (dur - t) / 0.03);
    let v = 0;
    harmonics.forEach((h, k) => (v += h * Math.sin((k + 1) * phase)));
    out[s0 + i] += amp * env * v;
  }
}

/** Melodía: lista de [midi, duraciónSeg]; silencio entre notas opcional. */
export function melody(notes, { gap = 0.02, cents = 0, vibrato = 0, amp = 0.3, tail = 0.3 } = {}) {
  const total = notes.reduce((a, [, d]) => a + d, 0) + tail;
  const out = new Float32Array(Math.ceil(total * SR));
  let t = 0;
  for (const [midi, d] of notes) {
    if (midi != null) addNote(out, { midi, start: t, dur: d - gap, amp, cents, vibrato });
    t += d;
  }
  return out;
}

/** Mezcla: melodía (fuerte, con vibrato) + bajo + acordes suaves + algo de ruido. */
export function mix(seed = 7) {
  const mel = [[72, 0.5], [74, 0.5], [76, 0.5], [77, 0.5], [79, 1], [77, 0.5], [76, 0.5], [74, 1]];
  const total = mel.reduce((a, [, d]) => a + d, 0) + 0.3;
  const out = new Float32Array(Math.ceil(total * SR));
  let t = 0;
  for (const [m, d] of mel) {
    addNote(out, { midi: m, start: t, dur: d - 0.02, amp: 0.35, vibrato: 0.004 });
    t += d;
  }
  [[48, 0, 2], [43, 2, 1], [41, 3, 2]].forEach(([m, s, d]) => addNote(out, { midi: m, start: s, dur: d - 0.05, amp: 0.25, harmonics: [1, 0.3] }));
  [[60, 64, 67], [55, 59, 62], [53, 57, 60]].forEach((ch, i) =>
    ch.forEach((m) => addNote(out, { midi: m, start: [0, 2, 3][i], dur: [2, 1, 2][i] - 0.05, amp: 0.06, harmonics: [1] })),
  );
  const r = rng(seed);
  for (let i = 0; i < out.length; i++) out[i] += (r() * 2 - 1) * 0.005;
  return out;
}

/** Casos estándar con su verdad conocida (notas MIDI esperadas). */
export const CASES = {
  escala: { make: () => melody([60, 62, 64, 65, 67, 69, 71, 72].map((m) => [m, 0.5])), expected: [60, 62, 64, 65, 67, 69, 71, 72] },
  himnoDesafinado: {
    make: () => melody([64, 64, 65, 67, 67, 65, 64, 62].map((m) => [m, 0.6]), { cents: 30, vibrato: 0.006 }),
    expected: [64, 64, 65, 67, 67, 65, 64, 62],
  },
  mezcla: { make: () => mix(), expected: [72, 74, 76, 77, 79, 77, 76, 74] },
};
