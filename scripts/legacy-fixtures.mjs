// Genera los tests dorados del núcleo musical ejecutando el código de legacy/index.html en Node.
// Uso: npm run fixtures:legacy   →   tests/fixtures/golden/core.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const coreSrc = scripts.find((s) => s.includes('Music core: pure functions'));
if (!coreSrc) throw new Error('No se encontró el núcleo musical en legacy/index.html');

const module = { exports: {} };
vm.runInNewContext(`${coreSrc}\nmodule.exports.normF = normF; module.exports.keyAcc = keyAcc;`, { module, TextEncoder, Math });
const L = module.exports;

const parseSeq = (s) =>
  s.trim() ? s.trim().split(/\s+/).map((t) => { const [p, d] = t.split(':'); return { p: p === 'r' ? null : Number(p), d: Number(d) }; }) : [];
const cases = JSON.parse(readFileSync(new URL('../tests/fixtures/scores/cases.json', import.meta.url), 'utf8'));

const scores = {};
for (const [name, c] of Object.entries(cases)) {
  const notes = parseSeq(c.notes);
  for (const [i, ch] of Object.entries(c.chords ?? {})) notes[Number(i)].c = ch;
  scores[name] = { title: c.title, composer: c.composer, key: c.key, meter: c.meter, tempo: c.tempo, notes };
}

const abc = {};
for (const [name, S] of Object.entries(scores)) {
  for (const I of L.INSTR) {
    for (const view of ['written', 'concert']) {
      for (const names of [false, true]) {
        const r = L.buildAbc(S, I, view, { names });
        abc[`${name}|${I.id}|${view}|${names}`] = { abc: r.abc, charMap: [...r.charMap], f: r.f, t: r.t };
      }
    }
  }
}

const spell = {};
for (let f = -7; f <= 7; f++) for (let m = 0; m <= 127; m++) { const s = L.spell(m, f); spell[`${m}|${f}`] = `${s.L}|${s.a}|${s.oct}`; }

const measures = {};
const METERS = { '4/4': 16, '3/4': 12, '2/4': 8, '6/8': 12, '3/8': 6, '12/8': 24 };
for (const [name, S] of Object.entries(scores)) {
  for (const meter of Object.keys(METERS)) measures[`${name}|${meter}`] = L.toMeasures({ ...S, meter });
}

const normF = {};
for (let f = -30; f <= 30; f++) normF[f] = L.normF(f);

const instruments = L.INSTR.map((i) => ({ id: i.id, n: i.n, t: i.t, clef: i.clef, lo: i.lo, hi: i.hi, tb: i.tb, gm: i.gm, tab: i.tab ?? null, str: i.str ?? null, note: i.note ?? null }));

mkdirSync(new URL('../tests/fixtures/golden/', import.meta.url), { recursive: true });
const out = { generatedFrom: 'legacy/index.html', scores, instruments, abc, spell, measures, normF };
writeFileSync(new URL('../tests/fixtures/golden/core.json', import.meta.url), JSON.stringify(out));
console.log(`✅ Dorados: ${Object.keys(abc).length} ABC, ${Object.keys(spell).length} spell, ${Object.keys(measures).length} medidas`);
