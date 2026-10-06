import math

import pytest

from flickpick.ratings import Rating
from flickpick.science import (
    agreement,
    bootstrap_ci,
    cross_validated_fit,
    holdout_evaluate,
    ranking_metrics,
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


def test_holdout_evaluate_on_fixture(small, example_ratings):
    out = holdout_evaluate(small, example_ratings, folds=5, k=10)
    assert set(out["ease"]) == {"folds", "mean", "ci95"}
    assert len(out["ease"]["folds"]) == 5
    for name in ("ease", "popularity"):
        lo, hi = out[name]["ci95"]["ndcg"]
        assert 0 <= lo <= out[name]["mean"]["ndcg"] <= hi <= 1
    assert out["ease"]["mean"]["ndcg"] > out["popularity"]["mean"]["ndcg"]
