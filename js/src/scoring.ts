/**
 * Score catalogue items for a user and turn the scores into recommendations.
 *
 * - `scoreCf`: EASE row sum over the user's liked items (seam 2's v1 default).
 * - `scoreSemantic`: brute-force cosine between a query embedding and every item embedding.
 * - `fuse`: percentile-rank each available component over the candidate set, then a weighted
 *   sum. Ranks, not z-scores: EASE scores are heavy-tailed (z up to ~15 against ~3 for the
 *   cosine), so z-score fusion let CF drown the mood.
 * - `recommend`: structured filters, fusion, ranking, `reasons` and `because_of`.
 *
 * Every number comes from `defaults` (re-exported here) or from the options argument.
 */
import { defaults } from './defaults.js';
import {
  QuerySchema,
  type Artifacts,
  type CatalogItem,
  type EmbedQuery,
  type Query,
  type QueryInput,
  type Rating,
  type Recommendation,
  type Weights,
} from './types.js';

export { defaults };

export interface LikeOptions {
  /** Below this many ratings, `fallbackThreshold` replaces the median. */
  minRatingsForMedian?: number;
  /** Fixed like threshold (0-100) for users with few ratings. */
  fallbackThreshold?: number;
}

export interface ScoreCfOptions extends LikeOptions {
  /** Extra item ids treated as liked regardless of score (e.g. `query.like_ids`). */
  extraLikedIds?: readonly string[];
}

/** The last score per item id (later ratings of the same item win). */
function latestScores(ratings: readonly Rating[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const r of ratings) scores.set(r.item_id, r.score);
  return scores;
}

/** Median of a non-empty list. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('median of an empty list');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The score at or above which a rating counts as liked: the median of all the user's scores
 * (in the catalogue or not), or the fixed fallback with few ratings.
 */
export function likeThreshold(ratings: readonly Rating[], options: LikeOptions = {}): number {
  const { minRatingsForMedian = defaults.likes.minRatingsForMedian, fallbackThreshold = defaults.likes.fallbackThreshold } =
    options;
  const scores = ratings.map((r) => r.score);
  return scores.length < minRatingsForMedian ? fallbackThreshold : median(scores);
}

/** Item ids of the liked ratings (score >= `likeThreshold`). */
export function likedIds(ratings: readonly Rating[], options: LikeOptions = {}): string[] {
  const threshold = likeThreshold(ratings, options);
  return [...latestScores(ratings)].filter(([, s]) => s >= threshold).map(([id]) => id);
}

/** Map item ids to catalogue rows, dropping ids the catalogue does not have. */
export function idsToIdx(artifacts: Artifacts, ids: Iterable<string>): number[] {
  const out: number[] = [];
  for (const id of ids) {
    const idx = artifacts.idToIdx.get(id);
    if (idx !== undefined) out.push(idx);
  }
  return out;
}

/** Row indices of the user's liked items (plus `extraLikedIds`) that are in the catalogue. */
export function likedIdx(artifacts: Artifacts, ratings: readonly Rating[], options: ScoreCfOptions = {}): number[] {
  const ids = new Set([...likedIds(ratings, options), ...(options.extraLikedIds ?? [])]);
  return idsToIdx(artifacts, ids);
}

/**
 * EASE collaborative score: `s_j = sum over liked i of B[i, j]`. Every rated item (liked or
 * not) is set to `-Infinity` so it can never be recommended.
 */
export function scoreCf(artifacts: Artifacts, ratings: readonly Rating[], options: ScoreCfOptions = {}): Float32Array {
  const { indptr, indices, values } = artifacts.cf;
  const scores = new Float32Array(artifacts.manifest.n_items);
  for (const i of likedIdx(artifacts, ratings, options)) {
    for (let p = indptr[i]!; p < indptr[i + 1]!; p++) scores[indices[p]!]! += values[p]!;
  }
  for (const i of idsToIdx(artifacts, latestScores(ratings).keys())) scores[i] = -Infinity;
  return scores;
}

/** `B[i, j]`, or 0 when the pair is not in the sparsified matrix. */
export function cfWeight(artifacts: Artifacts, i: number, j: number): number {
  const { indptr, indices, values } = artifacts.cf;
  for (let p = indptr[i]!; p < indptr[i + 1]!; p++) if (indices[p] === j) return values[p]!;
  return 0;
}

/** Liked items with the largest positive `B[i, j]`, strongest first (ties: lower row first). */
export function topContributors(
  artifacts: Artifacts,
  liked: readonly number[],
  j: number,
  { max = defaults.explain.maxBecauseOf }: { max?: number } = {},
): number[] {
  return liked
    .map((i) => ({ i, w: cfWeight(artifacts, i, j) }))
    .filter(({ w }) => w > 0)
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .slice(0, max)
    .map(({ i }) => i);
}

/** Cosine similarity of `queryEmbedding` with every item embedding (brute force). */
export function scoreSemantic(artifacts: Artifacts, queryEmbedding: ArrayLike<number>): Float32Array {
  const { embeddings, manifest } = artifacts;
  if (!embeddings || !manifest.embedding) {
    throw new Error(`artifact set "${manifest.name}" has no embeddings (manifest.embedding is null); semantic search is unavailable`);
  }
  const { dim } = manifest.embedding;
  if (queryEmbedding.length !== dim) {
    throw new Error(`query embedding has ${queryEmbedding.length} dimensions, the artifact set expects ${dim}`);
  }
  let qNorm = 0;
  for (let d = 0; d < dim; d++) qNorm += queryEmbedding[d]! * queryEmbedding[d]!;
  qNorm = Math.sqrt(qNorm);
  const n = manifest.n_items;
  const out = new Float32Array(n);
  if (qNorm === 0) return out;
  for (let j = 0; j < n; j++) {
    let dot = 0;
    let eNorm = 0;
    const base = j * dim;
    for (let d = 0; d < dim; d++) {
      const e = embeddings[base + d]!;
      dot += e * queryEmbedding[d]!;
      eNorm += e * e;
    }
    out[j] = eNorm === 0 ? 0 : dot / (qNorm * Math.sqrt(eNorm));
  }
  return out;
}

/** `log1p(n_ratings)` for every item. */
export function scorePopularity(artifacts: Artifacts): Float64Array {
  return Float64Array.from(artifacts.catalog, (item) => Math.log1p(item.n_ratings));
}

/** Score components by name; a missing component contributes 0 to the fused score. */
export type Components = Partial<Record<keyof Weights, ArrayLike<number>>>;

/** z-scores of `scores` restricted to `candidates` (all 0 when the spread is 0). */
export function zScores(scores: ArrayLike<number>, candidates: readonly number[]): Float64Array {
  const n = candidates.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  let mean = 0;
  for (const c of candidates) mean += scores[c]!;
  mean /= n;
  let variance = 0;
  for (const c of candidates) variance += (scores[c]! - mean) ** 2;
  const std = Math.sqrt(variance / n);
  if (!(std > 0)) return out;
  candidates.forEach((c, k) => (out[k] = (scores[c]! - mean) / std));
  return out;
}

/**
 * Percentile ranks of `scores` restricted to `candidates`, in [0, 1]: ranks run 0..n-1
 * (ascending) over the finite values, tied values share their mean rank, and each rank is
 * divided by `max(n - 1, 1)`. Non-finite values (e.g. `-Infinity` for rated items) are
 * dropped before ranking and get 0. Same definition as the Python `percentile_rank`.
 */
export function percentileRanks(scores: ArrayLike<number>, candidates: readonly number[]): Float64Array {
  const out = new Float64Array(candidates.length);
  const finite: number[] = [];
  candidates.forEach((c, k) => {
    if (Number.isFinite(scores[c]!)) finite.push(k);
  });
  const n = finite.length;
  if (n === 0) return out;
  const value = (k: number) => scores[candidates[k]!]!;
  finite.sort((a, b) => value(a) - value(b) || a - b);
  const denom = Math.max(n - 1, 1);
  for (let start = 0; start < n; ) {
    let end = start + 1;
    while (end < n && value(finite[end]!) === value(finite[start]!)) end++;
    const meanRank = (start + end - 1) / 2;
    for (let p = start; p < end; p++) out[finite[p]!] = meanRank / denom;
    start = end;
  }
  return out;
}

/** Normalisers `fuse` can apply, by the name in `defaults.fusion.normalisation`. */
const normalisers = { percentile_rank: percentileRanks } as const;

/**
 * Fused score per candidate: sum over components of `weight * percentileRank`, aligned with
 * `candidates`. Components are added in `defaults.query.weights` key order (cf, semantic,
 * popularity), as the Python `fuse` does, so float sums and exact ties agree across the two.
 */
export function fuse(components: Components, candidates: readonly number[], weights: Partial<Weights> = {}): Float64Array {
  const w = { ...defaults.query.weights, ...weights };
  const normalise = normalisers[defaults.fusion.normalisation];
  const out = new Float64Array(candidates.length);
  for (const name of Object.keys(w) as (keyof Weights)[]) {
    const scores = components[name];
    if (!scores || w[name] === 0) continue;
    const r = normalise(scores, candidates);
    for (let k = 0; k < out.length; k++) out[k]! += w[name] * r[k]!;
  }
  return out;
}

const lower = (xs: readonly string[]) => new Set(xs.map((x) => x.toLowerCase()));

/** Whether a catalogue item passes the query's structured filters. */
export function passesFilters(item: CatalogItem, query: Query): boolean {
  const genres = item.genres.map((g) => g.toLowerCase());
  const include = lower(query.include_genres);
  const exclude = lower(query.exclude_genres);
  if (include.size && !genres.some((g) => include.has(g))) return false;
  if (exclude.size && genres.some((g) => exclude.has(g))) return false;
  if (query.year_min !== undefined && (item.year === null || item.year < query.year_min)) return false;
  if (query.year_max !== undefined && (item.year === null || item.year > query.year_max)) return false;
  if (query.min_ratings !== undefined && item.n_ratings < query.min_ratings) return false;
  return true;
}

/** Candidate rows: pass the filters, not rated, not excluded, not a seed. */
export function candidateIdx(artifacts: Artifacts, ratings: readonly Rating[], query: Query): number[] {
  const blocked = new Set(idsToIdx(artifacts, [...ratings.map((r) => r.item_id), ...query.exclude_ids, ...query.like_ids]));
  return artifacts.catalog.filter((item) => !blocked.has(item.idx) && passesFilters(item, query)).map((item) => item.idx);
}

/** Sort candidate rows by score (descending), ties by population count, then by row. */
export function rankIdx(artifacts: Artifacts, candidates: readonly number[], scores: ArrayLike<number>): number[] {
  const nRatings = (i: number) => artifacts.catalog[i]!.n_ratings;
  return candidates
    .map((idx, k) => ({ idx, s: scores[k]! }))
    .sort((a, b) => b.s - a.s || nRatings(b.idx) - nRatings(a.idx) || a.idx - b.idx)
    .map(({ idx }) => idx);
}

/** Top `k` unrated rows by a full-catalogue score array (used by evaluation). */
export function topKByScore(artifacts: Artifacts, scores: ArrayLike<number>, k: number): number[] {
  const candidates: number[] = [];
  for (let i = 0; i < scores.length; i++) if (Number.isFinite(scores[i]!)) candidates.push(i);
  return rankIdx(artifacts, candidates, candidates.map((i) => scores[i]!)).slice(0, k);
}

export interface RecommendOptions extends LikeOptions {
  /** Embeds `query.mood`; required when the query has a mood. See `makeEmbedQuery`. */
  embedQuery?: EmbedQuery;
  /** Max liked items listed in `because_of`. */
  maxBecauseOf?: number;
  /** Receives non-fatal notices (e.g. a mood given to an artifact set without embeddings). */
  onWarning?: (message: string) => void;
}

const label = (item: CatalogItem) => (item.year === null ? item.title : `${item.title} (${item.year})`);

/**
 * Human-readable reasons (same wording as the Python scorer): the liked items behind the CF
 * score, the mood similarity, and popularity only when neither applies.
 */
function buildReasons(
  artifacts: Artifacts,
  item: CatalogItem,
  { because, mood, similarity }: { because: number[]; mood: string | undefined; similarity: number | null },
): string[] {
  const reasons: string[] = [];
  if (because.length) reasons.push(`you liked ${because.map((i) => label(artifacts.catalog[i]!)).join(', ')}`);
  if (mood && similarity !== null) {
    reasons.push(`close to "${mood}" (similarity ${similarity.toFixed(defaults.explain.similarityDigits)})`);
  }
  if (!reasons.length) {
    const mean = item.mean_rating === null ? '' : `, mean ${item.mean_rating.toFixed(0)}/100`;
    reasons.push(`popular: ${item.n_ratings} ratings${mean}`);
  }
  return reasons;
}

/**
 * Recommend `query.k` items for a user: filter, score (CF, semantic when `query.mood` is set,
 * popularity), fuse, rank, explain. Rated items, `exclude_ids` and `like_ids` never appear.
 */
export async function recommend(
  artifacts: Artifacts,
  ratings: readonly Rating[],
  query: QueryInput = {},
  options: RecommendOptions = {},
): Promise<Recommendation[]> {
  const q = QuerySchema.parse(query);
  const { onWarning = (m: string) => console.warn(m) } = options;
  const likeOpts = { ...options, extraLikedIds: q.like_ids };
  const liked = likedIdx(artifacts, ratings, likeOpts);
  const cf = liked.length ? scoreCf(artifacts, ratings, likeOpts) : undefined;
  const popularity = scorePopularity(artifacts);
  let mood = q.mood?.trim() || undefined;
  let semantic: Float32Array | undefined;
  if (mood && !artifacts.embeddings) {
    onWarning(`recommend: a mood was given but artifact set "${artifacts.manifest.name}" has no embeddings; ignoring the mood`);
    mood = undefined;
  }
  if (mood) {
    if (!options.embedQuery) {
      throw new Error('recommend: query.mood is set but no embedQuery was given; pass { embedQuery: makeEmbedQuery(artifacts.manifest.embedding) }');
    }
    semantic = scoreSemantic(artifacts, await options.embedQuery(mood));
  }

  const candidates = candidateIdx(artifacts, ratings, q);
  const components: Components = { popularity, ...(cf ? { cf } : {}), ...(semantic ? { semantic } : {}) };
  const fused = fuse(components, candidates, q.weights);
  const position = new Map(candidates.map((idx, k) => [idx, k]));
  const maxBecauseOf = options.maxBecauseOf ?? defaults.explain.maxBecauseOf;

  return rankIdx(artifacts, candidates, fused)
    .slice(0, q.k)
    .map((idx) => {
      const item = artifacts.catalog[idx]!;
      const because = liked.length ? topContributors(artifacts, liked, idx, { max: maxBecauseOf }) : [];
      const similarity = semantic ? semantic[idx]! : null;
      return {
        item_id: item.imdb_id,
        idx,
        title: item.title,
        year: item.year,
        score: fused[position.get(idx)!]!,
        cf_score: cf ? cf[idx]! : null,
        semantic_score: similarity,
        popularity_score: popularity[idx]!,
        reasons: buildReasons(artifacts, item, { because, mood, similarity }),
        because_of: because.map((i) => artifacts.catalog[i]!.imdb_id),
      };
    });
}
