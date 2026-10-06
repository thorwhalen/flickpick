# Core contract (v1)

*What the TypeScript core (`js/`, npm `flickpick`) and the Python scorer (`flickpick/score.py`) both implement over the artifact format. Same inputs, same outputs, same defaults; parity tests run the two on the example ratings (`tests/fixtures/parity/`: `recommend` and `holdoutEvaluate`).*

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
- Importers (`importers/`): `parseLetterboxd(csvText)`, `parseImdb(csvText)`, `parseMovielens(csvText)`, `parseFlickpick(csvText)` → `Rating[]`; `detectFormat(csvText)` (rules under **Importers** below). The flickpick format is the example file's columns (`movie_id, imdb_id, tmdb_id, rating, average_rating, title`), with `imdb_id` numeric or `tt`-prefixed.
- Science (`science/`): `rankingMetrics(recommendedIdx, heldOutIdx, k)` → `{ hit_rate, recall, ndcg, precision }`; `holdoutEvaluate(artifacts, ratings, { folds: 5, k: 10, seed: 0 })` → `{ folds, k, n_liked, n_rated, per_fold, mean, ci95, note }` (algorithm under **Science** below); `agreement(ratings, catalog)` → `{ pearson, spearman, n, slope, intercept }` of the user's score against `mean_rating`; `crossValidatedFit(ratings, catalog, { folds })` → RMSE and MAE of predicting the user's score from `mean_rating` (linear) versus the user's mean (baseline).

## Importers

`detectFormat` reads the header row only. Each header cell is trimmed and compared case-insensitively. The formats are tried in this order and the first one whose required columns are all present wins (both languages hold this table as `SIGNATURES`):

| format | required columns | optional columns the parser reads |
|---|---|---|
| imdb | `Const`, `Your Rating` | `Date Rated`, `Title`, `Year` |
| flickpick | `movie_id`, `imdb_id`, `rating` | `tmdb_id`, `title`, `rated_at` |
| letterboxd | `Name`, `Year`, `Rating` | `Date`, `Letterboxd URI` (not required: `diary.csv` and hand-made files lack it) |
| movielens | `movieId`, `rating` | `userId`, `timestamp` (TS also `imdbId`, `title`) |

A MovieLens file whose `userId` column holds more than one user is refused unless the caller picks one (`user_id=` in Python, `{ userId }` in TS); merging users would score one person on everybody's ratings. A file without `userId` is one user. An unrecognised header is a `ValueError` in Python and `null` from TS `detectFormat` (and an error from `parseRatings`), naming the header.

## Science

`holdoutEvaluate` / `holdout_evaluate` is one algorithm, implemented identically in both languages; `tests/fixtures/parity/expected_evaluate.json` (written by `tests/fixtures/make_fixtures.py`) is the Python output and the TS test must match it to 1e-6.

Randomness is **mulberry32** with a 32-bit seed, chosen because it is one line in both languages. State `a = seed mod 2^32`; each call does, in unsigned 32-bit arithmetic (`imul` = low 32 bits of the product): `a += 0x6D2B79F5; t = a; t = imul(t ^ (t >> 15), t | 1); t ^= t + imul(t ^ (t >> 7), t | 61); return (t ^ (t >> 14)) / 2^32`. A **shuffle** is Fisher-Yates: for `i` from `n - 1` down to 1, swap positions `i` and `floor(random() * (i + 1))`.

a. **Restrict to the catalogue.** Resolve the ratings against the catalogue (by id, `ml:`/`tmdb:` id, or title and year); drop those not found; keep one rating per item (the later one wins); re-key each to the catalogue `imdb_id`; order by catalogue `idx`. Everything below uses only this set (its size is `n_rated`).
b. **Liked items** are those scoring at or above the like threshold computed on the restricted set (median, or 70 with fewer than 5 ratings). Fewer liked items than `folds` is an error.
c. **Folds.** Sort the liked `imdb_id`s lexicographically, shuffle them with `mulberry32(seed)`, and put the item at position `p` in fold `p mod folds`; within a fold, items keep their shuffled order (`test_ids`).
d. **Per fold**, the training ratings are the restricted set minus that fold's items (still in `idx` order). The scorer (default: the EASE row sum, `scoreCf`) scores the whole catalogue from them; every item outside the training ratings with a finite score is ranked, and `hit_rate@k` (1 if any held-out item is in the top k), `precision@k` (hits / k), `recall@k` (hits / fold size) and `ndcg@k` (gain 1 / log2(rank + 1), ideal DCG over `min(k, fold size)` hits) are computed against the fold's items. `mean` is the plain mean over folds.
e. **Tie-break** when ranking, in both scorers and in `recommend`: score descending, then `n_ratings` descending, then `idx` ascending.
f. **Output**: `{ folds, k, n_liked, n_rated, per_fold: [{ fold, n_test, test_ids, metrics: { hit_rate, recall, ndcg, precision } }], mean: {...}, ci95: { metric: [low, high] | null }, note: string | null }`.

**The 95% interval** resamples held-out items, not folds (five fold means made a degenerate interval, for example `[1, 1]` for hit rate). Each held-out item `i` in fold `f` contributes, for recall, `hit_i * n_liked / (folds * |f|)`; for precision, `hit_i * n_liked / (folds * k)`; for NDCG, `hit_i * discount_i * n_liked / (folds * idcg_f)`. These are scaled so that their mean over all held-out items equals the reported `mean`. The items are listed fold by fold in `test_ids` order. Draw `n_bootstrap` (1000) resamples of `n_liked` items with replacement, using one fresh `mulberry32(seed)`: resample `b` takes item `floor(u * n_liked)` for the next `n_liked` outputs `u`. The same draws serve all three metrics. The interval is the linear-interpolated 2.5% and 97.5% quantiles of the resample means. `hit_rate` is a per-fold quantity with no per-item form. With at least `min_folds_for_fold_ci` (10) folds its interval is the same bootstrap over the per-fold values. Below that it is `null`, and `note` says why.

## Defaults that are not seams

Like threshold: the user's median score (or 70 with fewer than 5 ratings). Fusion (`normalisation: percentile_rank`): each available component becomes percentile ranks over the candidate set (ranks 0..n-1 over the finite values, ties share their mean rank, divided by `max(n - 1, 1)`; `-Infinity` and other non-finite values are dropped before ranking and get 0), then a weighted sum; a missing component contributes 0. Ranks rather than z-scores because EASE scores are heavy-tailed, so their z-scores (up to ~15) swamped the cosine's (~3) and a mood barely reordered the list. Popularity: `log1p(n_ratings)`. Ties: by `n_ratings` descending, then `idx` ascending (the same order the evaluation ranks by).

## CLI (both)

```
npx flickpick recommend --artifacts <dir|url> --ratings <csv> [--mood "..."] [--exclude-genre Horror] [--k 10]
python -m flickpick recommend --artifacts <dir> --ratings <csv> [--mood "..."] ...
python -m flickpick build --out <dir> [--sample] [--topk 100] [--no-embeddings]
python -m flickpick evaluate --artifacts <dir> --ratings <csv> [--folds 5] [--k 10] [--seed 0]
```

Both CLIs accept `--include-genre`/`--exclude-genre` and the plural spellings.

Output of `recommend`: one line per item, `rank. title (year)  score=…  because: …`, or JSON with `--json`.
