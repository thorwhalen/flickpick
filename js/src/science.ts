/**
 * Personal evaluation and agreement statistics: pure numeric functions over arrays.
 *
 * - `rankingMetrics`: hit rate, recall, precision and nDCG at k for one ranked list.
 * - `holdoutEvaluate`: k-fold over the user's liked items (seeded shuffle), rank the catalogue from
 *   the rest, score the held-out fold; mean per metric with a bootstrap interval over held-out
 *   items. Specified in docs/core-contract.md (Science) and identical to the Python
 *   `holdout_evaluate` (parity fixture: tests/fixtures/parity/expected_evaluate.json).
 * - `agreement`: Pearson, Spearman (average ranks), n and the OLS line of the user's scores
 *   against the population `mean_rating`.
 * - `crossValidatedFit`: k-fold RMSE / MAE of that linear fit versus the user-mean baseline.
 *
 * Undefined statistics (too few points, zero variance) are `NaN`, never a thrown error.
 */
import { defaults } from './defaults.js';
import { resolveRatings } from './importers.js';
import { likeThreshold, scoreCf, topKByScore, type LikeOptions } from './scoring.js';
import type { Artifacts, CatalogItem, Rating } from './types.js';

// ---------------------------------------------------------------------------------- basics

/**
 * Seeded PRNG (mulberry32): same seed, same sequence, in every runtime, and bit-identical to the
 * Python `mulberry32`. Returns floats in [0, 1).
 */
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

/**
 * Means of `resamples` bootstrap resamples of the rows of `rows` (each row a vector of equal
 * length). Resample b draws row `floor(u * n)` for n consecutive outputs u of `mulberry32(seed)`;
 * every column uses the same draws. Same draws as the Python `_bootstrap_means`.
 */
export function bootstrapMeans(rows: readonly (readonly number[])[], { resamples, seed }: { resamples: number; seed: number }): number[][] {
  const n = rows.length;
  const width = rows[0]?.length ?? 0;
  const random = mulberry32(seed);
  return Array.from({ length: resamples }, () => {
    const sums = new Array<number>(width).fill(0);
    for (let i = 0; i < n; i++) {
      const row = rows[Math.floor(random() * n)]!;
      for (let c = 0; c < width; c++) sums[c]! += row[c]!;
    }
    return sums.map((s) => s / n);
  });
}

/** Percentile interval (linear-interpolated quantiles) of each column of bootstrap means. */
function percentileInterval(means: readonly (readonly number[])[], column: number, level: number): [number, number] {
  const values = means.map((m) => m[column]!);
  const tail = (1 - level) / 2;
  return [quantile(values, tail), quantile(values, 1 - tail)];
}

/** Percentile-bootstrap interval of the mean (same draws as the Python `bootstrap_ci`). */
export function bootstrapMeanCi(
  xs: readonly number[],
  {
    resamples = defaults.science.bootstrapResamples,
    level = defaults.science.ciLevel,
    seed = defaults.science.seed,
  }: { resamples?: number; level?: number; seed?: number } = {},
): [number, number] {
  if (!xs.length) return [NaN, NaN];
  return percentileInterval(bootstrapMeans(xs.map((x) => [x]), { resamples, seed }), 0, level);
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
/** Metrics that are a mean of per-held-out-item contributions, bootstrapped per item. */
const ITEM_METRICS = ['recall', 'ndcg', 'precision'] as const;

const dcgDiscount = (rank0: number) => 1 / Math.log2(rank0 + 2);

export interface HoldoutOptions extends LikeOptions {
  folds?: number;
  k?: number;
  seed?: number;
  bootstrapResamples?: number;
  ciLevel?: number;
  /** Below this many folds, `hit_rate` (a per-fold quantity) gets no interval. */
  minFoldsForFoldCi?: number;
  /**
   * Scorer over the training ratings (seam 2); defaults to `scoreCf`. Its scores are ranked
   * over every catalogue item outside the training ratings; non-finite scores are skipped.
   */
  score?: (artifacts: Artifacts, trainRatings: readonly Rating[]) => ArrayLike<number>;
}

export interface HoldoutFold {
  fold: number;
  n_test: number;
  test_ids: string[];
  metrics: RankingMetrics;
}

/** Same shape as the Python `holdout_evaluate` result. */
export interface HoldoutResult {
  folds: number;
  k: number;
  n_liked: number;
  /** Ratings found in the catalogue (one per item). */
  n_rated: number;
  per_fold: HoldoutFold[];
  mean: RankingMetrics;
  /** `null` for `hit_rate` with fewer than `minFoldsForFoldCi` folds (see `note`). */
  ci95: Record<keyof RankingMetrics, [number, number] | null>;
  note: string | null;
}

/**
 * Step (a) of the evaluation: the ratings found in the catalogue (after `resolveRatings`), one
 * per item (the latest wins), re-keyed to the catalogue `imdb_id`, in catalogue row order.
 */
export function catalogueRatings(artifacts: Artifacts, ratings: readonly Rating[]): Rating[] {
  const latest = new Map<number, number>();
  for (const r of resolveRatings(ratings, artifacts.catalog)) {
    const idx = artifacts.idToIdx.get(r.item_id);
    if (idx !== undefined) latest.set(idx, r.score);
  }
  return [...latest.keys()]
    .sort((a, b) => a - b)
    .map((idx) => ({ item_id: artifacts.catalog[idx]!.imdb_id, score: latest.get(idx)! }));
}

/**
 * Per held-out item `[recall, ndcg, precision]` contributions of one fold, scaled so that their
 * mean over every held-out item equals the mean over folds of the fold metric.
 */
function itemContributions(top: readonly number[], held: readonly number[], k: number, nLiked: number, folds: number): number[][] {
  const position = new Map(top.slice(0, k).map((idx, p) => [idx, p]));
  let idcg = 0;
  for (let r = 0; r < Math.min(k, held.length); r++) idcg += dcgDiscount(r);
  return held.map((i) => {
    const p = position.get(i);
    const hit = p === undefined ? 0 : 1;
    const disc = p === undefined ? 0 : dcgDiscount(p);
    return [(hit * nLiked) / (folds * held.length), (disc * nLiked) / (folds * idcg), (hit * nLiked) / (folds * k)];
  });
}

/**
 * k-fold hold-out over the user's liked items, ranked over the full catalogue. Steps (a)-(f) of
 * docs/core-contract.md (Science), identical to the Python `holdout_evaluate`: restrict the
 * ratings to the catalogue; liked = at or above the like threshold of that set; sort the liked
 * ids, shuffle them with `mulberry32(seed)`, deal them round-robin into folds; per fold, score
 * the training ratings and rank every item outside them. `ci95` bootstraps held-out items for
 * recall, NDCG and precision; `hit_rate`'s is over folds, and null below `minFoldsForFoldCi`.
 */
export function holdoutEvaluate(artifacts: Artifacts, ratings: readonly Rating[], options: HoldoutOptions = {}): HoldoutResult {
  const {
    folds = defaults.science.folds,
    k = defaults.science.k,
    seed = defaults.science.seed,
    bootstrapResamples = defaults.science.bootstrapResamples,
    ciLevel = defaults.science.ciLevel,
    minFoldsForFoldCi = defaults.science.minFoldsForFoldCi,
    score = (a: Artifacts, r: readonly Rating[]) => scoreCf(a, r, options),
  } = options;
  const rated = catalogueRatings(artifacts, ratings);
  const threshold = likeThreshold(rated, options);
  const liked = rated
    .filter((r) => r.score >= threshold)
    .map((r) => r.item_id)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (liked.length < folds) {
    throw new Error(`holdoutEvaluate: ${liked.length} liked items in the catalogue, need at least folds=${folds}`);
  }
  const toIdx = (id: string) => artifacts.idToIdx.get(id)!;
  const contributions: number[][] = [];
  const perFold = kFolds(shuffled(liked, mulberry32(seed)), folds).map((testIds, fold): HoldoutFold => {
    const held = new Set(testIds);
    const train = rated.filter((r) => !held.has(r.item_id));
    const top = topKByScore(artifacts, score(artifacts, train), k, train.map((r) => toIdx(r.item_id)));
    const testIdx = testIds.map(toIdx);
    contributions.push(...itemContributions(top, testIdx, k, liked.length, folds));
    return { fold, n_test: testIds.length, test_ids: testIds, metrics: rankingMetrics(top, testIdx, k) };
  });
  const values = (m: keyof RankingMetrics) => perFold.map((f) => f.metrics[m]);
  const itemMeans = bootstrapMeans(contributions, { resamples: bootstrapResamples, seed });
  const ci95 = Object.fromEntries(ITEM_METRICS.map((m, c) => [m, percentileInterval(itemMeans, c, ciLevel)])) as HoldoutResult['ci95'];
  const foldCi = folds >= minFoldsForFoldCi;
  ci95.hit_rate = foldCi ? bootstrapMeanCi(values('hit_rate'), { resamples: bootstrapResamples, level: ciLevel, seed }) : null;
  return {
    folds,
    k,
    n_liked: liked.length,
    n_rated: rated.length,
    per_fold: perFold,
    mean: Object.fromEntries(METRIC_NAMES.map((m) => [m, mean(values(m))])) as unknown as RankingMetrics,
    ci95: Object.fromEntries(METRIC_NAMES.map((m) => [m, ci95[m]])) as HoldoutResult['ci95'],
    note: foldCi
      ? null
      : `hit_rate is per fold (any held-out item in the top ${k}); with ${folds} < ${minFoldsForFoldCi} folds its interval is not reported.`,
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
