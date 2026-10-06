"""Named defaults shared by the build pipeline, the scorer and the CLI.

One frozen dataclass, ``DFLT``, is the single source of truth for every number the
core contract (``docs/core-contract.md``) and the artifact format
(``docs/artifact-format.md``) fix. Functions take these as keyword-only defaults, so a
caller can override any of them without touching this module.
"""

from dataclasses import dataclass

#: The canonical ratings scale is 0-100; these convert from each source's scale.
STARS_TO_100 = 20  # Letterboxd and MovieLens: 0.5-5 stars
TEN_TO_100 = 10  # IMDb: 1-10


@dataclass(frozen=True)
class Defaults:
    """Every tunable number in one place (see the docs cited on each field)."""

    # Collaborative filtering (EASE, Steck 2019)
    #: L2 regularisation; the recsys report's probe found 200, 500 and 1000 tie on
    #: NDCG@100 for MovieLens 32M (docs/research/recsys-methods-libraries-evaluation.md §3)
    ease_lambda: float = 500.0
    #: kept neighbours per item row (98% of dense NDCG@100 in the same probe)
    topk: int = 100
    #: number of most-rated items in the CF artifact (they carry ~97% of ratings)
    n_items: int = 10_000
    #: a population rating counts as a "like" at or above this, on the 0-100 scale
    #: (3.5 stars)
    like_threshold: float = 70.0

    # The user's liked set (core contract: "Defaults that are not seams")
    #: with fewer ratings than this, the fixed like_threshold replaces the median
    min_ratings_for_median: int = 5

    # Fusion
    #: how each component is normalised over the candidate set before the weighted
    #: sum (core contract: "Defaults that are not seams"); the only value is
    #: "percentile_rank" (average ranks scaled to [0, 1])
    normalisation: str = "percentile_rank"
    w_cf: float = 1.0
    w_semantic: float = 1.0
    w_popularity: float = 0.1
    k: int = 10
    #: number of liked items named in "because you liked ..."
    n_because: int = 3

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384
    query_prefix: str = ""
    embed_batch_size: int = 64
    #: cap on the distinct user tags appended to semantic_text (most frequent first)
    max_tags: int = 50

    # Evaluation
    folds: int = 5
    seed: int = 0
    n_bootstrap: int = 1000
    ci_level: float = 0.95


DFLT = Defaults()
