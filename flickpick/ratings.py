"""The canonical ``Rating`` type, and how ratings are joined to a catalogue.

A rating's ``item_id`` is an IMDb id (``tt0114369``) whenever the source knows it. Sources
that do not (Letterboxd, MovieLens) emit a prefixed reference instead -- ``ml:<movieId>``,
``tmdb:<id>``, or no id at all with a ``"Title (Year)"`` title -- and
:func:`resolve_ratings` maps each to a catalogue row index.
"""

import re
import statistics
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from flickpick.defaults import DFLT

IMDB_PREFIX = "tt"
IMDB_DIGITS = 7
ML_PREFIX = "ml:"
TMDB_PREFIX = "tmdb:"

_YEAR_SUFFIX = re.compile(r"\s*\((\d{4})(?:[-–]\d{0,4})?\)\s*$")
_PARENTHETICAL = re.compile(r"\s*\(([^()]*)\)")
_AKA = re.compile(r"^(?:a\.k\.a\.|aka)\s+", re.IGNORECASE)
#: an ``item_id`` that names one film: an IMDb id, ``ml:<id>`` or ``tmdb:<id>``
#: (``CATALOGUE_ID`` in ``js/src/importers.ts``)
_CATALOGUE_ID = re.compile(r"^(?:tt\d+|ml:\d+|tmdb:\d+)$")


@dataclass(frozen=True)
class Rating:
    """One user rating on the canonical 0-100 scale."""

    item_id: str
    score: float
    rated_at: str | None = None
    title: str | None = None
    #: the source's other ids for the same film (``ml:<id>``, ``tmdb:<id>``), tried after
    #: ``item_id`` when it misses the catalogue (#15)
    alt_ids: tuple[str, ...] = ()


def as_rating(x) -> Rating:
    """Coerce a ``Rating`` or a mapping with the same keys into a ``Rating``."""
    if isinstance(x, Rating):
        return x
    if isinstance(x, Mapping):
        return Rating(
            item_id=str(x.get("item_id") or ""),
            score=float(x["score"]),
            rated_at=x.get("rated_at"),
            title=x.get("title"),
            alt_ids=tuple(x.get("alt_ids") or ()),
        )
    raise TypeError(f"Expected a Rating or a mapping, got {type(x).__name__}: {x!r}")


def imdb_id(value) -> str | None:
    """Normalise an IMDb id given as ``114369``, ``'114369'`` or ``'tt0114369'``.

    ``0`` names no film and gives ``None``, as the TypeScript ``normalizeImdbId``.

    >>> imdb_id(114369), imdb_id('tt0114369'), imdb_id(''), imdb_id(12345678), imdb_id(0)
    ('tt0114369', 'tt0114369', None, 'tt12345678', None)
    """
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if s.lower().startswith(IMDB_PREFIX):
        s = s[len(IMDB_PREFIX) :]
    if not s.isdigit():
        raise ValueError(f"Not an IMDb id: {value!r}")
    if int(s) == 0:
        return None
    return f"{IMDB_PREFIX}{int(s):0{IMDB_DIGITS}d}"


def split_title_year(text: str) -> tuple[str, int | None]:
    """Split ``"Toy Story (1995)"`` into ``("Toy Story", 1995)``.

    >>> split_title_year('Toy Story (1995) ')
    ('Toy Story', 1995)
    >>> split_title_year('Babylon 5')
    ('Babylon 5', None)
    """
    m = _YEAR_SUFFIX.search(text)
    if not m:
        return text.strip(), None
    return text[: m.start()].strip(), int(m.group(1))


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def title_variants(title: str) -> list[str]:
    """The primary title plus any parenthesised alternates, normalised for matching.

    >>> title_variants('Seven (a.k.a. Se7en)')
    ['seven', 'se7en']
    """
    alternates = [_AKA.sub("", p) for p in _PARENTHETICAL.findall(title)]
    primary = _PARENTHETICAL.sub("", title)
    return [v for v in (_norm(t) for t in [primary, *alternates]) if v]


def title_keys(title: str, year: int | None) -> list[str]:
    """Matching keys ``"normalised title|year"`` for a title and its alternates."""
    return [f"{t}|{year if year is not None else ''}" for t in title_variants(title)]


def catalog_lookup(catalog: Sequence[Mapping]) -> dict[str, int]:
    """Map every way a rating can name an item to its catalogue ``idx``.

    Keys: the IMDb id, ``ml:<id>``, ``tmdb:<id>`` and title keys. An earlier (more
    popular) row wins a title-key collision.
    """
    lookup: dict[str, int] = {}
    for row in catalog:
        idx = row["idx"]
        lookup[row["imdb_id"]] = idx
        if row.get("ml_id") is not None:
            lookup[f"{ML_PREFIX}{row['ml_id']}"] = idx
        if row.get("tmdb_id") is not None:
            lookup.setdefault(f"{TMDB_PREFIX}{row['tmdb_id']}", idx)
        for key in title_keys(row["title"], row.get("year")):
            lookup.setdefault(key, idx)
    return lookup


def _rating_idx(rating: Rating, lookup: Mapping[str, int]) -> int | None:
    """The catalogue ``idx`` a rating names, or ``None``.

    An id is authoritative (#12): a rating with an IMDb, ``ml:`` or ``tmdb:`` id
    matches by its ids (``item_id``, then each of ``alt_ids``, #15) or not at all, never
    by a same-title row. Only a rating without one (Letterboxd) is matched by title and
    year.
    """
    ids = [rating.item_id or "", *rating.alt_ids]
    for i in ids:
        if i in lookup:
            return lookup[i]
    if any(_CATALOGUE_ID.match(i) for i in ids):
        return None
    if rating.title:
        for key in title_keys(*split_title_year(rating.title)):
            if key in lookup:
                return lookup[key]
    return None


def count_matched(catalog: Sequence[Mapping], ratings: Iterable) -> tuple[int, int]:
    """``(matched, total)``: how many of ``ratings`` name a catalogue item, counting
    repeats, as the Node CLI's ``note: <matched> of <total> ratings matched``."""
    lookup = catalog_lookup(catalog)
    found = [_rating_idx(r, lookup) is not None for r in map(as_rating, ratings)]
    return sum(found), len(found)


def resolve_ratings(
    catalog: Sequence[Mapping], ratings: Iterable
) -> list[tuple[int, Rating]]:
    """Pair each rating with its catalogue ``idx``, dropping the ones not found.

    A later rating of the same item replaces an earlier one.
    """
    lookup = catalog_lookup(catalog)
    resolved: dict[int, Rating] = {}
    for rating in map(as_rating, ratings):
        idx = _rating_idx(rating, lookup)
        if idx is not None:
            resolved.pop(idx, None)
            resolved[idx] = rating
    return list(resolved.items())


def like_threshold(
    scores: Sequence[float],
    *,
    min_n: int = DFLT.min_ratings_for_median,
    fallback: float = DFLT.like_threshold,
) -> float:
    """The user's median score, or ``fallback`` when they have fewer than ``min_n``.

    >>> like_threshold([90, 50, 70, 80, 60])
    70
    >>> like_threshold([90, 50])
    70.0
    """
    if len(scores) < min_n:
        return fallback
    return statistics.median(scores)
