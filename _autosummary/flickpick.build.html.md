# flickpick.build

The build pipeline: MovieLens tables -> catalogue, sparse EASE matrix, embeddings.

`build_artifacts` is pure (tables in, `Artifacts` out; the only side effect is
running the embedding model). `tools.build` adds the download and the write.

The CF set is the `n_items` most-rated films that have an IMDb id; `idx` orders them
by rating count (descending, ties by MovieLens id). EASE is trained on ratings at or
above `like_threshold` (on the 0-100 scale; 70 = 3.5 stars), binarised.

### Functions

| [`build_artifacts`](#flickpick.build.build_artifacts)(ml, \*[, n_items, topk, lam, ...])   | Build an in-memory artifact set from MovieLens tables.                         |
|-------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| [`catalog_rows`](#flickpick.build.catalog_rows)(items, tags_by_movie)                   | Catalogue rows (`docs/artifact-format.md`) in `idx` order.                     |
| [`clean_title`](#flickpick.build.clean_title)(ml_title)                                | MovieLens `"Matrix, The (1999)"` -> `("The Matrix", 1999)`.                    |
| [`like_matrix`](#flickpick.build.like_matrix)(ratings, movie_ids, \*[, ...])           | Binary users x items matrix of likes, columns in the order of `movie_ids`.     |
| [`movie_tags`](#flickpick.build.movie_tags)(tags, \*[, max_tags])                     | movieId -> its distinct user tags (lower-cased), most applied first.           |
| [`parse_genres`](#flickpick.build.parse_genres)(text)                                   | `"Action|Sci-Fi"` -> `["Action", "Sci-Fi"]`; `"(no genres listed)"` -> [].     |
| [`select_items`](#flickpick.build.select_items)(ml, \*, n_items)                        | One row per CF item (movieId, imdbId, tmdbId, title, genres, n_ratings, mean). |

### flickpick.build.build_artifacts(ml, , n_items=10000, topk=100, lam=500.0, like_threshold=70.0, embeddings=True, embedding_model='BAAI/bge-small-en-v1.5', embed=None, max_tags=50)

Build an in-memory artifact set from MovieLens tables.

`embed` (texts -> L2-normalised float32 array) replaces the default encoder,
which is `embed_texts` with `embedding_model`.

* **Return type:**
  [`Artifacts`](flickpick.artifacts.html.md#flickpick.artifacts.Artifacts)

### flickpick.build.catalog_rows(items, tags_by_movie)

Catalogue rows (`docs/artifact-format.md`) in `idx` order.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)]

### flickpick.build.clean_title(ml_title)

MovieLens `"Matrix, The (1999)"` -> `("The Matrix", 1999)`.

Parenthesised alternate titles are kept (they help match other services’ titles),
with their articles moved to the front too.

* **Return type:**
  [`tuple`](https://docs.python.org/3/builtins/stdtypes.html#tuple)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str), [`int`](https://docs.python.org/3/builtins/functions.html#int) | [`None`](https://docs.python.org/3/builtins/constants.html#None)]

```pycon
>>> clean_title('Seven (a.k.a. Se7en) (1995)')
('Seven (a.k.a. Se7en)', 1995)
>>> clean_title('Shawshank Redemption, The (1994)')
('The Shawshank Redemption', 1994)
```

### flickpick.build.like_matrix(ratings, movie_ids, , like_threshold=70.0)

Binary users x items matrix of likes, columns in the order of `movie_ids`.

* **Return type:**
  `csr_matrix`

### flickpick.build.movie_tags(tags, , max_tags=50)

movieId -> its distinct user tags (lower-cased), most applied first.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)[[`int`](https://docs.python.org/3/builtins/functions.html#int), [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)]

### flickpick.build.parse_genres(text)

`"Action|Sci-Fi"` -> `["Action", "Sci-Fi"]`; `"(no genres listed)"` -> [].

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str)]

### flickpick.build.select_items(ml, , n_items)

One row per CF item (movieId, imdbId, tmdbId, title, genres, n_ratings, mean).

* **Return type:**
  `DataFrame`
