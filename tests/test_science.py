"""Science: metrics, the seeded generator, the hold-out algorithm and its parity file."""

import json
import math

import numpy as np
import pytest

from flickpick.ratings import Rating
from flickpick.tools import cli_egress
from flickpick.science import (
    agreement,
    bootstrap_ci,
    check_folds,
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


def test_cv_fit_parity_file_is_current(small, example_ratings, paths):
    """``expected_cv_fit.json`` (what the TypeScript parity test reads) matches today's
    ``cross_validated_fit`` (#3); rerun ``tests/fixtures/make_fixtures.py`` after a change."""
    path = paths["parity_file"].parent / "expected_cv_fit.json"
    for case in json.loads(path.read_text())["cases"]:
        got = cross_validated_fit(example_ratings, small.catalog, **case["options"])
        assert _close(json.loads(json.dumps(got)), case["expected"]), case["name"]


def test_cross_validated_fit_uses_the_shared_fold_split():
    """Folds are the sorted ids shuffled with mulberry32, dealt round-robin (#3): the
    ratings' input order does not matter, and a no-spread fold predicts the baseline."""
    ratings, catalog = _linear_user()
    a = cross_validated_fit(ratings, catalog, folds=4, seed=3)
    b = cross_validated_fit(list(reversed(ratings)), catalog, folds=4, seed=3)
    assert a == b
    flat = [{**c, "mean_rating": 50.0} for c in catalog]
    fit = cross_validated_fit(ratings, flat, folds=4)
    assert fit["linear"] == fit["baseline"]


def _close(a, b, tol=1e-9) -> bool:
    if isinstance(b, (int, float)) and not isinstance(b, bool):
        return abs(a - b) <= tol
    if isinstance(b, list):
        return len(a) == len(b) and all(_close(x, y, tol) for x, y in zip(a, b))
    if isinstance(b, dict):
        return a.keys() == b.keys() and all(_close(a[k], b[k], tol) for k in b)
    return a == b


def test_cross_validated_fit_needs_one_item_per_fold_as_typescript_does():
    """#4: the Python core refused below ``folds * MIN_POINTS`` (15 for 5 folds) where
    the TypeScript core, and so the web app, accepted anything from ``folds`` up."""
    ratings, catalog = _linear_user()
    with pytest.raises(
        ValueError,
        match="^need at least 5 rated catalogue items with a mean_rating for 5 folds; got 4$",
    ):
        cross_validated_fit(ratings[:4], catalog, folds=5)
    fit = cross_validated_fit(ratings[:5], catalog, folds=5)
    assert fit["n"] == 5 and fit["folds"] == 5
    assert fit["linear"]["rmse"] == pytest.approx(
        0, abs=1e-9
    )  # 4 training points fit the line
    # Two folds of one item each: a one-point training fold falls back to the baseline.
    two = cross_validated_fit(ratings[:2], catalog, folds=2)
    assert two["linear"] == pytest.approx(two["baseline"])


@pytest.mark.parametrize("folds", [-1, 0, 1, 2.5, True])
def test_folds_below_two_are_refused_by_both_evaluations(folds, small, example_ratings):
    """#7: ``folds <= 0`` returned uninitialised numbers and ``folds = 1`` all-NaN; both
    cores now refuse with the message of the TypeScript ``checkFolds``."""
    ratings, catalog = _linear_user()
    message = f"folds must be an integer of at least 2; got {folds}"
    with pytest.raises(ValueError, match=message.replace(".", r"\.")):
        cross_validated_fit(ratings, catalog, folds=folds)
    with pytest.raises(ValueError, match=message.replace(".", r"\.")):
        holdout_evaluate(small, example_ratings, folds=folds)
    assert check_folds(2) == 2  # the smallest accepted
    assert cross_validated_fit(ratings, catalog, folds=2)["folds"] == 2


def test_whole_float_folds_pass_as_in_typescript(small, example_ratings):
    """``2.0`` is the number 2 in JavaScript, so the Python core accepts it too."""
    ratings, catalog = _linear_user()
    assert check_folds(2.0) == 2 and check_folds(np.float64(3.0)) == 3
    assert cross_validated_fit(ratings, catalog, folds=2.0) == cross_validated_fit(
        ratings, catalog, folds=2
    )
    with pytest.raises(ValueError, match="got 0$"):
        check_folds(0.0)
    with pytest.raises(ValueError, match="got nan$"):
        check_folds(float("nan"))


@pytest.mark.parametrize("k", [-1, 0, 1.5])
def test_holdout_refuses_k_below_one(k, small, example_ratings):
    """``k = 0`` divided by zero and ``k = -1`` gave a negative precision; the
    TypeScript core refuses both with the same message."""
    with pytest.raises(
        ValueError, match=f"k must be an integer of at least 1; got {k}$"
    ):
        holdout_evaluate(small, example_ratings, k=k)


def _nan_free(d):
    return {
        k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in d.items()
    }


def test_agreement_minimum_is_the_typescript_rule():
    """#7: below ``min_agreement_points`` (3) paired items the statistics are NaN, not an
    error, and a set with no spread gives NaN rather than scipy's ValueError. The same
    cases are pinned in ``js/test/science.test.ts`` ('agreement: the minimum ...')."""
    ratings, catalog = _linear_user()
    nan_stats = {"pearson": None, "spearman": None, "slope": None, "intercept": None}
    assert _nan_free(agreement(ratings[:2], catalog)) == {**nan_stats, "n": 2}
    assert _nan_free(agreement([], catalog)) == {**nan_stats, "n": 0}
    three = agreement(ratings[:3], catalog)
    assert three == pytest.approx(
        {"pearson": 1.0, "spearman": 1.0, "n": 3, "slope": 2.0, "intercept": -50.0}
    )
    flat = [{**c, "mean_rating": 60.0} for c in catalog]  # no spread in mean_rating
    assert _nan_free(agreement(ratings[:4], flat)) == {**nan_stats, "n": 4}
    assert agreement(ratings[:2], catalog, min_points=2)["slope"] == pytest.approx(2.0)


def test_cli_json_writes_nan_as_null():
    """``NaN`` is not JSON; the Node CLI's ``JSON.stringify`` writes ``null`` and so does
    this one."""
    import io

    out = io.StringIO()
    cli_egress(
        {"agreement": {"pearson": float("nan"), "n": 2, "ci": [float("inf"), 1.0]}},
        out=out,
    )
    assert json.loads(out.getvalue()) == {
        "agreement": {"pearson": None, "n": 2, "ci": [None, 1.0]}
    }


def test_too_few_items_messages_are_the_typescript_ones(small, example_ratings):
    """#8: the same refusal text as ``js/test/science.test.ts`` pins for
    ``holdoutEvaluate`` and ``crossValidatedFit``."""
    with pytest.raises(
        ValueError,
        match="^need at least 5 liked items in the catalogue for 5 folds; got 2$",
    ):
        holdout_evaluate(small, example_ratings[:2], folds=5)
    ratings, catalog = _linear_user()
    with pytest.raises(
        ValueError,
        match="^need at least 5 rated catalogue items with a mean_rating for 5 folds; got 2$",
    ):
        cross_validated_fit(ratings[:2], catalog, folds=5)


def test_cli_json_converts_numpy_values():
    """#8: numpy scalars and arrays are numbers in the JSON, not their ``str``."""
    import io

    out = io.StringIO()
    cli_egress(
        {
            "a": np.array([1.0, np.nan]),
            "b": np.int64(3),
            "c": np.float32("nan"),
            "d": (np.float32(0.5),),
        },
        out=out,
    )
    assert json.loads(out.getvalue()) == {
        "a": [1.0, None],
        "b": 3,
        "c": None,
        "d": [0.5],
    }
