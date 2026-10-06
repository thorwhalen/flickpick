/**
 * The `prepare` hook: build `dist/` after `npm install` / `npm ci` in this package, so a checkout
 * is usable as is.
 *
 * It does nothing when the build toolchain (tsup, a devDependency) is not installed. That is the
 * case when npm runs this hook on behalf of a package that links the core with `file:../js`
 * (the web app): npm does not install the core's devDependencies there, so building would fail
 * and abort that package's `npm install`. The web app's `build-core` script installs them and
 * builds instead.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
if (existsSync(fileURLToPath(new URL('../node_modules/tsup/package.json', import.meta.url)))) {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
} else {
  console.log('flickpick prepare: build toolchain not installed here; skipping the build (run `npm ci` in js/ to build)');
}
