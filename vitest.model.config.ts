import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/** Prueba real del modelo en CPU, separada de la instrumentación de cobertura. */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/basic-pitch-model.test.ts'],
    coverage: { enabled: false },
  },
});
