// Convierte legacy/bp-model.json (pesos en base64) en model.json + .bin estáticos para tf.loadGraphModel (ear-spec 11.1).
// Uso: node scripts/split-bp-model.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('../legacy/bp-model.json', import.meta.url), 'utf8'));
const weights = Buffer.from(src.weightsB64, 'base64');
const hash = createHash('sha256').update(weights).digest('hex').slice(0, 10);
const binName = `group1-shard1of1.${hash}.bin`;
const outDir = new URL('../public/models/basic-pitch/', import.meta.url);

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) rmSync(new URL(f, outDir));
writeFileSync(new URL(binName, outDir), weights);
const model = {
  format: src.format,
  generatedBy: src.generatedBy,
  convertedBy: src.convertedBy,
  signature: src.signature,
  modelTopology: src.modelTopology,
  weightsManifest: [{ paths: [binName], weights: src.weightsManifest[0].weights }],
};
writeFileSync(new URL('model.json', outDir), JSON.stringify(model));
console.log(`✅ Modelo: model.json + ${binName} (${(weights.length / 1024).toFixed(0)} KB de pesos)`);
