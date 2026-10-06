/**
 * Every tunable number and name the core uses, in one place.
 *
 * Nothing else in `src/` hardcodes a threshold, a weight, a file name or a scale factor:
 * it reads it from here, and every function that uses one also accepts an override in its
 * options object. These values mirror `docs/core-contract.md` ("Defaults that are not seams")
 * and `docs/artifact-format.md`; the Python scorer uses the same numbers.
 */

export const defaults = {
  /** The canonical rating scale every score is converted to. */
  scale: { min: 0, max: 100 },

  /** Query defaults (also baked into `QuerySchema`). */
  query: {
    k: 10,
    weights: { cf: 1, semantic: 1, popularity: 0.1 },
  },

  /**
   * How `fuse` normalises each component over the candidate set before the weighted sum
   * (core contract, "Defaults that are not seams"). The only value is `percentile_rank`:
   * average ranks 0..n-1 of the finite values divided by `max(n - 1, 1)`.
   */
  fusion: { normalisation: 'percentile_rank' as const },

  /** Which of the user's ratings count as "liked" for the CF row sum. */
  likes: {
    /** With fewer ratings than this, the fixed threshold below is used instead of the median. */
    minRatingsForMedian: 5,
    /** Fixed like threshold (0-100) for users with few ratings. */
    fallbackThreshold: 70,
  },

  /** Explanations attached to each recommendation. */
  explain: {
    /** How many contributing liked items go into `because_of`. */
    maxBecauseOf: 3,
    /** Fraction digits for the similarity shown in the mood reason. */
    similarityDigits: 2,
  },

  /** Artifact-set layout (see docs/artifact-format.md). */
  artifacts: {
    formatVersion: 1,
    manifestFile: 'manifest.json',
    catalogFile: 'catalog.json',
    /** Logical file key -> default file name, used when the manifest's `files` omits a key. */
    files: {
      cf_indptr: 'cf_indptr.i32',
      cf_indices: 'cf_indices.i32',
      cf_values: 'cf_values.f32',
      embeddings: 'embeddings.f32',
    },
  },

  /** Query-time embedding with transformers.js. */
  embedding: {
    task: 'feature-extraction',
    /** Pooling when neither the manifest nor `modelPooling` says otherwise. */
    pooling: 'mean',
    /**
     * Pooling per manifest model id, matching what sentence-transformers (the Python writer)
     * uses for that model; the BGE family is CLS-pooled. A query pooled differently from the
     * documents lands in a slightly different space, so this is a parity setting.
     */
    modelPooling: {
      'BAAI/bge-small-en-v1.5': 'cls',
      'BAAI/bge-base-en-v1.5': 'cls',
    } as Record<string, 'mean' | 'cls'>,
    normalize: true,
    /** Python (sentence-transformers) model id -> transformers.js (ONNX) model id. */
    modelAliases: {
      'BAAI/bge-small-en-v1.5': 'Xenova/bge-small-en-v1.5',
      'BAAI/bge-base-en-v1.5': 'Xenova/bge-base-en-v1.5',
      'sentence-transformers/all-MiniLM-L6-v2': 'Xenova/all-MiniLM-L6-v2',
      'Snowflake/snowflake-arctic-embed-xs': 'Snowflake/snowflake-arctic-embed-xs',
    } as Record<string, string>,
  },

  /** Ratings importers: scale factors and id format. */
  importers: {
    /** Letterboxd and MovieLens stars (0.5-5) -> 0-100. */
    starsFactor: 20,
    /** IMDb (1-10) -> 0-100. */
    imdbFactor: 10,
    imdbPrefix: 'tt',
    imdbMinDigits: 7,
    /** Milliseconds per second, for MovieLens unix timestamps. */
    msPerSecond: 1000,
  },

  /** Personal evaluation and agreement statistics. */
  science: {
    folds: 5,
    k: 10,
    seed: 0,
    bootstrapResamples: 1000,
    ciLevel: 0.95,
  },

  /** CLI output formatting. */
  cli: {
    scoreDigits: 3,
    metricDigits: 3,
  },
} as const;

export type Defaults = typeof defaults;
