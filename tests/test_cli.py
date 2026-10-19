"""The Python CLI (``python -m flickpick``): refusals and notes read as the Node CLI's."""

import pytest

from flickpick.__main__ import EXIT_ERROR, main


@pytest.fixture
def evaluate_args(paths):
    return [
        "evaluate",
        "--artifacts",
        str(paths["fixture_dir"]),
        "--ratings",
        str(paths["example_ratings"]),
    ]


@pytest.mark.parametrize(
    "flag, value, message",
    [
        ("--folds", "-1", "folds must be an integer of at least 2; got -1"),
        ("--folds", "1", "folds must be an integer of at least 2; got 1"),
        ("--k", "-1", "k must be an integer of at least 1; got -1"),
    ],
)
def test_refusal_is_one_line_with_exit_1(evaluate_args, capsys, flag, value, message):
    """#10: a refusal printed a traceback; now ``flickpick: <message>`` and exit 1, the
    cases ``js/test/cli.test.ts`` pins for the Node CLI."""
    assert main([*evaluate_args, flag, value]) == EXIT_ERROR == 1
    out, err = capsys.readouterr()
    assert out == ""
    assert err.splitlines()[-1] == f"flickpick: {message}"
    assert "Traceback" not in err


def test_missing_ratings_file_is_one_line(paths, capsys):
    args = [
        "recommend",
        "--artifacts",
        str(paths["fixture_dir"]),
        "--ratings",
        "nope.csv",
    ]
    assert main(args) == 1
    assert capsys.readouterr().err.startswith("flickpick: ")


def test_unmatched_ratings_are_noted_on_stderr(paths, capsys, tmp_path):
    """#10: the Node CLI's ``note:`` line, word for word; stdout stays JSON."""
    import json

    from flickpick import read_artifacts

    cat = read_artifacts(paths["fixture_dir"]).catalog
    rows = [f"{c['ml_id']},{c['imdb_id']},,90,,{c['title']}" for c in cat[:2]]
    csv = tmp_path / "ratings.csv"
    csv.write_text(
        "movie_id,imdb_id,tmdb_id,rating,average_rating,title\n"
        + "\n".join([*rows, "999999,tt9999999,,70,,Nowhere (1900)"])
        + "\n"
    )
    args = [
        "recommend",
        "--artifacts",
        str(paths["fixture_dir"]),
        "--ratings",
        str(csv),
    ]
    assert main([*args, "--k", "1", "--json"]) == 0
    out, err = capsys.readouterr()
    assert err == "note: 2 of 3 ratings matched the catalogue; the rest are ignored\n"
    assert len(json.loads(out)["recommendations"]) == 1


@pytest.mark.parametrize("k", ["0", "-1"])
def test_recommend_refuses_k_below_one(paths, capsys, k):
    """#10 review: ``recommend --k -1`` printed every film; both cores now refuse it."""
    args = ["recommend", "--artifacts", str(paths["fixture_dir"])]
    args += ["--ratings", str(paths["example_ratings"]), "--k", k]
    assert main(args) == 1
    err = capsys.readouterr().err
    assert (
        err.splitlines()[-1]
        == f"flickpick: k must be an integer of at least 1; got {k}"
    )


def test_missing_ratings_is_a_usage_error(paths, capsys):
    """Exit 2 with Node's first line, as for any other usage error."""
    assert main(["evaluate", "--artifacts", str(paths["fixture_dir"])]) == 2
    assert capsys.readouterr().err == "flickpick: --ratings is required\n"
