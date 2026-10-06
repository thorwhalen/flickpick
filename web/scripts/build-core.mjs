/**
 * Build the TypeScript core in `../js`, which the app imports as `flickpick` (`file:../js`, from
 * its `dist/`), so a fresh clone runs with `npm install && npm run dev` (or `npm run build`,
 * `npm test`): those scripts call this first.
 *
 * Idempotent and quick when nothing changed: the core's dependencies are installed (`npm ci`,
 * whose `prepare` step also builds) only when `../js/node_modules` is missing, and the core is
 * rebuilt only when `../js/dist/index.js` is missing or older than a source or config file.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const core = resolve(dirname(fileURLToPath(import.meta.url)), '../../js');
const built = join(core, 'dist', 'index.js');
/** What the build reads: a change to any of these makes `dist/` stale. */
const inputs = ['src', 'package.json', 'package-lock.json', 'tsup.config.ts', 'tsconfig.json'];

const run = (command) => {
  console.log(`build-core: ${command} (in ${core})`);
  execSync(command, { cwd: core, stdio: 'inherit' });
};

/** Latest modification time (ms) of a file, or of any file below a directory. */
function newest(path) {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(0, ...readdirSync(path).map((name) => newest(join(path, name))));
}

if (!existsSync(join(core, 'package.json'))) {
  console.error(`build-core: no TypeScript core at ${core}; run this from a full flickpick checkout.`);
  process.exit(1);
}
if (!existsSync(join(core, 'node_modules'))) run('npm ci');
const sourceTime = Math.max(...inputs.map((p) => newest(join(core, p))));
if (!existsSync(built) || statSync(built).mtimeMs < sourceTime) run('npm run build');
else console.log('build-core: ../js/dist is up to date');
