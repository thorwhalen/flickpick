/**
 * flickpick core: load an artifact set, import a user's ratings, recommend, evaluate.
 *
 * Runs in the browser and in Node; no UI and no fetch policy. Everything comes in as arguments.
 *
 * ```ts
 * import { loadArtifacts, parseRatings, resolveRatings, recommend } from 'flickpick';
 * const artifacts = await loadArtifacts('https://.../artifacts');
 * const ratings = resolveRatings(parseRatings(csvText), artifacts.catalog);
 * const recs = await recommend(artifacts, ratings, { exclude_genres: ['Horror'], k: 10 });
 * ```
 */
export * from './types.js';
export { defaults, type Defaults } from './defaults.js';
export * from './artifacts.js';
export * from './scoring.js';
export * from './embed.js';
export * from './importers.js';
export * from './science.js';
