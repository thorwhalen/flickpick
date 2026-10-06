"""Rebuild the test fixtures.

    python tests/fixtures/make_fixtures.py            # parity file only
    python tests/fixtures/make_fixtures.py --rebuild  # artifact set too (network, [embed])

The artifact set is rebuilt only with ``--rebuild`` or when it is missing. The mood
case reuses the query embedding already stored in the parity file, so regenerating the
parity file after a scoring change needs no model; the model runs only when there is no
stored embedding (or the artifact set was rebuilt).

- ``artifacts_small/``: ml-latest-small, the 600 most-rated films, top-50 EASE, with
  embeddings (the TypeScript core's parity test reads it too).
- ``parity/expected_recommend.json``: the Python scorer's output for the example ratings
  under a few queries; the mood case stores its query embedding so a parity test needs
  no model.
"""

import json
import sys
from pathlib import Path

import numpy as np

from flickpick import Query, read_artifacts, read_ratings, recommend
from flickpick.artifacts import write_artifacts
from flickpick.build import build_artifacts
from flickpick.data import load_movielens
from flickpick.score import embed_query

HERE = Path(__file__).parent
REPO = HERE.parent.parent
ARTIFACTS = HERE / "artifacts_small"
PARITY = HERE / "parity" / "expected_recommend.json"
RATINGS = "flickpick/data/examples/movie_ratings_various.csv"
N_ITEMS, TOPK = 600, 50
MOOD = "slow-burn melancholic sci-fi"

CASES = [
    {"name": "default", "query": {}},
    {
        "name": "filters",
        "query": {
            "exclude_genres": ["Horror"],
            "year_min": 1990,
            "year_max": 2005,
            "k": 10,
        },
    },
    {"name": "include_genre", "query": {"include_genres": ["sci-fi"], "k": 5}},
    {"name": "mood", "query": {"mood": MOOD, "exclude_genres": ["Horror"], "k": 10}},
]


def build_fixture():
    a = build_artifacts(load_movielens("ml-latest-small"), n_items=N_ITEMS, topk=TOPK)
    write_artifacts(a, ARTIFACTS)


def _stored_embeddings() -> dict:
    """``{case name: query embedding}`` from the current parity file, if any."""
    if not PARITY.exists():
        return {}
    cases = json.loads(PARITY.read_text())["cases"]
    return {c["name"]: c["query_embedding"] for c in cases if c.get("query_embedding")}


def parity_cases(*, reuse_embeddings: bool = True):
    a = read_artifacts(ARTIFACTS)
    ratings = read_ratings(REPO / RATINGS)
    stored = _stored_embeddings() if reuse_embeddings else {}
    out = []
    for case in CASES:
        q = Query(**case["query"])
        vec = None
        if q.mood:
            vec = (
                np.asarray(stored[case["name"]], dtype=np.float32)
                if case["name"] in stored
                else embed_query(q.mood, a.manifest["embedding"])
            )
        recs = recommend(a, ratings, q, embed_query=lambda *_, v=vec: v)
        out.append(
            {
                **case,
                "query_embedding": None if vec is None else vec.tolist(),
                "expected": [r.to_dict() for r in recs],
            }
        )
    return {
        "artifacts": "tests/fixtures/artifacts_small",
        "ratings": RATINGS,
        "cases": out,
    }


if __name__ == "__main__":
    rebuild = "--rebuild" in sys.argv[1:] or not (ARTIFACTS / "manifest.json").exists()
    if rebuild:
        build_fixture()
    PARITY.parent.mkdir(exist_ok=True)
    cases = parity_cases(reuse_embeddings=not rebuild)
    PARITY.write_text(json.dumps(cases, indent=1, ensure_ascii=False))
