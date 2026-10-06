"""Sentence embeddings of catalogue text and of mood queries.

The model is fixed per artifact set (``manifest["embedding"]["model"]``, by default
``BAAI/bge-small-en-v1.5``, 384-d). Encoding goes through the in-house ``ef`` package's
sentence-transformers adapter when ``ef`` is importable, else through
``sentence-transformers`` directly; either way it needs the optional ``[embed]`` extra
(``pip install 'flickpick[embed]'``). Vectors are always returned L2-normalised float32.
"""

from collections.abc import Callable, Sequence
from functools import lru_cache

import numpy as np

from flickpick.defaults import DFLT

INSTALL_HINT = (
    "Embeddings need sentence-transformers: pip install 'flickpick[embed]' "
    "(or build with --no-embeddings)."
)


def l2_normalise(x: np.ndarray) -> np.ndarray:
    """Rows of ``x`` scaled to unit L2 norm (zero rows stay zero), as float32."""
    x = np.asarray(x, dtype=np.float32)
    norms = np.linalg.norm(x, axis=-1, keepdims=True)
    return (x / np.where(norms == 0, 1, norms)).astype(np.float32)


@lru_cache(maxsize=4)
def get_encoder(
    model: str = DFLT.embedding_model, *, batch_size: int = DFLT.embed_batch_size
) -> Callable[[Sequence[str]], np.ndarray]:
    """A batch text encoder ``texts -> array(n, dim)`` for ``model`` (cached)."""
    try:
        import ef

        return ef.sentence_transformers_embedder(
            model, normalize=True, batch_size=batch_size
        )
    except ImportError:
        pass
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise ImportError(INSTALL_HINT) from exc
    st = SentenceTransformer(model)

    def encode(texts):
        return st.encode(
            list(texts),
            batch_size=batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

    return encode


def embed_texts(
    texts: Sequence[str], *, model: str = DFLT.embedding_model, prefix: str = ""
) -> np.ndarray:
    """L2-normalised float32 embeddings of ``prefix + text`` for each text."""
    encoder = get_encoder(model)
    return l2_normalise(encoder([prefix + t for t in texts]))


def embedding_spec(
    *,
    model: str = DFLT.embedding_model,
    dim: int = DFLT.embedding_dim,
    query_prefix: str = DFLT.query_prefix,
) -> dict:
    """The manifest ``embedding`` entry for vectors of ``semantic_text``."""
    return {
        "model": model,
        "dim": int(dim),
        "dtype": "float32",
        "query_prefix": query_prefix,
        "text_field": "semantic_text",
    }
