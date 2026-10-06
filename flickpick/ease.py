"""EASE (Steck 2019): a closed-form linear item-item model, sparsified to top-k.

Given a binary user x item matrix X:

    G = X^T X + lambda I;   P = G^-1;   B = -P / diag(P) (column-wise);   diag(B) = 0

A user's score vector is then ``x B``. ``B`` is dense, so each source row keeps only its
``topk`` largest positive weights (the recsys report, section 3, measured 98% of dense
NDCG@100 at top-100 on MovieLens 32M). Rows of the result are source items, columns
target items, and each row's entries are sorted by descending weight, which is the
order ``docs/artifact-format.md`` requires.
"""

import numpy as np
from scipy import sparse

from flickpick.artifacts import CF
from flickpick.defaults import DFLT

#: rows processed at a time when sparsifying a dense B (bounds peak memory)
SPARSIFY_CHUNK_ROWS = 1024


def most_rated_items(X, *, n_items: int = DFLT.n_items) -> np.ndarray:
    """Column indices of the ``n_items`` columns of ``X`` with most nonzeros.

    Ties are broken by column index, so the result is deterministic.
    """
    counts = np.asarray((sparse.csc_matrix(X) != 0).sum(axis=0)).ravel()
    order = np.lexsort((np.arange(len(counts)), -counts))
    return order[:n_items]


def ease_dense(X, *, lam: float = DFLT.ease_lambda, dtype=np.float64) -> np.ndarray:
    """The dense EASE weight matrix B for a (sparse or dense) binary matrix X."""
    if lam <= 0:
        raise ValueError(f"lam must be positive (it makes G invertible), got {lam}")
    X = sparse.csr_matrix(X, dtype=dtype)
    G = (X.T @ X).toarray()
    G[np.diag_indices_from(G)] += lam
    del X
    B = np.linalg.inv(G)  # P; turned into B in place to keep one n x n array alive
    del G
    B /= -np.diag(B).copy()
    B[np.diag_indices_from(B)] = 0.0
    return B


def sparsify_topk(B: np.ndarray, *, topk: int = DFLT.topk) -> CF:
    """Keep each row's ``topk`` largest positive weights, sorted descending, as CSR."""
    n_rows, n_cols = B.shape
    kk = min(topk, n_cols)
    indptr = np.zeros(n_rows + 1, dtype=np.int64)
    rows_idx, rows_val = [], []
    for start in range(0, n_rows, SPARSIFY_CHUNK_ROWS):
        chunk = B[start : start + SPARSIFY_CHUNK_ROWS]
        top = (
            np.argpartition(-chunk, kk - 1, axis=1)[:, :kk]
            if kk < n_cols
            else (np.tile(np.arange(n_cols), (len(chunk), 1)))
        )
        vals = np.take_along_axis(chunk, top, axis=1)
        order = np.lexsort((top, -vals), axis=1)
        top = np.take_along_axis(top, order, axis=1)
        vals = np.take_along_axis(vals, order, axis=1)
        for r in range(len(chunk)):
            keep = vals[r] > 0
            rows_idx.append(top[r][keep])
            rows_val.append(vals[r][keep])
            indptr[start + r + 1] = keep.sum()
    np.cumsum(indptr, out=indptr)
    concat = np.concatenate if rows_idx else (lambda _: np.zeros(0))
    return CF(
        indptr=indptr.astype(np.int32),
        indices=concat(rows_idx).astype(np.int32),
        values=concat(rows_val).astype(np.float32),
    )


def fit_ease(
    X,
    *,
    lam: float = DFLT.ease_lambda,
    topk: int = DFLT.topk,
    n_items: int | None = DFLT.n_items,
) -> tuple[CF, np.ndarray]:
    """Fit sparse EASE on X restricted to its ``n_items`` most-rated columns (None: all).

    Returns ``(cf, item_cols)``: the CSR matrix over the kept items, and the original
    column index of each kept item (row ``r`` of ``cf`` is column ``item_cols[r]``).
    """
    X = sparse.csr_matrix(X)
    cols = (
        np.arange(X.shape[1])
        if n_items is None
        else most_rated_items(X, n_items=n_items)
    )
    B = ease_dense(X[:, cols], lam=lam)
    return sparsify_topk(B, topk=topk), cols
