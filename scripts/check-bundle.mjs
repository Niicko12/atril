// Presupuesto de JS inicial (technical-decisions 15.2): ≤ 250 KB gzip.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const LIMIT = 250 * 1024;
const html = readFileSync('dist/index.html', 'utf8');
const entries = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const total = entries.reduce((sum, f) => sum + gzipSync(readFileSync(`dist/${f}`)).length, 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`JS inicial: ${kb(total)} gzip (límite ${kb(LIMIT)}) — ${entries.join(', ')}`);
console.log(`Chunks totales: ${readdirSync('dist/assets').filter((f) => f.endsWith('.js')).length}`);
if (total > LIMIT) {
  console.error('❌ El JS inicial supera el presupuesto: mover código a import() diferido.');
  process.exit(1);
}
