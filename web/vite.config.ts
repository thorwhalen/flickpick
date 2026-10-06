/**
 * Vite config for the flickpick web app (also the vitest config).
 *
 * - `base: './'` makes every asset URL relative, so the built `dist/` works from any static host
 *   path (GitHub Pages project sites, a sub-folder, a file server) without a rebuild.
 * - `dedupe` forces one copy of zod and React: the core (`flickpick`, linked from `../js`) has its
 *   own `node_modules`, and two zod copies would mean two sets of schema classes at runtime.
 * - `@huggingface/transformers` is excluded from dependency pre-bundling (its ONNX runtime loads
 *   WebAssembly files relative to itself, which pre-bundling breaks) and runs in a Web Worker.
 */
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom', 'zod'],
  },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  worker: { format: 'es' },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 20_000,
  },
});
