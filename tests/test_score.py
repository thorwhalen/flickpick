import io
import json

import cw
import numpy as np
import pytest

from flickpick import Query, Rating, recommend, score_cf, score_semantic
from flickpick.score import percentile_rank, zscore
from flickpick.tools import CLI_CONFIG, CLI_FUNCS, cli_egress


def _no_model(*_):
    raise AssertionError("the model must not run without a mood")


def test_smoke_recommend(small, example_ratings):
    recs = recommend(small, example_ratings, Query(k=10), embed_query=_no_model)
    rated = {r.item_id for r in example_ratings}
    assert len(recs) == 10
    assert not {r.item_id for r in recs} & rated
    assert all(r.reasons and r.because_of for r in recs)
    assert [r.score for r in recs] == sorted((r.score for r in recs), reverse=True)


def test_mood_and_filters(small, example_ratings):
    target = next(row for row in small.catalog if "Sci-Fi" in row["genres"])
    vec = small.embeddings[target["idx"]]
    recs = recommend(
        small,
        example_ratings,
        Query(mood="space", exclude_genres=["horror"], year_min=1980, k=10),
        embed_query=lambda text, spec: vec,
    )
    for r in recs:
        row = small.catalog[r.idx]
        assert "Horror" not in row["genres"] and row["year"] >= 1980
        assert r.semantic_score is not None
        assert any("space" in reason for reason in r.reasons)


def test_include_genres_any_of(small, example_ratings):
    recs = recommend(
        small, example_ratings, Query(include_genres=["Western", "musical"], k=20)
    )
    assert recs and all(
        {"Western", "Musical"} & set(small.catalog[r.idx]["genres"]) for r in recs
    )


def test_score_cf_masks_rated(small):
    ratings = [
        Rating(small.catalog[0]["imdb_id"], 90),
        Rating(small.catalog[1]["imdb_id"], 40),
    ]
    s = score_cf(small, ratings)
    assert s.dtype == np.float32 and s.shape == (600,)
    assert np.isneginf(s[0]) and np.isneginf(s[1])
    # fewer than 5 ratings: like threshold 70, so only item 0 is liked
    lo, hi = small.cf.indptr[0], small.cf.indptr[1]
    targets, weights = small.cf.indices[lo:hi], small.cf.values[lo:hi]
    keep = targets != 1
    np.testing.assert_allclose(s[targets[keep]], weights[keep])
    assert np.count_nonzero(np.isfinite(s) & (s != 0)) == keep.sum()


def test_score_semantic_is_cosine(small):
    s = score_semantic(small, small.embeddings[3])
    assert s[3] == pytest.approx(1.0, abs=1e-5) and s.max() <= 1 + 1e-5


def test_cold_user_gets_popular_items(small):
    recs = recommend(small, [], Query(k=3))
    assert [r.idx for r in recs] == [0, 1, 2]
    assert recs[0].cf_score is None and recs[0].reasons[0].startswith("popular")


def test_zscore_constant_is_zero():
    assert zscore(np.array([2.0, 2.0])).tolist() == [0.0, 0.0]


def test_percentile_rank_ties_and_non_finite():
    # finite n = 4: ranks 1.5, 0, 1.5, -, 3 over rank / (n - 1)
    got = percentile_rank(np.array([5, 1, 5, -np.inf, 9], dtype=np.float32))
    assert got.tolist() == [0.5, 0.0, 0.5, 0.0, 1.0]
    assert percentile_rank(np.array([7.0])).tolist() == [0.0]
    assert percentile_rank(np.array([2.0, 2.0, 2.0])).tolist() == [0.5, 0.5, 0.5]


def test_parity_file_reproduces(small, example_ratings, paths):
    expected = json.loads(paths["parity_file"].read_text())
    for case in expected["cases"]:
        vec = case["query_embedding"]
        recs = recommend(
            small,
            example_ratings,
            Query(**case["query"]),
            embed_query=lambda *_, v=vec: np.array(v, dtype=np.float32),
        )
        got = [r.to_dict() for r in recs]
        assert [g["item_id"] for g in got] == [e["item_id"] for e in case["expected"]]
        assert [g["because_of"] for g in got] == [
            e["because_of"] for e in case["expected"]
        ]
        np.testing.assert_allclose(
            [g["score"] for g in got], [e["score"] for e in case["expected"]], rtol=1e-5
        )


def _cli(*argv):
    out = io.StringIO()
    code = cw.dispatch(
        CLI_FUNCS, list(argv), config=CLI_CONFIG, egress=cli_egress, out=out
    )
    return code, out.getvalue()


def test_cli_recommend_lines(paths):
    code, text = _cli(
        "recommend",
        "--artifacts",
        str(paths["fixture_dir"]),
        "--ratings",
        str(paths["example_ratings"]),
        "--exclude-genre",
        "Horror",
        "--exclude-genre",
        "Comedy",
        "--k",
        "4",
    )
    lines = text.strip().splitlines()
    assert code == 0 and len(lines) == 4
    assert (
        lines[0].startswith("1. ") and "score=" in lines[0] and "because:" in lines[0]
    )


def test_cli_recommend_json(paths):
    code, text = _cli(
        "recommend",
        "--artifacts",
        str(paths["fixture_dir"]),
        "--ratings",
        str(paths["example_ratings"]),
        "--k",
        "2",
        "--json",
    )
    recs = json.loads(text)["recommendations"]
    assert code == 0 and len(recs) == 2 and {"item_id", "because_of"} <= set(recs[0])
