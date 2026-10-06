"""Science: metrics, the seeded generator, the hold-out algorithm and its parity file."""

import json
import math

import numpy as np
import pytest

from flickpick.ratings import Rating
from flickpick.science import (
    agreement,
    bootstrap_ci,
    cross_validated_fit,
    ease_scorer,
    holdout_evaluate,
    mulberry32,
    mulberry32_floats,
    popularity_scorer,
    rank_unrated,
    ranking_metrics,
    shuffled,
)


def test_ranking_metrics_hand_computed():
    m = ranking_metrics([3, 1, 2, 0], [1, 0], 3)
    # one hit, at rank 2; ideal has both held-out items at ranks 1 and 2
    dcg = 1 / math.log2(3)
    assert m == pytest.approx(
        {"hit_rate": 1.0, "recall": 0.5, "ndcg": dcg / (1 + dcg), "precision": 1 / 3}
    )


def test_ranking_metrics_perfect_and_miss():
    assert ranking_metrics([1, 0], [0, 1], 2)["ndcg"] == pytest.approx(1.0)
    assert ranking_metrics([5, 6], [0], 2) == {
        "hit_rate": 0.0,
        "recall": 0.0,
        "ndcg": 0.0,
        "precision": 0.0,
    }


def test_bootstrap_ci_constant():
    assert bootstrap_ci([0.3] * 5) == pytest.approx([0.3, 0.3])
    lo, hi = bootstrap_ci([0.0, 1.0] * 10)
    assert 0.2 < lo < 0.5 < hi < 0.8


def _linear_user(n=20):
    catalog = [
        {
            "idx": i,
            "imdb_id": f"tt{i:07d}",
            "title": f"F{i}",
            "year": None,
            "mean_rating": 40.0 + 2 * i,
        }
        for i in range(n)
    ]
    ratings = [Rating(f"tt{i:07d}", 2 * (40.0 + 2 * i) - 50) for i in range(n)]
    return ratings, catalog


def test_agreement_exact_line():
    ratings, catalog = _linear_user()
    a = agreement(ratings, catalog)
    assert a == pytest.approx(
        {"pearson": 1.0, "spearman": 1.0, "n": 20, "slope": 2.0, "intercept": -50.0}
    )


def test_cross_validated_fit_linear_beats_baseline():
    ratings, catalog = _linear_user()
    fit = cross_validated_fit(ratings, catalog, folds=4)
    assert fit["linear"]["rmse"] == pytest.approx(0, abs=1e-9)
    assert fit["baseline"]["mae"] > 10 and fit["n"] == 20


def test_mulberry32_matches_typescript():
    # first outputs of the TypeScript mulberry32 for seeds 42 and 2**32 - 1
    r = mulberry32(42)
    assert [r(), r(), r()] == [
        0.6011037519201636,
        0.44829055899754167,
        0.8524657934904099,
    ]
    assert mulberry32(4294967295)() == 0.8964226141106337
    assert mulberry32_floats(42, 2, start=1).tolist() == [
        0.44829055899754167,
        0.8524657934904099,
    ]


def test_shuffled_is_fisher_yates():
    assert sorted(shuffled(range(10), mulberry32(1))) == list(range(10))
    assert shuffled("abc", mulberry32(0)) == shuffled("abc", mulberry32(0))


def test_holdout_evaluate_on_fixture(small, example_ratings):
    out = holdout_evaluate(small, example_ratings, folds=5, k=10)
    assert set(out) == {
        "folds", "k", "n_liked", "n_rated", "per_fold", "mean", "ci95", "note"
    }  # fmt: skip
    assert out["folds"] == 5 and len(out["per_fold"]) == 5
    assert sum(f["n_test"] for f in out["per_fold"]) == out["n_liked"]
    for m in ("recall", "ndcg", "precision"):
        lo, hi = out["ci95"][m]
        assert 0 <= lo < out["mean"][m] < hi <= 1  # non-degenerate
    # hit_rate is per fold: no interval with 5 folds, and the note says why
    assert out["ci95"]["hit_rate"] is None and "hit_rate" in out["note"]
    base = holdout_evaluate(small, example_ratings, scorer=popularity_scorer)
    assert out["mean"]["ndcg"] > base["mean"]["ndcg"]


def test_holdout_folds_are_sorted_shuffled_round_robin(small, example_ratings):
    out = holdout_evaluate(small, example_ratings, folds=3, k=5, seed=11)
    liked = sorted(i for f in out["per_fold"] for i in f["test_ids"])
    order = shuffled(liked, mulberry32(11))
    assert [f["test_ids"] for f in out["per_fold"]] == [order[f::3] for f in range(3)]


def test_holdout_restricts_ratings_to_catalogue_first(small, example_ratings):
    noise = [Rating(f"tt99{i:05d}", 1.0) for i in range(200)]  # not in the catalogue
    a = holdout_evaluate(small, example_ratings)
    b = holdout_evaluate(small, [*example_ratings, *noise])
    assert (a["n_liked"], a["n_rated"], a["mean"]) == (
        b["n_liked"],
        b["n_rated"],
        b["mean"],
    )


def test_holdout_item_bootstrap_matches_mean(small, example_ratings):
    """The per-item contributions average to the fold-mean metric (so the interval is
    centred on what is reported)."""
    out = holdout_evaluate(small, example_ratings, n_boot=4000)
    for m in ("recall", "ndcg", "precision"):
        lo, hi = out["ci95"][m]
        assert lo < out["mean"][m] < hi
    ten = holdout_evaluate(small, example_ratings, folds=10, k=5)
    assert ten["note"] is None and len(ten["ci95"]["hit_rate"]) == 2


def test_rank_unrated_tie_break(small):
    flat = np.zeros(small.n_items)
    top = rank_unrated(small, flat, [], 5)
    expected = np.lexsort((np.arange(small.n_items), -small.n_ratings))[:5].tolist()
    assert top == expected
    assert rank_unrated(small, flat, [top[0]], 4) == expected[1:]
    flat[3] = -np.inf
    assert 3 not in rank_unrated(small, flat, [], small.n_items)


def test_holdout_parity_file_is_current(small, example_ratings, paths):
    """``expected_evaluate.json`` (what the TypeScript parity test reads) matches today's
    ``holdout_evaluate``; rerun ``tests/fixtures/make_fixtures.py`` after a change."""
    scorers = {"ease": ease_scorer, "popularity": popularity_scorer}
    path = paths["parity_file"].parent / "expected_evaluate.json"
    for case in json.loads(path.read_text())["cases"]:
        got = holdout_evaluate(
            small, example_ratings, scorer=scorers[case["scorer"]], **case["options"]
        )
        assert _close(json.loads(json.dumps(got)), case["expected"]), case["name"]


def _close(a, b, tol=1e-9) -> bool:
    if isinstance(b, (int, float)) and not isinstance(b, bool):
        return abs(a - b) <= tol
    if isinstance(b, list):
        return len(a) == len(b) and all(_close(x, y, tol) for x, y in zip(a, b))
    if isinstance(b, dict):
        return a.keys() == b.keys() and all(_close(a[k], b[k], tol) for k in b)
    return a == b
