"""The command surface: plain functions returning JSON-able values (SSOT for the CLI).

``python -m flickpick <command> --help`` lists each command's options; the same list,
``CLI_FUNCS``, is what any later surface (MCP, HTTP) should project.

>>> [f.__name__ for f in CLI_FUNCS]
['build', 'recommend', 'evaluate']
"""

import argparse
import json as _json
import sys
from pathlib import Path

from flickpick import science as _science
from flickpick import score as _score
from flickpick.artifacts import read_artifacts, write_artifacts
from flickpick.build import build_artifacts
from flickpick.data import FULL_DATASET, SAMPLE_DATASET, data_home, load_movielens
from flickpick.defaults import DFLT
from flickpick.importers import read_ratings

ARTIFACTS_SUBDIR = "artifacts"
LIST_SEP = ","


def default_artifacts_dir(*, sample: bool = False) -> Path:
    """Where ``build`` writes by default: ``<data home>/artifacts/<dataset>``."""
    return data_home() / ARTIFACTS_SUBDIR / (SAMPLE_DATASET if sample else FULL_DATASET)


def _resolve_artifacts_dir(artifacts) -> Path:
    if artifacts:
        return Path(artifacts).expanduser()
    for sample in (False, True):
        candidate = default_artifacts_dir(sample=sample)
        if (candidate / "manifest.json").is_file():
            return candidate
    raise FileNotFoundError(
        "No --artifacts given and none built in the data home "
        f"({data_home() / ARTIFACTS_SUBDIR}). Run: python -m flickpick build --sample"
    )


def _require(value, name: str):
    if not value:
        raise ValueError(
            f"--{name} is required (e.g. --{name} "
            "flickpick/data/examples/movie_ratings_various.csv)"
        )
    return value


def _as_list(value) -> list[str]:
    """Accept None, a comma-separated string, or a list of either."""
    if value is None:
        return []
    items = [value] if isinstance(value, str) else list(value)
    return [p.strip() for v in items for p in str(v).split(LIST_SEP) if p.strip()]


def build(
    out: str | None = None,
    *,
    sample: bool = False,
    topk: int = DFLT.topk,
    n_items: int = DFLT.n_items,
    embeddings: bool = True,
) -> dict:
    """Build an artifact set from MovieLens (ml-32m, or ml-latest-small with --sample).

    Writes to ``out`` (default: the data home). Returns a summary of what was built.
    """
    ml = load_movielens(SAMPLE_DATASET if sample else FULL_DATASET)
    a = build_artifacts(
        ml, n_items=int(n_items), topk=int(topk), embeddings=bool(embeddings)
    )
    path = write_artifacts(a, out or default_artifacts_dir(sample=sample))
    print(f"Wrote {a.n_items} items to {path}", file=sys.stderr)
    return {
        "out": str(path),
        "n_items": a.n_items,
        "nnz": int(len(a.cf.values)),
        "embedding": a.manifest["embedding"],
        "cf": a.manifest["cf"],
    }


def recommend(
    artifacts: str | None = None,
    ratings: str | None = None,
    *,
    mood: str | None = None,
    include_genres=None,
    exclude_genres=None,
    year_min: int | None = None,
    year_max: int | None = None,
    k: int = DFLT.k,
    json: bool = False,
):
    """Recommend ``k`` unrated films for the ratings in a CSV (any supported export).

    Returns one line per film (``rank. title (year)  score=...  because: ...``), or,
    with ``json``, a dict holding the full ``Recommendation`` records.
    """
    a = read_artifacts(_resolve_artifacts_dir(artifacts))
    user = read_ratings(_require(ratings, "ratings"))
    query = _score.Query(
        mood=mood or None,
        include_genres=_as_list(include_genres),
        exclude_genres=_as_list(exclude_genres),
        year_min=None if year_min is None else int(year_min),
        year_max=None if year_max is None else int(year_max),
        k=int(k),
    )
    recs = _score.recommend(a, user, query)
    if json:
        return {
            "artifacts": a.manifest["name"],
            "n_ratings": len(user),
            "recommendations": [r.to_dict() for r in recs],
        }
    return _score.format_recommendations(recs)


def evaluate(
    artifacts: str | None = None,
    ratings: str | None = None,
    *,
    folds: int = DFLT.folds,
    k: int = DFLT.k,
    seed: int = DFLT.seed,
) -> dict:
    """Personal benchmark: k-fold holdout metrics, agreement and a cross-validated fit."""
    a = read_artifacts(_resolve_artifacts_dir(artifacts))
    user = read_ratings(_require(ratings, "ratings"))
    folds, k, seed = int(folds), int(k), int(seed)
    return {
        "holdout": _science.holdout_evaluate(a, user, folds=folds, k=k, seed=seed),
        "agreement": _science.agreement(user, a.catalog),
        "cross_validated_fit": _science.cross_validated_fit(
            user, a.catalog, folds=folds, seed=seed
        ),
    }


CLI_FUNCS = [build, recommend, evaluate]

_ARTIFACTS_HELP = (
    "artifact set directory (default: the latest one built in the data home)"
)
_RATINGS_HELP = "ratings CSV: Letterboxd, IMDb, MovieLens or flickpick export"

#: per-parameter argparse settings (help texts; repeatable genre options;
#: --embeddings/--no-embeddings)
CLI_CONFIG = {
    "build": {
        "out": {"help": "output directory (default: <data home>/artifacts/<dataset>)"},
        "sample": {"help": "build from ml-latest-small instead of ml-32m"},
        "topk": {"help": "neighbours kept per item in the EASE matrix"},
        "n_items": {"help": "number of most-rated films in the artifact set"},
        "embeddings": {
            "action": argparse.BooleanOptionalAction,
            "help": "embed semantic_text (needs flickpick[embed])",
        },
    },
    "recommend": {
        "artifacts": {"help": _ARTIFACTS_HELP},
        "ratings": {"help": _RATINGS_HELP},
        "mood": {"help": "free-text mood, matched against the embeddings"},
        "include_genres": {
            "action": "append",
            "metavar": "GENRE",
            "help": "keep films with any of these genres (repeatable)",
        },
        "exclude_genres": {
            "action": "append",
            "metavar": "GENRE",
            "help": "drop films with any of these genres (repeatable)",
        },
        "year_min": {"help": "earliest release year"},
        "year_max": {"help": "latest release year"},
        "k": {"help": "number of recommendations"},
        "json": {"help": "print full records as JSON"},
    },
    "evaluate": {
        "artifacts": {"help": _ARTIFACTS_HELP},
        "ratings": {"help": _RATINGS_HELP},
        "folds": {"help": "number of holdout folds"},
        "k": {"help": "cutoff for the ranking metrics"},
        "seed": {"help": "seed of the fold shuffle and the bootstrap (mulberry32)"},
    },
}


def cli_egress(result, *, out=None, err=None) -> int:
    """Print a list one item per line, a string as is, anything else as JSON."""
    out = out or sys.stdout
    if result is None:
        return 0
    if isinstance(result, (list, tuple)):
        out.write("".join(f"{line}\n" for line in result))
    elif isinstance(result, str):
        out.write(result + "\n")
    else:
        out.write(_json.dumps(result, indent=2, ensure_ascii=False, default=str) + "\n")
    return 0
