/**
 * The shared vocabulary of the core, as Zod schemas.
 *
 * Each schema is the single source of truth for its type: the TypeScript types below are
 * inferred from it, never written by hand. Shapes follow docs/core-contract.md and
 * docs/artifact-format.md. Unknown extra keys in the manifest and catalogue are kept
 * (`looseObject`), so a newer Python writer does not break an older reader.
 */
import { z } from 'zod';
import { defaults } from './defaults.js';

const { min: SCALE_MIN, max: SCALE_MAX } = defaults.scale;

/** One rating by the user, on the canonical 0-100 scale. */
export const RatingSchema = z.object({
  /** The catalogue id (`imdb_id`, e.g. `tt0114369`), or a placeholder when `needs_resolution`. */
  item_id: z.string().min(1),
  score: z.number().min(SCALE_MIN).max(SCALE_MAX),
  rated_at: z.string().optional(),
  title: z.string().optional(),
  year: z.number().int().optional(),
  /**
   * True when the source had no IMDb id (Letterboxd, or MovieLens rows without `imdbId`):
   * `item_id` is then `title:year` (or `ml:<movieId>`) until `resolveRatings` maps it onto
   * the catalogue.
   */
  needs_resolution: z.boolean().optional(),
});
export type Rating = z.infer<typeof RatingSchema>;

/** Weights of the fused score. Partial weights are completed from the defaults. */
export const WeightsSchema = z.object({
  cf: z.number().default(defaults.query.weights.cf),
  semantic: z.number().default(defaults.query.weights.semantic),
  popularity: z.number().default(defaults.query.weights.popularity),
});
export type Weights = z.infer<typeof WeightsSchema>;

/** What the user asks for. Every field is optional; `QuerySchema.parse({})` gives the defaults. */
export const QuerySchema = z.object({
  /** Free text, embedded and matched against item embeddings. */
  mood: z.string().optional(),
  /** Extra seed items treated as liked (and excluded from the output). */
  like_ids: z.array(z.string()).default([]),
  /** Keep items having at least one of these genres (case-insensitive). */
  include_genres: z.array(z.string()).default([]),
  /** Drop items having any of these genres (case-insensitive). */
  exclude_genres: z.array(z.string()).default([]),
  year_min: z.number().int().optional(),
  year_max: z.number().int().optional(),
  /** Minimum population rating count. */
  min_ratings: z.number().int().nonnegative().optional(),
  exclude_ids: z.array(z.string()).default([]),
  k: z.number().int().positive().default(defaults.query.k),
  weights: WeightsSchema.default({ ...defaults.query.weights }),
});
/** A parsed query, defaults filled in. */
export type Query = z.output<typeof QuerySchema>;
/** What callers may pass: any subset of the fields. */
export type QueryInput = z.input<typeof QuerySchema>;

/** One recommended item. Component scores are raw (before percentile ranking); `null` when not computed. */
export const RecommendationSchema = z.object({
  item_id: z.string(),
  idx: z.number().int().nonnegative(),
  title: z.string(),
  year: z.number().int().nullable(),
  score: z.number(),
  cf_score: z.number().nullable(),
  semantic_score: z.number().nullable(),
  popularity_score: z.number().nullable(),
  reasons: z.array(z.string()),
  /** item_ids of the liked items contributing most to `cf_score`, strongest first. */
  because_of: z.array(z.string()),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const SourceSchema = z.looseObject({
  name: z.string(),
  version: z.string().nullable().optional(),
  licence: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

export const CfInfoSchema = z.looseObject({
  method: z.literal('ease'),
  topk: z.number().int().positive(),
  lambda: z.number(),
  n_train_users: z.number().int().nonnegative().optional(),
  n_train_ratings: z.number().int().nonnegative().optional(),
  like_threshold: z.number().optional(),
});

export const EmbeddingInfoSchema = z.looseObject({
  model: z.string().min(1),
  dim: z.number().int().positive(),
  dtype: z.literal('float32'),
  query_prefix: z.string().default(''),
  text_field: z.string().default('semantic_text'),
  /** Optional: how the writer pooled token embeddings (`mean` or `cls`); defaults to mean. */
  pooling: z.enum(['mean', 'cls']).optional(),
});
export type EmbeddingInfo = z.infer<typeof EmbeddingInfoSchema>;

export const FileInfoSchema = z.looseObject({
  path: z.string().min(1),
  dtype: z.string(),
  shape: z.array(z.number().int().nonnegative()),
});
export type FileInfo = z.infer<typeof FileInfoSchema>;

/** `manifest.json` of an artifact set. */
export const ManifestSchema = z.looseObject({
  format_version: z.literal(defaults.artifacts.formatVersion),
  built_at: z.string(),
  name: z.string(),
  n_items: z.number().int().nonnegative(),
  sources: z.array(SourceSchema).default([]),
  cf: CfInfoSchema,
  embedding: EmbeddingInfoSchema.nullable().default(null),
  files: z.record(z.string(), FileInfoSchema).default({}),
});
export type Manifest = z.infer<typeof ManifestSchema>;

/** One row of `catalog.json`; rows are in `idx` order. */
export const CatalogItemSchema = z.looseObject({
  idx: z.number().int().nonnegative(),
  imdb_id: z.string().min(1),
  tmdb_id: z.number().int().nullable().default(null),
  ml_id: z.number().int().nullable().default(null),
  qid: z.string().nullable().default(null),
  title: z.string(),
  year: z.number().int().nullable().default(null),
  genres: z.array(z.string()).default([]),
  n_ratings: z.number().int().nonnegative().default(0),
  mean_rating: z.number().nullable().default(null),
  semantic_text: z.string().default(''),
});
export type CatalogItem = z.infer<typeof CatalogItemSchema>;

/** The sparse EASE matrix B in CSR form (rows = source item, columns = target item). */
export interface CsrMatrix {
  indptr: Int32Array;
  indices: Int32Array;
  values: Float32Array;
}

/** A loaded artifact set: what every scoring function takes. */
export interface Artifacts {
  manifest: Manifest;
  catalog: CatalogItem[];
  cf: CsrMatrix;
  /** Row-major `n_items x dim`, L2-normalised; absent when `manifest.embedding` is null. */
  embeddings?: Float32Array;
  /** `imdb_id` -> row index. */
  idToIdx: Map<string, number>;
}

/** Turns a query text into an embedding of `manifest.embedding.dim` numbers. */
export type EmbedQuery = (text: string) => Promise<Float32Array>;
