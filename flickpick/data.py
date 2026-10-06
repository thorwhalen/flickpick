"""Download (with a cache) and parse the MovieLens datasets the build uses.

Zips are cached under ``<data home>/raw/`` -- ``~/.local/share/flickpick/raw/`` unless
the ``FLICKPICK_DATA_HOME`` environment variable says otherwise -- through the ``graze``
URL cache when it is installed, else plain ``urllib``. CSVs are streamed out of the
zip with ``zipfile``, so the 900 MB ``ratings.csv`` of ml-32m is never held as bytes.

MovieLens licence: research and non-commercial use, and redistributed transformations
carry the same conditions (https://grouplens.org/datasets/movielens/).
"""

import os
import sys
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

DATA_HOME_ENVVAR = "FLICKPICK_DATA_HOME"
DFLT_DATA_HOME = "~/.local/share/flickpick"
MOVIELENS_BASE_URL = "https://files.grouplens.org/datasets/movielens/"
MOVIELENS_HOME = "https://grouplens.org/datasets/movielens/"
MOVIELENS_LICENCE = "research, non-commercial, share-alike on transformations"

SAMPLE_DATASET = "ml-latest-small"
FULL_DATASET = "ml-32m"
DATASETS = {
    name: f"{MOVIELENS_BASE_URL}{name}.zip" for name in (SAMPLE_DATASET, FULL_DATASET)
}

_DTYPES = {
    "ratings": {
        "userId": "int32",
        "movieId": "int32",
        "rating": "float32",
        "timestamp": "int64",
    },
    "movies": {"movieId": "int32", "title": "string", "genres": "string"},
    "links": {"movieId": "int32", "imdbId": "Int64", "tmdbId": "Int64"},
    "tags": {
        "userId": "int32",
        "movieId": "int32",
        "tag": "string",
        "timestamp": "int64",
    },
}


def data_home() -> Path:
    """The package's data folder (``$FLICKPICK_DATA_HOME`` or ``~/.local/share/flickpick``)."""
    return Path(os.environ.get(DATA_HOME_ENVVAR, DFLT_DATA_HOME)).expanduser()


def raw_dir() -> Path:
    """Where downloaded source archives are cached."""
    return data_home() / "raw"


def _download(url: str, path: Path) -> Path:
    try:
        import graze
    except ImportError:
        graze = None
    print(f"Downloading {url} -> {path}", file=sys.stderr)
    if graze is not None:
        return Path(graze.graze(url, cache_key=str(path), return_key=True))
    tmp = path.with_suffix(path.suffix + ".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.replace(path)
    return path


def fetch_dataset(name: str = SAMPLE_DATASET, *, cache_dir=None) -> Path:
    """Path to the cached zip of MovieLens dataset ``name``, downloading it if needed."""
    if name not in DATASETS:
        raise ValueError(f"Unknown dataset {name!r}; choose one of {sorted(DATASETS)}")
    folder = Path(cache_dir).expanduser() if cache_dir else raw_dir()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{name}.zip"
    if path.is_file() and zipfile.is_zipfile(path):
        return path
    return _download(DATASETS[name], path)


@dataclass
class MovieLens:
    """The four MovieLens tables used by the build, as DataFrames."""

    name: str
    ratings: pd.DataFrame
    movies: pd.DataFrame
    links: pd.DataFrame
    tags: pd.DataFrame


def _read_member(zf: zipfile.ZipFile, table: str) -> pd.DataFrame:
    members = [
        n for n in zf.namelist() if n.endswith(f"/{table}.csv") or n == f"{table}.csv"
    ]
    if not members:
        raise FileNotFoundError(f"{table}.csv not found in {zf.filename}")
    dtypes = _DTYPES[table]
    with zf.open(members[0]) as f:
        return pd.read_csv(f, dtype=dtypes, usecols=list(dtypes))


def read_movielens(zip_path, *, name: str | None = None) -> MovieLens:
    """Parse ratings, movies, links and tags out of a MovieLens zip."""
    zip_path = Path(zip_path)
    with zipfile.ZipFile(zip_path) as zf:
        tables = {t: _read_member(zf, t) for t in _DTYPES}
    return MovieLens(name=name or zip_path.stem, **tables)


def load_movielens(name: str = SAMPLE_DATASET, *, cache_dir=None) -> MovieLens:
    """Fetch (cached) and parse MovieLens dataset ``name``."""
    return read_movielens(fetch_dataset(name, cache_dir=cache_dir), name=name)


def movielens_source(name: str) -> dict:
    """The manifest ``sources`` entry for a MovieLens dataset."""
    return {
        "name": f"MovieLens {name}",
        "version": name,
        "licence": MOVIELENS_LICENCE,
        "url": MOVIELENS_HOME,
    }
