"""The build pipeline: MovieLens tables -> catalogue, sparse EASE matrix, embeddings.

``build_artifacts`` is pure (tables in, ``Artifacts`` out; the only side effect is
running the embedding model). ``tools.build`` adds the download and the write.

The CF set is the ``n_items`` most-rated films that have an IMDb id; ``idx`` orders them
by rating count (descending, ties by MovieLens id). EASE is trained on ratings at or
above ``like_threshold`` (on the 0-100 scale; 70 = 3.5 stars), binarised.
"""

import re
from collections.abc import Callable

import numpy as np
import pandas as pd
from scipy import sparse

from flickpick.artifacts import Artifacts, mk_manifest
from flickpick.data import MovieLens, movielens_source
from flickpick.defaults import DFLT, STARS_TO_100
from flickpick.ease import ease_dense, sparsify_topk
from flickpick.embedding import embed_texts, embedding_spec
from flickpick.ratings import imdb_id, split_title_year

NO_GENRES = "(no genres listed)"
GENRE_SEP = "|"
TEXT_SEP = ", "
MEAN_RATING_DECIMALS = 2
_TRAILING_ARTICLE = re.compile(r"^(.*), (The|A|An)$")
_PARENTHETICAL_SPLIT = re.compile(r"(\s*\([^()]*\))")


def _front_article(text: str) -> str:
    m = _TRAILING_ARTICLE.match(text.strip())
    return f"{m.group(2)} {m.group(1)}" if m else text.strip()


def clean_title(ml_title: str) -> tuple[str, int | None]:
    """MovieLens ``"Matrix, The (1999)"`` -> ``("The Matrix", 1999)``.

    Parenthesised alternate titles are kept (they help match other services' titles),
    with their articles moved to the front too.

    >>> clean_title('Seven (a.k.a. Se7en) (1995)')
    ('Seven (a.k.a. Se7en)', 1995)
    >>> clean_title('Shawshank Redemption, The (1994)')
    ('The Shawshank Redemption', 1994)
    """
    title, year = split_title_year(ml_title)
    parts = _PARENTHETICAL_SPLIT.split(title)
    head, rest = parts[0], parts[1:]
    rest = [
        re.sub(r"\(([^()]*)\)", lambda m: f"({_front_article(m.group(1))})", p)
        for p in rest
    ]
    return _front_article(head) + "".join(rest), year


def parse_genres(text) -> list[str]:
    """``"Action|Sci-Fi"`` -> ``["Action", "Sci-Fi"]``; ``"(no genres listed)"`` -> []."""
    if text is None or pd.isna(text) or text == NO_GENRES:
        return []
    return [g for g in str(text).split(GENRE_SEP) if g]


def _optional_int(x):
    return None if x is None or pd.isna(x) else int(x)


def select_items(ml: MovieLens, *, n_items: int) -> pd.DataFrame:
    """One row per CF item (movieId, imdbId, tmdbId, title, genres, n_ratings, mean)."""
    stats = ml.ratings.groupby("movieId")["rating"].agg(n_ratings="size", mean="mean")
    items = (
        stats.join(ml.links.set_index("movieId"), how="inner")
        .join(ml.movies.set_index("movieId"), how="inner")
        .dropna(subset=["imdbId"])
        .reset_index()
        .sort_values(["n_ratings", "movieId"], ascending=[False, True])
    )
    items = items.drop_duplicates(subset="imdbId", keep="first")
    return items.head(n_items).reset_index(drop=True)


def movie_tags(tags: pd.DataFrame, *, max_tags: int = DFLT.max_tags) -> dict[int, list]:
    """movieId -> its distinct user tags (lower-cased), most applied first."""
    t = tags.assign(tag=tags["tag"].astype(str).str.strip().str.lower())
    t = t[t["tag"] != ""]
    counts = t.groupby(["movieId", "tag"]).size().reset_index(name="n")
    counts = counts.sort_values(["movieId", "n", "tag"], ascending=[True, False, True])
    return {
        int(mid): list(g["tag"].head(max_tags))
        for mid, g in counts.groupby("movieId", sort=False)
    }


def catalog_rows(items: pd.DataFrame, tags_by_movie: dict) -> list[dict]:
    """Catalogue rows (``docs/artifact-format.md``) in ``idx`` order."""
    rows = []
    for idx, it in enumerate(items.itertuples(index=False)):
        title, year = clean_title(str(it.title))
        genres = parse_genres(it.genres)
        tags = tags_by_movie.get(int(it.movieId), [])
        rows.append(
            {
                "idx": idx,
                "imdb_id": imdb_id(int(it.imdbId)),
                "tmdb_id": _optional_int(it.tmdbId),
                "ml_id": int(it.movieId),
                "qid": None,
                "title": title,
                "year": year,
                "genres": genres,
                "n_ratings": int(it.n_ratings),
                "mean_rating": round(
                    float(it.mean) * STARS_TO_100, MEAN_RATING_DECIMALS
                ),
                "semantic_text": TEXT_SEP.join([title, *genres, *tags]),
            }
        )
    return rows


def like_matrix(
    ratings: pd.DataFrame, movie_ids, *, like_threshold: float = DFLT.like_threshold
) -> sparse.csr_matrix:
    """Binary users x items matrix of likes, columns in the order of ``movie_ids``."""
    col = pd.Series(np.arange(len(movie_ids)), index=np.asarray(movie_ids))
    liked = ratings[ratings["rating"] * STARS_TO_100 >= like_threshold]
    liked = liked[liked["movieId"].isin(col.index)]
    users, user_codes = np.unique(liked["userId"].to_numpy(), return_inverse=True)
    cols = col.loc[liked["movieId"].to_numpy()].to_numpy()
    data = np.ones(len(cols), dtype=np.float64)
    return sparse.csr_matrix(
        (data, (user_codes, cols)), shape=(len(users), len(movie_ids))
    )


def build_artifacts(
    ml: MovieLens,
    *,
    n_items: int = DFLT.n_items,
    topk: int = DFLT.topk,
    lam: float = DFLT.ease_lambda,
    like_threshold: float = DFLT.like_threshold,
    embeddings: bool = True,
    embedding_model: str = DFLT.embedding_model,
    embed: Callable | None = None,
    max_tags: int = DFLT.max_tags,
) -> Artifacts:
    """Build an in-memory artifact set from MovieLens tables.

    ``embed`` (texts -> L2-normalised float32 array) replaces the default encoder,
    which is ``embed_texts`` with ``embedding_model``.
    """
    items = select_items(ml, n_items=n_items)
    catalog = catalog_rows(items, movie_tags(ml.tags, max_tags=max_tags))
    X = like_matrix(ml.ratings, items["movieId"], like_threshold=like_threshold)
    cf = sparsify_topk(ease_dense(X, lam=lam), topk=topk)
    spec, vectors = None, None
    if embeddings:
        embed = embed or (lambda texts: embed_texts(texts, model=embedding_model))
        vectors = np.asarray(
            embed([r["semantic_text"] for r in catalog]), dtype=np.float32
        )
        spec = embedding_spec(model=embedding_model, dim=vectors.shape[1])
    manifest = mk_manifest(
        name=f"flickpick-{ml.name}-{len(catalog)}",
        n_items=len(catalog),
        sources=[movielens_source(ml.name)],
        cf={
            "method": "ease",
            "topk": int(topk),
            "lambda": float(lam),
            "n_train_users": int(X.shape[0]),
            "n_train_ratings": int(X.nnz),
            "like_threshold": float(like_threshold),
        },
        embedding=spec,
    )
    return Artifacts(manifest=manifest, catalog=catalog, cf=cf, embeddings=vectors)
