/**
 * End-to-end on the Python-built fixture (`tests/fixtures/artifacts_small/`, MovieLens
 * ml-latest-small) with the example ratings file: the architecture's one-command test, minus
 * the mood. Skipped, with the reason in its name, when the fixture has not been built.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadArtifacts, parseRatings, recommend, resolveRatings } from '../src/index.js';

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
});
