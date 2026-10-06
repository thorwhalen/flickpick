# Core contract (v1)

*What the TypeScript core (`js/`, npm `flickpick`) and the Python scorer (`flickpick/score.py`) both implement over the artifact format. Same inputs, same outputs, same defaults; a parity test runs the two on the example ratings.*

## Types (Zod in TS, dataclasses in Python)

- `Rating { item_id: string (imdb_id), score: number (0-100), rated_at?: string (ISO), title?: string }`
- `Query { mood?: string, like_ids?: string[], include_genres?: string[], exclude_genres?: string[], year_min?: number, year_max?: number, min_ratings?: number, exclude_ids?: string[], k?: number (default 10), weights?: { cf: 1, semantic: 1, popularity: 0.1 } }`
- `Recommendation { item_id, idx, title, year, score, cf_score, semantic_score, popularity_score, reasons: string[], because_of: string[] (item_ids) }`
- `Artifacts { manifest, catalog, cf: { indptr, indices, values }, embeddings?: Float32Array }`

## Functions

- `loadArtifacts(source)` → `Artifacts`. `source` is a URL base or a directory path (seam 1). TS: `fetch` in the browser, `fs` in Node. Python: a directory path.
- `scoreCf(artifacts, ratings)` → `Float32Array[n_items]` (EASE row sum over liked items; rated items set to `-Infinity`).
- `scoreSemantic(artifacts, queryEmbedding)` → `Float32Array[n_items]` (cosine; brute force).
- `embedQuery(text, manifest.embedding)` → `Float32Array[dim]` (TS: transformers.js with the manifest's model; Python: the same model through `ef` or sentence-transformers). The only place a model runs at query time.
- `recommend(artifacts, ratings, query, { embedQuery })` → `Recommendation[]`: filters by the structured fields, percentile-ranks each available score over the candidate set, combines with `query.weights`, sorts, takes `k`, fills `reasons` and `because_of`.
- Importers (`importers/`): `parseLetterboxd(csvText)`, `parseImdb(csvText)`, `parseMovielens(csvText)`, `parseFlickpick(csvText)` → `Rating[]`; `detectFormat(csvText)`. The flickpick format is the example file's columns (`movie_id, imdb_id, tmdb_id, rating, average_rating, title`), with `imdb_id` numeric or `tt`-prefixed.
- Science (`science/`): `rankingMetrics(recommendedIdx, heldOutIdx, k)` → `{ hit_rate, recall, ndcg, precision }`; `holdoutEvaluate(artifacts, ratings, { folds: 5, k: 10, seed })` → per-fold metrics with mean and a bootstrap 95% interval; `agreement(ratings, catalog)` → `{ pearson, spearman, n, slope, intercept }` of the user's score against `mean_rating`; `crossValidatedFit(ratings, catalog, { folds })` → RMSE and MAE of predicting the user's score from `mean_rating` (linear) versus the user's mean (baseline).

## Defaults that are not seams

Like threshold: the user's median score (or 70 with fewer than 5 ratings). Fusion (`normalisation: percentile_rank`): each available component becomes percentile ranks over the candidate set (ranks 0..n-1 over the finite values, ties share their mean rank, divided by `max(n - 1, 1)`; `-Infinity` and other non-finite values are dropped before ranking and get 0), then a weighted sum; a missing component contributes 0. Ranks rather than z-scores because EASE scores are heavy-tailed, so their z-scores (up to ~15) swamped the cosine's (~3) and a mood barely reordered the list. Popularity: `log1p(n_ratings)`. Ties: by `n_ratings` descending.

## CLI (both)

```
npx flickpick recommend --artifacts <dir|url> --ratings <csv> [--mood "..."] [--exclude-genre Horror] [--k 10]
python -m flickpick recommend --artifacts <dir> --ratings <csv> [--mood "..."] ...
python -m flickpick build --out <dir> [--sample] [--topk 100] [--no-embeddings]
python -m flickpick evaluate --artifacts <dir> --ratings <csv>
```

Output of `recommend`: one line per item, `rank. title (year)  score=…  because: …`, or JSON with `--json`.
