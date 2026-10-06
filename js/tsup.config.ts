/** Build config: ESM bundles for the library (browser + Node) and the Node CLI, with type declarations. */
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', cli: 'src/cli.ts' },
  format: ['esm'],
  dts: { entry: { index: 'src/index.ts' } },
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  splitting: true,
  treeshake: true,
  external: ['@huggingface/transformers', 'zod', /^node:/],
});
