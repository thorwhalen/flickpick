"""Personal evaluation and agreement statistics ("for scientists").

- :func:`ranking_metrics`: hit rate, recall, NDCG and precision at k for one ranked list
  against a held-out set (binary relevance; recall = hits / |held out|; NDCG's ideal
  DCG puts ``min(k, |held out|)`` hits first; gains discounted by ``log2(rank + 1)``).
- :func:`holdout_evaluate`: k-fold over the user's liked items, full-catalogue ranking
  (never sampled negatives), with a bootstrap confidence interval over folds.
- :func:`agreement`: correlation and regression of the user's scores against the
  population ``mean_rating``.
- :func:`cross_validated_fit`: how well ``mean_rating`` predicts the user's score
  (linear fit) versus always predicting the user's mean.
"""

from collections.abc import Callable, Iterable, Mapping, Sequence

import numpy as np
from scipy import stats

from flickpick.artifacts import Artifacts
from flickpick.defaults import DFLT
from flickpick.ratings import as_rating, like_threshold, resolve_ratings

METRICS = ("hit_rate", "recall", "ndcg", "precision")
#: fewer points than this make a correlation or a fold meaningless
MIN_POINTS = 3


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


def bootstrap_ci(
    values: Sequence[float],
    *,
    n_boot: int = DFLT.n_bootstrap,
    level: float = DFLT.ci_level,
    seed: int = DFLT.seed,
) -> list[float]:
    """Percentile bootstrap interval of the mean of ``values``."""
    v = np.asarray(values, dtype=float)
    if v.size == 0:
        return [float("nan"), float("nan")]
    rng = np.random.default_rng(seed)
    means = rng.choice(v, size=(n_boot, v.size), replace=True).mean(axis=1)
    tail = (1 - level) / 2
    return [float(np.quantile(means, tail)), float(np.quantile(means, 1 - tail))]


def _summary(per_fold: list[dict], **ci_kwargs) -> dict:
    return {
        "mean": {m: float(np.mean([f[m] for f in per_fold])) for m in METRICS},
        "ci95": {
            m: bootstrap_ci([f[m] for f in per_fold], **ci_kwargs) for m in METRICS
        },
    }


def _popularity_scorer(artifacts: Artifacts, ratings) -> np.ndarray:
    return np.log1p(artifacts.n_ratings.astype(np.float64))


def _ease_scorer(artifacts: Artifacts, ratings) -> np.ndarray:
    from flickpick.score import score_cf

    return score_cf(artifacts, ratings)


DFLT_SCORERS: Mapping[str, Callable] = {
    "ease": _ease_scorer,
    "popularity": _popularity_scorer,
}


def _top_k(scores: np.ndarray, exclude: Iterable[int], k: int) -> list[int]:
    s = np.asarray(scores, dtype=np.float64).copy()
    s[list(exclude)] = -np.inf
    order = np.lexsort((np.arange(len(s)), -s))
    return [int(i) for i in order[:k] if np.isfinite(s[i])]


def holdout_evaluate(
    artifacts: Artifacts,
    ratings: Iterable,
    *,
    folds: int = DFLT.folds,
    k: int = DFLT.k,
    seed: int = DFLT.seed,
    scorers: Mapping[str, Callable] = DFLT_SCORERS,
    n_boot: int = DFLT.n_bootstrap,
) -> dict:
    """K-fold holdout of the user's liked items, scored over the full catalogue.

    Each fold hides a fold of liked items (they are removed from the input ratings),
    scores every item with each scorer, and ranks the items the user has not rated.
    Returns ``{scorer: {"folds": [...], "mean": {...}, "ci95": {...}}, "n_liked": n}``.
    """
    ratings = [as_rating(r) for r in ratings]
    threshold = like_threshold([r.score for r in ratings])
    resolved = resolve_ratings(artifacts.catalog, ratings)
    liked = np.array([idx for idx, r in resolved if r.score >= threshold])
    if len(liked) < folds:
        raise ValueError(
            f"Need at least {folds} liked items in the catalogue for "
            f"{folds}-fold evaluation; found {len(liked)}."
        )
    rng = np.random.default_rng(seed)
    splits = np.array_split(rng.permutation(liked), folds)
    out = {name: {"folds": []} for name in scorers}
    for held in splits:
        held_set = set(held.tolist())
        train = [r for idx, r in resolved if idx not in held_set]
        train_idx = [idx for idx, _ in resolved if idx not in held_set]
        for name, scorer in scorers.items():
            ranked = _top_k(scorer(artifacts, train), train_idx, k)
            out[name]["folds"].append(ranking_metrics(ranked, held_set, k))
    for name in scorers:
        out[name].update(_summary(out[name]["folds"], n_boot=n_boot, seed=seed))
    return {**out, "n_liked": int(len(liked)), "folds": folds, "k": k}


def _paired_scores(ratings, catalog) -> tuple[np.ndarray, np.ndarray]:
    pairs = resolve_ratings(catalog, ratings)
    x = np.array([catalog[idx]["mean_rating"] for idx, _ in pairs], dtype=float)
    y = np.array([r.score for _, r in pairs], dtype=float)
    return x, y


def agreement(ratings: Iterable, catalog: Sequence[Mapping]) -> dict:
    """Pearson, Spearman and the OLS line of the user's score on ``mean_rating``."""
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
