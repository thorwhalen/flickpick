/**
 * Personal evaluation and agreement statistics: pure numeric functions over arrays.
 *
 * - `rankingMetrics`: hit rate, recall, precision and nDCG at k for one ranked list.
 * - `holdoutEvaluate`: k-fold over the user's liked items (seeded shuffle), recommend from the
 *   rest, score the held-out fold; mean per metric with a percentile-bootstrap interval.
 * - `agreement`: Pearson, Spearman (average ranks), n and the OLS line of the user's scores
 *   against the population `mean_rating`.
 * - `crossValidatedFit`: k-fold RMSE / MAE of that linear fit versus the user-mean baseline.
 *
 * Undefined statistics (too few points, zero variance) are `NaN`, never a thrown error.
 */
import { defaults } from './defaults.js';
import { idsToIdx, likedIdx, scoreCf, topKByScore, type LikeOptions } from './scoring.js';
import type { Artifacts, CatalogItem, Rating } from './types.js';

// ---------------------------------------------------------------------------------- basics

/** Seeded PRNG (mulberry32): same seed, same sequence, in every runtime. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Split into `folds` round-robin groups (sizes differ by at most one). */
export function kFolds<T>(items: readonly T[], folds: number): T[][] {
  const out: T[][] = Array.from({ length: folds }, () => []);
  items.forEach((x, i) => out[i % folds]!.push(x));
  return out;
}

export const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);

/** Linear-interpolated quantile of a list (q in [0, 1]). */
export function quantile(xs: readonly number[], q: number): number {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** Percentile-bootstrap interval of the mean. */
export function bootstrapMeanCi(
  xs: readonly number[],
  {
    resamples = defaults.science.bootstrapResamples,
    level = defaults.science.ciLevel,
    seed = defaults.science.seed,
  }: { resamples?: number; level?: number; seed?: number } = {},
): [number, number] {
  if (!xs.length) return [NaN, NaN];
  const random = mulberry32(seed);
  const means = Array.from({ length: resamples }, () => {
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += xs[Math.floor(random() * xs.length)]!;
    return s / xs.length;
  });
  const tail = (1 - level) / 2;
  return [quantile(means, tail), quantile(means, 1 - tail)];
}

// ---------------------------------------------------------------------------------- ranking

export interface RankingMetrics {
  hit_rate: number;
  recall: number;
  ndcg: number;
  precision: number;
}

/**
 * Metrics at `k` with binary relevance. `hit_rate` is 1 when any held-out item is in the top k;
 * `recall` = hits / |heldOut|; `precision` = hits / k; `ndcg` = DCG / ideal DCG with
 * gain 1 / log2(rank + 1), rank starting at 1.
 */
export function rankingMetrics(recommendedIdx: readonly number[], heldOutIdx: readonly number[], k: number): RankingMetrics {
  if (k <= 0) throw new RangeError(`rankingMetrics: k must be positive, got ${k}`);
  const relevant = new Set(heldOutIdx);
  if (!relevant.size) throw new RangeError('rankingMetrics: heldOutIdx is empty');
  const top = recommendedIdx.slice(0, k);
  let hits = 0;
  let dcg = 0;
  top.forEach((idx, rank) => {
    if (relevant.has(idx)) {
      hits++;
      dcg += 1 / Math.log2(rank + 2);
    }
  });
  let idcg = 0;
  for (let rank = 0; rank < Math.min(k, relevant.size); rank++) idcg += 1 / Math.log2(rank + 2);
  return { hit_rate: hits > 0 ? 1 : 0, recall: hits / relevant.size, ndcg: dcg / idcg, precision: hits / k };
}

const METRIC_NAMES: (keyof RankingMetrics)[] = ['hit_rate', 'recall', 'ndcg', 'precision'];

export interface HoldoutOptions extends LikeOptions {
  folds?: number;
  k?: number;
  seed?: number;
  bootstrapResamples?: number;
  ciLevel?: number;
  /** Scorer over training ratings (seam 2); defaults to `scoreCf`. Rated items must be -Infinity. */
  score?: (artifacts: Artifacts, trainRatings: readonly Rating[]) => ArrayLike<number>;
}

export interface HoldoutResult {
  k: number;
  folds: { fold: number; n_test: number; test_ids: string[]; metrics: RankingMetrics }[];
  mean: RankingMetrics;
  ci95: Record<keyof RankingMetrics, [number, number]>;
  n_liked: number;
  n_rated_in_catalog: number;
}

/**
 * k-fold hold-out over the user's liked items (those in the catalogue): each fold's items are
 * removed from the ratings, the remaining ratings are scored, and the fold is looked for in
 * the top `k` unrated items.
 */
export function holdoutEvaluate(artifacts: Artifacts, ratings: readonly Rating[], options: HoldoutOptions = {}): HoldoutResult {
  const {
    folds = defaults.science.folds,
    k = defaults.science.k,
    seed = defaults.science.seed,
    bootstrapResamples = defaults.science.bootstrapResamples,
    ciLevel = defaults.science.ciLevel,
    score = (a: Artifacts, r: readonly Rating[]) => scoreCf(a, r, options),
  } = options;
  const liked = likedIdx(artifacts, ratings, options);
  if (liked.length < folds) {
    throw new Error(`holdoutEvaluate: ${liked.length} liked items in the catalogue, need at least folds=${folds}`);
  }
  const groups = kFolds(shuffled(liked, mulberry32(seed)), folds);
  const perFold = groups.map((test, fold) => {
    const testIds = test.map((i) => artifacts.catalog[i]!.imdb_id);
    const held = new Set(testIds);
    const train = ratings.filter((r) => !held.has(r.item_id));
    const top = topKByScore(artifacts, score(artifacts, train), k);
    return { fold, n_test: test.length, test_ids: testIds, metrics: rankingMetrics(top, test, k) };
  });
  const values = (m: keyof RankingMetrics) => perFold.map((f) => f.metrics[m]);
  const ci = (m: keyof RankingMetrics) => bootstrapMeanCi(values(m), { resamples: bootstrapResamples, level: ciLevel, seed });
  return {
    k,
    folds: perFold,
    mean: Object.fromEntries(METRIC_NAMES.map((m) => [m, mean(values(m))])) as unknown as RankingMetrics,
    ci95: Object.fromEntries(METRIC_NAMES.map((m) => [m, ci(m)])) as HoldoutResult['ci95'],
    n_liked: liked.length,
    n_rated_in_catalog: idsToIdx(artifacts, new Set(ratings.map((r) => r.item_id))).length,
  };
}

// ---------------------------------------------------------------------------------- agreement

/** Pearson correlation; NaN with fewer than 2 points or zero variance. */
export function pearson(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  if (n !== y.length) throw new RangeError(`pearson: lengths differ (${n} vs ${y.length})`);
  if (n < 2) return NaN;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sxx += (x[i]! - mx) ** 2;
    syy += (y[i]! - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Ranks starting at 1, ties get the average of their ranks. */
export function averageRanks(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const ranks = new Array<number>(xs.length);
  for (let start = 0; start < order.length; ) {
    let end = start;
    while (end + 1 < order.length && order[end + 1]!.x === order[start]!.x) end++;
    const rank = (start + end) / 2 + 1;
    for (let p = start; p <= end; p++) ranks[order[p]!.i] = rank;
    start = end + 1;
  }
  return ranks;
}

/** Spearman correlation: Pearson over average ranks. */
export function spearman(x: readonly number[], y: readonly number[]): number {
  return pearson(averageRanks(x), averageRanks(y));
}

/** Ordinary least squares `y = slope * x + intercept`; slope NaN when x has no spread. */
export function olsFit(x: readonly number[], y: readonly number[]): { slope: number; intercept: number } {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sxx += (x[i]! - mx) ** 2;
  }
  if (!(sxx > 0)) return { slope: NaN, intercept: NaN };
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/** Pairs (population mean_rating, user score) for rated catalogue items with a mean rating. */
export function ratingPairs(ratings: readonly Rating[], catalog: readonly CatalogItem[]): { x: number[]; y: number[] } {
  const meanById = new Map(catalog.filter((c) => c.mean_rating !== null).map((c) => [c.imdb_id, c.mean_rating!]));
  const latest = new Map(ratings.map((r) => [r.item_id, r.score]));
  const x: number[] = [];
  const y: number[] = [];
  for (const [id, score] of latest) {
    const m = meanById.get(id);
    if (m !== undefined) {
      x.push(m);
      y.push(score);
    }
  }
  return { x, y };
}

export interface Agreement {
  pearson: number;
  spearman: number;
  n: number;
  slope: number;
  intercept: number;
}

/** How the user's scores line up with the population's `mean_rating`. */
export function agreement(ratings: readonly Rating[], catalog: readonly CatalogItem[]): Agreement {
  const { x, y } = ratingPairs(ratings, catalog);
  return { pearson: pearson(x, y), spearman: spearman(x, y), n: x.length, ...olsFit(x, y) };
}

export interface FitErrors {
  rmse: number;
  mae: number;
}

export interface CrossValidatedFit {
  n: number;
  folds: number;
  linear: FitErrors;
  baseline: FitErrors;
}

/**
 * k-fold cross-validated errors of predicting the user's score from `mean_rating` with an OLS
 * line (`linear`), against predicting the training-fold mean of the user's scores (`baseline`).
 * A training fold with no spread in `mean_rating` falls back to the baseline prediction.
 */
export function crossValidatedFit(
  ratings: readonly Rating[],
  catalog: readonly CatalogItem[],
  { folds = defaults.science.folds, seed = defaults.science.seed }: { folds?: number; seed?: number } = {},
): CrossValidatedFit {
  const { x, y } = ratingPairs(ratings, catalog);
  if (x.length < folds) throw new Error(`crossValidatedFit: ${x.length} ratings matched the catalogue, need at least folds=${folds}`);
  const groups = kFolds(shuffled([...x.keys()], mulberry32(seed)), folds);
  const linErr: number[] = [];
  const baseErr: number[] = [];
  for (const test of groups) {
    const testSet = new Set(test);
    const trainIdx = [...x.keys()].filter((i) => !testSet.has(i));
    const tx = trainIdx.map((i) => x[i]!);
    const ty = trainIdx.map((i) => y[i]!);
    const base = mean(ty);
    const { slope, intercept } = olsFit(tx, ty);
    for (const i of test) {
      const linear = Number.isFinite(slope) ? slope * x[i]! + intercept : base;
      linErr.push(y[i]! - linear);
      baseErr.push(y[i]! - base);
    }
  }
  const errors = (e: number[]): FitErrors => ({
    rmse: Math.sqrt(mean(e.map((d) => d * d))),
    mae: mean(e.map(Math.abs)),
  });
  return { n: x.length, folds, linear: errors(linErr), baseline: errors(baseErr) };
}
