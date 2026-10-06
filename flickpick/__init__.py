"""flickpick: a personal movie recommender (Python half: build pipeline and scorer).

Build an artifact set, then recommend from a ratings export:

>>> from flickpick import read_artifacts, read_ratings, recommend, Query  # doctest: +SKIP
>>> a = read_artifacts('path/to/artifacts')  # doctest: +SKIP
>>> recommend(a, read_ratings('my_ratings.csv'), Query(mood='slow-burn sci-fi'))  # doctest: +SKIP

From the shell: ``python -m flickpick build --sample`` then
``python -m flickpick recommend --ratings my_ratings.csv --mood "..."``.
The formats and the scoring contract are in ``docs/artifact-format.md`` and
``docs/core-contract.md``.
"""

from flickpick.artifacts import (
    CF,
    ArtifactFormatError,
    Artifacts,
    read_artifacts,
    validate_artifacts,
    write_artifacts,
)
from flickpick.build import build_artifacts
from flickpick.defaults import DFLT, Defaults
from flickpick.ease import ease_dense, fit_ease, sparsify_topk
from flickpick.importers import (
    detect_format,
    parse_flickpick,
    parse_imdb,
    parse_letterboxd,
    parse_movielens,
    parse_ratings,
    read_ratings,
)
from flickpick.ratings import Rating, resolve_ratings
from flickpick.science import (
    agreement,
    cross_validated_fit,
    holdout_evaluate,
    ranking_metrics,
)
from flickpick.score import (
    Query,
    Recommendation,
    Weights,
    embed_query,
    format_recommendations,
    recommend,
    score_cf,
    score_semantic,
)

__all__ = [
    "CF",
    "ArtifactFormatError",
    "Artifacts",
    "read_artifacts",
    "validate_artifacts",
    "write_artifacts",
    "build_artifacts",
    "DFLT",
    "Defaults",
    "ease_dense",
    "fit_ease",
    "sparsify_topk",
    "detect_format",
    "parse_flickpick",
    "parse_imdb",
    "parse_letterboxd",
    "parse_movielens",
    "parse_ratings",
    "read_ratings",
    "Rating",
    "resolve_ratings",
    "agreement",
    "cross_validated_fit",
    "holdout_evaluate",
    "ranking_metrics",
    "Query",
    "Recommendation",
    "Weights",
    "embed_query",
    "format_recommendations",
    "recommend",
    "score_cf",
    "score_semantic",
]
