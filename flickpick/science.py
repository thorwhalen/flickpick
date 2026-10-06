"""Personal evaluation and agreement statistics ("for scientists").

- :func:`ranking_metrics`: hit rate, recall, NDCG and precision at k for one ranked list
  against a held-out set (binary relevance; recall = hits / |held out|; NDCG's ideal
  DCG puts ``min(k, |held out|)`` hits first; gains discounted by ``log2(rank + 1)``).
- :func:`holdout_evaluate`: k-fold over the user's liked items, full-catalogue ranking
  (never sampled negatives), with a bootstrap 95% interval over held-out items. The
  algorithm is specified step by step in ``docs/core-contract.md`` (Science) and is
  implemented identically by the TypeScript ``holdoutEvaluate``; a parity fixture
  (``tests/fixtures/parity/expected_evaluate.json``) holds the two together.
- :func:`agreement`: correlation and regression of the user's scores against the
  population ``mean_rating``.
- :func:`cross_validated_fit`: how well ``mean_rating`` predicts the user's score
  (linear fit) versus always predicting the user's mean.

Randomness comes from :func:`mulberry32`, a 32-bit generator small enough to specify in
a line and implement bit-for-bit in both languages (``random.Random`` and numpy's
generators have no TypeScript twin). ``scipy`` is imported only by :func:`agreement`.
"""

from collections.abc import Callable, Iterable, Mapping, Sequence

import numpy as np

from flickpick.artifacts import Artifacts
from flickpick.defaults import DFLT
from flickpick.ratings import Rating, like_threshold, resolve_ratings

METRICS = ("hit_rate", "recall", "ndcg", "precision")
#: metrics that are a mean of per-held-out-item contributions (bootstrapped per item);
#: ``hit_rate`` is a per-fold "any hit" and is bootstrapped over folds, if at all
ITEM_METRICS = ("recall", "ndcg", "precision")
#: fewer points than this make a correlation or a fold meaningless
MIN_POINTS = 3

_U32 = 0xFFFFFFFF
_TWO_32 = 4294967296.0
_MULBERRY_STEP = 0x6D2B79F5


# ------------------------------------------------------------------------- randomness


def mulberry32_floats(seed: int, n: int, *, start: int = 0) -> np.ndarray:
    """Outputs ``start .. start + n - 1`` of :func:`mulberry32` (vectorised).

    mulberry32 is counter-based: output ``i`` depends only on
    ``a_i = seed + (i + 1) * 0x6D2B79F5 (mod 2**32)``, so a block can be computed at once.

    >>> mulberry32_floats(42, 3).tolist() == [f() for f in [mulberry32(42)] for _ in range(3)]
    True
    """
    m = np.uint64(_U32)
    i = np.arange(start + 1, start + n + 1, dtype=np.uint64)
    a = (np.uint64(seed & _U32) + i * np.uint64(_MULBERRY_STEP)) & m
    t = ((a ^ (a >> np.uint64(15))) * (a | np.uint64(1))) & m
    t = t ^ ((t + (((t ^ (t >> np.uint64(7))) * (t | np.uint64(61))) & m)) & m)
    return ((t ^ (t >> np.uint64(14))) & m).astype(np.float64) / _TWO_32


def mulberry32(seed: int) -> Callable[[], float]:
    """Seeded PRNG returning floats in ``[0, 1)``; bit-identical to the TypeScript one.

    >>> r = mulberry32(42); [round(r(), 6) for _ in range(3)]
    [0.601104, 0.448291, 0.852466]
    """
    count = 0

    def random() -> float:
        nonlocal count
        count += 1
        return float(mulberry32_floats(seed, 1, start=count - 1)[0])

    return random


def shuffled(items: Sequence, random: Callable[[], float]) -> list:
    """Fisher-Yates shuffle into a new list: ``i`` from ``n - 1`` down to 1 swaps
    ``i`` with ``j = floor(random() * (i + 1))`` (as the TypeScript ``shuffled``)."""
    out = list(items)
    for i in range(len(out) - 1, 0, -1):
        j = int(random() * (i + 1))
        out[i], out[j] = out[j], out[i]
    return out


def _bootstrap_means(values: np.ndarray, *, n_boot: int, seed: int) -> np.ndarray:
    """``(n_boot, ...)`` means of resamples of the rows of ``values``.

    Resample ``b`` draws row ``floor(u * n)`` for ``n`` consecutive outputs ``u`` of
    ``mulberry32(seed)``; every column uses the same draws.
    """
    n = values.shape[0]
    idx = np.floor(mulberry32_floats(seed, n_boot * n) * n).astype(np.int64)
    return values[idx.reshape(n_boot, n)].mean(axis=1)


def _percentile_interval(means: np.ndarray, level: float) -> np.ndarray:
    tail = (1 - level) / 2
    return np.quantile(means, [tail, 1 - tail], axis=0)


def bootstrap_ci(
    values: Sequence[float],
    *,
    n_boot: int = DFLT.n_bootstrap,
    level: float = DFLT.ci_level,
    seed: int = DFLT.seed,
) -> list[float]:
    """Percentile bootstrap interval of the mean of ``values`` (linear-interpolated
    quantiles; same draws as the TypeScript ``bootstrapMeanCi``)."""
    v = np.asarray(values, dtype=float)
    if v.size == 0:
        return [float("nan"), float("nan")]
    lo, hi = _percentile_interval(_bootstrap_means(v, n_boot=n_boot, seed=seed), level)
    return [float(lo), float(hi)]


# ---------------------------------------------------------------------------- ranking


def _dcg_discount(rank0: int) -> float:
    return 1.0 / np.log2(rank0 + 2)


def ranking_metrics(
    recommended_idx: Sequence[int], held_out_idx: Iterable[int], k: int
) -> dict:
    """Ranking metrics at ``k`` of one recommendation list against held-out items.

    >>> ranking_metrics([5, 1, 7], [1, 9], 3)['recall']
    0.5
    """
    held = set(held_out_idx)
    top = list(recommended_idx)[:k]
    gains = np.array([1.0 if i in held else 0.0 for i in top])
    hits = gains.sum()
    discounts = 1.0 / np.log2(np.arange(2, len(top) + 2))
    ideal = (1.0 / np.log2(np.arange(2, min(k, len(held)) + 2))).sum()
    return {
        "hit_rate": float(hits > 0),
        "recall": float(hits / len(held)) if held else 0.0,
        "ndcg": float((gains * discounts).sum() / ideal) if ideal else 0.0,
        "precision": float(hits / k) if k else 0.0,
    }


def popularity_scorer(artifacts: Artifacts, ratings) -> np.ndarray:
    """``log1p(n_ratings)``: the baseline every personal scorer should beat."""
    return np.log1p(artifacts.n_ratings.astype(np.float64))


def ease_scorer(artifacts: Artifacts, ratings) -> np.ndarray:
    """The EASE row sum (:func:`flickpick.score.score_cf`), the default scorer."""
    from flickpick.score import score_cf

    return score_cf(artifacts, ratings)


def rank_unrated(
    artifacts: Artifacts, scores, exclude: Iterable[int], k: int
) -> list[int]:
    """Top ``k`` rows by ``scores``, skipping ``exclude`` and non-finite scores.

    Ties: more ``n_ratings`` first, then lower ``idx`` (the ``recommend`` tie-break).
    """
    s = np.asarray(scores, dtype=np.float64)
    keep = np.isfinite(s)
    keep[list(exclude)] = False
    cand = np.nonzero(keep)[0]
    order = np.lexsort((cand, -artifacts.n_ratings[cand], -s[cand]))
    return [int(i) for i in cand[order[:k]]]


def _catalogue_ratings(artifacts: Artifacts, ratings: Iterable) -> list[Rating]:
    """Step (a): ratings found in the catalogue, one per item (the latest wins),
    re-keyed to the catalogue ``imdb_id``, in catalogue ``idx`` order."""
    resolved = sorted(resolve_ratings(artifacts.catalog, ratings), key=lambda t: t[0])
    cat = artifacts.catalog
    return [Rating(item_id=cat[idx]["imdb_id"], score=r.score) for idx, r in resolved]


def _item_contributions(
    top: Sequence[int], held: Sequence[int], *, k: int, n_items: int, folds: int
) -> np.ndarray:
    """Per held-out item ``[recall, ndcg, precision]`` contributions of one fold.

    Scaled so that the mean over all held-out items of every fold equals the mean over
    folds of the fold metric: ``n / (folds * |fold|)`` per hit for recall,
    ``n / (folds * k)`` for precision, ``n * discount / (folds * idcg)`` for NDCG.
    """
    position = {idx: p for p, idx in enumerate(top[:k])}
    idcg = sum(_dcg_discount(r) for r in range(min(k, len(held))))
    rows = []
    for i in held:
        hit = i in position
        disc = _dcg_discount(position[i]) if hit else 0.0
        rows.append(
            [
                hit * n_items / (folds * len(held)),
                disc * n_items / (folds * idcg),
                hit * n_items / (folds * k),
            ]
        )
    return np.array(rows, dtype=np.float64)


def holdout_evaluate(
    artifacts: Artifacts,
    ratings: Iterable,
    *,
    folds: int = DFLT.folds,
    k: int = DFLT.k,
    seed: int = DFLT.seed,
    scorer: Callable = ease_scorer,
    n_boot: int = DFLT.n_bootstrap,
    ci_level: float = DFLT.ci_level,
    min_folds_for_fold_ci: int = DFLT.min_folds_for_fold_ci,
) -> dict:
    """K-fold holdout of the user's liked items, scored over the full catalogue.

    The algorithm (steps a-f of ``docs/core-contract.md``, Science): restrict the
    ratings to the catalogue; liked = at or above the like threshold of that restricted
    set; sort the liked ``imdb_id``s, shuffle them with ``mulberry32(seed)`` and deal
    them round-robin into folds; per fold, score with ``scorer(artifacts, train)`` and
    rank every item outside the training ratings. ``ci95`` is a bootstrap over held-out
    items for recall, NDCG and precision; ``hit_rate``'s is over folds, and ``None``
    (see ``note``) with fewer than ``min_folds_for_fold_ci`` folds.

    Returns ``{folds, k, n_liked, n_rated, per_fold, mean, ci95, note}``.
    """
    rated = _catalogue_ratings(artifacts, ratings)
    threshold = like_threshold([r.score for r in rated])
    liked = sorted(r.item_id for r in rated if r.score >= threshold)
    if len(liked) < folds:
        raise ValueError(
            f"Need at least {folds} liked items in the catalogue for "
            f"{folds}-fold evaluation; found {len(liked)}."
        )
    order = shuffled(liked, mulberry32(seed))
    to_idx = artifacts.imdb_to_idx
    per_fold, contributions = [], []
    for f in range(folds):
        test_ids = order[f::folds]
        held = set(test_ids)
        train = [r for r in rated if r.item_id not in held]
        top = rank_unrated(
            artifacts, scorer(artifacts, train), (to_idx[r.item_id] for r in train), k
        )
        test_idx = [to_idx[i] for i in test_ids]
        per_fold.append(
            {
                "fold": f,
                "n_test": len(test_ids),
                "test_ids": test_ids,
                "metrics": ranking_metrics(top, test_idx, k),
            }
        )
        contributions.append(
            _item_contributions(top, test_idx, k=k, n_items=len(liked), folds=folds)
        )
    mean = {m: float(np.mean([p["metrics"][m] for p in per_fold])) for m in METRICS}
    item_ci = _percentile_interval(
        _bootstrap_means(np.vstack(contributions), n_boot=n_boot, seed=seed), ci_level
    )
    ci95 = {m: [float(v) for v in item_ci[:, c]] for c, m in enumerate(ITEM_METRICS)}
    note = None
    if folds >= min_folds_for_fold_ci:
        hit_rates = [p["metrics"]["hit_rate"] for p in per_fold]
        ci95["hit_rate"] = bootstrap_ci(
            hit_rates, n_boot=n_boot, level=ci_level, seed=seed
        )
    else:
        ci95["hit_rate"] = None
        note = (
            f"hit_rate is per fold (any held-out item in the top {k}); with "
            f"{folds} < {min_folds_for_fold_ci} folds its interval is not reported."
        )
    return {
        "folds": folds,
        "k": k,
        "n_liked": len(liked),
        "n_rated": len(rated),
        "per_fold": per_fold,
        "mean": mean,
        "ci95": {m: ci95[m] for m in METRICS},
        "note": note,
    }


# -------------------------------------------------------------------------- agreement


def _paired_scores(ratings, catalog) -> tuple[np.ndarray, np.ndarray]:
    pairs = resolve_ratings(catalog, ratings)
    x = np.array([catalog[idx]["mean_rating"] for idx, _ in pairs], dtype=float)
    y = np.array([r.score for _, r in pairs], dtype=float)
    return x, y


def agreement(ratings: Iterable, catalog: Sequence[Mapping]) -> dict:
    """Pearson, Spearman and the OLS line of the user's score on ``mean_rating``."""
    from scipy import stats  # heavy: imported on first use, not with the package

    x, y = _paired_scores(ratings, catalog)
    if len(x) < MIN_POINTS:
        raise ValueError(
            f"Need at least {MIN_POINTS} rated catalogue items; got {len(x)}."
        )
    fit = stats.linregress(x, y)
    return {
        "pearson": float(stats.pearsonr(x, y)[0]),
        "spearman": float(stats.spearmanr(x, y)[0]),
        "n": int(len(x)),
        "slope": float(fit.slope),
        "intercept": float(fit.intercept),
    }


def _errors(pred: np.ndarray, y: np.ndarray) -> dict:
    err = pred - y
    return {"rmse": float(np.sqrt(np.mean(err**2))), "mae": float(np.mean(np.abs(err)))}


def cross_validated_fit(
    ratings: Iterable,
    catalog: Sequence[Mapping],
    *,
    folds: int = DFLT.folds,
    seed: int = DFLT.seed,
) -> dict:
    """K-fold RMSE/MAE of a linear fit on ``mean_rating`` vs the user-mean baseline."""
    x, y = _paired_scores(ratings, catalog)
    if len(x) < folds * MIN_POINTS:
        raise ValueError(
            f"Need at least {folds * MIN_POINTS} rated catalogue items "
            f"for {folds} folds; got {len(x)}."
        )
    order = np.random.default_rng(seed).permutation(len(x))
    pred_lin, pred_base = np.empty_like(y), np.empty_like(y)
    for test in np.array_split(order, folds):
        train = np.setdiff1d(order, test)
        slope, intercept = np.polyfit(x[train], y[train], 1)
        pred_lin[test] = intercept + slope * x[test]
        pred_base[test] = y[train].mean()
    return {
        "linear": _errors(pred_lin, y),
        "baseline": _errors(pred_base, y),
        "n": int(len(x)),
        "folds": folds,
    }
