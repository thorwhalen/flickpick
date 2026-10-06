/**
 * Copy the repo's small fixture artifact set into `public/data/artifacts_small/`, so `npm run dev`
 * serves it at `./data/artifacts_small/` (the app's default artifact source), and the example
 * ratings file into `public/data/examples/` (the ratings page offers it as a demo import).
 *
 * The copy is gitignored: artifacts are data, not code, and the only committed set is the
 * fixture under `tests/fixtures/`. A later deploy points the app at a hosted set instead.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../tests/fixtures/artifacts_small');
const target = resolve(here, '../public/data/artifacts_small');
const exampleSource = resolve(here, '../../flickpick/data/examples/movie_ratings_various.csv');
const exampleTarget = resolve(here, '../public/data/examples/movie_ratings_various.csv');

if (!existsSync(source)) {
  console.error(`prepare-data: no fixture artifact set at ${source}; build one with \`python -m flickpick build --sample\`.`);
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`prepare-data: copied ${source} -> ${target}`);
if (existsSync(exampleSource)) {
  mkdirSync(dirname(exampleTarget), { recursive: true });
  cpSync(exampleSource, exampleTarget);
  console.log(`prepare-data: copied ${exampleSource} -> ${exampleTarget}`);
}
