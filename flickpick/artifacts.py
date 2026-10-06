"""Write and read an artifact set as specified in ``docs/artifact-format.md``.

An artifact set is one directory: ``manifest.json``, ``catalog.json``, the sparse EASE
matrix as three CSR arrays (``cf_indptr.i32``, ``cf_indices.i32``, ``cf_values.f32``)
and, optionally, ``embeddings.f32``. Binaries are little-endian, row-major, headerless;
their shapes are recorded in ``manifest["files"]`` and checked on read.

>>> import numpy as np, tempfile
>>> rows = [{**dict.fromkeys(CATALOG_FIELDS), 'idx': i, 'imdb_id': f'tt000000{i}',
...          'title': f'Film {i}', 'genres': [], 'n_ratings': 1} for i in range(2)]
>>> a = Artifacts(
...     manifest=mk_manifest(name='toy', n_items=2, sources=[], cf={'method': 'ease'}),
...     catalog=rows,
...     cf=CF(np.array([0, 1, 1]), np.array([1]), np.array([0.5])),
... )
>>> d = tempfile.mkdtemp()
>>> _ = write_artifacts(a, d)
>>> read_artifacts(d).cf.values.tolist()
[0.5]
"""

import json
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import cached_property
from pathlib import Path

import numpy as np

FORMAT_VERSION = 1
MANIFEST_FILE = "manifest.json"
CATALOG_FILE = "catalog.json"

#: name in ``manifest["files"]`` -> (file name, numpy little-endian dtype, dtype label)
BINARY_FILES = {
    "cf_indptr": ("cf_indptr.i32", "<i4", "int32"),
    "cf_indices": ("cf_indices.i32", "<i4", "int32"),
    "cf_values": ("cf_values.f32", "<f4", "float32"),
    "embeddings": ("embeddings.f32", "<f4", "float32"),
}

CATALOG_FIELDS = (
    "idx",
    "imdb_id",
    "tmdb_id",
    "ml_id",
    "qid",
    "title",
    "year",
    "genres",
    "n_ratings",
    "mean_rating",
    "semantic_text",
)


class ArtifactFormatError(ValueError):
    """An artifact set does not match ``docs/artifact-format.md``."""


@dataclass
class CF:
    """The sparsified EASE item-item matrix B in CSR form (rows = source items)."""

    indptr: np.ndarray
    indices: np.ndarray
    values: np.ndarray

    def to_scipy(self, n_items: int):
        """The same matrix as a ``scipy.sparse.csr_matrix`` of shape (n, n)."""
        from scipy.sparse import csr_matrix

        return csr_matrix(
            (self.values, self.indices, self.indptr), shape=(n_items, n_items)
        )


@dataclass
class Artifacts:
    """One loaded artifact set: manifest, catalogue, CF matrix, optional embeddings."""

    manifest: dict
    catalog: list[dict]
    cf: CF
    embeddings: np.ndarray | None = field(default=None)

    @property
    def n_items(self) -> int:
        """Number of items (rows of every file)."""
        return len(self.catalog)

    @cached_property
    def n_ratings(self) -> np.ndarray:
        """Population rating counts, as an array in ``idx`` order."""
        return np.array([row["n_ratings"] for row in self.catalog], dtype=np.int64)

    @cached_property
    def imdb_to_idx(self) -> dict[str, int]:
        """IMDb id -> row index."""
        return {row["imdb_id"]: row["idx"] for row in self.catalog}


def mk_manifest(
    *,
    name: str,
    n_items: int,
    sources: list[dict],
    cf: dict,
    embedding: dict | None = None,
    built_at: str | None = None,
) -> dict:
    """A manifest without ``files`` (``write_artifacts`` fills that in)."""
    return {
        "format_version": FORMAT_VERSION,
        "built_at": built_at
        or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "name": name,
        "n_items": int(n_items),
        "sources": list(sources),
        "cf": dict(cf),
        "embedding": None if embedding is None else dict(embedding),
    }


def _binary_arrays(a: Artifacts) -> dict[str, np.ndarray]:
    arrays = {
        "cf_indptr": a.cf.indptr,
        "cf_indices": a.cf.indices,
        "cf_values": a.cf.values,
    }
    if a.embeddings is not None:
        arrays["embeddings"] = a.embeddings
    return arrays


def validate_artifacts(a: Artifacts) -> Artifacts:
    """Raise ``ArtifactFormatError`` unless every shape and the catalogue agree."""
    m, n = a.manifest, a.n_items

    def check(ok, msg):
        if not ok:
            raise ArtifactFormatError(msg)

    check(
        m.get("format_version") == FORMAT_VERSION,
        f"format_version is {m.get('format_version')!r}; this reader supports "
        f"{FORMAT_VERSION}",
    )
    check(
        m.get("n_items") == n,
        f"manifest n_items={m.get('n_items')} but the catalogue has {n} rows",
    )
    check(
        [row.get("idx") for row in a.catalog] == list(range(n)),
        "catalogue rows must be in idx order with idx = 0..n_items-1",
    )
    for i, row in enumerate(a.catalog):
        missing = set(CATALOG_FIELDS) - set(row)
        check(not missing, f"catalogue row {i} lacks {sorted(missing)}")
    indptr, indices, values = a.cf.indptr, a.cf.indices, a.cf.values
    check(
        indptr.shape == (n + 1,),
        f"cf_indptr has shape {indptr.shape}, expected ({n + 1},)",
    )
    nnz = int(indptr[-1]) if len(indptr) else 0
    check(
        indices.shape == (nnz,) and values.shape == (nnz,),
        f"cf_indices {indices.shape} and cf_values {values.shape} must both have "
        f"length indptr[-1] = {nnz}",
    )
    check(len(indptr) == 0 or int(indptr[0]) == 0, "cf_indptr[0] must be 0")
    check(bool(np.all(np.diff(indptr) >= 0)), "cf_indptr must be non-decreasing")
    check(
        nnz == 0 or (indices.min() >= 0 and indices.max() < n),
        f"cf_indices must lie in [0, {n})",
    )
    spec = m.get("embedding")
    if spec is None:
        check(a.embeddings is None, "embeddings present but manifest.embedding is null")
    else:
        check(
            a.embeddings is not None,
            "manifest.embedding is set but embeddings are missing",
        )
        expected = (n, int(spec["dim"]))
        check(
            a.embeddings.shape == expected,
            f"embeddings have shape {a.embeddings.shape}, expected {expected}",
        )
    return a


def _write_json(path: Path, obj) -> None:
    path.write_text(
        json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )


def write_artifacts(a: Artifacts, out_dir) -> Path:
    """Write ``a`` to ``out_dir`` (created if needed) and return the directory path.

    The manifest's ``files`` entry is (re)computed from the arrays.
    """
    out = Path(out_dir).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    files = {}
    for name, arr in _binary_arrays(a).items():
        filename, dtype, label = BINARY_FILES[name]
        np.ascontiguousarray(arr, dtype=dtype).tofile(out / filename)
        files[name] = {"path": filename, "dtype": label, "shape": list(arr.shape)}
    manifest = {**a.manifest, "files": files}
    validate_artifacts(Artifacts(manifest, a.catalog, a.cf, a.embeddings))
    _write_json(out / CATALOG_FILE, a.catalog)
    (out / MANIFEST_FILE).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return out


def _read_binary(root: Path, name: str, files: Mapping) -> np.ndarray:
    if name not in files:
        raise ArtifactFormatError(f"manifest.files has no entry {name!r}")
    entry = files[name]
    _, dtype, label = BINARY_FILES[name]
    if entry.get("dtype") != label:
        raise ArtifactFormatError(
            f"{name}: dtype {entry.get('dtype')!r}, expected {label!r}"
        )
    path = root / entry["path"]
    if not path.is_file():
        raise ArtifactFormatError(f"{name}: file not found: {path}")
    arr = np.fromfile(path, dtype=dtype)
    shape = tuple(entry["shape"])
    if arr.size != int(np.prod(shape)):
        raise ArtifactFormatError(
            f"{name}: {arr.size} values on disk but the manifest "
            f"says shape {list(shape)}"
        )
    return arr.reshape(shape).astype(dtype[1:], copy=False)


def read_artifacts(source) -> Artifacts:
    """Load and validate the artifact set in directory ``source``."""
    root = Path(source).expanduser()
    manifest_path = root / MANIFEST_FILE
    if not manifest_path.is_file():
        raise FileNotFoundError(
            f"No {MANIFEST_FILE} in {root}. Build an artifact set first: "
            "python -m flickpick build --sample"
        )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    catalog = json.loads((root / CATALOG_FILE).read_text(encoding="utf-8"))
    files = manifest.get("files", {})
    cf = CF(
        *(
            _read_binary(root, n, files)
            for n in ("cf_indptr", "cf_indices", "cf_values")
        )
    )
    embeddings = None
    if manifest.get("embedding") is not None:
        embeddings = _read_binary(root, "embeddings", files)
    return validate_artifacts(Artifacts(manifest, catalog, cf, embeddings))
