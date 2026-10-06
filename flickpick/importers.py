"""Parse ratings exports into ``Rating`` lists on the canonical 0-100 scale.

Formats (detected from the header by :func:`detect_format`):

- **letterboxd** -- ``ratings.csv`` from Letterboxd's data export
  (``Date,Name,Year,Letterboxd URI,Rating``; 0.5-5 stars, x20). No IMDb id: the
  rating carries ``"Name (Year)"`` as its title and is matched by title.
- **imdb** -- IMDb's ratings export (``Const``, ``Your Rating`` 1-10, x10).
- **movielens** -- a MovieLens ``ratings.csv`` (``userId,movieId,rating,timestamp``;
  x20). Items are ``ml:<movieId>``; pass ``user_id`` when the file holds several users.
- **flickpick** -- ``movie_id,imdb_id,tmdb_id,rating,average_rating,title`` with
  ``rating`` already 0-100 and ``imdb_id`` numeric or ``tt``-prefixed.

>>> parse_ratings("Const,Your Rating,Title,Year\\ntt0114369,9,Se7en,1995\\n")
[Rating(item_id='tt0114369', score=90.0, rated_at=None, title='Se7en (1995)')]
"""

import csv
import io
from collections.abc import Callable
from datetime import datetime, timezone

from flickpick.defaults import STARS_TO_100, TEN_TO_100
from flickpick.ratings import ML_PREFIX, TMDB_PREFIX, Rating, imdb_id

#: format -> columns whose presence identifies it (checked in this order)
SIGNATURES = {
    "flickpick": {"movie_id", "imdb_id", "rating"},
    "imdb": {"Const", "Your Rating"},
    "letterboxd": {"Name", "Year", "Rating"},
    "movielens": {"userId", "movieId", "rating"},
}


def _rows(csv_text: str) -> list[dict]:
    text = csv_text.lstrip("﻿")
    return list(csv.DictReader(io.StringIO(text)))


def _header(csv_text: str) -> set[str]:
    first = next(csv.reader(io.StringIO(csv_text.lstrip("﻿"))), [])
    return {c.strip() for c in first}


def detect_format(csv_text: str) -> str:
    """The name of the export format of ``csv_text`` (a key of ``SIGNATURES``)."""
    header = _header(csv_text)
    for name, required in SIGNATURES.items():
        if required <= header:
            return name
    raise ValueError(
        f"Unrecognised ratings CSV header {sorted(header)}. Expected one of: "
        + "; ".join(f"{n} ({', '.join(sorted(c))})" for n, c in SIGNATURES.items())
    )


def _blank(value) -> bool:
    return value is None or not str(value).strip()


def _with_year(title: str, year) -> str:
    return f"{title} ({year})" if not _blank(year) else title


def parse_letterboxd(csv_text: str) -> list[Rating]:
    """Letterboxd ``ratings.csv`` -> ratings (unrated rows are skipped)."""
    return [
        Rating(
            item_id="",
            score=float(r["Rating"]) * STARS_TO_100,
            rated_at=r.get("Date") or None,
            title=_with_year(r["Name"], r["Year"]),
        )
        for r in _rows(csv_text)
        if not _blank(r.get("Rating"))
    ]


def parse_imdb(csv_text: str) -> list[Rating]:
    """IMDb ratings export -> ratings."""
    return [
        Rating(
            item_id=imdb_id(r["Const"]),
            score=float(r["Your Rating"]) * TEN_TO_100,
            rated_at=r.get("Date Rated") or None,
            title=_with_year(r.get("Title") or "", r.get("Year"))
            if r.get("Title")
            else None,
        )
        for r in _rows(csv_text)
        if not _blank(r.get("Your Rating"))
    ]


def _iso(timestamp) -> str | None:
    if _blank(timestamp):
        return None
    dt = datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
    return dt.isoformat(timespec="seconds")


def parse_movielens(csv_text: str, *, user_id=None) -> list[Rating]:
    """MovieLens ``ratings.csv`` -> ratings of one user (``ml:<movieId>`` ids)."""
    rows = _rows(csv_text)
    users = {r["userId"] for r in rows}
    if user_id is None and len(users) > 1:
        raise ValueError(
            f"The file holds {len(users)} users; pass user_id= to pick one."
        )
    if user_id is not None:
        rows = [r for r in rows if r["userId"] == str(user_id)]
    return [
        Rating(
            item_id=f"{ML_PREFIX}{int(r['movieId'])}",
            score=float(r["rating"]) * STARS_TO_100,
            rated_at=_iso(r.get("timestamp")),
        )
        for r in rows
    ]


def _flickpick_id(row: dict) -> str:
    if not _blank(row.get("imdb_id")):
        return imdb_id(row["imdb_id"])
    if not _blank(row.get("movie_id")):
        return f"{ML_PREFIX}{int(row['movie_id'])}"
    if not _blank(row.get("tmdb_id")):
        return f"{TMDB_PREFIX}{int(row['tmdb_id'])}"
    return ""


def parse_flickpick(csv_text: str) -> list[Rating]:
    """The flickpick CSV (the example file's columns) -> ratings (already 0-100)."""
    return [
        Rating(
            item_id=_flickpick_id(r),
            score=float(r["rating"]),
            rated_at=r.get("rated_at") or None,
            title=r.get("title") or None,
        )
        for r in _rows(csv_text)
        if not _blank(r.get("rating"))
    ]


PARSERS: dict[str, Callable[[str], list[Rating]]] = {
    "letterboxd": parse_letterboxd,
    "imdb": parse_imdb,
    "movielens": parse_movielens,
    "flickpick": parse_flickpick,
}


def parse_ratings(csv_text: str, *, format: str | None = None) -> list[Rating]:
    """Parse ``csv_text`` with the parser for ``format`` (detected when None)."""
    fmt = format or detect_format(csv_text)
    if fmt not in PARSERS:
        raise ValueError(f"Unknown format {fmt!r}; choose one of {sorted(PARSERS)}")
    return PARSERS[fmt](csv_text)


def read_ratings(path, *, format: str | None = None, encoding="utf-8") -> list[Rating]:
    """Read and parse a ratings CSV file."""
    with open(path, encoding=encoding) as f:
        return parse_ratings(f.read(), format=format)
