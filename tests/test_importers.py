import pytest

from flickpick.importers import (
    detect_format,
    parse_flickpick,
    parse_imdb,
    parse_letterboxd,
    parse_movielens,
    parse_ratings,
)
from flickpick.ratings import Rating, resolve_ratings

LETTERBOXD = """Date,Name,Year,Letterboxd URI,Rating
2024-01-02,Se7en,1995,https://boxd.it/abc,4.5
2024-01-03,The Matrix,1999,https://boxd.it/def,3
"""
IMDB = """Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Year
tt0114369,9,2024-01-02,Se7en,https://www.imdb.com/title/tt0114369/,Movie,8.6,1995
tt0133093,7,2024-01-03,The Matrix,https://www.imdb.com/title/tt0133093/,Movie,8.7,1999
"""
MOVIELENS = """userId,movieId,rating,timestamp
1,47,4.5,964982703
1,2571,3.5,964981247
"""
FLICKPICK = """movie_id,imdb_id,tmdb_id,rating,average_rating,title
47,114369,807,95,81.88,Se7en (1995)
2571,tt0133093,603,70,84.0,"Matrix, The (1999)"
"""


@pytest.mark.parametrize(
    "text, fmt",
    [
        (LETTERBOXD, "letterboxd"),
        (IMDB, "imdb"),
        (MOVIELENS, "movielens"),
        (FLICKPICK, "flickpick"),
    ],
)
def test_detect_format(text, fmt):
    assert detect_format(text) == fmt
    assert detect_format("﻿" + text) == fmt


#: the four header variants the contract names (docs/core-contract.md, Importers); the
#: TypeScript importers test uses the same four
HEADER_VARIANTS = [
    (
        "Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,Se7en,1995,u,4.5\n",
        "letterboxd",
    ),
    ("Date,Name,Year,Rating\n2024-01-02,Se7en,1995,4.5\n", "letterboxd"),
    ("userId,movieId,rating,timestamp\n1,47,4.5,964982703\n", "movielens"),
    ("movieId,rating\n47,4.5\n", "movielens"),
]


@pytest.mark.parametrize("text, fmt", HEADER_VARIANTS)
def test_detect_format_header_variants(text, fmt):
    assert detect_format(text) == fmt
    assert (
        detect_format(text.replace("Rating", "RATING").replace("rating", "Rating"))
        == fmt
    )
    (r,) = parse_ratings(text)
    assert r.score == 90.0
    assert (r.title, r.item_id) == (
        ("Se7en (1995)", "") if fmt == "letterboxd" else (None, "ml:47")
    )


def test_movielens_multi_user_needs_user_id():
    text = "userId,movieId,rating\n1,47,4.5\n2,50,3\n"
    with pytest.raises(ValueError, match="2 users"):
        parse_movielens(text)
    assert [r.item_id for r in parse_movielens(text, user_id=2)] == ["ml:50"]


def test_detect_format_unknown():
    with pytest.raises(ValueError, match="Unrecognised ratings CSV header"):
        detect_format("a,b\n1,2\n")


def test_letterboxd():
    r = parse_letterboxd(LETTERBOXD)
    assert [(x.score, x.title, x.rated_at) for x in r] == [
        (90.0, "Se7en (1995)", "2024-01-02"),
        (60.0, "The Matrix (1999)", "2024-01-03"),
    ]


def test_imdb():
    r = parse_imdb(IMDB)
    assert [(x.item_id, x.score) for x in r] == [
        ("tt0114369", 90.0),
        ("tt0133093", 70.0),
    ]


def test_movielens():
    r = parse_movielens(MOVIELENS)
    assert [(x.item_id, x.score) for x in r] == [("ml:47", 90.0), ("ml:2571", 70.0)]
    assert r[0].rated_at == "2000-07-30T18:45:03+00:00"
    two_users = MOVIELENS + "2,1,5,964981247\n"
    with pytest.raises(ValueError, match="user_id"):
        parse_movielens(two_users)
    assert len(parse_movielens(two_users, user_id=2)) == 1


def test_flickpick():
    r = parse_flickpick(FLICKPICK)
    assert r == [
        Rating("tt0114369", 95.0, None, "Se7en (1995)"),
        Rating("tt0133093", 70.0, None, "Matrix, The (1999)"),
    ]


def test_parse_ratings_dispatches():
    assert parse_ratings(IMDB) == parse_imdb(IMDB)
    assert parse_ratings(IMDB, format="imdb") == parse_imdb(IMDB)


def test_every_format_resolves_to_the_same_items():
    catalog = [
        {
            "idx": 0,
            "imdb_id": "tt0133093",
            "tmdb_id": 603,
            "ml_id": 2571,
            "title": "The Matrix",
            "year": 1999,
        },
        {
            "idx": 1,
            "imdb_id": "tt0114369",
            "tmdb_id": 807,
            "ml_id": 47,
            "title": "Seven (a.k.a. Se7en)",
            "year": 1995,
        },
    ]
    for text in (LETTERBOXD, IMDB, MOVIELENS, FLICKPICK):
        resolved = resolve_ratings(catalog, parse_ratings(text))
        assert sorted(idx for idx, _ in resolved) == [0, 1], text


@pytest.mark.parametrize(
    "text",
    [
        "Date,Name,Year,Letterboxd URI,Rating\n2020-01-01,Heat,1995,u,7\n",
        "Const,Your Rating,Title,Year\ntt0114369,11,Se7en,1995\n",
        "movie_id,imdb_id,tmdb_id,rating,average_rating,title\n47,114369,807,150,1,X\n",
        "movie_id,imdb_id,tmdb_id,rating,average_rating,title\n47,114369,807,-5,1,X\n",
    ],
)
def test_out_of_scale_ratings_are_rejected(text):
    with pytest.raises(ValueError, match="outside the 0-100 scale"):
        parse_ratings(text)


def test_padded_header_and_upper_case_imdb_id():
    assert parse_ratings("Const, Your Rating\nTT0114369,9\n") == [
        Rating(item_id="tt0114369", score=90.0)
    ]


def test_bom_crlf_and_quoted_fields():
    text = (
        "﻿Date,Name,Year,Letterboxd URI,Rating\r\n"
        '2020-01-01,"Crouching Tiger, Hidden Dragon",2000,u,4.5\r\n'
    )
    [r] = parse_ratings(text)
    assert (r.score, r.title) == (90.0, "Crouching Tiger, Hidden Dragon (2000)")
