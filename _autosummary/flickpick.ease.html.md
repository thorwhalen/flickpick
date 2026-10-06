# flickpick.ease

EASE (Steck 2019): a closed-form linear item-item model, sparsified to top-k.

Given a binary user x item matrix X:

> G = X^T X + lambda I;   P = G^-1;   B = -P / diag(P) (column-wise);   diag(B) = 0

A user’s score vector is then `x B`. `B` is dense, so each source row keeps only its
`topk` largest positive weights (the recsys report, section 3, measured 98% of dense
[NDCG@100](mailto:NDCG@100) at top-100 on MovieLens 32M). Rows of the result are source items, columns
target items, and each row’s entries are sorted by descending weight, which is the
order `docs/artifact-format.md` requires.

### Module Attributes

| [`SPARSIFY_CHUNK_ROWS`](#flickpick.ease.SPARSIFY_CHUNK_ROWS)   | rows processed at a time when sparsifying a dense B (bounds peak memory)   |
|------------------------------------------------------------------------|----------------------------------------------------------------------------|

### Functions

| [`ease_dense`](#flickpick.ease.ease_dense)(X, \*[, lam, dtype])       | The dense EASE weight matrix B for a (sparse or dense) binary matrix X.          |
|----------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| [`fit_ease`](#flickpick.ease.fit_ease)(X, \*[, lam, topk, n_items]) | Fit sparse EASE on X restricted to its `n_items` most-rated columns (None: all). |
| [`most_rated_items`](#flickpick.ease.most_rated_items)(X, \*[, n_items])    | Column indices of the `n_items` columns of `X` with most nonzeros.               |
| [`sparsify_topk`](#flickpick.ease.sparsify_topk)(B, \*[, topk])          | Keep each row's `topk` largest positive weights, sorted descending, as CSR.      |

### flickpick.ease.SPARSIFY_CHUNK_ROWS *= 1024*

rows processed at a time when sparsifying a dense B (bounds peak memory)

### flickpick.ease.ease_dense(X, \*, lam=500.0, dtype=<class 'numpy.float64'>)

The dense EASE weight matrix B for a (sparse or dense) binary matrix X.

* **Return type:**
  `ndarray`

### flickpick.ease.fit_ease(X, , lam=500.0, topk=100, n_items=10000)

Fit sparse EASE on X restricted to its `n_items` most-rated columns (None: all).

Returns `(cf, item_cols)`: the CSR matrix over the kept items, and the original
column index of each kept item (row `r` of `cf` is column `item_cols[r]`).

* **Return type:**
  [`tuple`](https://docs.python.org/3/builtins/stdtypes.html#tuple)[[`CF`](flickpick.artifacts.html.md#flickpick.artifacts.CF), `ndarray`]

### flickpick.ease.most_rated_items(X, , n_items=10000)

Column indices of the `n_items` columns of `X` with most nonzeros.

Ties are broken by column index, so the result is deterministic.

* **Return type:**
  `ndarray`

### flickpick.ease.sparsify_topk(B, , topk=100)

Keep each row’s `topk` largest positive weights, sorted descending, as CSR.

* **Return type:**
  [`CF`](flickpick.artifacts.html.md#flickpick.artifacts.CF)
