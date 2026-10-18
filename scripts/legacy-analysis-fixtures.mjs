// Dorados del análisis de audio: ejecuta en Node las funciones de "De oído" de legacy/index.html
// sobre el audio sintético de tests/fixtures/audio/synth.mjs. Uso: node scripts/legacy-analysis-fixtures.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { CASES, SR, melody, rng } from '../tests/fixtures/audio/synth.mjs';

const html = readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8');

/** Código de una función de legacy por nombre (con llaves balanceadas). */
function extract(name) {
  const m = new RegExp(`(?:async\\s+)?function ${name}\\s*\\(`).exec(html);
  if (!m) throw new Error(`No se encontró ${name}`);
  let i = html.indexOf('{', m.index);
  let depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}' && --depth === 0) return html.slice(m.index, j + 1);
  }
  throw new Error(`Llaves sin cerrar en ${name}`);
}

const NAMES = ['normF', 'detectNotes', 'segmentNotes', 'fft', 'detectMelodyMix', 'guessTempo', 'quantize', 'guessKey', 'wsola'];
const ctx = { Math, Float32Array, Uint8Array, Array, Promise, setTimeout, out: {} };
vm.runInNewContext(`${NAMES.map(extract).join('\n')}\n${NAMES.map((n) => `out.${n} = ${n};`).join('\n')}`, ctx);
const L = ctx.out;
const noop = () => {};
const round = (raw) => raw.map((r) => ({ m: r.m, t0: +r.t0.toFixed(6), t1: +r.t1.toFixed(6) }));

const out = { cases: {} };
for (const [name, c] of Object.entries(CASES)) {
  const x = c.make();
  const raw = name === 'mezcla' ? await L.detectMelodyMix(x, SR, noop) : await L.detectNotes(x, SR, noop);
  const bpm = raw.length ? L.guessTempo(raw) : null;
  out.cases[name] = {
    raw: round(raw),
    bpm,
    key: raw.length ? L.guessKey(raw) : null,
    quantized: raw.length ? L.quantize(raw, bpm) : [],
    quantized90: raw.length ? L.quantize(raw, 90) : [],
  };
}

// segmentNotes sobre secuencias pseudoaleatorias con glitches.
const r = rng(11);
out.segment = Array.from({ length: 5 }, (_, k) => {
  const q = Array.from({ length: 300 }, (_, i) => (r() < 0.08 ? (r() < 0.5 ? null : 60 + Math.floor(r() * 12)) : 60 + Math.floor(i / 30) * (k % 2 ? 1 : 2)));
  const times = q.map((_, i) => i * 0.02);
  return { q, result: round(L.segmentNotes(q, times, 0.02, 3)) };
});

// WSOLA a 70 % sobre 1 s de escala: longitud y primeras muestras.
const w = melody([[60, 0.5], [67, 0.5]], { tail: 0 });
const y = L.wsola(w, SR, 0.7);
out.wsola = { length: y.length, head: Array.from(y.subarray(20000, 20010)).map((v) => +v.toFixed(6)) };

writeFileSync(new URL('../tests/fixtures/golden/analysis.json', import.meta.url), JSON.stringify(out));
for (const [k, v] of Object.entries(out.cases)) console.log(`${k}: ${v.raw.length} notas`, v.raw.map((n) => n.m).join(' '), `♩=${v.bpm} key=${v.key}`);
console.log(`wsola: ${out.wsola.length} muestras`);
