# flickpick.artifacts

Write and read an artifact set as specified in `docs/artifact-format.md`.

An artifact set is one directory: `manifest.json`, `catalog.json`, the sparse EASE
matrix as three CSR arrays (`cf_indptr.i32`, `cf_indices.i32`, `cf_values.f32`)
and, optionally, `embeddings.f32`. Binaries are little-endian, row-major, headerless;
their shapes are recorded in `manifest["files"]` and checked on read.

```pycon
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
```

### Module Attributes

| [`BINARY_FILES`](#flickpick.artifacts.BINARY_FILES)   | name in `manifest["files"]` -> (file name, numpy little-endian dtype, dtype label)   |
|-----------------------------------------------------------------|--------------------------------------------------------------------------------------|

### Functions

| [`mk_manifest`](#flickpick.artifacts.mk_manifest)(\*, name, n_items, sources, cf[, ...])   | A manifest without `files` (`write_artifacts` fills that in).             |
|-------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| [`read_artifacts`](#flickpick.artifacts.read_artifacts)(source)                               | Load and validate the artifact set in directory `source`.                 |
| [`validate_artifacts`](#flickpick.artifacts.validate_artifacts)(a)                                | Raise `ArtifactFormatError` unless every shape and the catalogue agree.   |
| [`write_artifacts`](#flickpick.artifacts.write_artifacts)(a, out_dir)                          | Write `a` to `out_dir` (created if needed) and return the directory path. |

### Classes

| [`Artifacts`](#flickpick.artifacts.Artifacts)(manifest, catalog, cf[, embeddings])   | One loaded artifact set: manifest, catalogue, CF matrix, optional embeddings.   |
|---------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| [`CF`](#flickpick.artifacts.CF)(indptr, indices, values)                      | The sparsified EASE item-item matrix B in CSR form (rows = source items).       |

### Exceptions

| [`ArtifactFormatError`](#flickpick.artifacts.ArtifactFormatError)   | An artifact set does not match `docs/artifact-format.md`.   |
|------------------------------------------------------------------------|-------------------------------------------------------------|

### *exception* flickpick.artifacts.ArtifactFormatError

Bases: [`ValueError`](https://docs.python.org/3/builtins/exceptions.html#ValueError)

An artifact set does not match `docs/artifact-format.md`.

### *class* flickpick.artifacts.Artifacts(manifest, catalog, cf, embeddings=None)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

One loaded artifact set: manifest, catalogue, CF matrix, optional embeddings.

#### *property* imdb_to_idx *: [dict](https://docs.python.org/3/builtins/stdtypes.html#dict)[[str](https://docs.python.org/3/builtins/stdtypes.html#str), [int](https://docs.python.org/3/builtins/functions.html#int)]*

IMDb id -> row index.

#### *property* n_items *: [int](https://docs.python.org/3/builtins/functions.html#int)*

Number of items (rows of every file).

#### *property* n_ratings *: ndarray*

Population rating counts, as an array in `idx` order.

### flickpick.artifacts.BINARY_FILES *= {'cf_indices': ('cf_indices.i32', '<i4', 'int32'), 'cf_indptr': ('cf_indptr.i32', '<i4', 'int32'), 'cf_values': ('cf_values.f32', '<f4', 'float32'), 'embeddings': ('embeddings.f32', '<f4', 'float32')}*

name in `manifest["files"]` -> (file name, numpy little-endian dtype, dtype label)

### *class* flickpick.artifacts.CF(indptr, indices, values)

Bases: [`object`](https://docs.python.org/3/builtins/functions.html#object)

The sparsified EASE item-item matrix B in CSR form (rows = source items).

#### to_scipy(n_items)

The same matrix as a `scipy.sparse.csr_matrix` of shape (n, n).

### flickpick.artifacts.mk_manifest(, name, n_items, sources, cf, embedding=None, built_at=None)

A manifest without `files` (`write_artifacts` fills that in).

* **Return type:**
  [`dict`](https://docs.python.org/3/builtins/stdtypes.html#dict)

### flickpick.artifacts.read_artifacts(source)

Load and validate the artifact set in directory `source`.

* **Return type:**
  [`Artifacts`](#flickpick.artifacts.Artifacts)

### flickpick.artifacts.validate_artifacts(a)

Raise `ArtifactFormatError` unless every shape and the catalogue agree.

* **Return type:**
  [`Artifacts`](#flickpick.artifacts.Artifacts)

### flickpick.artifacts.write_artifacts(a, out_dir)

Write `a` to `out_dir` (created if needed) and return the directory path.

The manifest’s `files` entry is (re)computed from the arrays.

* **Return type:**
  [`Path`](https://docs.python.org/3/library/pathlib.html#pathlib.Path)
