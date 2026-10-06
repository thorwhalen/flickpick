/**
 * End-to-end on the Python-built fixture (`tests/fixtures/artifacts_small/`, MovieLens
 * ml-latest-small) with the example ratings file: the architecture's one-command test, minus
 * the mood. Skipped, with the reason in its name, when the fixture has not been built.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  holdoutEvaluate,
  loadArtifacts,
  parseRatings,
  recommend,
  resolveRatings,
  scorePopularity,
  type HoldoutOptions,
} from '../src/index.js';

const FIXTURE = fileURLToPath(new URL('../../tests/fixtures/artifacts_small/', import.meta.url));
const EXAMPLE = fileURLToPath(new URL('../../flickpick/data/examples/movie_ratings_various.csv', import.meta.url));
const ready = existsSync(`${FIXTURE}manifest.json`) && existsSync(EXAMPLE);
const title = ready
  ? 'recommends 10 unrated films for the example ratings (no mood)'
  : 'SKIPPED: tests/fixtures/artifacts_small/ is not built yet (run the Python build --sample into it)';

describe('Python-built fixture artifact set', () => {
  it.skipIf(!ready)(title, async () => {
    const artifacts = await loadArtifacts(FIXTURE);
    const ratings = resolveRatings(parseRatings(readFileSync(EXAMPLE, 'utf8')), artifacts.catalog);
    const started = performance.now();
    const recs = await recommend(artifacts, ratings);
    const elapsed = performance.now() - started;
    expect(recs).toHaveLength(10);
    const rated = new Set(ratings.map((r) => r.item_id));
    for (const rec of recs) {
      expect(rated.has(rec.item_id)).toBe(false);
      expect(rec.reasons.length).toBeGreaterThan(0);
    }
    expect(elapsed).toBeLessThan(1000);
  });

  const PARITY = fileURLToPath(new URL('../../tests/fixtures/parity/expected_recommend.json', import.meta.url));
  const parityReady = ready && existsSync(PARITY);
  it.skipIf(!parityReady)('matches the Python scorer on the parity cases (tests/fixtures/parity/)', async () => {
    const artifacts = await loadArtifacts(FIXTURE);
    const ratings = resolveRatings(parseRatings(readFileSync(EXAMPLE, 'utf8')), artifacts.catalog);
    const { cases } = JSON.parse(readFileSync(PARITY, 'utf8')) as {
      cases: { name: string; query: object; query_embedding: number[] | null; expected: { item_id: string; score: number; because_of: string[] }[] }[];
    };
    for (const c of cases) {
      const embedQuery = async () => Float32Array.from(c.query_embedding ?? []);
      const recs = await recommend(artifacts, ratings, c.query, { embedQuery });
      expect(recs.map((r) => r.item_id), c.name).toEqual(c.expected.map((e) => e.item_id));
      expect(recs.map((r) => r.because_of), c.name).toEqual(c.expected.map((e) => e.because_of));
      recs.forEach((r, i) => expect(r.score, `${c.name} #${i}`).toBeCloseTo(c.expected[i]!.score, 5));
    }
  });

  const PARITY_EVALUATE = fileURLToPath(new URL('../../tests/fixtures/parity/expected_evaluate.json', import.meta.url));
  const evaluateReady = ready && existsSync(PARITY_EVALUATE);
  /** Every number in `actual` within 1e-6 of `expected`; everything else equal (null, strings, keys). */
  const expectClose = (actual: unknown, expected: unknown, path: string): void => {
    if (typeof expected === 'number') {
      expect(typeof actual, path).toBe('number');
      expect(Math.abs((actual as number) - expected), path).toBeLessThan(1e-6);
    } else if (Array.isArray(expected)) {
      expect(Array.isArray(actual), path).toBe(true);
      expect((actual as unknown[]).length, path).toBe(expected.length);
      expected.forEach((e, i) => expectClose((actual as unknown[])[i], e, `${path}[${i}]`));
    } else if (expected !== null && typeof expected === 'object') {
      expect(Object.keys(actual as object).sort(), path).toEqual(Object.keys(expected).sort());
      for (const [key, e] of Object.entries(expected)) expectClose((actual as Record<string, unknown>)[key], e, `${path}.${key}`);
    } else {
      expect(actual, path).toEqual(expected);
    }
  };
  it.skipIf(!evaluateReady)('holdoutEvaluate matches the Python holdout_evaluate to 1e-6 (tests/fixtures/parity/)', async () => {
    const artifacts = await loadArtifacts(FIXTURE);
    const ratings = parseRatings(readFileSync(EXAMPLE, 'utf8'));
    const { cases } = JSON.parse(readFileSync(PARITY_EVALUATE, 'utf8')) as {
      cases: { name: string; scorer: 'ease' | 'popularity'; options: { folds: number; k: number; seed: number }; expected: unknown }[];
    };
    const scorers: Record<string, HoldoutOptions['score']> = { ease: undefined, popularity: (a) => scorePopularity(a) };
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      const actual = holdoutEvaluate(artifacts, ratings, { ...c.options, score: scorers[c.scorer] });
      expectClose(JSON.parse(JSON.stringify(actual)), c.expected, c.name);
    }
  });
});
