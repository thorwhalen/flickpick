/**
 * Every tunable number, name and URL the web app uses, in one place.
 *
 * Components and commands read from here instead of hardcoding values. Numbers the recommender
 * itself uses (like threshold, fusion weights, science folds) live in the core's `defaults`
 * (`flickpick`), not here; this file only holds what is specific to the browser app.
 */
export const defaults = {
  app: {
    name: 'flickpick',
    repoUrl: 'https://github.com/thorwhalen/flickpick',
    /** Base for links to repository files (docs, research). */
    repoBlobUrl: 'https://github.com/thorwhalen/flickpick/blob/main/',
  },

  /** Default values of the user settings (the schema in `settings/schema.ts` uses these). */
  settings: {
    artifactSource: './data/artifacts_small/',
    region: 'US',
    embeddingEnabled: true,
  },

  /** Keys under which the zodal localStorage providers keep each collection. */
  storage: {
    ratingsKey: 'flickpick:ratings',
    settingsKey: 'flickpick:settings',
    /** The settings collection holds a single row with this id. */
    settingsRowId: 'settings',
    enrichmentKey: 'flickpick:tmdb-cache',
  },

  /** The rating control (the canonical scale is the core's 0-100). */
  rating: {
    min: 0,
    max: 100,
    step: 1,
    /** Where the slider of an unrated title starts when the population has no mean either. */
    unratedStart: 50,
  },

  /** The recommend form. */
  recommend: {
    k: 10,
    kMin: 1,
    kMax: 50,
  },

  /** Query-time embedding in the browser (transformers.js in a Web Worker). */
  embedding: {
    /** Quantised (int8) ONNX weights: about 4x smaller than fp32 for a negligible quality cost. */
    dtype: 'q8',
  },

  /** Movie page neighbour lists. */
  neighbours: {
    cf: 10,
    semantic: 10,
  },

  /** TMDB live enrichment (display only; see `sources/tmdb.ts`). */
  tmdb: {
    apiBase: 'https://api.themoviedb.org/3',
    imageBase: 'https://image.tmdb.org/t/p/',
    posterSize: 'w342',
    backdropSize: 'w1280',
    providerLogoSize: 'w92',
    /** TMDB's terms allow caching for at most six months. */
    cacheDays: 180,
    websiteUrl: 'https://www.themoviedb.org/',
    justWatchUrl: 'https://www.justwatch.com/',
    /** A v4 "API read access token" is a JWT, which always starts with this. */
    bearerTokenPrefix: 'eyJ',
  },

  /** Ratings export. */
  export: {
    filename: 'flickpick-ratings.csv',
    mime: 'text/csv;charset=utf-8',
  },

  /** Ratings import preview. */
  import: {
    /** How many unmatched titles the preview lists by name. */
    unmatchedShown: 8,
  },

  /** Interaction timing. */
  ui: {
    /** Debounce of the ratings table search box. */
    searchDebounceMs: 150,
  },

  /** Charts on the science page (SVG user units; the SVG scales to its container). */
  charts: {
    width: 640,
    height: 400,
    margin: { top: 16, right: 24, bottom: 48, left: 76 },
    pointRadius: 4,
    tickCount: 5,
  },

  /** Number formatting. */
  format: {
    statDigits: 2,
    metricDigits: 3,
  },

  /** Time. */
  time: {
    msPerDay: 86_400_000,
  },
} as const;

export type Defaults = typeof defaults;
