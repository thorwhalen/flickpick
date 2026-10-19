/** Science: ranking metrics, correlations, fits and the hold-out evaluation against hand values. */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  agreement,
  averageRanks,
  bootstrapMeanCi,
  crossValidatedFit,
  holdoutEvaluate,
  loadArtifacts,
  mulberry32,
  olsFit,
  pearson,
  rankingMetrics,
  shuffled,
  spearman,
  topKByScore,
  type Artifacts,
  type CatalogItem,
  type Rating,
} from '../src/index.js';
import { imdbId, syntheticCatalog, writeSyntheticArtifacts } from './helpers/synthetic.js';

describe('rankingMetrics', () => {
  it('matches hand-computed values', () => {
    // hits at ranks 2 and 4 out of 3 relevant items, k = 4
    const m = rankingMetrics([5, 3, 8, 1], [3, 1, 9], 4);
    expect(m.hit_rate).toBe(1);
    expect(m.recall).toBeCloseTo(2 / 3, 12);
    expect(m.precision).toBe(0.5);
    const dcg = 1 / Math.log2(3) + 1 / Math.log2(5);
    const idcg = 1 + 1 / Math.log2(3) + 1 / Math.log2(4);
    expect(m.ndcg).toBeCloseTo(dcg / idcg, 12);
    expect(rankingMetrics([1, 2], [9], 2)).toEqual({ hit_rate: 0, recall: 0, ndcg: 0, precision: 0 });
    expect(rankingMetrics([9, 2], [9], 2).ndcg).toBe(1);
  });

  it('rejects an empty held-out set', () => {
    expect(() => rankingMetrics([1], [], 1)).toThrow(/empty/);
  });
});

describe('correlation and fits', () => {
  const x = [1, 2, 3, 4];
  const y = [2, 4, 5, 9];

  it('Pearson and OLS match hand values', () => {
    // sxy = 11, sxx = 5, syy = 26
    expect(pearson(x, y)).toBeCloseTo(11 / Math.sqrt(130), 12);
    const fit = olsFit(x, y);
    expect(fit.slope).toBeCloseTo(2.2, 12);
    expect(fit.intercept).toBeCloseTo(-0.5, 12);
    expect(pearson([1], [1])).toBeNaN();
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNaN();
  });

  it('Spearman uses average ranks for ties', () => {
    expect(averageRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
    expect(spearman([1, 2, 3, 4], [1, 4, 9, 16])).toBeCloseTo(1, 12);
    // ranks x [1,2.5,2.5,4] vs y [1,2,3,4]: sxy = 4.5, sxx = 4.5, syy = 5
    expect(spearman([10, 20, 20, 30], [1, 2, 3, 4])).toBeCloseTo(4.5 / Math.sqrt(4.5 * 5), 12);
  });

  it('agreement joins ratings with the catalogue mean_rating', () => {
    const catalog = syntheticCatalog() as CatalogItem[]; // mean_rating = 50 + 3j
    const ratings: Rating[] = [0, 1, 2, 3].map((j) => ({ item_id: imdbId(j), score: 60 + 6 * j }));
    ratings.push({ item_id: 'tt9999999', score: 10 }); // not in the catalogue: ignored
    const a = agreement(ratings, catalog);
    expect(a.n).toBe(4);
    expect(a.pearson).toBeCloseTo(1, 12);
    expect(a.spearman).toBeCloseTo(1, 12);
    expect(a.slope).toBeCloseTo(2, 12);
    expect(a.intercept).toBeCloseTo(60 - 2 * 50, 12);
  });

  it('crossValidatedFit: an exact line beats the user-mean baseline', () => {
    const catalog = syntheticCatalog() as CatalogItem[];
    const ratings: Rating[] = catalog.map((c) => ({ item_id: c.imdb_id, score: 0.5 * c.mean_rating! + 20 }));
    const fit = crossValidatedFit(ratings, catalog, { folds: 4, seed: 1 });
    expect(fit.n).toBe(12);
    expect(fit.linear.rmse).toBeLessThan(1e-9);
    expect(fit.linear.mae).toBeLessThan(1e-9);
    expect(fit.baseline.rmse).toBeGreaterThan(5);
    expect(() => crossValidatedFit(ratings.slice(0, 2), catalog, { folds: 5 })).toThrow(/need at least folds=5/);
  });

  it('agreement: the minimum and no-spread rule of the Python core (#7)', () => {
    // Same cases as tests/test_science.py::test_agreement_minimum_is_the_typescript_rule.
    const catalog = Array.from({ length: 20 }, (_, i) => ({ ...(syntheticCatalog()[0] as CatalogItem), imdb_id: imdbId(i), mean_rating: 40 + 2 * i }));
    const ratings: Rating[] = catalog.map((c) => ({ item_id: c.imdb_id, score: 2 * c.mean_rating! - 50 }));
    const undefinedStats = { pearson: NaN, spearman: NaN, slope: NaN, intercept: NaN };
    expect(agreement(ratings.slice(0, 2), catalog)).toEqual({ ...undefinedStats, n: 2 });
    expect(agreement([], catalog)).toEqual({ ...undefinedStats, n: 0 });
    const three = agreement(ratings.slice(0, 3), catalog);
    expect(three.n).toBe(3);
    expect(three.pearson).toBeCloseTo(1, 12);
    expect(three.spearman).toBeCloseTo(1, 12);
    expect(three.slope).toBeCloseTo(2, 12);
    expect(three.intercept).toBeCloseTo(-50, 12);
    const flat = catalog.map((c) => ({ ...c, mean_rating: 60 })); // no spread in mean_rating
    expect(agreement(ratings.slice(0, 4), flat)).toEqual({ ...undefinedStats, n: 4 });
    expect(agreement(ratings.slice(0, 2), catalog, { minPoints: 2 }).slope).toBeCloseTo(2, 12);
  });

  it.each([-1, 0, 1, 2.5])('folds=%s is refused with the Python check_folds message (#7)', (folds) => {
    const catalog = syntheticCatalog() as CatalogItem[];
    const ratings: Rating[] = catalog.map((c) => ({ item_id: c.imdb_id, score: 0.5 * c.mean_rating! + 20 }));
    const message = `folds must be an integer of at least 2; got ${folds}`;
    expect(() => crossValidatedFit(ratings, catalog, { folds })).toThrow(message);
    expect(crossValidatedFit(ratings, catalog, { folds: 2 }).folds).toBe(2);
  });

  it('crossValidatedFit: one item per fold is enough, as in the Python core (#4)', () => {
    const catalog = syntheticCatalog() as CatalogItem[];
    const ratings: Rating[] = catalog.map((c) => ({ item_id: c.imdb_id, score: 0.5 * c.mean_rating! + 20 }));
    expect(() => crossValidatedFit(ratings.slice(0, 4), catalog, { folds: 5 })).toThrow(/need at least folds=5/);
    const fit = crossValidatedFit(ratings.slice(0, 5), catalog, { folds: 5 });
    expect(fit.n).toBe(5);
    expect(fit.linear.rmse).toBeLessThan(1e-9); // 4 training points fit the line
    // Two folds of one item each: a one-point training fold falls back to the baseline.
    const two = crossValidatedFit(ratings.slice(0, 2), catalog, { folds: 2 });
    expect(two.linear.rmse).toBeCloseTo(two.baseline.rmse, 12);
    expect(two.linear.mae).toBeCloseTo(two.baseline.mae, 12);
  });
});

describe('resampling', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('mulberry32 matches the Python mulberry32 bit for bit (values from flickpick.science)', () => {
    const r = mulberry32(42);
    expect([r(), r(), r()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
    const z = mulberry32(4294967295);
    expect(z()).toBe(0.8964226141106337);
  });

  it('bootstrap interval brackets the mean and collapses for constant data', () => {
    expect(bootstrapMeanCi([3, 3, 3])).toEqual([3, 3]);
    const [lo, hi] = bootstrapMeanCi([0, 1, 0, 1, 1, 0, 1, 0]);
    expect(lo).toBeLessThanOrEqual(0.5);
    expect(hi).toBeGreaterThanOrEqual(0.5);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
  });
});

describe('holdoutEvaluate', () => {
  let art: Artifacts;
  beforeAll(async () => {
    art = await loadArtifacts(await writeSyntheticArtifacts());
  });
  // ten ratings; median 72.5 -> liked: items 0, 1, 2, 5, 6 (scores >= 72.5)
  const ratings: Rating[] = [
    [0, 90], [1, 85], [2, 80], [5, 75], [6, 73], [3, 72], [4, 60], [7, 50], [8, 40], [9, 30],
  ].map(([j, s]) => ({ item_id: imdbId(j!), score: s! }));

  it('is deterministic for a seed and reports per-fold metrics with intervals', () => {
    const res = holdoutEvaluate(art, ratings, { folds: 5, k: 2, seed: 7 });
    expect(Object.keys(res).sort()).toEqual(['ci95', 'folds', 'k', 'mean', 'n_liked', 'n_rated', 'note', 'per_fold']);
    expect(res.n_liked).toBe(5);
    expect(res.n_rated).toBe(10);
    expect(res.folds).toBe(5);
    expect(res.per_fold).toHaveLength(5);
    expect(res.per_fold.every((f) => f.n_test === 1)).toBe(true);
    for (const m of ['recall', 'ndcg', 'precision'] as const) {
      const [lo, hi] = res.ci95[m]!;
      expect(lo).toBeLessThanOrEqual(res.mean[m] + 1e-12);
      expect(hi).toBeGreaterThanOrEqual(res.mean[m] - 1e-12);
    }
    // hit_rate is per fold: no interval below minFoldsForFoldCi folds, and the note says why
    expect(res.ci95.hit_rate).toBeNull();
    expect(res.note).toMatch(/hit_rate is per fold/);
    expect(holdoutEvaluate(art, ratings, { folds: 5, k: 2, seed: 7, minFoldsForFoldCi: 5 }).ci95.hit_rate).toHaveLength(2);
    expect(holdoutEvaluate(art, ratings, { folds: 5, k: 2, seed: 7 })).toEqual(res);
  });

  it('folds: sorted liked ids, mulberry32 Fisher-Yates, position mod folds', () => {
    const liked = [0, 1, 2, 5, 6].map(imdbId).sort();
    const order = shuffled(liked, mulberry32(3));
    const res = holdoutEvaluate(art, ratings, { folds: 2, k: 2, seed: 3 });
    expect(res.per_fold.map((f) => f.test_ids)).toEqual([order.filter((_, p) => p % 2 === 0), order.filter((_, p) => p % 2 === 1)]);
  });

  it('restricts ratings to the catalogue before the like threshold', () => {
    // low scores outside the catalogue would pull the median down and add liked items
    const extra: Rating[] = Array.from({ length: 20 }, (_, i) => ({ item_id: `tt99${String(i).padStart(5, '0')}`, score: 5 }));
    const res = holdoutEvaluate(art, [...ratings, ...extra], { folds: 5, k: 2, seed: 7 });
    expect(res.n_liked).toBe(5);
    expect(res.n_rated).toBe(10);
  });

  it('finds an item recoverable from the rest (item 2 from items 0 and 1)', () => {
    // Holding out item 2 leaves nine ratings, median 72, liked {0, 1, 3, 5, 6}; the only
    // unrated items are 2, 10 and 11, and B[0,2] + B[1,2] = 0.5 puts item 2 first.
    const res = holdoutEvaluate(art, ratings, { folds: 5, k: 1, seed: 7 });
    const fold2 = res.per_fold.find((f) => f.test_ids.includes(imdbId(2)))!;
    expect(fold2.test_ids).toEqual([imdbId(2)]);
    expect(fold2.metrics).toEqual({ hit_rate: 1, recall: 1, ndcg: 1, precision: 1 });
  });

  it('ranks only items outside the training ratings, ties by n_ratings then row', () => {
    // a constant scorer: every unrated item ties, so the order is n_ratings desc (= row desc here)
    const res = holdoutEvaluate(art, ratings, { folds: 5, k: 3, seed: 7, score: (a) => new Float64Array(a.manifest.n_items) });
    for (const f of res.per_fold) {
      const held = f.test_ids.map((id) => art.idToIdx.get(id)!);
      const top = topKByScore(art, new Float64Array(art.manifest.n_items), 3, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((i) => !held.includes(i)));
      expect(top.slice(0, 2)).toEqual([11, 10]);
      expect(f.metrics.hit_rate).toBe(top.some((i) => held.includes(i)) ? 1 : 0);
    }
    expect(topKByScore(art, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 3)).toEqual([11, 10, 9]);
    expect(topKByScore(art, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 3, [11])).toEqual([10, 9, 8]);
  });

  it('needs at least as many liked items as folds', () => {
    expect(() => holdoutEvaluate(art, ratings.slice(0, 2), { folds: 5 })).toThrow(/need at least folds=5/);
  });

  it.each([-1, 0, 1, 2.5])('refuses folds=%s before reading the ratings (#7)', (folds) => {
    expect(() => holdoutEvaluate(art, ratings, { folds })).toThrow(`folds must be an integer of at least 2; got ${folds}`);
  });
});
