# flickpick.score

Score and recommend over an artifact set (`docs/core-contract.md`).

The TypeScript core implements the same functions with the same defaults; a parity
test runs both on the example ratings. Scores per component:

- **cf**: `s_j = sum_{i in L} B[i, j]` over the user’s liked set L (scores at or above
  their median, or the fixed like threshold with fewer than 5 ratings); rated items get
  `-inf`.
- **semantic**: cosine between the mood query’s embedding and each item’s.
- **popularity**: `log1p(n_ratings)`.

`recommend` filters candidates by the structured fields, turns each available
component into percentile ranks over the candidates (`percentile_rank`: average
ranks 0..n-1 of the finite values, ties sharing their mean rank, divided by
`max(n - 1, 1)`; non-finite values get 0), adds them with `query.weights`, sorts
(ties: more ratings first, then lower `idx`), and explains the top `k`. Ranks, not
z-scores, because EASE scores are heavy-tailed: their z-scores reach ~15 against ~3 for
the cosine, which drowned the mood.

### Functions

| [`score_cf`](#flickpick.score.score_cf)(artifacts, ratings)                    | EASE scores `float32[n_items]`; the user's rated items are `-inf`.           |
|--------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| [`score_semantic`](#flickpick.score.score_semantic)(artifacts, query_embedding)      | Cosine similarity `float32[n_items]` of every item to the query embedding.   |
| [`embed_query`](#flickpick.score.embed_query)(text, embedding)                    | L2-normalised `float32[dim]` embedding of `query_prefix + text`.             |
| [`recommend`](#flickpick.score.recommend)(artifacts, ratings[, query, ...])     | The top `query.k` unrated items for this user and query, explained.          |
| [`format_recommendations`](#flickpick.score.format_recommendations)(recs)                    | One line per item: <br/><br/>```<br/>``<br/>```<br/><br/>rank.               |
| [`liked_indices`](#flickpick.score.liked_indices)(artifacts, ratings)               | `(liked_idx, rated_idx)`: catalogue rows the user liked, and all rated rows. |
| [`candidate_mask`](#flickpick.score.candidate_mask)(artifacts, query, \*[, exclude]) | Boolean mask of items that pass the query's structured filters.              |
| [`zscore`](#flickpick.score.zscore)(x)                                       | `(x - mean) / std` (population std); all zeros when `x` is constant.         |
| [`percentile_rank`](#flickpick.score.percentile_rank)(x)                              | Average ranks of `x` scaled to `[0, 1]`: `rank / max(n - 1, 1)`.             |
| [`fuse`](#flickpick.score.fuse)(components, candidates, weights)           | Fused score per candidate: `sum(weight * percentile_rank)` over components.  |

### Classes

| [`Weights`](#flickpick.score.Weights)([cf, semantic, popularity])            | Fusion weights of the percentile-ranked components.                       |
|-------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| [`Query`](#flickpick.score.Query)([mood, like_ids, include_genres, ...])   | What the user asks for, beyond their ratings (all fields optional).       |
| [`Recommendation`](#flickpick.score.Recommendation)(item_id, idx, title, year, ...) | One recommended item, its fused score, its raw component scores, and why. |
| [`Rating`](#flickpick.score.Rating)(item_id, score[, rated_at, title])      | One user rating on the canonical 0-100 scale.                             |

### *class* flickpick.score.Query(mood=None, like_ids=(), include_genres=(), exclude_genres=(), year_min=None, year_max=None, min_ratings=None, exclude_ids=(), k=10, weights=<factory>)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

What the user asks for, beyond their ratings (all fields optional).

### *class* flickpick.score.Rating(item_id, score, rated_at=None, title=None)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

One user rating on the canonical 0-100 scale.

### *class* flickpick.score.Recommendation(item_id, idx, title, year, score, cf_score, semantic_score, popularity_score, reasons, because_of)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

One recommended item, its fused score, its raw component scores, and why.

#### to_dict()

A JSON-able dict.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### *class* flickpick.score.Weights(cf=1.0, semantic=1.0, popularity=0.1)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

Fusion weights of the percentile-ranked components.

### flickpick.score.candidate_mask(artifacts, query, , exclude=())

Boolean mask of items that pass the query’s structured filters.

Genres match case-insensitively: `include_genres` keeps items with any of them,
`exclude_genres` drops items with any of them. A year bound drops items with no
year.

* **Return type:**
  `ndarray`

### flickpick.score.embed_query(text, embedding)

L2-normalised `float32[dim]` embedding of `query_prefix + text`.

`embedding` is `manifest["embedding"]`; this is the only place a model runs at
query time.

* **Return type:**
  `ndarray`

### flickpick.score.format_recommendations(recs)

One line per item: `rank. title (year)  score=...  because: ...`.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`str`](https://docs.python.org/3/builtins/stdtypes.html#str)]

### flickpick.score.fuse(components, candidates, weights)

Fused score per candidate: `sum(weight * percentile_rank)` over components.

`components` maps a `Weights` field to a full-catalogue score array, or `None`
when absent (it contributes 0). Components are added in `Weights` field order,
skipping zero weights, exactly as the TypeScript `fuse` does, so that the float
sums (and therefore exact ties, broken by `n_ratings`) agree across the two.

* **Return type:**
  `ndarray`

### flickpick.score.liked_indices(artifacts, ratings)

`(liked_idx, rated_idx)`: catalogue rows the user liked, and all rated rows.

The threshold is computed over all of the user’s ratings, found in the catalogue
or not.

* **Return type:**
  [`tuple`](https://docs.python.org/3/builtins/stdtypes.html#tuple)[[`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`int`](https://docs.python.org/3/builtins/functions.html#int)], [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`int`](https://docs.python.org/3/builtins/functions.html#int)]]

### flickpick.score.percentile_rank(x)

Average ranks of `x` scaled to `[0, 1]`: `rank / max(n - 1, 1)`.

Ranks run 0..n-1 over the finite values (ascending); tied values share their mean
rank; non-finite values (e.g. `-inf` for rated items) are dropped before ranking
and get 0.

* **Return type:**
  `ndarray`

### flickpick.score.recommend(artifacts, ratings, query=None, \*, embed_query=<function embed_query>, n_because=3)

The top `query.k` unrated items for this user and query, explained.

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`Recommendation`](#flickpick.score.Recommendation)]

### flickpick.score.score_cf(artifacts, ratings)

EASE scores `float32[n_items]`; the user’s rated items are `-inf`.

* **Return type:**
  `ndarray`

### flickpick.score.score_semantic(artifacts, query_embedding)

Cosine similarity `float32[n_items]` of every item to the query embedding.

* **Return type:**
  `ndarray`

### flickpick.score.zscore(x)

`(x - mean) / std` (population std); all zeros when `x` is constant.

* **Return type:**
  `ndarray`
