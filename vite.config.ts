import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // Spike temporal de la semana 1 (se elimina al decidir; ver implementation-plan 1.10).
        spikeBasicPitch: fileURLToPath(new URL('./spike/basic-pitch.html', import.meta.url)),
      },
    },
  },
  worker: { format: 'es' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/main.tsx', 'src/test-setup.ts', 'src/vendor/**', 'src/spikes/**'],
      // Umbrales por capa (technical-decisions 16.1, specs de módulo).
      thresholds: { lines: 85, 'src/core/**': { lines: 95, branches: 90, functions: 95 } },
    },
  },
});
