/** Scoring: EASE row sums, cosine ranking, percentile-rank fusion, filters and explanations. */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  defaults,
  fuse,
  likeThreshold,
  likedIds,
  percentileRanks,
  loadArtifacts,
  recommend,
  scoreCf,
  scoreSemantic,
  zScores,
  type Artifacts,
  type Rating,
} from '../src/index.js';
import { imdbId, writeSyntheticArtifacts } from './helpers/synthetic.js';

const r = (j: number, score: number): Rating => ({ item_id: imdbId(j), score });

let a: Artifacts;
beforeAll(async () => {
  a = await loadArtifacts(await writeSyntheticArtifacts());
});

describe('liked items', () => {
  it('uses the fixed threshold below five ratings and the median from five on', () => {
    expect(likeThreshold([r(0, 90), r(1, 80)])).toBe(defaults.likes.fallbackThreshold);
    expect(likedIds([r(0, 90), r(1, 69)])).toEqual([imdbId(0)]);
    const six = [50, 60, 70, 80, 90, 100].map((s, j) => r(j, s));
    expect(likeThreshold(six)).toBe(75);
    expect(likedIds(six)).toEqual([3, 4, 5].map(imdbId));
  });
});

describe('scoreCf', () => {
  it('sums the rows of the liked items and blocks every rated item (hand-checked)', () => {
    // 3 ratings -> threshold 70 -> liked {0, 1}; rows 0 + 1 of B; item 3 is rated but not liked.
    const s = scoreCf(a, [r(0, 90), r(1, 80), r(3, 40)]);
    expect(s[0]).toBe(-Infinity);
    expect(s[1]).toBe(-Infinity);
    expect(s[3]).toBe(-Infinity);
    expect(s[2]).toBeCloseTo(0.3 + 0.2, 6);
    expect(s[5]).toBeCloseTo(-0.1, 6);
    for (const j of [4, 6, 7, 8, 9, 10, 11]) expect(s[j]).toBe(0);
  });

  it('ignores ratings of items outside the catalogue and adds extra liked ids', () => {
    const s = scoreCf(a, [{ item_id: 'tt9999999', score: 100 }], { extraLikedIds: [imdbId(5)] });
    expect(s[7]).toBeCloseTo(0.9, 6);
    expect(s[8]).toBeCloseTo(0.2, 6);
  });
});

describe('scoreSemantic', () => {
  it('ranks items by cosine with the query', () => {
    const s = scoreSemantic(a, Float32Array.from([2, 0, 0, 0]));
    expect(s[0]).toBeCloseTo(1, 6);
    expect(s[6]).toBeCloseTo(0, 6);
    expect(s[11]).toBeCloseTo(Math.cos((11 * Math.PI) / 12), 6);
    const order = [...s.keys()].sort((x, y) => s[y]! - s[x]!);
    expect(order).toEqual([...Array(12).keys()]);
  });

  it('refuses a query of the wrong dimension', () => {
    expect(() => scoreSemantic(a, [1, 0, 0])).toThrow(/3 dimensions, the artifact set expects 4/);
  });
});

describe('fuse', () => {
  it('keeps the z-score helper', () => {
    const z = zScores([1, 2, 3, 100], [0, 1, 2]);
    const sd = Math.sqrt(2 / 3);
    expect([...z].map((x) => +x.toFixed(6))).toEqual([-1 / sd, 0, 1 / sd].map((x) => +x.toFixed(6)));
  });

  it('percentile-ranks over the candidates: mean rank for ties, non-finite dropped and 0', () => {
    // candidates 0..4 -> values 5, 1, 5, -Inf, 9; finite n = 4, ranks 1.5, 0, 1.5, -, 3
    const p = percentileRanks([5, 1, 5, -Infinity, 9, 100], [0, 1, 2, 3, 4]);
    expect([...p]).toEqual([0.5, 0, 0.5, 0, 1]);
    expect([...percentileRanks([7], [0])]).toEqual([0]);
    expect([...percentileRanks([2, 2, 2], [0, 1, 2])]).toEqual([0.5, 0.5, 0.5]);
  });

  it('weights the percentile ranks; a heavy tail does not dominate', () => {
    const fused = fuse({ cf: [1, 2, 1000], semantic: [0.3, 0.2, 0.1], popularity: [3, 3, 3] }, [0, 1, 2], {
      cf: 2,
      semantic: 1,
      popularity: 1,
    });
    expect([...fused]).toEqual([2 * 0 + 1 + 0.5, 2 * 0.5 + 0.5 + 0.5, 2 * 1 + 0 + 0.5]);
    const noSemantic = fuse({ cf: [1, 2, 3] }, [0, 1, 2], { cf: 1, semantic: 1, popularity: 1 });
    expect([...noSemantic]).toEqual([0, 0.5, 1]); // missing components contribute 0
  });
});

describe('recommend', () => {
  const ratings = [r(0, 90), r(1, 80), r(3, 40)];

  it('never returns rated items, respects k and explains CF picks', async () => {
    const recs = await recommend(a, ratings, { k: 5, weights: { popularity: 0 } });
    expect(recs).toHaveLength(5);
    const ids = recs.map((x) => x.item_id);
    for (const j of [0, 1, 3]) expect(ids).not.toContain(imdbId(j));
    expect(recs[0]!.item_id).toBe(imdbId(2));
    expect(recs[0]!.because_of).toEqual([imdbId(0), imdbId(1)]);
    expect(recs[0]!.reasons).toEqual(['you liked Movie 0 (1990), Movie 1 (1991)']);
    expect(recs[1]!.reasons).toEqual(['popular: 120 ratings, mean 83/100']);
    expect(recs.slice(1).map((x) => x.idx)).toEqual([11, 10, 9, 8]); // CF ties broken by n_ratings
    const full = await recommend(a, ratings, { k: 12, weights: { popularity: 0 } });
    expect(full).toHaveLength(9);
    expect(full.at(-1)!.idx).toBe(5); // B[0,5] < 0 puts item 5 last
  });

  it('applies genre, year, popularity and id filters', async () => {
    const all = async (q: object) => (await recommend(a, ratings, { k: 12, ...q })).map((x) => x.idx);
    expect(await all({ exclude_genres: ['horror'] })).toEqual(expect.not.arrayContaining([4, 7, 10]));
    expect((await all({ include_genres: ['Comedy'] })).sort((x, y) => x - y)).toEqual([2, 5, 8, 11]);
    expect((await all({ year_min: 1995, year_max: 1997 })).sort((x, y) => x - y)).toEqual([5, 6, 7]);
    expect((await all({ min_ratings: 100 })).sort((x, y) => x - y)).toEqual([9, 10, 11]);
    expect(await all({ exclude_ids: [imdbId(2)] })).not.toContain(2);
    expect(await all({ like_ids: [imdbId(5)] })).not.toContain(5);
  });

  it('ranks by mood when only the semantic weight is on', async () => {
    const embedQuery = async () => Float32Array.from([1, 0, 0, 0]);
    const recs = await recommend(a, ratings, { mood: 'cosy', k: 3, weights: { cf: 0, semantic: 1, popularity: 0 } }, { embedQuery });
    expect(recs.map((x) => x.idx)).toEqual([2, 4, 5]);
    expect(recs[0]!.semantic_score).toBeCloseTo(Math.cos(Math.PI / 6), 5);
    expect(recs[0]!.reasons).toEqual(['you liked Movie 0 (1990), Movie 1 (1991)', 'close to "cosy" (similarity 0.87)']);
  });

  it('asks for embedQuery when a mood is given without one', async () => {
    await expect(recommend(a, ratings, { mood: 'tense' })).rejects.toThrow(/no embedQuery/);
  });

  it('ignores a mood, with a warning, when the set has no embeddings', async () => {
    const bare = await loadArtifacts(await writeSyntheticArtifacts({ withEmbeddings: false }));
    const warnings: string[] = [];
    const recs = await recommend(bare, ratings, { mood: 'tense', k: 2 }, { onWarning: (m) => warnings.push(m) });
    expect(recs).toHaveLength(2);
    expect(recs[0]!.semantic_score).toBeNull();
    expect(warnings[0]).toMatch(/no embeddings; ignoring the mood/);
  });

  it('falls back to popularity with no usable ratings', async () => {
    const recs = await recommend(a, [], { k: 3 });
    expect(recs.map((x) => x.idx)).toEqual([11, 10, 9]);
    expect(recs[0]!.cf_score).toBeNull();
    expect(recs[0]!.because_of).toEqual([]);
  });
});
