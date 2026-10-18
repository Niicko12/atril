// Máximo 15 archivos de lógica por módulo (technical-decisions 9.3); no cuentan strings.ts, types.ts ni index.ts.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT = 15;
const EXCLUDED = new Set(['strings.ts', 'types.ts', 'index.ts']);
const root = 'src/modules';
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [f]));
let failed = false;
for (const mod of existsSync(root) ? readdirSync(root) : []) {
  const files = walk(join(root, mod)).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !EXCLUDED.has(f));
  const flag = files.length > LIMIT ? '❌' : '✅';
  if (files.length > LIMIT) failed = true;
  console.log(`${flag} ${mod}: ${files.length} archivos`);
}
if (failed) process.exit(1);
