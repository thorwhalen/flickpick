# flickpick

flickpick: a personal movie recommender (Python half: build pipeline and scorer).

Build an artifact set, then recommend from a ratings export:

```pycon
>>> from flickpick import read_artifacts, read_ratings, recommend, Query
>>> a = read_artifacts('path/to/artifacts')
>>> recommend(a, read_ratings('my_ratings.csv'), Query(mood='slow-burn sci-fi'))
```

From the shell: `python -m flickpick build --sample` then
`python -m flickpick recommend --ratings my_ratings.csv --mood "..."`.
The formats and the scoring contract are in `docs/artifact-format.md` and
`docs/core-contract.md`.

`import flickpick` stays light (numpy only): the names from `build`, `ease` and
`science`, which pull in pandas and scipy, are imported on first access.

### Functions

| [`read_artifacts`](#flickpick.read_artifacts)(source)                             | Load and validate the artifact set in directory `source`.                        |
|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| [`validate_artifacts`](#flickpick.validate_artifacts)(a)                              | Raise `ArtifactFormatError` unless every shape and the catalogue agree.          |
| [`write_artifacts`](#flickpick.write_artifacts)(a, out_dir)                        | Write `a` to `out_dir` (created if needed) and return the directory path.        |
| [`build_artifacts`](#flickpick.build_artifacts)(ml, \*[, n_items, topk, lam, ...]) | Build an in-memory artifact set from MovieLens tables.                           |
| [`ease_dense`](#flickpick.ease_dense)(X, \*[, lam, dtype])                    | The dense EASE weight matrix B for a (sparse or dense) binary matrix X.          |
| [`fit_ease`](#flickpick.fit_ease)(X, \*[, lam, topk, n_items])              | Fit sparse EASE on X restricted to its `n_items` most-rated columns (None: all). |
| [`sparsify_topk`](#flickpick.sparsify_topk)(B, \*[, topk])                       | Keep each row's `topk` largest positive weights, sorted descending, as CSR.      |
| [`detect_format`](#flickpick.detect_format)(csv_text)                            | The name of the export format of `csv_text` (a key of `SIGNATURES`).             |
| [`parse_flickpick`](#flickpick.parse_flickpick)(csv_text)                          | The flickpick CSV (the example file's columns) -> ratings (already 0-100).       |
| [`parse_imdb`](#flickpick.parse_imdb)(csv_text)                               | IMDb ratings export -> ratings.                                                  |
| [`parse_letterboxd`](#flickpick.parse_letterboxd)(csv_text)                         | Letterboxd `ratings.csv` -> ratings (unrated rows are skipped).                  |
| [`parse_movielens`](#flickpick.parse_movielens)(csv_text, \*[, user_id])           | MovieLens `ratings.csv` -> ratings of one user (`ml:<movieId>` ids).             |
| [`parse_ratings`](#flickpick.parse_ratings)(csv_text, \*[, format])              | Parse `csv_text` with the parser for `format` (detected when None).              |
| [`read_ratings`](#flickpick.read_ratings)(path, \*[, format, encoding])         | Read and parse a ratings CSV file.                                               |
| [`resolve_ratings`](#flickpick.resolve_ratings)(catalog, ratings)                  | Pair each rating with its catalogue `idx`, dropping the ones not found.          |
| [`agreement`](#flickpick.agreement)(ratings, catalog)                        | Pearson, Spearman and the OLS line of the user's score on `mean_rating`.         |
| [`cross_validated_fit`](#flickpick.cross_validated_fit)(ratings, catalog, \*[, ...])   | K-fold RMSE/MAE of a linear fit on `mean_rating` vs the user-mean baseline.      |
| [`holdout_evaluate`](#flickpick.holdout_evaluate)(artifacts, ratings, \*[, ...])    | K-fold holdout of the user's liked items, scored over the full catalogue.        |
| [`ranking_metrics`](#flickpick.ranking_metrics)(recommended_idx, held_out_idx, k)  | Ranking metrics at `k` of one recommendation list against held-out items.        |
| [`embed_query`](#flickpick.embed_query)(text, embedding)                       | L2-normalised `float32[dim]` embedding of `query_prefix + text`.                 |
| [`format_recommendations`](#flickpick.format_recommendations)(recs)                       | One line per item: <br/><br/>```<br/>``<br/>```<br/><br/>rank.                   |
| [`recommend`](#flickpick.recommend)(artifacts, ratings[, query, ...])        | The top `query.k` unrated items for this user and query, explained.              |
| [`score_cf`](#flickpick.score_cf)(artifacts, ratings)                       | EASE scores `float32[n_items]`; the user's rated items are `-inf`.               |
| [`score_semantic`](#flickpick.score_semantic)(artifacts, query_embedding)         | Cosine similarity `float32[n_items]` of every item to the query embedding.       |

### Classes

| [`CF`](#flickpick.CF)(indptr, indices, values)                    | The sparsified EASE item-item matrix B in CSR form (rows = source items).     |
|-------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| [`Artifacts`](#flickpick.Artifacts)(manifest, catalog, cf[, embeddings]) | One loaded artifact set: manifest, catalogue, CF matrix, optional embeddings. |
| [`Defaults`](#flickpick.Defaults)([ease_lambda, topk, n_items, ...])    | Every tunable number in one place (see the docs cited on each field).         |
| [`Rating`](#flickpick.Rating)(item_id, score[, rated_at, title])      | One user rating on the canonical 0-100 scale.                                 |
| [`Query`](#flickpick.Query)([mood, like_ids, include_genres, ...])   | What the user asks for, beyond their ratings (all fields optional).           |
| [`Recommendation`](#flickpick.Recommendation)(item_id, idx, title, year, ...) | One recommended item, its fused score, its raw component scores, and why.     |
| [`Weights`](#flickpick.Weights)([cf, semantic, popularity])            | Fusion weights of the percentile-ranked components.                           |

### Exceptions

| [`ArtifactFormatError`](#flickpick.ArtifactFormatError)   | An artifact set does not match `docs/artifact-format.md`.   |
|------------------------------------------------------------------------|-------------------------------------------------------------|

### *exception* flickpick.ArtifactFormatError

Bases: [`ValueError`](https://docs.python.org/3/builtins/exceptions.html#ValueError)

An artifact set does not match `docs/artifact-format.md`.

### *class* flickpick.Artifacts(manifest, catalog, cf, embeddings=None)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

One loaded artifact set: manifest, catalogue, CF matrix, optional embeddings.

#### *property* imdb_to_idx *: [dict](https://docs.python.org/3/builtins/stdtypes.html#dict)[[str](https://docs.python.org/3/builtins/stdtypes.html#str), [int](https://docs.python.org/3/builtins/functions.html#int)]*

IMDb id -> row index.

#### *property* n_items *: [int](https://docs.python.org/3/builtins/functions.html#int)*

Number of items (rows of every file).

#### *property* n_ratings *: ndarray*

Population rating counts, as an array in `idx` order.

### *class* flickpick.CF(indptr, indices, values)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

The sparsified EASE item-item matrix B in CSR form (rows = source items).

#### to_scipy(n_items)

The same matrix as a `scipy.sparse.csr_matrix` of shape (n, n).

### *class* flickpick.Defaults(ease_lambda=500.0, topk=100, n_items=10000, like_threshold=70.0, min_ratings_for_median=5, normalisation='percentile_rank', w_cf=1.0, w_semantic=1.0, w_popularity=0.1, k=10, n_because=3, embedding_model='BAAI/bge-small-en-v1.5', embedding_dim=384, query_prefix='', embed_batch_size=64, max_tags=50, folds=5, seed=0, n_bootstrap=1000, ci_level=0.95, min_folds_for_fold_ci=10)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

Every tunable number in one place (see the docs cited on each field).

#### ease_lambda *: [float](https://docs.python.org/3/builtins/functions.html#float)* *= 500.0*

L2 regularisation; the recsys report’s probe found 200, 500 and 1000 tie on
[NDCG@100](mailto:NDCG@100) for MovieLens 32M (docs/research/recsys-methods-libraries-evaluation.md §3)

#### like_threshold *: [float](https://docs.python.org/3/builtins/functions.html#float)* *= 70.0*

a population rating counts as a “like” at or above this, on the 0-100 scale
(3.5 stars)

#### max_tags *: [int](https://docs.python.org/3/builtins/functions.html#int)* *= 50*

cap on the distinct user tags appended to semantic_text (most frequent first)

#### min_folds_for_fold_ci *: [int](https://docs.python.org/3/builtins/functions.html#int)* *= 10*

hit_rate is a per-fold quantity; below this many folds its bootstrap interval
(over folds) is too coarse to report (core contract, Science)

#### min_ratings_for_median *: [int](https://docs.python.org/3/builtins/functions.html#int)* *= 5*

with fewer ratings than this, the fixed like_threshold replaces the median

#### n_because *: [int](https://docs.python.org/3/builtins/functions.html#int)* *= 3*

number of liked items named in “because you liked …”

#### n_items *: [int](https://docs.python.org/3/builtins/functions.html#int)* *= 10000*

number of most-rated items in the CF artifact (they carry ~97% of ratings)

#### normalisation *: [str](https://docs.python.org/3/builtins/stdtypes.html#str)* *= 'percentile_rank'*

how each component is normalised over the candidate set before the weighted
sum (core contract: “Defaults that are not seams”); the only value is
“percentile_rank” (average ranks scaled to [0, 1])

#### topk *: [int](https://docs.python.org/3/builtins/functions.html#int)* *= 100*

kept neighbours per item row (98% of dense [NDCG@100](mailto:NDCG@100) in the same probe)

### *class* flickpick.Query(mood=None, like_ids=(), include_genres=(), exclude_genres=(), year_min=None, year_max=None, min_ratings=None, exclude_ids=(), k=10, weights=<factory>)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

What the user asks for, beyond their ratings (all fields optional).

### *class* flickpick.Rating(item_id, score, rated_at=None, title=None)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

One user rating on the canonical 0-100 scale.

### *class* flickpick.Recommendation(item_id, idx, title, year, score, cf_score, semantic_score, popularity_score, reasons, because_of)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

One recommended item, its fused score, its raw component scores, and why.

#### to_dict()

A JSON-able dict.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### *class* flickpick.Weights(cf=1.0, semantic=1.0, popularity=0.1)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

Fusion weights of the percentile-ranked components.

### flickpick.agreement(ratings, catalog)

Pearson, Spearman and the OLS line of the user’s score on `mean_rating`.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.build_artifacts(ml, , n_items=10000, topk=100, lam=500.0, like_threshold=70.0, embeddings=True, embedding_model='BAAI/bge-small-en-v1.5', embed=None, max_tags=50)

Build an in-memory artifact set from MovieLens tables.

`embed` (texts -> L2-normalised float32 array) replaces the default encoder,
which is `embed_texts` with `embedding_model`.

* **Return type:**
  [`Artifacts`](flickpick.artifacts.md#flickpick.artifacts.Artifacts)

### flickpick.cross_validated_fit(ratings, catalog, , folds=5, seed=0)

K-fold RMSE/MAE of a linear fit on `mean_rating` vs the user-mean baseline.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.detect_format(csv_text)

The name of the export format of `csv_text` (a key of `SIGNATURES`).

* **Return type:**
  [`str`](https://docs.python.org/3/builtins/stdtypes.html#str)

### flickpick.ease_dense(X, \*, lam=500.0, dtype=<class 'numpy.float64'>)

The dense EASE weight matrix B for a (sparse or dense) binary matrix X.

* **Return type:**
  `ndarray`

### flickpick.embed_query(text, embedding)

L2-normalised `float32[dim]` embedding of `query_prefix + text`.

`embedding` is `manifest["embedding"]`; this is the only place a model runs at
query time.

* **Return type:**
  `ndarray`

### flickpick.fit_ease(X, , lam=500.0, topk=100, n_items=10000)

Fit sparse EASE on X restricted to its `n_items` most-rated columns (None: all).

Returns `(cf, item_cols)`: the CSR matrix over the kept items, and the original
column index of each kept item (row `r` of `cf` is column `item_cols[r]`).

* **Return type:**
  [`tuple`](https://docs.python.org/3/builtins/stdtypes.html#tuple)[[`CF`](flickpick.artifacts.md#flickpick.artifacts.CF), `ndarray`]

### flickpick.format_recommendations(recs)

One line per item: `rank. title (year)  score=...  because: ...`.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str)]

### flickpick.holdout_evaluate(artifacts, ratings, \*, folds=5, k=10, seed=0, scorer=<function ease_scorer>, n_boot=1000, ci_level=0.95, min_folds_for_fold_ci=10)

K-fold holdout of the user’s liked items, scored over the full catalogue.

The algorithm (steps a-f of `docs/core-contract.md`, Science): restrict the
ratings to the catalogue; liked = at or above the like threshold of that restricted
set; sort the liked `imdb_id``s, shuffle them with ``mulberry32(seed)` and deal
them round-robin into folds; per fold, score with `scorer(artifacts, train)` and
rank every item outside the training ratings. `ci95` is a bootstrap over held-out
items for recall, NDCG and precision; `hit_rate`’s is over folds, and `None`
(see `note`) with fewer than `min_folds_for_fold_ci` folds.

Returns `{folds, k, n_liked, n_rated, per_fold, mean, ci95, note}`.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.parse_flickpick(csv_text)

The flickpick CSV (the example file’s columns) -> ratings (already 0-100).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.md#flickpick.ratings.Rating)]

### flickpick.parse_imdb(csv_text)

IMDb ratings export -> ratings.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.md#flickpick.ratings.Rating)]

### flickpick.parse_letterboxd(csv_text)

Letterboxd `ratings.csv` -> ratings (unrated rows are skipped).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.md#flickpick.ratings.Rating)]

### flickpick.parse_movielens(csv_text, , user_id=None)

MovieLens `ratings.csv` -> ratings of one user (`ml:<movieId>` ids).

`userId` is optional; a file holding several users needs `user_id`.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.md#flickpick.ratings.Rating)]

### flickpick.parse_ratings(csv_text, , format=None)

Parse `csv_text` with the parser for `format` (detected when None).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.md#flickpick.ratings.Rating)]

### flickpick.ranking_metrics(recommended_idx, held_out_idx, k)

Ranking metrics at `k` of one recommendation list against held-out items.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

```pycon
>>> ranking_metrics([5, 1, 7], [1, 9], 3)['recall']
0.5
```

### flickpick.read_artifacts(source)

Load and validate the artifact set in directory `source`.

* **Return type:**
  [`Artifacts`](flickpick.artifacts.md#flickpick.artifacts.Artifacts)

### flickpick.read_ratings(path, , format=None, encoding='utf-8')

Read and parse a ratings CSV file.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Rating`](flickpick.ratings.md#flickpick.ratings.Rating)]

### flickpick.recommend(artifacts, ratings, query=None, \*, embed_query=<function embed_query>, n_because=3)

The top `query.k` unrated items for this user and query, explained.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Recommendation`](flickpick.score.md#flickpick.score.Recommendation)]

### flickpick.resolve_ratings(catalog, ratings)

Pair each rating with its catalogue `idx`, dropping the ones not found.

A later rating of the same item replaces an earlier one.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`tuple`](https://docs.python.org/3/builtins/stdtypes.html#tuple)[[`int`](https://docs.python.org/3/builtins/functions.html#int), [`Rating`](flickpick.ratings.md#flickpick.ratings.Rating)]]

### flickpick.score_cf(artifacts, ratings)

EASE scores `float32[n_items]`; the user’s rated items are `-inf`.

* **Return type:**
  `ndarray`

### flickpick.score_semantic(artifacts, query_embedding)

Cosine similarity `float32[n_items]` of every item to the query embedding.

* **Return type:**
  `ndarray`

### flickpick.sparsify_topk(B, , topk=100)

Keep each row’s `topk` largest positive weights, sorted descending, as CSR.

* **Return type:**
  [`CF`](flickpick.artifacts.md#flickpick.artifacts.CF)

### flickpick.validate_artifacts(a)

Raise `ArtifactFormatError` unless every shape and the catalogue agree.

* **Return type:**
  [`Artifacts`](flickpick.artifacts.md#flickpick.artifacts.Artifacts)

### flickpick.write_artifacts(a, out_dir)

Write `a` to `out_dir` (created if needed) and return the directory path.

The manifest’s `files` entry is (re)computed from the arrays.

* **Return type:**
  [`Path`](https://docs.python.org/3/library/pathlib.html#pathlib.Path)

### Modules

| [`artifacts`](flickpick.artifacts.md#module-flickpick.artifacts)   | Write and read an artifact set as specified in `docs/artifact-format.md`.           |
|-----------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| [`build`](flickpick.build.md#module-flickpick.build)           | The build pipeline: MovieLens tables -> catalogue, sparse EASE matrix, embeddings.  |
| [`data`](flickpick.data.md#module-flickpick.data)             | Download (with a cache) and parse the MovieLens datasets the build uses.            |
| [`defaults`](flickpick.defaults.md#module-flickpick.defaults)     | Named defaults shared by the build pipeline, the scorer and the CLI.                |
| [`ease`](flickpick.ease.md#module-flickpick.ease)             | EASE (Steck 2019): a closed-form linear item-item model, sparsified to top-k.       |
| [`embedding`](flickpick.embedding.md#module-flickpick.embedding)   | Sentence embeddings of catalogue text and of mood queries.                          |
| [`importers`](flickpick.importers.md#module-flickpick.importers)   | Parse ratings exports into `Rating` lists on the canonical 0-100 scale.             |
| [`ratings`](flickpick.ratings.md#module-flickpick.ratings)       | The canonical `Rating` type, and how ratings are joined to a catalogue.             |
| [`science`](flickpick.science.md#module-flickpick.science)       | Personal evaluation and agreement statistics ("for scientists").                    |
| [`score`](flickpick.score.md#module-flickpick.score)           | Score and recommend over an artifact set (`docs/core-contract.md`).                 |
| [`tools`](flickpick.tools.md#module-flickpick.tools)           | The command surface: plain functions returning JSON-able values (SSOT for the CLI). |
