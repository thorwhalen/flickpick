# flickpick.science

Personal evaluation and agreement statistics (“for scientists”).

- [`ranking_metrics()`](#flickpick.science.ranking_metrics): hit rate, recall, NDCG and precision at k for one ranked list
  against a held-out set (binary relevance; recall = hits / 

  ```
  |held out|
  ```

  ; NDCG’s ideal
  DCG puts `min(k, |held out|)` hits first; gains discounted by `log2(rank + 1)`).
- [`holdout_evaluate()`](#flickpick.science.holdout_evaluate): k-fold over the user’s liked items, full-catalogue ranking
  (never sampled negatives), with a bootstrap 95% interval over held-out items. The
  algorithm is specified step by step in `docs/core-contract.md` (Science) and is
  implemented identically by the TypeScript `holdoutEvaluate`; a parity fixture
  (`tests/fixtures/parity/expected_evaluate.json`) holds the two together.
- [`agreement()`](#flickpick.science.agreement): correlation and regression of the user’s scores against the
  population `mean_rating`; `NaN` where undefined (too few points, no spread), as
  the TypeScript `agreement`.
- [`cross_validated_fit()`](#flickpick.science.cross_validated_fit): how well `mean_rating` predicts the user’s score
  (linear fit) versus always predicting the user’s mean.

Randomness comes from [`mulberry32()`](#flickpick.science.mulberry32), a 32-bit generator small enough to specify in
a line and implement bit-for-bit in both languages (`random.Random` and numpy’s
generators have no TypeScript twin). `scipy` is imported only by [`agreement()`](#flickpick.science.agreement).

### Module Attributes

| [`ITEM_METRICS`](#flickpick.science.ITEM_METRICS)   | metrics that are a mean of per-held-out-item contributions (bootstrapped per item); `hit_rate` is a per-fold "any hit" and is bootstrapped over folds, if at all   |
|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [`MIN_FOLDS`](#flickpick.science.MIN_FOLDS)      | a k-fold split needs a training fold besides the held-out one (core contract, Science)                                                                             |
| [`MIN_K`](#flickpick.science.MIN_K)          | the ranking metrics are at a cutoff of at least one item                                                                                                           |

### Functions

| [`agreement`](#flickpick.science.agreement)(ratings, catalog, \*[, min_points])     | Pearson, Spearman (average ranks) and the OLS line of the user's score on `mean_rating`, over the rated catalogue items that have one.          |
|----------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| [`bootstrap_ci`](#flickpick.science.bootstrap_ci)(values, \*[, n_boot, level, seed])   | Percentile bootstrap interval of the mean of `values` (linear-interpolated quantiles; same draws as the TypeScript `bootstrapMeanCi`).          |
| [`check_folds`](#flickpick.science.check_folds)(folds)                                | `folds` as an `int`, refused below [`MIN_FOLDS`](#flickpick.science.MIN_FOLDS) (#7).                                             |
| [`cross_validated_fit`](#flickpick.science.cross_validated_fit)(ratings, catalog, \*[, ...])  | K-fold RMSE/MAE of a linear fit on `mean_rating` vs the user-mean baseline.                                                                     |
| [`ease_scorer`](#flickpick.science.ease_scorer)(artifacts, ratings)                   | The EASE row sum ([`flickpick.score.score_cf()`](flickpick.score.html.md#flickpick.score.score_cf)), the default scorer.    |
| [`holdout_evaluate`](#flickpick.science.holdout_evaluate)(artifacts, ratings, \*[, ...])   | K-fold holdout of the user's liked items, scored over the full catalogue.                                                                       |
| [`mulberry32`](#flickpick.science.mulberry32)(seed)                                  | Seeded PRNG returning floats in `[0, 1)`; bit-identical to the TypeScript one.                                                                  |
| [`mulberry32_floats`](#flickpick.science.mulberry32_floats)(seed, n, \*[, start])           | Outputs <br/><br/>```<br/>``<br/>```<br/><br/>start .                                                                                           |
| [`popularity_scorer`](#flickpick.science.popularity_scorer)(artifacts, ratings)             | `log1p(n_ratings)`: the baseline every personal scorer should beat.                                                                             |
| [`rank_unrated`](#flickpick.science.rank_unrated)(artifacts, scores, exclude, k)       | Top `k` rows by `scores`, skipping `exclude` and non-finite scores.                                                                             |
| [`ranking_metrics`](#flickpick.science.ranking_metrics)(recommended_idx, held_out_idx, k) | Ranking metrics at `k` of one recommendation list against held-out items.                                                                       |
| [`shuffled`](#flickpick.science.shuffled)(items, random)                           | Fisher-Yates shuffle into a new list: `i` from `n - 1` down to 1 swaps `i` with `j = floor(random() * (i + 1))` (as the TypeScript `shuffled`). |

### flickpick.science.ITEM_METRICS *= ('recall', 'ndcg', 'precision')*

metrics that are a mean of per-held-out-item contributions (bootstrapped per item);
`hit_rate` is a per-fold “any hit” and is bootstrapped over folds, if at all

### flickpick.science.MIN_FOLDS *= 2*

a k-fold split needs a training fold besides the held-out one (core contract, Science)

### flickpick.science.MIN_K *= 1*

the ranking metrics are at a cutoff of at least one item

### flickpick.science.agreement(ratings, catalog, , min_points=3)

Pearson, Spearman (average ranks) and the OLS line of the user’s score on
`mean_rating`, over the rated catalogue items that have one.

Never refuses: with fewer than `min_points` paired items every statistic but `n`
is `nan`, and so is any that is undefined for lack of spread. The TypeScript
`agreement` follows the same rule (#7), so both CLIs report the same numbers.

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.science.bootstrap_ci(values, , n_boot=1000, level=0.95, seed=0)

Percentile bootstrap interval of the mean of `values` (linear-interpolated
quantiles; same draws as the TypeScript `bootstrapMeanCi`).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`float`](https://docs.python.org/3/builtins/functions.html#float)]

### flickpick.science.check_folds(folds)

`folds` as an `int`, refused below [`MIN_FOLDS`](#flickpick.science.MIN_FOLDS) (#7).

* **Return type:**
  [`int`](https://docs.python.org/3/builtins/functions.html#int)

### flickpick.science.cross_validated_fit(ratings, catalog, , folds=5, seed=0)

K-fold RMSE/MAE of a linear fit on `mean_rating` vs the user-mean baseline.

The folds are the shared split of `docs/core-contract.md` (Science): the paired
items sorted by `imdb_id`, shuffled with `mulberry32(seed)`, position `p` in
fold `p mod folds`, so the TypeScript `crossValidatedFit` gives the same numbers
for the same seed (#3). A training fold with no spread in `mean_rating` predicts
the baseline.

It needs at least `folds` paired items, one per held-out fold, as the TypeScript
core does (#4): below that a fold would be empty. Small inputs are not refused
beyond that, because a training fold too small to fit a line predicts the baseline
and the result reports its `n`. `folds` below [`MIN_FOLDS`](#flickpick.science.MIN_FOLDS) is refused (#7).

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.science.ease_scorer(artifacts, ratings)

The EASE row sum ([`flickpick.score.score_cf()`](flickpick.score.html.md#flickpick.score.score_cf)), the default scorer.

* **Return type:**
  `ndarray`

### flickpick.science.holdout_evaluate(artifacts, ratings, \*, folds=5, k=10, seed=0, scorer=<function ease_scorer>, n_boot=1000, ci_level=0.95, min_folds_for_fold_ci=10)

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

### flickpick.science.mulberry32(seed)

Seeded PRNG returning floats in `[0, 1)`; bit-identical to the TypeScript one.

```pycon
>>> r = mulberry32(42); [round(r(), 6) for _ in range(3)]
[0.601104, 0.448291, 0.852466]
```

* **Return type:**
  [`Callable`](https://docs.python.org/3/library/collections.abc.html#collections.abc.Callable)[[], [`float`](https://docs.python.org/3/builtins/functions.html#float)]

### flickpick.science.mulberry32_floats(seed, n, , start=0)

Outputs `start .. start + n - 1` of [`mulberry32()`](#flickpick.science.mulberry32) (vectorised).

mulberry32 is counter-based: output `i` depends only on
`a_i = seed + (i + 1) * 0x6D2B79F5 (mod 2**32)`, so a block can be computed at once.

```pycon
>>> mulberry32_floats(42, 3).tolist() == [f() for f in [mulberry32(42)] for _ in range(3)]
True
```

* **Return type:**
  `ndarray`

### flickpick.science.popularity_scorer(artifacts, ratings)

`log1p(n_ratings)`: the baseline every personal scorer should beat.

* **Return type:**
  `ndarray`

### flickpick.science.rank_unrated(artifacts, scores, exclude, k)

Top `k` rows by `scores`, skipping `exclude` and non-finite scores.

Ties: more `n_ratings` first, then lower `idx` (the `recommend` tie-break).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)[[`int`](https://docs.python.org/3/builtins/functions.html#int)]

### flickpick.science.ranking_metrics(recommended_idx, held_out_idx, k)

Ranking metrics at `k` of one recommendation list against held-out items.

```pycon
>>> ranking_metrics([5, 1, 7], [1, 9], 3)['recall']
0.5
```

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.science.shuffled(items, random)

Fisher-Yates shuffle into a new list: `i` from `n - 1` down to 1 swaps
`i` with `j = floor(random() * (i + 1))` (as the TypeScript `shuffled`).

* **Return type:**
  [`list`](https://docs.python.org/3/builtins/stdtypes.html#list)
