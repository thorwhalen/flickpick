"""Parse ratings exports into ``Rating`` lists on the canonical 0-100 scale.

Formats (detected from the header by :func:`detect_format`; header cells are trimmed
and matched case-insensitively, and the first format whose required columns are all
present wins, in this order -- the rules of ``docs/core-contract.md``, Importers):

- **imdb** -- IMDb's ratings export (requires ``Const``, ``Your Rating``; 1-10, x10).
- **flickpick** -- ``movie_id,imdb_id,tmdb_id,rating,average_rating,title`` (requires
  ``movie_id``, ``imdb_id``, ``rating``) with ``rating`` already 0-100 and ``imdb_id``
  numeric or ``tt``-prefixed.
- **letterboxd** -- ``ratings.csv`` or ``diary.csv`` from Letterboxd's data export
  (requires ``Name``, ``Year``, ``Rating``; ``Date`` and ``Letterboxd URI`` optional;
  0.5-5 stars, x20). No IMDb id: the rating carries ``"Name (Year)"`` as its title and
  is matched by title.
- **movielens** -- a MovieLens ``ratings.csv`` (requires ``movieId``, ``rating``;
  ``userId``, ``timestamp``, ``imdbId`` and ``title`` optional; x20). Items are the
  ``imdbId`` (with ``ml:<movieId>`` as an alternate) or ``ml:<movieId>``; a file
  holding several users needs ``user_id=``.

An id cell is ASCII digits (an IMDb one may be ``tt``-prefixed); blank or 0 names no
film and the row is matched by title; anything else is refused, naming the row and
column (core contract, Importers).

>>> parse_ratings("Const,Your Rating,Title,Year\\ntt0114369,9,Se7en,1995\\n")
[Rating(item_id='tt0114369', score=90.0, rated_at=None, title='Se7en (1995)', alt_ids=())]
"""

import csv
import io
import re
from collections.abc import Callable
from datetime import datetime, timezone

from flickpick.defaults import SCALE_MAX, SCALE_MIN, STARS_TO_100, TEN_TO_100
from flickpick.ratings import ML_PREFIX, TMDB_PREFIX, Rating, imdb_id

#: format -> lower-cased columns whose presence identifies it (checked in this order;
#: the same table as the TypeScript ``SIGNATURES``)
SIGNATURES = {
    "imdb": {"const", "your rating"},
    "flickpick": {"movie_id", "imdb_id", "rating"},
    "letterboxd": {"name", "year", "rating"},
    "movielens": {"movieid", "rating"},
}


def _rows(csv_text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(csv_text.lstrip("﻿")))
    # header cells are matched stripped and lower-cased (as in ``detect_format``), so
    # "Const, Your Rating" or "RATING" does not silently yield no rows
    reader.fieldnames = [c.strip().lower() for c in reader.fieldnames or []]
    return list(reader)


def _header(csv_text: str) -> set[str]:
    first = next(csv.reader(io.StringIO(csv_text.lstrip("﻿"))), [])
    return {c.strip().lower() for c in first}


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


#: an id cell: ASCII digits, an IMDb one optionally ``tt``-prefixed (core contract,
#: Importers; ``ID_CELL`` in ``js/src/importers.ts``)
_ID_CELL = re.compile(r"(?:tt)?([0-9]+)", re.IGNORECASE)


def _id_cell(
    value, *, fmt: str, row: int, column: str, imdb: bool = False
) -> int | None:
    """The number in an id cell; ``None`` when it is blank or 0 (which names no film).

    Anything else (``356.0``, ``0x164``, ``N/A``) is refused, naming the row and column,
    with the message of the TypeScript ``idCell``.
    """
    s = "" if value is None else str(value).strip()
    m = _ID_CELL.fullmatch(s)
    if s and (not m or (not imdb and s[:2].lower() == "tt")):
        raise ValueError(f'{fmt}: row {row}: {column} is not an id: "{s}"')
    return (int(m.group(1)) or None) if s else None


def _imdb(n: int | None) -> str | None:
    return imdb_id(n) if n else None


def _score(value, factor: float) -> float:
    """``value`` converted to the 0-100 scale; raises when the result falls outside it."""
    score = float(value) * factor
    if not SCALE_MIN <= score <= SCALE_MAX:
        raise ValueError(
            f"Rating {value!r} (x{factor} = {score}) is outside the "
            f"{SCALE_MIN}-{SCALE_MAX} scale"
        )
    return score


def _with_year(title: str, year) -> str:
    return f"{title} ({year})" if not _blank(year) else title


def parse_letterboxd(csv_text: str) -> list[Rating]:
    """Letterboxd ``ratings.csv`` -> ratings (unrated rows are skipped)."""
    return [
        Rating(
            item_id="",
            score=_score(r["rating"], STARS_TO_100),
            rated_at=r.get("date") or None,
            title=_with_year(r["name"], r["year"]),
        )
        for r in _rows(csv_text)
        if not _blank(r.get("rating"))
    ]


def parse_imdb(csv_text: str) -> list[Rating]:
    """IMDb ratings export -> ratings (a row whose ``Const`` is blank or 0 has no id and
    is matched by title)."""
    return [
        Rating(
            item_id=_imdb(
                _id_cell(r["const"], fmt="imdb", row=n, column="Const", imdb=True)
            )
            or "",
            score=_score(r["your rating"], TEN_TO_100),
            rated_at=r.get("date rated") or None,
            title=_with_year(r.get("title") or "", r.get("year"))
            if r.get("title")
            else None,
        )
        for n, r in enumerate(_rows(csv_text), start=2)
        if not _blank(r.get("your rating"))
    ]


def _iso(timestamp) -> str | None:
    if _blank(timestamp):
        return None
    dt = datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
    return dt.isoformat(timespec="seconds")


def parse_movielens(csv_text: str, *, user_id=None) -> list[Rating]:
    """MovieLens ``ratings.csv`` -> ratings of one user.

    The id is ``imdbId`` when the file has it (``ml:<movieId>`` then is an alternate),
    else ``ml:<movieId>``; ``title`` is kept for matching a row with neither. ``userId``
    is optional; a file holding several users needs ``user_id``.
    """
    rows = list(enumerate(_rows(csv_text), start=2))
    users = {r["userid"].strip() for _, r in rows if not _blank(r.get("userid"))}
    if user_id is None and len(users) > 1:
        raise ValueError(
            f"The file holds {len(users)} users; pass user_id= to pick one."
        )
    if user_id is not None:
        rows = [
            (n, r) for n, r in rows if (r.get("userid") or "").strip() == str(user_id)
        ]

    def rating(n: int, r: dict) -> Rating:
        cell = dict(fmt="movielens", row=n)
        imdb = _imdb(_id_cell(r.get("imdbid"), column="imdbId", **cell))
        ml = _id_cell(r.get("movieid"), column="movieId", **cell)
        ids = [i for i in (imdb, ml and f"{ML_PREFIX}{ml}") if i]
        return Rating(
            item_id=ids[0] if ids else "",
            score=_score(r["rating"], STARS_TO_100),
            rated_at=_iso(r.get("timestamp")),
            title=r.get("title") or None,
            alt_ids=tuple(ids[1:]),
        )

    return [rating(n, r) for n, r in rows if not _blank(r.get("rating"))]


def _flickpick_ids(row: dict, n: int) -> list[str]:
    """The row's ids, in the order they are tried: ``imdb_id``, ``movie_id``, ``tmdb_id``
    (a blank or 0 cell names no film)."""
    cell = dict(fmt="flickpick", row=n)
    imdb = _imdb(_id_cell(row.get("imdb_id"), column="imdb_id", imdb=True, **cell))
    ml = _id_cell(row.get("movie_id"), column="movie_id", **cell)
    tmdb = _id_cell(row.get("tmdb_id"), column="tmdb_id", **cell)
    return [
        i
        for i in (imdb, ml and f"{ML_PREFIX}{ml}", tmdb and f"{TMDB_PREFIX}{tmdb}")
        if i
    ]


def parse_flickpick(csv_text: str) -> list[Rating]:
    """The flickpick CSV (the example file's columns) -> ratings (already 0-100)."""
    return [
        Rating(
            item_id=ids[0] if ids else "",
            score=_score(r["rating"], 1),
            rated_at=r.get("rated_at") or None,
            title=r.get("title") or None,
            alt_ids=tuple(ids[1:]),
        )
        for n, r in enumerate(_rows(csv_text), start=2)
        if not _blank(r.get("rating"))
        for ids in [_flickpick_ids(r, n)]
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
