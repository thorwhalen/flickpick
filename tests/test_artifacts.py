import json

import numpy as np
import pytest

from flickpick.artifacts import (
    CF,
    ArtifactFormatError,
    Artifacts,
    mk_manifest,
    read_artifacts,
    validate_artifacts,
    write_artifacts,
)
from flickpick.embedding import embedding_spec, l2_normalise


def _row(idx, **kw):
    return {
        "idx": idx,
        "imdb_id": f"tt{idx:07d}",
        "tmdb_id": None,
        "ml_id": idx,
        "qid": None,
        "title": f"Film {idx}",
        "year": 2000 + idx,
        "genres": ["Drama"],
        "n_ratings": 10 - idx,
        "mean_rating": 70.0,
        "semantic_text": "x",
        **kw,
    }


def _synthetic(n=3, dim=4, with_embeddings=True):
    rng = np.random.default_rng(0)
    emb = l2_normalise(rng.normal(size=(n, dim))) if with_embeddings else None
    return Artifacts(
        manifest=mk_manifest(
            name="synthetic",
            n_items=n,
            sources=[],
            cf={"method": "ease", "topk": 2},
            embedding=embedding_spec(dim=dim) if with_embeddings else None,
        ),
        catalog=[_row(i) for i in range(n)],
        cf=CF(np.array([0, 2, 3, 3]), np.array([1, 2, 0]), np.array([0.5, 0.25, 0.1])),
        embeddings=emb,
    )


@pytest.mark.parametrize("with_embeddings", [True, False])
def test_round_trip(tmp_path, with_embeddings):
    a = _synthetic(with_embeddings=with_embeddings)
    write_artifacts(a, tmp_path)
    b = read_artifacts(tmp_path)
    assert b.catalog == a.catalog
    assert b.cf.indptr.dtype == np.int32 and b.cf.values.dtype == np.float32
    np.testing.assert_array_equal(b.cf.indptr, a.cf.indptr)
    np.testing.assert_array_equal(b.cf.indices, a.cf.indices)
    np.testing.assert_allclose(b.cf.values, a.cf.values)
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["files"]["cf_indptr"] == {
        "path": "cf_indptr.i32",
        "dtype": "int32",
        "shape": [4],
    }
    if with_embeddings:
        np.testing.assert_allclose(b.embeddings, a.embeddings)
        assert manifest["files"]["embeddings"]["shape"] == [3, 4]
    else:
        assert b.embeddings is None and "embeddings" not in manifest["files"]
        assert not (tmp_path / "embeddings.f32").exists()


def test_binary_layout_is_little_endian_headerless(tmp_path):
    write_artifacts(_synthetic(), tmp_path)
    raw = (tmp_path / "cf_indptr.i32").read_bytes()
    assert raw == np.array([0, 2, 3, 3], dtype="<i4").tobytes()


def test_shape_mismatch_is_reported(tmp_path):
    write_artifacts(_synthetic(), tmp_path)
    (tmp_path / "cf_values.f32").write_bytes(np.zeros(2, dtype="<f4").tobytes())
    with pytest.raises(ArtifactFormatError, match="cf_values"):
        read_artifacts(tmp_path)


def test_bad_indptr_rejected(tmp_path):
    a = _synthetic()
    a.cf = CF(np.array([0, 2, 3]), a.cf.indices, a.cf.values)
    with pytest.raises(ArtifactFormatError, match="cf_indptr"):
        write_artifacts(a, tmp_path)


def test_missing_dir_says_how_to_build(tmp_path):
    with pytest.raises(FileNotFoundError, match="flickpick build"):
        read_artifacts(tmp_path / "nope")


def test_fixture_is_valid_and_small(small, paths):
    FIXTURE_DIR = paths["fixture_dir"]
    assert small.n_items == 600
    assert small.manifest["cf"]["topk"] == 50
    assert small.embeddings.shape == (600, 384)
    np.testing.assert_allclose(np.linalg.norm(small.embeddings, axis=1), 1, atol=1e-5)
    # rows sorted by descending weight, positive, no diagonal
    for i in range(small.n_items):
        lo, hi = small.cf.indptr[i], small.cf.indptr[i + 1]
        vals = small.cf.values[lo:hi]
        assert np.all(np.diff(vals) <= 0) and np.all(vals > 0)
        assert i not in small.cf.indices[lo:hi]
    total = sum(p.stat().st_size for p in FIXTURE_DIR.iterdir())
    assert total < 2_000_000
    assert (FIXTURE_DIR / "LICENSE-DATA.md").is_file()


def test_indptr_must_start_at_zero(tmp_path):
    # the TypeScript reader rejects this; the Python one must too
    a = _synthetic()
    a.cf = CF(np.array([1, 2, 3, 3]), np.array([1, 2, 0]), np.array([0.5, 0.25, 0.1]))
    with pytest.raises(ArtifactFormatError, match=r"cf_indptr\[0\] must be 0"):
        validate_artifacts(a)
