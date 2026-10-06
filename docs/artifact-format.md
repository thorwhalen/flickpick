# Artifact format (v1)

*The contract between the Python build pipeline (writer) and the TypeScript core and Python scorer (readers). Versioned by `manifest.json`. Any change here is a new `format_version`.*

An **artifact set** is one directory (or one URL base) holding the files below. All binary files are little-endian, row-major, no header; their shapes are in the manifest. Item order is the same in every file: the row index `idx` is the key that joins them.

| File | Type | Content |
|---|---|---|
| `manifest.json` | JSON | `format_version` (1), `built_at` (ISO), `name`, `n_items`, `sources` (list of `{name, version, licence, url}`), `cf` (`{method: "ease", topk, lambda, n_train_users, n_train_ratings, like_threshold}`), `embedding` (`{model, dim, dtype: "float32", query_prefix: "", text_field: "semantic_text"}` or `null` when absent), `files` (name → `{path, dtype, shape}`) |
| `catalog.json` | JSON array, one object per item, in `idx` order | `idx` (int), `imdb_id` (string, `tt0114369`; the canonical item id in v1), `tmdb_id` (int or null), `ml_id` (int or null, MovieLens movieId), `qid` (string or null, Wikidata), `title`, `year` (int or null), `genres` (string[]), `n_ratings` (int, population count), `mean_rating` (float 0-100, population mean on the canonical scale), `semantic_text` (string; v1: tags and genres joined; later: plot + vibe profile) |
| `cf_indptr.i32` | Int32[n_items+1] | CSR row pointers of the sparsified EASE item-item matrix B (rows = source item, columns = target item) |
| `cf_indices.i32` | Int32[nnz] | column indices, per row sorted by descending weight |
| `cf_values.f32` | Float32[nnz] | weights B[row, col]; the diagonal is zero and absent |
| `embeddings.f32` | Float32[n_items × dim] | L2-normalised sentence embeddings of `semantic_text`; absent when `manifest.embedding` is null |

**Ratings scale.** Everything the scorer sees is on the canonical 0-100 scale (the scale of the example file and of Criticker). Importers convert: Letterboxd and MovieLens stars ×20, IMDb ×10.

**Scoring an EASE artifact.** For a user with liked set L (items scored at or above the user's own median, or ≥ `like_threshold` when they have fewer than 5 ratings), the CF score of item j is `s_j = Σ_{i∈L} B[i, j]`, i.e. the sum of the rows of the liked items. Rated items are excluded from the output. The contributing items with the largest `B[i, j]` are the explanation ("because you liked …").

**Semantic score.** `cos(q, e_j)` with q the L2-normalised embedding of `query_prefix + query_text` from the model in `manifest.embedding`.

**Sizes (v1 defaults).** `topk = 100`, which puts a 10k-item artifact near 4 MB of CF files plus 15 MB of float32 embeddings at dim 384. int8 embeddings are the known next step and will be `format_version` 2.

**Licensing.** The artifact set is data, not code: its `sources` carry the licences (MovieLens: research, non-commercial, share-alike on transformations; Wikipedia: CC BY-SA 4.0), and the set must not be committed to this repository except as the small test fixture under `tests/fixtures/` built from MovieLens `ml-latest-small`.
