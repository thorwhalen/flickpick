import numpy as np
from scipy import sparse

from flickpick.ease import ease_dense, fit_ease, most_rated_items, sparsify_topk


def _toy():
    # items 0 & 1 are liked together, items 2 & 3 together; item 4 alone, rarely
    rows = [[1, 1, 0, 0, 0]] * 6 + [[0, 0, 1, 1, 0]] * 4 + [[1, 0, 1, 0, 1]]
    return sparse.csr_matrix(np.array(rows, dtype=float))


def test_ease_matches_closed_form():
    X = _toy()
    lam = 2.0
    G = (X.T @ X).toarray() + lam * np.eye(5)
    P = np.linalg.inv(G)
    expected = -P / np.diag(P)
    np.fill_diagonal(expected, 0)
    np.testing.assert_allclose(ease_dense(X, lam=lam), expected)


def test_known_top_neighbours():
    cf, cols = fit_ease(_toy(), lam=1.0, topk=2, n_items=None)
    np.testing.assert_array_equal(cols, np.arange(5))
    top = {i: cf.indices[cf.indptr[i]] for i in range(4)}
    assert top == {0: 1, 1: 0, 2: 3, 3: 2}
    for i in range(5):
        vals = cf.values[cf.indptr[i] : cf.indptr[i + 1]]
        assert len(vals) <= 2 and np.all(vals > 0) and np.all(np.diff(vals) <= 0)
        assert i not in cf.indices[cf.indptr[i] : cf.indptr[i + 1]]


def test_sparsify_keeps_only_positive_sorted():
    B = np.array(
        [[0, 0.2, -0.5, 0.9], [0.1, 0, 0.3, 0.0], [-1, -1, 0, -1], [0.4, 0.4, 0.1, 0]]
    )
    cf = sparsify_topk(B, topk=2)
    assert cf.indptr.tolist() == [0, 2, 4, 4, 6]
    assert cf.indices.tolist() == [3, 1, 2, 0, 0, 1]  # ties broken by column
    np.testing.assert_allclose(cf.values, [0.9, 0.2, 0.3, 0.1, 0.4, 0.4])


def test_most_rated_items_restricts_columns():
    cols = most_rated_items(_toy(), n_items=2)
    assert cols.tolist() == [0, 1]  # 7 and 6 ratings
    X = sparse.csr_matrix(np.array([[1, 1, 1], [0, 1, 1], [1, 0, 1]]))
    assert most_rated_items(X, n_items=2).tolist() == [2, 0]  # tie 0/1 -> by index
    cf, kept = fit_ease(_toy(), lam=1.0, topk=5, n_items=2)
    assert kept.tolist() == [0, 1] and len(cf.indptr) == 3
