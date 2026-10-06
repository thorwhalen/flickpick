"""Score and recommend over an artifact set (``docs/core-contract.md``).

The TypeScript core implements the same functions with the same defaults; a parity
test runs both on the example ratings. Scores per component:

- **cf**: ``s_j = sum_{i in L} B[i, j]`` over the user's liked set L (scores at or above
  their median, or the fixed like threshold with fewer than 5 ratings); rated items get
  ``-inf``.
- **semantic**: cosine between the mood query's embedding and each item's.
- **popularity**: ``log1p(n_ratings)``.

``recommend`` filters candidates by the structured fields, turns each available
component into percentile ranks over the candidates (``percentile_rank``: average
ranks 0..n-1 of the finite values, ties sharing their mean rank, divided by
``max(n - 1, 1)``; non-finite values get 0), adds them with ``query.weights``, sorts
(ties: more ratings first, then lower ``idx``), and explains the top ``k``. Ranks, not
z-scores, because EASE scores are heavy-tailed: their z-scores reach ~15 against ~3 for
the cosine, which drowned the mood.
"""

import math
import warnings
from collections.abc import Callable, Iterable, Sequence
from dataclasses import asdict, dataclass, field

import numpy as np

from flickpick.artifacts import Artifacts
from flickpick.defaults import DFLT
from flickpick.embedding import embed_texts
from flickpick.ratings import Rating, as_rating, like_threshold, resolve_ratings

SIMILARITY_DECIMALS = 2


@dataclass(frozen=True)
class Weights:
    """Fusion weights of the percentile-ranked components."""

    cf: float = DFLT.w_cf
    semantic: float = DFLT.w_semantic
    popularity: float = DFLT.w_popularity


@dataclass(frozen=True)
class Query:
    """What the user asks for, beyond their ratings (all fields optional)."""

    mood: str | None = None
    like_ids: Sequence[str] = ()
    include_genres: Sequence[str] = ()
    exclude_genres: Sequence[str] = ()
    year_min: int | None = None
    year_max: int | None = None
    min_ratings: int | None = None
    exclude_ids: Sequence[str] = ()
    k: int = DFLT.k
    weights: Weights = field(default_factory=Weights)


@dataclass
class Recommendation:
    """One recommended item, its fused score, its raw component scores, and why."""

    item_id: str
    idx: int
    title: str
    year: int | None
    score: float
    cf_score: float | None
    semantic_score: float | None
    popularity_score: float
    reasons: list[str]
    because_of: list[str]

    def to_dict(self) -> dict:
        """A JSON-able dict."""
        return asdict(self)


def liked_indices(
    artifacts: Artifacts, ratings: Iterable
) -> tuple[list[int], list[int]]:
    """``(liked_idx, rated_idx)``: catalogue rows the user liked, and all rated rows.

    The threshold is computed over all of the user's ratings, found in the catalogue
    or not.
    """
    ratings = [as_rating(r) for r in ratings]
    threshold = like_threshold([r.score for r in ratings])
    resolved = resolve_ratings(artifacts.catalog, ratings)
    liked = [idx for idx, r in resolved if r.score >= threshold]
    return liked, [idx for idx, _ in resolved]


def _cf_row_sum(artifacts: Artifacts, rows: Iterable[int]) -> np.ndarray:
    cf = artifacts.cf
    s = np.zeros(artifacts.n_items, dtype=np.float32)
    for i in rows:
        lo, hi = cf.indptr[i], cf.indptr[i + 1]
        s[cf.indices[lo:hi]] += cf.values[lo:hi]
    return s


def score_cf(artifacts: Artifacts, ratings: Iterable) -> np.ndarray:
    """EASE scores ``float32[n_items]``; the user's rated items are ``-inf``."""
    liked, rated = liked_indices(artifacts, ratings)
    s = _cf_row_sum(artifacts, liked)
    s[rated] = -np.inf
    return s


def score_semantic(artifacts: Artifacts, query_embedding) -> np.ndarray:
    """Cosine similarity ``float32[n_items]`` of every item to the query embedding."""
    if artifacts.embeddings is None:
        raise ValueError(
            "This artifact set has no embeddings (built with "
            "--no-embeddings); semantic scoring is unavailable."
        )
    q = np.asarray(query_embedding, dtype=np.float32).ravel()
    if q.shape[0] != artifacts.embeddings.shape[1]:
        raise ValueError(
            f"Query embedding has dim {q.shape[0]}, artifacts have "
            f"{artifacts.embeddings.shape[1]}"
        )
    return artifacts.embeddings @ q


def embed_query(text: str, embedding: dict) -> np.ndarray:
    """L2-normalised ``float32[dim]`` embedding of ``query_prefix + text``.

    ``embedding`` is ``manifest["embedding"]``; this is the only place a model runs at
    query time.
    """
    vec = embed_texts(
        [text], model=embedding["model"], prefix=embedding.get("query_prefix", "")
    )[0]
    if vec.shape[0] != int(embedding["dim"]):
        raise ValueError(
            f"Model {embedding['model']} gave dim {vec.shape[0]}, the "
            f"manifest says {embedding['dim']}"
        )
    return vec


def zscore(x: np.ndarray) -> np.ndarray:
    """``(x - mean) / std`` (population std); all zeros when ``x`` is constant."""
    x = np.asarray(x, dtype=np.float64)
    if x.size == 0:
        return x
    std = x.std()
    return np.zeros_like(x) if std == 0 else (x - x.mean()) / std


def percentile_rank(x: np.ndarray) -> np.ndarray:
    """Average ranks of ``x`` scaled to ``[0, 1]``: ``rank / max(n - 1, 1)``.

    Ranks run 0..n-1 over the finite values (ascending); tied values share their mean
    rank; non-finite values (e.g. ``-inf`` for rated items) are dropped before ranking
    and get 0.
    """
    x = np.asarray(x, dtype=np.float64)
    out = np.zeros_like(x)
    finite = np.nonzero(np.isfinite(x))[0]
    n = finite.size
    if n == 0:
        return out
    vals = x[finite]
    order = np.argsort(vals, kind="stable")
    sorted_vals = vals[order]
    # start of each run of equal values, and the run each sorted position belongs to
    starts = np.r_[0, np.nonzero(np.diff(sorted_vals))[0] + 1]
    ends = np.r_[starts[1:], n]
    mean_rank = (starts + ends - 1) / 2
    run = np.repeat(np.arange(starts.size), ends - starts)
    ranks = np.empty(n)
    ranks[order] = mean_rank[run]
    out[finite] = ranks / max(n - 1, 1)
    return out


NORMALISERS = {"percentile_rank": percentile_rank}


def fuse(components: dict, candidates: np.ndarray, weights: Weights) -> np.ndarray:
    """Fused score per candidate: ``sum(weight * percentile_rank)`` over components.

    ``components`` maps a ``Weights`` field to a full-catalogue score array, or ``None``
    when absent (it contributes 0). Components are added in ``Weights`` field order,
    skipping zero weights, exactly as the TypeScript ``fuse`` does, so that the float
    sums (and therefore exact ties, broken by ``n_ratings``) agree across the two.
    """
    normalise = NORMALISERS[DFLT.normalisation]
    out = np.zeros(len(candidates), dtype=np.float64)
    for name in Weights.__dataclass_fields__:
        scores, w = components.get(name), getattr(weights, name)
        if scores is not None and w != 0:
            out += w * normalise(np.asarray(scores)[candidates])
    return out


def _lower_set(values) -> set[str]:
    return {v.strip().lower() for v in values or () if v and v.strip()}


def candidate_mask(artifacts: Artifacts, query: Query, *, exclude=()) -> np.ndarray:
    """Boolean mask of items that pass the query's structured filters.

    Genres match case-insensitively: ``include_genres`` keeps items with any of them,
    ``exclude_genres`` drops items with any of them. A year bound drops items with no
    year.
    """
    include, excluded_genres = (
        _lower_set(query.include_genres),
        _lower_set(query.exclude_genres),
    )
    mask = np.ones(artifacts.n_items, dtype=bool)
    mask[list(exclude)] = False
    for row in artifacts.catalog:
        genres = {g.lower() for g in row["genres"]}
        year = row["year"]
        if (
            (include and not genres & include)
            or genres & excluded_genres
            or (query.year_min is not None and (year is None or year < query.year_min))
            or (query.year_max is not None and (year is None or year > query.year_max))
            or (query.min_ratings is not None and row["n_ratings"] < query.min_ratings)
        ):
            mask[row["idx"]] = False
    return mask


def _contributors(artifacts: Artifacts, liked: Sequence[int], j: int, *, n: int):
    cf = artifacts.cf
    contrib = []
    for i in liked:
        lo, hi = cf.indptr[i], cf.indptr[i + 1]
        hit = np.nonzero(cf.indices[lo:hi] == j)[0]
        if hit.size and cf.values[lo + hit[0]] > 0:
            contrib.append((float(cf.values[lo + hit[0]]), i))
    contrib.sort(key=lambda t: (-t[0], t[1]))
    return [i for _, i in contrib[:n]]


def _label(row: dict) -> str:
    return f"{row['title']} ({row['year']})" if row["year"] else row["title"]


def _reasons(artifacts, row, *, because_idx, semantic, mood) -> list[str]:
    cat = artifacts.catalog
    reasons = []
    if because_idx:
        reasons.append("you liked " + ", ".join(_label(cat[i]) for i in because_idx))
    if semantic is not None:
        reasons.append(
            f'close to "{mood}" (similarity {semantic:.{SIMILARITY_DECIMALS}f})'
        )
    if not reasons:
        mean = row["mean_rating"]
        # round half up, as JavaScript's toFixed(0) does (Python's format rounds half
        # to even, which printed "84/100" where the TypeScript core printed "85/100")
        mean_text = "" if mean is None else f", mean {math.floor(mean + 0.5)}/100"
        reasons.append(f"popular: {row['n_ratings']} ratings{mean_text}")
    return reasons


def recommend(
    artifacts: Artifacts,
    ratings: Iterable,
    query: Query | None = None,
    *,
    embed_query: Callable[[str, dict], np.ndarray] = embed_query,
    n_because: int = DFLT.n_because,
) -> list[Recommendation]:
    """The top ``query.k`` unrated items for this user and query, explained."""
    query = query or Query()
    mood = (query.mood or "").strip() or None  # a blank mood is no mood (as in TS)
    ratings = [as_rating(r) for r in ratings]
    liked, rated = liked_indices(artifacts, ratings)
    seeds = [
        artifacts.imdb_to_idx[i] for i in query.like_ids if i in artifacts.imdb_to_idx
    ]
    liked = list(dict.fromkeys([*liked, *seeds]))
    excluded = {
        *rated,
        *seeds,
        *(
            artifacts.imdb_to_idx[i]
            for i in query.exclude_ids
            if i in artifacts.imdb_to_idx
        ),
    }
    cand = np.nonzero(candidate_mask(artifacts, query, exclude=sorted(excluded)))[0]

    popularity = np.log1p(artifacts.n_ratings.astype(np.float64))
    # seam candidate: the scorer. EASE is hard-wired; iALS fold-in or item-kNN would
    # become one keyword argument once the pipeline emits their artifacts.
    cf = _cf_row_sum(artifacts, liked) if liked else None
    semantic = None
    if mood:
        if artifacts.embeddings is None:
            warnings.warn(
                "A mood was given but the artifacts have no embeddings; "
                "ignoring the mood.",
                stacklevel=2,
            )
        else:
            q = embed_query(mood, artifacts.manifest["embedding"])
            semantic = score_semantic(artifacts, q)
    components = {"cf": cf, "semantic": semantic, "popularity": popularity}
    fused = fuse(components, cand, query.weights)

    order = np.lexsort((cand, -artifacts.n_ratings[cand], -fused))[: query.k]
    recs = []
    for pos in order:
        j = int(cand[pos])
        row = artifacts.catalog[j]
        because_idx = _contributors(artifacts, liked, j, n=n_because) if liked else []
        sem = None if semantic is None else float(semantic[j])
        recs.append(
            Recommendation(
                item_id=row["imdb_id"],
                idx=j,
                title=row["title"],
                year=row["year"],
                score=float(fused[pos]),
                cf_score=None if cf is None else float(cf[j]),
                semantic_score=sem,
                popularity_score=float(popularity[j]),
                reasons=_reasons(
                    artifacts,
                    row,
                    because_idx=because_idx,
                    semantic=sem,
                    mood=mood,
                ),
                because_of=[artifacts.catalog[i]["imdb_id"] for i in because_idx],
            )
        )
    return recs


def format_recommendations(recs: Sequence[Recommendation]) -> list[str]:
    """One line per item: ``rank. title (year)  score=...  because: ...``."""
    return [
        f"{rank}. {r.title}{f' ({r.year})' if r.year else ''}  score={r.score:.3f}  "
        f"because: {'; '.join(r.reasons)}"
        for rank, r in enumerate(recs, start=1)
    ]


__all__ = [
    "Weights",
    "Query",
    "Recommendation",
    "Rating",
    "score_cf",
    "score_semantic",
    "embed_query",
    "recommend",
    "format_recommendations",
    "liked_indices",
    "candidate_mask",
    "zscore",
    "percentile_rank",
    "fuse",
]
