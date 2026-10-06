# flickpick.defaults

Named defaults shared by the build pipeline, the scorer and the CLI.

One frozen dataclass, `DFLT`, is the single source of truth for every number the
core contract (`docs/core-contract.md`) and the artifact format
(`docs/artifact-format.md`) fix. Functions take these as keyword-only defaults, so a
caller can override any of them without touching this module.

### Module Attributes

| [`STARS_TO_100`](#flickpick.defaults.STARS_TO_100)   | The canonical ratings scale is 0-100; these convert from each source's scale.   |
|-----------------------------------------------------------------|---------------------------------------------------------------------------------|

### Classes

| [`Defaults`](#flickpick.defaults.Defaults)([ease_lambda, topk, n_items, ...])   | Every tunable number in one place (see the docs cited on each field).   |
|------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|

### *class* flickpick.defaults.Defaults(ease_lambda=500.0, topk=100, n_items=10000, like_threshold=70.0, min_ratings_for_median=5, normalisation='percentile_rank', w_cf=1.0, w_semantic=1.0, w_popularity=0.1, k=10, n_because=3, embedding_model='BAAI/bge-small-en-v1.5', embedding_dim=384, query_prefix='', embed_batch_size=64, max_tags=50, folds=5, seed=0, n_bootstrap=1000, ci_level=0.95, min_folds_for_fold_ci=10)

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

### flickpick.defaults.STARS_TO_100 *= 20*

The canonical ratings scale is 0-100; these convert from each source’s scale.
